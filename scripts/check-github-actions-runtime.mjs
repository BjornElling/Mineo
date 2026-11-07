#!/usr/bin/env node
/**
 * Kontrollerer, at alle eksterne GitHub Actions i workflows er kendt for at
 * køre på mindst den understøttede action-runtime.
 *
 * En workflow-action kører i GitHub Runners egen JavaScript-runtime og er
 * derfor ikke dækket af `check-runtime-version.mjs`, som måler den Node/npm
 * der kører projektets egne scripts. En ny eller nedgraderet action skal først
 * registreres med sin dokumenterede runtime, før den kan passere release-gaten.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Actions bruger runnerens egen runtime: setup-node kan installere Node 26 til projektet,
// mens selve actionen fortsat kører på den understøttede Node 24. .nvmrc styrer kun projektet.
const minimumActionNodeMajor = 24;

/**
 * Action-majorer med dokumenteret Node-runtime. Ukendte majorer afvises
 * bevidst, så en fremtidig opdatering ikke ændrer runtime ubemærket.
 */
const actionPolicies = new Map([
  ['actions/checkout', { major: 7, nodeMajor: 24 }],
  ['actions/setup-node', { major: 7, nodeMajor: 24 }],
  ['actions/upload-artifact', { major: 7, nodeMajor: 24 }],
  ['actions/download-artifact', { major: 8, nodeMajor: 24 }],
]);

const validateGitHubActionsRuntime = (repoRoot) => {
  const workflowRoot = join(repoRoot, '.github', 'workflows');
  const workflowFiles = readdirSync(workflowRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => entry.name);

  if (workflowFiles.length === 0) {
    throw new Error('Der findes ingen GitHub Actions-workflows at kontrollere.');
  }

  const problems = [];
  let externalActionCount = 0;

  for (const workflowFile of workflowFiles) {
    const workflowPath = join(workflowRoot, workflowFile);
    const lines = readFileSync(workflowPath, 'utf8').split(/\r?\n/);

    lines.forEach((line, index) => {
      // YAML actions står normalt som listeelementer (`- uses:`). En kontrol, der kun matcher
      // den bare property-form, bliver grøn uden at have læst en eneste action.
      const usesMatch = /^\s*(?:-\s*)?uses:\s*([^\s#]+)/.exec(line);
      if (usesMatch === null) return;

      const reference = usesMatch[1];
      if (reference.startsWith('./') || reference.startsWith('docker://')) return;
      externalActionCount += 1;

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

      if (policy.nodeMajor < minimumActionNodeMajor) {
        problems.push(
          `${workflowFile}:${index + 1}: '${reference}' kører på Node ${policy.nodeMajor}, `
          + `men action-politikken kræver Node ${minimumActionNodeMajor} eller nyere.`
        );
      }
    });
  }

  return { problems, minimumActionNodeMajor, workflowCount: workflowFiles.length, externalActionCount };
};

const main = () => {
  const { problems, minimumActionNodeMajor, workflowCount } = validateGitHubActionsRuntime(defaultRepoRoot);
  if (problems.length > 0) {
    console.error('\nGitHub Actions-runtime matcher ikke action-politikken:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(
      `\nRegistrér kun en action, når dens \`runs.using\` er dokumenteret til Node ${minimumActionNodeMajor} eller nyere.\n`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `check:github-actions-runtime – ${workflowCount} workflow(s) bruger kun godkendte actions med mindst Node ${minimumActionNodeMajor}.`
  );
};

const isMain = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(
      `\nGitHub Actions-runtimekontrollen kunne ikke gennemføres: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  }
}

export { validateGitHubActionsRuntime };
