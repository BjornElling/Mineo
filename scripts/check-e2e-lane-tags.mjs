import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

/**
 * Vagt for E2E-banernes tags.
 *
 * Et tag er den ENESTE måde, en test kan bede om at køre i flere browsere eller viewporter, og
 * Playwright siger ikke fra, hvis taget er stavet forkert: `@browser` i stedet for `@browsere`
 * matcher ingen bane, og testen kører så kun i basisbanen. Resultatet er en grøn suite, der tavst
 * har holdt op med at dække det, taget blev sat for. Vagten fanger netop den forskel.
 *
 * Kilden til gyldige tags er `e2e/support/lanes.ts` — samme fil, som konfigurationen og spec-filerne
 * bruger. Vagten læser dens eksporter frem for at gentage værdierne her.
 *
 * **Arbejdsdelingen med `src/__tests__/quality/e2eSuiteConventions.test.ts`.** Denne vagt er
 * PRÆ-FLIGHT: den kører fra `run-e2e.mjs` før hver eneste E2E-kørsel og skal derfor være billig og
 * afhængighedsfri, så et fejlstavet tag melder sig med det samme frem for efter en kørsel. Den dækker
 * kun stavemåden. De strukturelle E2E-regler — bl.a. at en motorafhængig test faktisk ligger i
 * browserbanen — kræver et AST og bor derfor i vitest-værnet.
 */

const laneModulePath = path.resolve('e2e/support/lanes.ts');
const specDirectory = path.resolve('e2e');

const readLaneTags = () => {
  const source = readFileSync(laneModulePath, 'utf8');
  const tags = new Map();
  for (const match of source.matchAll(/export const (\w+) = '(@[^']+)';/g)) {
    tags.set(match[1], match[2]);
  }
  if (tags.size === 0) {
    throw new Error(`Fandt ingen bane-tags i ${laneModulePath}. Er eksporterne omskrevet?`);
  }
  return tags;
};

const collectSpecFiles = (directory) => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectSpecFiles(entryPath);
    return entry.isFile() && entry.name.endsWith('.spec.ts') ? [entryPath] : [];
  });

const laneTags = readLaneTags();
const knownNames = new Set(laneTags.keys());
const knownValues = new Set(laneTags.values());
const problems = [];

for (const specFile of collectSpecFiles(specDirectory)) {
  const source = readFileSync(specFile, 'utf8');
  const relativePath = path.relative(process.cwd(), specFile);

  // `tag:` optionen kan være en enkelt værdi eller et array, og hver værdi kan være en konstant
  // eller en streng. Begge former læses, så en fejlstavning fanges uanset skrivemåde.
  for (const match of source.matchAll(/\btag:\s*(\[[^\]]*\]|'[^']*'|[A-Za-z_$][\w$]*)/g)) {
    const expression = match[1];
    for (const literal of expression.matchAll(/'([^']*)'/g)) {
      if (!knownValues.has(literal[1])) {
        problems.push(`${relativePath}: ukendt bane-tag '${literal[1]}'.`);
      }
    }
    for (const identifier of expression.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
      if (!knownNames.has(identifier[1])) {
        problems.push(`${relativePath}: ukendt bane-konstant '${identifier[1]}'.`);
      }
    }
  }

  // Et bart `@ord` i en testtitel ligner et tag, men Playwright behandler det som almindelig tekst
  // uden `tag:`-optionen. Den fælde koster den samme tavse manglende dækning.
  for (const match of source.matchAll(/\b(?:test|test\.describe)\(\s*'([^']*@[^']*)'/g)) {
    problems.push(
      `${relativePath}: titlen «${match[1]}» indeholder et @-ord. Brug tag-optionen i stedet.`,
    );
  }
}

if (problems.length > 0) {
  console.error('E2E-banernes tags er ikke i orden:');
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(`\nGyldige tags: ${[...laneTags].map(([name, value]) => `${name} (${value})`).join(', ')}.`);
  process.exit(1);
}

console.log(`E2E-banetags er i orden (${laneTags.size} gyldige tags).`);
