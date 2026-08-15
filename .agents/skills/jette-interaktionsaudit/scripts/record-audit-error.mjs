#!/usr/bin/env node

import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(getOption('--repo') ?? process.cwd());
const targetPath = path.join(repoRoot, 'docs', 'testing', 'runtime-input-audit', 'AUDIT-WORKER-ERRORS.md');

const message = requireOption('--message');
const timestamp = new Date().toISOString();
const entry = [
  `\n## ${timestamp}`,
  `- Type: ${formatField(getOption('--type') ?? 'ukendt')}`,
  `- Fase: ${formatField(getOption('--phase') ?? 'ukendt')}`,
  `- Kommando/handling: ${formatField(getOption('--command') ?? 'ukendt')}`,
  `- Scenarie: ${formatField(getOption('--scenario') ?? 'ukendt')}`,
  `- Browser/viewport: ${formatField(getOption('--browser') ?? 'ukendt')} / ${formatField(getOption('--viewport') ?? 'ukendt')}`,
  `- Kan genoptages: ${formatField(getOption('--recoverable') ?? 'ukendt')}`,
  `- Fejl: ${formatField(message)}`,
  `- Detaljer: ${formatField(getOption('--details') ?? '—')}`,
  '',
].join('\n');

await mkdir(path.dirname(targetPath), { recursive: true });
await appendFile(targetPath, entry, 'utf8');
console.info(`Auditworker-fejl registreret: ${targetPath}`);

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function requireOption(name) {
  const value = getOption(name);
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Påkrævet option mangler: ${name}.`);
  }
  return value.trim();
}

function formatField(value) {
  return String(value)
    .replaceAll('\r', ' ')
    .replaceAll('\n', ' ')
    .replaceAll('`', "'")
    .trim()
    .slice(0, 4000) || '—';
}
