#!/usr/bin/env node
// Coverage-registrenes release-gate. Den kører de tests, der udleder felter/collections direkte fra de levende
// Zod-schemas og sammenholder consumers med faktiske exports/callsites. Dermed kan en statisk JSON-kopi ikke
// få validatoren til at rapportere falsk grønt ved schema- eller entrypointdrift.
//
// **Gaten er permanent, ikke et migrationstrin (R1-F06).** Den blev indført som backstop under draft/commit-
// omlægningen og var beskrevet som noget, der skulle bortfalde bagefter. Den kører nu som del af
// `verify:release`, fordi det, den måler, ikke var midlertidigt: schema-drift og uregistrerede entrypoints er
// stående risici. Fjern den ikke som "fase 0-rest".

import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';

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

/**
 * De testfiler validatoren SKAL køre.
 *
 * `greenfieldPhase0Inventory.test.ts` stod her indtil Fase 6's genåbning – filen var omdøbt til
 * `consumerInventory.test.ts`, men scriptet blev ikke fulgt med. Vitest behandler en ukendt sti som
 * "intet match" frem for en fejl, så `npm run verify:ledgers` rapporterede grønt, mens det kun kørte
 * ÉN af de to filer: schema-drift-snapshottet og consumer-registrene var slet ikke dækket.
 *
 * Derfor er listen nu eksplicit, OG kørslen verificeres mod et forventet antal testfiler. En
 * validator, der kan rapportere grønt uden at have kørt noget, er værre end ingen validator.
 */
const LEDGER_TEST_FILES = [
  'src/__tests__/inputCore/ledger/ledgerCompleteness.test.ts',
  'src/__tests__/quality/consumerInventory.test.ts',
];

/**
 * Gulvet for hvor mange tests kørslen skal indeholde. Sat lige under det aktuelle antal, så en
 * skrumpet eller tom kørsel fejler, men en ny test ikke kræver en opdatering her.
 */
const MINIMUM_LEDGER_TESTS = 15;

for (const testFile of LEDGER_TEST_FILES) {
  if (!existsSync(resolve(root, testFile))) {
    throw new Error(
      `Inventarvalidatorens testfil findes ikke: ${testFile}. `
      + 'En manglende sti ville få vitest til at køre nul tests og rapportere falsk grønt.'
    );
  }
}

const vitest = resolve(root, 'node_modules/vitest/vitest.mjs');
const reportPath = resolve(tmpdir(), `mineo-ledger-report-${process.pid}.json`);
const result = spawnSync(process.execPath, [
  vitest,
  'run',
  '--reporter=default',
  '--reporter=json',
  `--outputFile.json=${reportPath}`,
  ...LEDGER_TEST_FILES,
], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'inherit',
});

if (result.error !== undefined) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

// Bekræft at kørslen faktisk DÆKKEDE begge filer. Uden dette check kan en fremtidig omdøbning igen
// reducere validatoren til en tom, grøn kørsel – præcis den fejl Fase 6's genåbning fandt.
if (!existsSync(reportPath)) {
  throw new Error('Inventarkørslen efterlod ingen JSON-rapport – dækningen kan ikke verificeres.');
}
const report = JSON.parse(readFileSync(reportPath, 'utf8'));
rmSync(reportPath, { force: true });

const ranFiles = (report.testResults ?? []).map((suite) => String(suite.name).replaceAll('\\', '/'));
for (const testFile of LEDGER_TEST_FILES) {
  if (!ranFiles.some((name) => name.endsWith(testFile))) {
    throw new Error(`Inventarvalidatoren kørte ikke ${testFile} – kørslen er ikke dækkende.`);
  }
}
const executedTests = report.numTotalTests ?? 0;
if (executedTests < MINIMUM_LEDGER_TESTS) {
  throw new Error(
    `Inventarvalidatoren kørte kun ${executedTests} tests (forventet mindst ${MINIMUM_LEDGER_TESTS}). `
    + 'En skrumpet kørsel er ikke en grøn kørsel.'
  );
}
process.stdout.write(
  `\nInventarkørsel dækkede ${ranFiles.length} testfiler / ${executedTests} tests\n`
);

process.stdout.write('\nInputregistre – verificeret mod levende kilder\n');
process.stdout.write(`  Datafelter:       ${fieldCount}\n`);
process.stdout.write(`  Collections:      ${collectionCount}\n`);
process.stdout.write(`  Beregninger:      ${calculationCount}\n`);
process.stdout.write(`  Sagsfilstier:     ${caseFileCount}\n`);
process.stdout.write(`  Dokumentoutputs:  ${documentCount}\n`);
process.stdout.write('Inventarvalidator OK.\n\n');
