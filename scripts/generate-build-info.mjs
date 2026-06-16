#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUTPUT_FILE = resolve('.env.build-info.local');
const FALLBACK_VERSION = '0.0.0.dev';
const UNKNOWN = 'ukendt';

const runGit = (args) => {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return undefined;
  }
};

const escapeEnvValue = (value) => JSON.stringify(value);

const formatCommitYearMonth = (commitIsoDate) => {
  const match = commitIsoDate.match(/^(\d{4})-(\d{2})-/);
  return match ? `${match[1]}.${match[2]}` : undefined;
};

const resolveBuildInfo = () => {
  const isGitRepo = runGit(['rev-parse', '--is-inside-work-tree']) === 'true';
  const commit = isGitRepo ? runGit(['rev-parse', 'HEAD']) : undefined;

  if (!isGitRepo || !commit) {
    return {
      version: FALLBACK_VERSION,
      commit: UNKNOWN,
      commitShort: UNKNOWN,
      builtAt: new Date().toISOString(),
    };
  }

  // `%cI` bruger commitens gemte timezone og er derfor stabil på tværs af lokale
  // maskiner og GitHub Actions. `--date=format` ville afhænge af runnerens timezone.
  const commitDate = formatCommitYearMonth(runGit(['log', '-1', '--format=%cI']));
  const commitCount = runGit(['rev-list', '--count', 'HEAD']);
  // `git rev-parse --short=7` returnerer en MINIMUM-længde: git forlænger til den
  // korteste unikke prefiks, så i et stort repo kan resultatet blive 8+ tegn og
  // bryde `hash7`-formatet. Slice derfor altid eksakt 7 tegn fra det fulde hash.
  // 7 tegn matcher den korte hash, som GitHub og VS Code viser.
  const commitShort = commit.slice(0, 7);

  if (!commitDate || !commitCount) {
    return {
      version: FALLBACK_VERSION,
      commit,
      commitShort,
      builtAt: new Date().toISOString(),
    };
  }

  return {
    version: `${commitDate}.${commitCount}.${commitShort}`,
    commit,
    commitShort,
    builtAt: new Date().toISOString(),
  };
};

const buildInfo = resolveBuildInfo();

const content = [
  '# Autogenereret af scripts/generate-build-info.mjs. Commit ikke denne fil.',
  `VITE_APP_VERSION=${escapeEnvValue(buildInfo.version)}`,
  `VITE_APP_COMMIT_HASH=${escapeEnvValue(buildInfo.commit)}`,
  `VITE_APP_COMMIT_SHORT=${escapeEnvValue(buildInfo.commitShort)}`,
  `VITE_APP_BUILT_AT=${escapeEnvValue(buildInfo.builtAt)}`,
  '',
].join('\n');

writeFileSync(OUTPUT_FILE, content, 'utf8');
console.log(`Build-info genereret: ${buildInfo.version}`);
