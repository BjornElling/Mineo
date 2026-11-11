#!/usr/bin/env node
/**
 * Kontrollerer, at den KØRENDE Node/npm-version er den, projektet erklærer i `package.json` → `engines`.
 *
 * **Hvorfor der er brug for dette ud over `engine-strict`.** `.npmrc` har `engine-strict=true`, så `npm ci` og
 * `npm install` fejler fail-closed med `EBADENGINE` på en forkert version – det er efterprøvet. Men den kontrol
 * rammer kun INSTALLATIONEN. Kører man `npm run verify:release` på et træ, der allerede er installeret, udfører
 * npm ingen engine-kontrol, og gaten bliver grøn på en runtime, projektet ikke understøtter. Et grønt gate-udfald
 * ville da bære en påstand om den understøttede toolchain, som ingen har målt (R0-F01).
 *
 * Kontrollen er derfor et obligatorisk trin i `verify:release`: enten er gaten kørt på den erklærede runtime, eller
 * den er slet ikke kørt.
 *
 * Sandheden er ÉN kilde: `package.json` → `engines`. Scriptet dublerer ikke intervallerne, så en bump af
 * `engines` (eller af `.nvmrc`) kan ikke efterlade kontrollen bagud.
 *
 * Projektet bruger Node 26 LTS. `.nvmrc` fastlægger den konkrete CI-version, og `engines`
 * tillader efterfølgende rettelser i samme major. CI installerer npm-versionen fra `packageManager`,
 * så lokale kontroller og CI bruger samme hovedversion af begge værktøjer.
 *
 * `--warn-only` findes bevidst IKKE. En advarsel ville gøre kontrollen til støj, man scroller forbi, og det er
 * netop den tilstand, fundet beskriver.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { satisfiesRange } from './version-range.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Læs `engines` fra den ENE kanoniske kilde. */
const readEngines = () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const engines = pkg.engines;
  if (engines === undefined || typeof engines.node !== 'string' || typeof engines.npm !== 'string') {
    throw new Error('package.json → engines mangler node/npm. Kontrollen kan ikke måle mod en tom erklæring.');
  }
  return engines;
};

const engines = readEngines();

const actual = {
  node: process.versions.node,
  // npm's version leveres af npm selv, når scriptet kaldes gennem `npm run`. Køres scriptet direkte med
  // `node scripts/check-runtime-version.mjs`, findes variablen ikke – da kontrolleres kun Node, og npm
  // rapporteres som ukontrolleret frem for som opfyldt.
  npm: process.env.npm_config_user_agent?.match(/npm\/(\d+\.\d+\.\d+)/)?.[1],
};

const problems = [];

if (!satisfiesRange(actual.node, engines.node)) {
  problems.push(`Node: kræver ${engines.node}, kører ${actual.node}`);
}

if (actual.npm === undefined) {
  console.warn(
    'check:runtime – npm-versionen kunne ikke læses (scriptet blev ikke kaldt gennem npm). Kun Node er kontrolleret.'
  );
} else if (!satisfiesRange(actual.npm, engines.npm)) {
  problems.push(`npm: kræver ${engines.npm}, kører ${actual.npm}`);
}

if (problems.length > 0) {
  console.error('\nRuntime matcher ikke projektets erklærede toolchain:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    '\nKør gaten på den erklærede runtime. Versionen står i .nvmrc (og i package.json → engines);'
    + '\nen version manager kan skifte til den med `nvm use` / `fnm use`.'
    + '\n\nEt grønt gate-udfald på en anden runtime ville bære en påstand om den understøttede'
    + '\ntoolchain, som ingen har målt (R0-F01).\n'
  );
  process.exit(1);
}

console.log(`check:runtime – Node ${actual.node}${actual.npm ? ` / npm ${actual.npm}` : ''} matcher engines.`);
