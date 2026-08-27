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
 * Kontrollen er derfor `verify:release`s FØRSTE trin: enten er hele gaten kørt på den erklærede runtime, eller
 * den er slet ikke kørt.
 *
 * Sandheden er ÉN kilde: `package.json` → `engines`. Scriptet dublerer ikke intervallerne, så en bump af
 * `engines` (eller af `.nvmrc`) kan ikke efterlade kontrollen bagud.
 *
 * **Hvad intervallet dækker, og hvad CI måler (udviklerbeslutning 2026-08-07).** `engines` tillader bevidst
 * et BREDERE Node-interval (`>=24.18.0 <27`), end CI faktisk kører: workflowet henter sin version fra
 * `.nvmrc` (24.18.0), så det er den ene version, der efterprøves ved hver push. Udvidelsen blev truffet,
 * fordi hele toolchainen – fuld vitest-suite, Playwright-e2e, typecheck, lint og build – er verificeret
 * grøn på Node 26.7.0; gaten blokerede altså på en forældet erklæring, ikke på en reel inkompatibilitet.
 *
 * Prisen er, at et grønt LOKALT gate-udfald på Node 25/26 ikke er efterprøvet af CI. Det er en bevidst
 * afvejning, ikke et overset hul: kontrollen her sikrer fortsat, at runtimen ligger inden for det
 * erklærede – men «inden for det erklærede» er nu en bredere påstand end «det CI måler». Skal de to
 * falde sammen igen, er vejen at flytte `.nvmrc` og CI til samme major som udviklingsmaskinerne og
 * snævre intervallet ind igen.
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
