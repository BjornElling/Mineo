#!/usr/bin/env node
/**
 * Vagt for, at hver E2E-spec kan indlæses af Playwright.
 *
 * Playwright indlæser alle spec-filer, før en eneste test kører, og én fil, der ikke kan indlæses,
 * vælter hele kørslen i alle projekter. Fejlklassen er modul-niveau: en import, Node's egen
 * ESM-loader afviser (fx en JSON-import uden `with { type: 'json' }` efter `"type": "module"`), en
 * forkert sti eller en kaster i top-level-kode. Hverken `tsc` eller Vitest ser det, fordi ingen af
 * dem indlæser spec-filerne med Playwrights loader – så uden denne vagt landede fejlen først i
 * E2E-jobbene efter release-gaten (skete 2026-10-12).
 *
 * `playwright test --list` indlæser præcis som en rigtig kørsel, men uden browsere og webserver, og
 * tager få sekunder. Vagten kræver både exitkode 0 og mindst én fundet test, så en tom liste ikke
 * passerer som grøn.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const cliPath = path.resolve('node_modules/@playwright/test/cli.js');
const result = spawnSync(process.execPath, [cliPath, 'test', '--list'], { encoding: 'utf8' });
const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
const totalMatch = /Total: (\d+) tests? in (\d+) files?/.exec(output);
const testCount = totalMatch === null ? 0 : Number.parseInt(totalMatch[1], 10);

if (result.status !== 0 || testCount === 0) {
  const relevant = output
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0 && !/^\s+\[[^\]]+\] › /.test(line));
  console.error('\nE2E-specs kunne ikke indlæses af Playwright:\n');
  for (const line of relevant) console.error(`  ${line}`);
  console.error('');
  process.exitCode = 1;
} else {
  console.log(`check:e2e-load – ${totalMatch[2]} spec-filer indlæst, ${testCount} tests fundet.`);
}
