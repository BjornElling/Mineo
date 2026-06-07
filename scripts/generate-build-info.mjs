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

  const commitDate = runGit(['log', '-1', '--format=%cd', '--date=format:%Y.%m']);
  const commitCount = runGit(['rev-list', '--count', 'HEAD']);
  const commitShort = runGit(['rev-parse', '--short=6', 'HEAD']);

  if (!commitDate || !commitCount || !commitShort) {
    return {
      version: FALLBACK_VERSION,
      commit,
      commitShort: commit.slice(0, 6),
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
