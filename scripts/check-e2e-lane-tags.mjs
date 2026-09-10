import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Vagt for E2E-banernes tags.
 *
 * Et tag er den ENESTE måde, en test kan bede om at køre i flere browsere eller viewporter, og
 * Playwright siger ikke fra, hvis taget er stavet forkert: `@browser` i stedet for `@browsere`
 * matcher ingen bane, og testen kører så kun i basisbanen. Resultatet er en grøn suite, der tavst
 * har holdt op med at dække det, taget blev sat for. Vagten fanger netop den forskel.
 *
 * Kilden til gyldige tags er `e2e/support/lanes.ts` – samme fil, som konfigurationen og spec-filerne
 * bruger. Vagten læser dens eksporter frem for at gentage værdierne her.
 *
 * **Arbejdsdelingen med `src/__tests__/quality/e2eSuiteConventions.test.ts`.** Denne vagt er
 * PRÆ-FLIGHT: den kører fra `run-e2e.mjs` før hver eneste E2E-kørsel og skal derfor være billig og
 * afhængighedsfri, så et fejlstavet tag melder sig med det samme frem for efter en kørsel. Den dækker
 * kun stavemåden. De strukturelle E2E-regler – bl.a. at en motorafhængig test faktisk ligger i
 * browserbanen – kræver et AST og bor derfor i vitest-værnet.
 */

const laneModulePath = path.resolve('e2e/support/lanes.ts');
const specDirectory = path.resolve('e2e');

const isIdentifierStart = (character) => /[A-Za-z_$]/.test(character);
const isIdentifierPart = (character) => /[A-Za-z0-9_$]/.test(character);

/**
 * Læser netop den del af JavaScript-syntaksen, vagten har brug for.
 *
 * En rå regex kan finde `tag:` inde i kommentarer, strengindhold og testtitler. Det giver både
 * falske fund og en falsk tryghed, hvis syntaksen ændres til dobbeltcitationstegn. Tokenizeren
 * springer kommentarer og template literals over, men bevarer almindelige strenge som tokens, så
 * en faktisk `tag`-option stadig kan valideres uden en ny parser-dependency.
 */
const tokenize = (source) => {
  const tokens = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];

    if (/\s/.test(character)) {
      index += 1;
      continue;
    }

    if (character === '/' && source[index + 1] === '/') {
      index += 2;
      while (index < source.length && source[index] !== '\n') index += 1;
      continue;
    }

    if (character === '/' && source[index + 1] === '*') {
      index += 2;
      while (index < source.length && !(source[index] === '*' && source[index + 1] === '/')) {
        index += 1;
      }
      index = Math.min(source.length, index + 2);
      continue;
    }

    if (character === '`') {
      index += 1;
      while (index < source.length) {
        if (source[index] === '\\') {
          index += 2;
          continue;
        }
        if (source[index] === '`') {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (character === "'" || character === '"') {
      const quote = character;
      let value = '';
      index += 1;

      while (index < source.length) {
        const current = source[index];
        if (current === '\\') {
          const escaped = source[index + 1];
          if (escaped === undefined) {
            index += 1;
            break;
          }
          value += escaped;
          index += 2;
          continue;
        }
        if (current === quote) {
          index += 1;
          break;
        }
        value += current;
        index += 1;
      }

      tokens.push({ type: 'string', value });
      continue;
    }

    if (isIdentifierStart(character)) {
      const start = index;
      index += 1;
      while (index < source.length && isIdentifierPart(source[index])) index += 1;
      tokens.push({ type: 'identifier', value: source.slice(start, index) });
      continue;
    }

    tokens.push({ type: 'punctuation', value: character });
    index += 1;
  }

  return tokens;
};

const readLaneTags = () => {
  const source = readFileSync(laneModulePath, 'utf8');
  const tokens = tokenize(source);
  const tags = new Map();

  for (let index = 0; index + 4 < tokens.length; index += 1) {
    const declaration = tokens.slice(index, index + 5);
    if (
      declaration[0].type === 'identifier'
      && declaration[0].value === 'export'
      && declaration[1].type === 'identifier'
      && declaration[1].value === 'const'
      && declaration[2].type === 'identifier'
      && declaration[3].value === '='
      && declaration[4].type === 'string'
    ) {
      tags.set(declaration[2].value, declaration[4].value);
    }
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

const isTagProperty = (tokens, index) => {
  const previous = tokens[index - 1];
  return previous === undefined || previous.value === '{' || previous.value === ',';
};

/** Finder værdierne i en faktisk `tag:`-option – inklusive flade og nestede arrays. */
const readTagOptionValues = (source) => {
  const tokens = tokenize(source);
  const values = [];

  for (let index = 0; index + 2 < tokens.length; index += 1) {
    const property = tokens[index];
    if (
      property.type !== 'identifier'
      || property.value !== 'tag'
      || tokens[index + 1].value !== ':'
      || !isTagProperty(tokens, index)
    ) {
      continue;
    }

    const expression = tokens[index + 2];
    if (expression.type === 'string' || expression.type === 'identifier') {
      values.push(expression);
      continue;
    }

    if (expression.value !== '[') continue;

    let depth = 0;
    for (let cursor = index + 2; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor];
      if (token.value === '[') {
        depth += 1;
        continue;
      }
      if (token.value === ']') {
        depth -= 1;
        if (depth === 0) break;
        continue;
      }
      if (token.type === 'string' || token.type === 'identifier') values.push(token);
    }
  }

  return values;
};

/** Finder faktiske test/test.describe-kald, så @-ord i kommentarer og strengindhold ikke rammes. */
const readTaggedTestTitles = (source) => {
  const tokens = tokenize(source);
  const titles = [];

  for (let index = 0; index + 1 < tokens.length; index += 1) {
    if (tokens[index].type !== 'identifier' || tokens[index].value !== 'test') continue;

    let openParenthesis = index + 1;
    if (
      tokens[index + 1].value === '.'
      && tokens[index + 2]?.type === 'identifier'
      && tokens[index + 2].value === 'describe'
    ) {
      openParenthesis = index + 3;
    }

    if (tokens[openParenthesis]?.value !== '(') continue;
    const title = tokens[openParenthesis + 1];
    if (title?.type === 'string' && title.value.includes('@')) titles.push(title.value);
  }

  return titles;
};

const inspectSpecSource = (source, relativePath, laneTags) => {
  const knownNames = new Set(laneTags.keys());
  const knownValues = new Set(laneTags.values());
  const problems = [];

  // `tag:` optionen kan være en enkelt værdi eller et array, og hver værdi kan være en konstant
  // eller en streng. Begge former læses, så en fejlstavning fanges uanset skrivemåde.
  for (const value of readTagOptionValues(source)) {
    if (value.type === 'string' && !knownValues.has(value.value)) {
      problems.push(`${relativePath}: ukendt bane-tag '${value.value}'.`);
    }
    if (value.type === 'identifier' && !knownNames.has(value.value)) {
      problems.push(`${relativePath}: ukendt bane-konstant '${value.value}'.`);
    }
  }

  // Et bart `@ord` i en testtitel ligner et tag, men Playwright behandler det som almindelig tekst
  // uden `tag:`-optionen. Den fælde koster den samme tavse manglende dækning.
  for (const title of readTaggedTestTitles(source)) {
    problems.push(
      `${relativePath}: titlen «${title}» indeholder et @-ord. Brug tag-optionen i stedet.`,
    );
  }
  return problems;
};

export { inspectSpecSource, readTagOptionValues, readTaggedTestTitles };

const main = () => {
  const laneTags = readLaneTags();
  const problems = [];

  for (const specFile of collectSpecFiles(specDirectory)) {
    const source = readFileSync(specFile, 'utf8');
    const relativePath = path.relative(process.cwd(), specFile);
    problems.push(...inspectSpecSource(source, relativePath, laneTags));
  }

  if (problems.length > 0) {
    console.error('E2E-banernes tags er ikke i orden:');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`\nGyldige tags: ${[...laneTags].map(([name, value]) => `${name} (${value})`).join(', ')}.`);
    process.exit(1);
  }

  console.log(`E2E-banetags er i orden (${laneTags.size} gyldige tags).`);
};

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
