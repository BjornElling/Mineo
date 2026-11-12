#!/usr/bin/env node
/**
 * Kontrollerer, at den KØRENDE Node/npm-version er den, projektet erklærer i `package.json` → `engines`.
 *
 * **Hvorfor der er brug for dette ud over `engine-strict` og `devEngines`.** `engine-strict=true` rammer kun
 * installationen, og `devEngines.runtime` får npm til at afvise `npm run` på forkert Node – men ingen af dem
 * kontrollerer npm-versionen ved en almindelig kørsel. Gaten skal enten være kørt på den erklærede toolchain,
 * eller slet ikke være kørt (R0-F01). Lagdelingen er beskrevet i `runtime-requirements.mjs`.
 *
 * `--warn-only` findes bevidst IKKE. En advarsel ville gøre kontrollen til støj, man scroller forbi.
 */
import { satisfiesRange } from './version-range.mjs';
import { readRuntimeRequirements, upgradeInstructions } from './runtime-requirements.mjs';

const requirements = readRuntimeRequirements();

const actual = {
  node: process.versions.node,
  // npm's version leveres af npm selv, når scriptet kaldes gennem `npm run`. Køres scriptet direkte med
  // `node scripts/check-runtime-version.mjs`, findes variablen ikke – da kontrolleres kun Node, og npm
  // rapporteres som ukontrolleret frem for som opfyldt.
  npm: process.env.npm_config_user_agent?.match(/npm\/(\d+\.\d+\.\d+)/)?.[1],
};

const problems = [];

if (!satisfiesRange(actual.node, requirements.node)) {
  problems.push(`Node: kræver ${requirements.node}, kører ${actual.node} (${process.execPath})`);
}

if (actual.npm === undefined) {
  console.warn(
    'check:runtime – npm-versionen kunne ikke læses (scriptet blev ikke kaldt gennem npm). Kun Node er kontrolleret.'
  );
} else if (!satisfiesRange(actual.npm, requirements.npm)) {
  problems.push(`npm: kræver ${requirements.npm}, kører ${actual.npm}`);
}

if (problems.length > 0) {
  console.error('\nRuntime matcher ikke projektets erklærede toolchain:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`\n${upgradeInstructions(requirements)}\n`);
  process.exit(1);
}

console.log(`check:runtime – Node ${actual.node}${actual.npm ? ` / npm ${actual.npm}` : ''} matcher engines.`);
