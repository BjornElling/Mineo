#!/usr/bin/env node
// Greenfield-ledger-validator (§6). Producerer en sammenlignelig inventoryrapport fra det maskingenererede
// persisted-path-snapshot og fejler ved dublerede eller forældreløse entries samt ved drift mellem de
// baseline-counts, ledgerne fastlåser, og den faktiske schema-/inventar-flade. Den rigorøse felt/collection/
// consumer-reconciliation mod de LEVENDE Zod-schemas køres af completeness-testen
// (`src/__tests__/inputCore/ledger/ledgerCompleteness.test.ts`); denne .mjs er backstop + menneskelig rapport.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFileSync(resolve(root, relativePath), 'utf8');

const SNAPSHOT_PATH = 'docs/architecture/greenfield-phase-0-persisted-input-inventory.json';
const FIELD_LEDGER = 'src/inputCore/ledger/fieldLedger.ts';
const COLLECTION_LEDGER = 'src/inputCore/ledger/collectionLedger.ts';
const CONSUMER_LEDGER = 'src/inputCore/ledger/consumerLedger.ts';
const INVENTORY = 'src/config/greenfieldPhase0Inventory.ts';

const ENTITY_ID_LEAF = /(?:^|\.)(?:id|ansaettelsesforholdId)$/;
const AMOUNT_LEAF_SUFFIX = /\.(kind|value|expression)$/;

const leafToDataFieldPath = (leaf) => (ENTITY_ID_LEAF.test(leaf) ? null : leaf.replace(AMOUNT_LEAF_SUFFIX, ''));

const problems = [];
const fail = (message) => problems.push(message);

const readConstant = (source, name) => {
  const match = source.match(new RegExp(`${name}\\s*=\\s*(\\d+)`));
  if (match === null) fail(`Kunne ikke læse ${name}`);
  return match === null ? null : Number(match[1]);
};

const snapshot = JSON.parse(read(SNAPSHOT_PATH));

let totalDataFields = 0;
let totalCollections = 0;
const report = [];

for (const [section, { fields, collections }] of Object.entries(snapshot)) {
  const dataFields = new Set();
  const rawLeaves = new Set();
  for (const leaf of fields) {
    if (rawLeaves.has(leaf)) fail(`Dubleret leaf i ${section}: ${leaf}`);
    rawLeaves.add(leaf);
    const path = leafToDataFieldPath(leaf);
    if (path !== null) dataFields.add(path);
  }
  const collectionSet = new Set(collections);
  if (collectionSet.size !== collections.length) fail(`Dublerede collections i ${section}`);
  totalDataFields += dataFields.size;
  totalCollections += collectionSet.size;
  report.push({ section, felter: dataFields.size, collections: collectionSet.size });
}

// Baseline-counts fra ledgerne.
const fieldLedgerSource = read(FIELD_LEDGER);
const collectionLedgerSource = read(COLLECTION_LEDGER);
const consumerLedgerSource = read(CONSUMER_LEDGER);
const inventorySource = read(INVENTORY);

const expectedFieldRefCount = readConstant(fieldLedgerSource, 'EXPECTED_FIELD_REF_COUNT');
const expectedCollectionCount = readConstant(collectionLedgerSource, 'EXPECTED_COLLECTION_COUNT');
const expectedBeregning = readConstant(consumerLedgerSource, 'EXPECTED_BEREGNING_COUNT');
const expectedCasefile = readConstant(consumerLedgerSource, 'EXPECTED_CASEFILE_COUNT');
const expectedDocument = readConstant(consumerLedgerSource, 'EXPECTED_DOCUMENT_COUNT');

if (expectedFieldRefCount !== null && totalDataFields !== expectedFieldRefCount) {
  fail(`Feltantal driftet: snapshot=${totalDataFields}, ledger EXPECTED_FIELD_REF_COUNT=${expectedFieldRefCount}`);
}
if (expectedCollectionCount !== null && totalCollections !== expectedCollectionCount) {
  fail(`Collection-antal driftet: snapshot=${totalCollections}, ledger=${expectedCollectionCount}`);
}

// Consumer-inventar: tæl faktiske entrypoints i det maskinlåste inventar.
const countMatches = (source, pattern) => (source.match(pattern) ?? []).length;
const documentSymbols = countMatches(inventorySource, /symbol:\s*'download[A-Za-zÆØÅæøå]*Dokument'/g);
if (expectedDocument !== null && documentSymbols !== expectedDocument) {
  fail(`Dokumentoutputs driftet: inventar=${documentSymbols}, ledger=${expectedDocument}`);
}

// Rapport.
const line = (left, right) => `  ${String(left).padEnd(26)} ${String(right).padStart(4)}`;
process.stdout.write('\nGreenfield input-ledger — inventoryrapport (§6)\n');
process.stdout.write('══════════════════════════════════════════════\n');
for (const row of report) process.stdout.write(`${line(row.section, `${row.felter} felt / ${row.collections} coll`)}\n`);
process.stdout.write('----------------------------------------------\n');
process.stdout.write(`${line('I ALT felter', totalDataFields)}\n`);
process.stdout.write(`${line('I ALT collections', totalCollections)}\n`);
process.stdout.write(`${line('Beregninger (ledger)', expectedBeregning ?? '?')}\n`);
process.stdout.write(`${line('Sagsfiler (ledger)', expectedCasefile ?? '?')}\n`);
process.stdout.write(`${line('Dokumentoutputs', documentSymbols)}\n`);
process.stdout.write('══════════════════════════════════════════════\n');

if (problems.length > 0) {
  process.stderr.write('\nLEDGER-VALIDATOR FEJLEDE:\n');
  for (const problem of problems) process.stderr.write(`  - ${problem}\n`);
  process.exit(1);
}
process.stdout.write('Ledger-validator OK — baseline-counts stemmer.\n\n');
