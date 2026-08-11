import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();

const getTrackedFiles = () => {
  const output = execFileSync('git', ['ls-files'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
};

const getDeletedTrackedFiles = () => {
  const deleted = new Set();
  for (const args of [
    ['diff', '--name-only', '--diff-filter=D'],
    ['diff', '--cached', '--name-only', '--diff-filter=D'],
  ]) {
    const output = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).forEach((file) => deleted.add(file));
  }
  return deleted;
};

const findActualPath = (relativePath) => {
  const segments = relativePath.split('/');
  let currentPath = repoRoot;
  const actualSegments = [];

  for (const segment of segments) {
    let entries;

    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return { status: 'missing' };
    }

    const match = entries.find((entry) => entry.name.toLowerCase() === segment.toLowerCase());

    if (!match) {
      return { status: 'missing' };
    }

    actualSegments.push(match.name);
    currentPath = path.join(currentPath, match.name);
  }

  return {
    status: 'ok',
    actualPath: actualSegments.join('/'),
  };
};

// En fil, der bevidst er slettet i den aktuelle working tree, er korrekt fraværende. Gate'en skal
// derfor ikke gøre en legitim deletion umulig, før næste commit har fjernet stien fra Git-indexet.
const deletedTrackedFiles = getDeletedTrackedFiles();
const mismatches = getTrackedFiles()
  .filter((trackedPath) => !deletedTrackedFiles.has(trackedPath))
  .map((trackedPath) => {
    const resolved = findActualPath(trackedPath);

    if (resolved.status === 'missing') {
      return {
        trackedPath,
        issue: 'missing',
      };
    }

    if (resolved.actualPath !== trackedPath) {
      return {
        trackedPath,
        actualPath: resolved.actualPath,
        issue: 'case-mismatch',
      };
    }

    return null;
  })
  .filter(Boolean);

if (mismatches.length === 0) {
  console.log('Filnavns-casing stemmer mellem Git og filsystem.');
  process.exit(0);
}

console.error('Git tracker filer med en anden casing end filsystemet:');

for (const mismatch of mismatches) {
  if (mismatch.issue === 'missing') {
    console.error(`- Mangler på disk: ${mismatch.trackedPath}`);
    continue;
  }

  console.error(`- Git: ${mismatch.trackedPath}`);
  console.error(`  Disk: ${mismatch.actualPath}`);
}

process.exit(1);
