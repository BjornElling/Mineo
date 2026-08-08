#!/usr/bin/env node

import { constants } from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(process.argv[2] ?? process.cwd());
const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetDir = path.join(repoRoot, 'docs', 'testing', 'runtime-input-audit');

const documents = [
  ['STATUS.template.md', 'STATUS.md'],
  ['CRASHES.template.md', 'CRASHES.md'],
  ['OBSERVATIONS.template.md', 'OBSERVATIONS.md'],
  ['QUESTIONS.template.md', 'QUESTIONS.md'],
];

await mkdir(targetDir, { recursive: true });
await mkdir(path.join(repoRoot, 'test-results', 'runtime-input-audit'), { recursive: true });

for (const [templateName, targetName] of documents) {
  const source = path.join(skillRoot, 'assets', templateName);
  const target = path.join(targetDir, targetName);

  try {
    await copyFile(source, target, constants.COPYFILE_EXCL);
    console.info(`Oprettet: ${target}`);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      console.info(`Bevaret eksisterende: ${target}`);
      continue;
    }
    throw error;
  }
}
