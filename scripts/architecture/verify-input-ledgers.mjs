#!/usr/bin/env node
// Fase-0-inventarvalidator (§6). Den kører de tests, der udleder felter/collections direkte fra de levende
// Zod-schemas og sammenholder consumers med faktiske exports/callsites. Dermed kan en statisk JSON-kopi ikke
// få validatoren til at rapportere falsk grønt ved schema- eller entrypointdrift.

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const readConstant = (source, name) => {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  if (match === null) throw new Error(`Kunne ikke læse ${name}`);
  return Number(match[1]);
};

const fieldSource = read('src/inputCore/ledger/fieldLedger.ts');
const collectionSource = read('src/inputCore/ledger/collectionLedger.ts');
const consumerSource = read('src/inputCore/ledger/consumerLedger.ts');

const fieldCount = readConstant(fieldSource, 'EXPECTED_FIELD_REF_COUNT');
const collectionCount = readConstant(collectionSource, 'EXPECTED_COLLECTION_COUNT');
const calculationCount = readConstant(consumerSource, 'EXPECTED_BEREGNING_COUNT');
const caseFileCount = readConstant(consumerSource, 'EXPECTED_CASEFILE_COUNT');
const documentCount = readConstant(consumerSource, 'EXPECTED_DOCUMENT_COUNT');

const vitest = resolve(root, 'node_modules/vitest/vitest.mjs');
const result = spawnSync(process.execPath, [
  vitest,
  'run',
  'src/__tests__/inputCore/ledger/ledgerCompleteness.test.ts',
  'src/__tests__/quality/greenfieldPhase0Inventory.test.ts',
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error !== undefined) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

process.stdout.write('\nGreenfield fase-0-inventar — verificeret mod levende kilder\n');
process.stdout.write(`  Datafelter:       ${fieldCount}\n`);
process.stdout.write(`  Collections:      ${collectionCount}\n`);
process.stdout.write(`  Beregninger:      ${calculationCount}\n`);
process.stdout.write(`  Sagsfilstier:     ${caseFileCount}\n`);
process.stdout.write(`  Dokumentoutputs:  ${documentCount}\n`);
process.stdout.write('Inventarvalidator OK.\n\n');
