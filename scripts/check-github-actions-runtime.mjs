#!/usr/bin/env node
/**
 * Kontrollerer, at alle eksterne GitHub Actions i workflows er kendt for at
 * køre på mindst projektets Node-major-version.
 *
 * En workflow-action kører i GitHub Runners egen JavaScript-runtime og er
 * derfor ikke dækket af `check-runtime-version.mjs`, som måler den Node/npm
 * der kører projektets egne scripts. Denne kontrol holder de to runtime-flader
 * samlet: en ny eller nedgraderet action skal først registreres med sin
 * dokumenterede runtime, før den kan passere release-gaten.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const workflowRoot = join(repoRoot, '.github', 'workflows');

/**
 * Action-majorer med dokumenteret Node-runtime. Ukendte majorer afvises
 * bevidst, så en fremtidig opdatering ikke ændrer runtime ubemærket.
 */
const actionPolicies = new Map([
  ['actions/checkout', { major: 6, nodeMajor: 24 }],
  ['actions/setup-node', { major: 6, nodeMajor: 24 }],
  ['actions/upload-artifact', { major: 6, nodeMajor: 24 }],
  ['actions/download-artifact', { major: 7, nodeMajor: 24 }],
  ['cloudflare/wrangler-action', { major: 4, nodeMajor: 24 }],
]);

const readProjectNodeMajor = () => {
  const rawVersion = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim();
  const match = /^v?(\d+)(?:\.\d+){0,2}$/.exec(rawVersion);
  if (match === null) {
    throw new Error(`.nvmrc indeholder ikke en entydig Node-version: '${rawVersion}'.`);
  }
  return Number.parseInt(match[1], 10);
};

const workflowFiles = readdirSync(workflowRoot, { withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
  .map((entry) => entry.name);

if (workflowFiles.length === 0) {
  throw new Error('Der findes ingen GitHub Actions-workflows at kontrollere.');
}

const projectNodeMajor = readProjectNodeMajor();
const problems = [];

for (const workflowFile of workflowFiles) {
  const workflowPath = join(workflowRoot, workflowFile);
  const lines = readFileSync(workflowPath, 'utf8').split(/\r?\n/);

  lines.forEach((line, index) => {
    const usesMatch = /^\s*uses:\s*([^\s#]+)/.exec(line);
    if (usesMatch === null) return;

    const reference = usesMatch[1];
    if (reference.startsWith('./') || reference.startsWith('docker://')) return;

    const actionMatch = /^([^@]+)@(.+)$/.exec(reference);
    if (actionMatch === null) {
      problems.push(`${workflowFile}:${index + 1}: '${reference}' mangler en entydig action-reference.`);
      return;
    }

    const [, actionName, actionVersion] = actionMatch;
    const policy = actionPolicies.get(actionName);
    if (policy === undefined) {
      problems.push(
        `${workflowFile}:${index + 1}: '${actionName}' er ikke registreret med en dokumenteret Node-runtime.`
      );
      return;
    }

    const versionMatch = /^v(\d+)(?:\.\d+(?:\.\d+)?)?$/.exec(actionVersion);
    if (versionMatch === null || Number.parseInt(versionMatch[1], 10) !== policy.major) {
      problems.push(
        `${workflowFile}:${index + 1}: '${reference}' er ikke den godkendte major v${policy.major}; `
        + 'opdatér action-politikken efter kontrol af dens Node-runtime.'
      );
      return;
    }

    if (policy.nodeMajor < projectNodeMajor) {
      problems.push(
        `${workflowFile}:${index + 1}: '${reference}' kører på Node ${policy.nodeMajor}, `
        + `men projektet kræver Node ${projectNodeMajor} eller nyere.`
      );
    }
  });
}

if (problems.length > 0) {
  console.error('\nGitHub Actions-runtime matcher ikke projektets Node-version:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nRegistrér kun en action, når dens `runs.using` er dokumenteret til projektets Node-version eller nyere.\n'
  );
  process.exit(1);
}

console.log(
  `check:github-actions-runtime — ${workflowFiles.length} workflow(s) bruger kun godkendte Node ${projectNodeMajor}-actions.`
);
