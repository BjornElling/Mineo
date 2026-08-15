#!/usr/bin/env node
/**
 * Kontrollerer, at rodtræets kommandonavne har præcis én ejer, og at agentværktøjernes
 * Playwright-familie holdes uden for projektets egen afhængighedsgraf.
 *
 * Baggrund: `@playwright/cli` og `@playwright/mcp` pinner en anden Playwright-runtime end
 * `@playwright/test`. Da begge familier deklarerer kommandoen `playwright`, kan npm kun hejse
 * den ene til `node_modules/.bin/playwright` — og valget er ikke synligt nogen steder. Ramte
 * slottet CLI/MCP-familien, kørte `npx playwright test` testfilerne med en anden runner-instans
 * end den, filerne importerer, og hver eneste E2E-fil fejlede med «did not expect test.describe()
 * to be called here», før den overhovedet blev kørt.
 *
 * Kontrollen håndhæver derfor to ting, ikke bare den konkrete Playwright-sag:
 *   1. Ingen to top-level pakker må slås om det samme kommandonavn (den generelle årsag).
 *   2. Agentværktøjerne har deres eget manifest og eget node_modules (den strukturelle adskillelse).
 */
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Pakker der leverer agenternes browserværktøj og pinner deres egen Playwright-runtime. */
const AGENT_TOOL_PACKAGES = ['@playwright/cli', '@playwright/mcp'];

/** Manifestet der ejer agentværktøjerne, relativt til repo-roden. */
const AGENT_TOOL_ROOT = join('.agents', 'tools');

/** Playwright-pakkerne der udgør Mineos E2E-motor. De følges altid ad i version. */
const E2E_RUNNER_FAMILY = ['@playwright/test', 'playwright', 'playwright-core'];

/** Kommandoen E2E-suiten kaldes med, og den pakke der skal eje den. */
const E2E_COMMAND = 'playwright';
const E2E_COMMAND_OWNER = '@playwright/test';

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'));

const readOptionalJson = (filePath) => (existsSync(filePath) ? readJson(filePath) : null);

/** Top-level pakker er dem npm hejser til `node_modules/<navn>` — kun de kæmper om `.bin`-slottet. */
const topLevelLockEntries = (lockPackages) => Object.entries(lockPackages)
  .filter(([lockPath]) => /^node_modules\/(@[^/]+\/)?[^/]+$/.test(lockPath))
  .map(([lockPath, entry]) => ({ name: lockPath.slice('node_modules/'.length), entry }));

const lockEntriesForPackage = (lockPackages, packageName) => Object.entries(lockPackages)
  .filter(([lockPath]) => lockPath === `node_modules/${packageName}`
    || lockPath.endsWith(`/node_modules/${packageName}`))
  .map(([lockPath, entry]) => ({ lockPath, version: entry?.version }));

/**
 * Den generelle regel: to top-level pakker må ikke deklarere det samme kommandonavn. npm vælger
 * lydløst en vinder, og den tabende pakkes kommando bliver et andet program end forventet.
 */
const findCommandConflicts = (lockPackages) => {
  const ownersByCommand = new Map();
  for (const { name, entry } of topLevelLockEntries(lockPackages)) {
    if (!isObject(entry?.bin)) continue;
    for (const command of Object.keys(entry.bin)) {
      const owners = ownersByCommand.get(command) ?? [];
      owners.push(`${name}@${entry.version ?? 'ukendt'}`);
      ownersByCommand.set(command, owners);
    }
  }
  return [...ownersByCommand.entries()]
    .filter(([, owners]) => owners.length > 1)
    .map(([command, owners]) => ({ command, owners }));
};

/**
 * Udleder pakkenavnet af en sti ind i node_modules, fx `../@playwright/test/cli.js`
 * → `@playwright/test`. Stien er altid relativ til `.bin`, så pakkenavnet er de første
 * ét eller to segmenter efter de indledende `../`.
 */
const packageNameFromBinTarget = (target) => {
  const segments = target.replace(/\\/g, '/').split('/').filter((segment) => segment !== '' && segment !== '.');
  const start = segments.findIndex((segment) => segment !== '..');
  if (start === -1) return null;
  const first = segments[start];
  if (first === undefined) return null;
  if (first.startsWith('@')) {
    const second = segments[start + 1];
    return second === undefined ? null : `${first}/${second}`;
  }
  return first;
};

/**
 * Læser hvilken pakke npm faktisk har lagt i `.bin`-slottet i det installerede træ.
 *
 * npm bruger to forskellige mekanismer, og kontrollen skal kunne læse dem begge:
 *   - POSIX (bl.a. CI's ubuntu-runner): et ægte symlink, hvis MÅL er pakkestien. Filens
 *     indhold er den pegede-på fil, så det skal læses med readlink — ikke readFileSync,
 *     der følger linket og udleverer selve CLI-kildekoden.
 *   - Windows: en cmd-/sh-shim, dvs. en almindelig fil hvis INDHOLD nævner pakkestien.
 *
 * Kan ejeren ikke afgøres, rapporteres det som `undetermined` frem for som en forkert ejer.
 * Ellers ville en ulæselig shim ligne en ægte konflikt — præcis den fejl, denne kontrol
 * selv fejlede med i CI, hvor symlinket blev læst som «et ukendt sted».
 */
const resolveInstalledCommandOwner = (repoRoot, command) => {
  const binDirectory = join(repoRoot, 'node_modules', '.bin');
  if (!existsSync(binDirectory)) return { present: false, owner: null, undetermined: false };
  const entries = readdirSync(binDirectory);
  const shimName = entries.find((entry) => entry === command)
    ?? entries.find((entry) => entry === `${command}.cmd`);
  if (shimName === undefined) return { present: false, owner: null, undetermined: false };

  const shimPath = join(binDirectory, shimName);
  if (lstatSync(shimPath).isSymbolicLink()) {
    const owner = packageNameFromBinTarget(readlinkSync(shimPath));
    return { present: true, owner, undetermined: owner === null };
  }

  const shim = readFileSync(shimPath, 'utf8');
  const match = /[\\/]\.\.[\\/]((?:@[^\\/"'\s]+[\\/])?[^\\/"'\s]+)[\\/]/.exec(shim.replace(/\\/g, '/'));
  return { present: true, owner: match?.[1] ?? null, undetermined: match === null };
};

const validateToolIsolation = (repoRoot) => {
  const packageJson = readJson(join(repoRoot, 'package.json'));
  const packageLock = readJson(join(repoRoot, 'package-lock.json'));
  const problems = [];

  const lockPackages = packageLock.packages;
  if (!isObject(lockPackages)) {
    problems.push('package-lock.json mangler packages-kortet.');
    return problems;
  }

  for (const { command, owners } of findCommandConflicts(lockPackages)) {
    problems.push(
      `kommandoen '${command}' deklareres af flere top-level pakker (${owners.join(' og ')}); `
      + 'npm kan kun give node_modules/.bin ét program, og valget er lydløst.'
    );
  }

  const declared = { ...packageJson.dependencies, ...packageJson.devDependencies };
  for (const name of AGENT_TOOL_PACKAGES) {
    if (declared[name] !== undefined) {
      problems.push(
        `${name} er deklareret i package.json; agentværktøjerne hører hjemme i ${AGENT_TOOL_ROOT}, `
        + 'fordi de pinner en anden Playwright-runtime end E2E-motoren.'
      );
    }
  }

  const toolManifest = readOptionalJson(join(repoRoot, AGENT_TOOL_ROOT, 'package.json'));
  if (toolManifest === null) {
    problems.push(`${join(AGENT_TOOL_ROOT, 'package.json')} mangler; agentværktøjerne har intet eget manifest at bo i.`);
  } else {
    const toolDeclared = { ...toolManifest.dependencies, ...toolManifest.devDependencies };
    for (const name of AGENT_TOOL_PACKAGES) {
      if (toolDeclared[name] === undefined) {
        problems.push(`${join(AGENT_TOOL_ROOT, 'package.json')} deklarerer ikke ${name}.`);
      }
    }
    if (!existsSync(join(repoRoot, AGENT_TOOL_ROOT, 'package-lock.json'))) {
      problems.push(`${join(AGENT_TOOL_ROOT, 'package-lock.json')} mangler; agentværktøjernes versioner er ikke låst.`);
    }
  }

  const familyVersions = new Map();
  for (const name of E2E_RUNNER_FAMILY) {
    const versions = [...new Set(lockEntriesForPackage(lockPackages, name).map(({ version }) => version))];
    if (versions.length === 0) {
      problems.push(`${name} findes ikke i package-lock.json; E2E-motoren er ikke låst.`);
      continue;
    }
    if (versions.length > 1) {
      problems.push(`${name} er låst i flere udgaver (${versions.join(', ')}); E2E-motoren skal være én version.`);
    }
    familyVersions.set(name, versions);
  }

  const distinctFamilyVersions = [...new Set([...familyVersions.values()].flat())];
  if (familyVersions.size === E2E_RUNNER_FAMILY.length && distinctFamilyVersions.length > 1) {
    problems.push(
      `Playwright-familien følges ikke ad: ${[...familyVersions.entries()]
        .map(([name, versions]) => `${name}=${versions.join('/')}`)
        .join(', ')}.`
    );
  }

  const lockedCommandOwner = topLevelLockEntries(lockPackages)
    .filter(({ entry }) => isObject(entry?.bin) && entry.bin[E2E_COMMAND] !== undefined)
    .map(({ name }) => name);
  if (!lockedCommandOwner.includes(E2E_COMMAND_OWNER)) {
    problems.push(
      `kommandoen '${E2E_COMMAND}' ejes ikke af ${E2E_COMMAND_OWNER} i package-lock.json `
      + `(fandt ${lockedCommandOwner.length === 0 ? 'ingen ejer' : lockedCommandOwner.join(', ')}); `
      + '`npx playwright test` ville ramme en anden runner end den, e2e-filerne importerer.'
    );
  }

  if (!existsSync(join(repoRoot, 'node_modules'))) {
    problems.push('node_modules mangler; kør `npm ci`, før den installerede placering kan kontrolleres.');
  } else {
    const installed = resolveInstalledCommandOwner(repoRoot, E2E_COMMAND);
    if (!installed.present) {
      problems.push(`node_modules/.bin/${E2E_COMMAND} mangler i det installerede træ.`);
    } else if (installed.undetermined) {
      problems.push(
        `node_modules/.bin/${E2E_COMMAND} kunne ikke tydes, så ejeren er ukendt; det er en fejl i `
        + 'denne kontrol, ikke nødvendigvis i afhængighedsgrafen.'
      );
    } else if (installed.owner !== E2E_COMMAND_OWNER) {
      problems.push(
        `node_modules/.bin/${E2E_COMMAND} peger på ${installed.owner} i stedet for `
        + `${E2E_COMMAND_OWNER}; kør \`npm dedupe\`, så slottet igen ejes af E2E-motoren.`
      );
    }
  }

  return problems;
};

const getRepoRoot = () => {
  const repoFlagIndex = process.argv.indexOf('--repo');
  return repoFlagIndex === -1 ? defaultRepoRoot : resolve(process.argv[repoFlagIndex + 1] ?? '');
};

const main = () => {
  const problems = validateToolIsolation(getRepoRoot());
  if (problems.length > 0) {
    console.error('\nAgentværktøj og E2E-motor deler afhængighedsgraf:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error(`\nAgentværktøjerne installeres med \`npm run tools:install\` i ${AGENT_TOOL_ROOT}.\n`);
    process.exitCode = 1;
    return;
  }
  console.log('check:tool-isolation — kommandonavnene har én ejer, og agentværktøjerne bor i deres eget træ.');
};

const isMain = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`\nKontrollen af værktøjsisolationen kunne ikke gennemføres: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export { packageNameFromBinTarget, resolveInstalledCommandOwner, validateToolIsolation };
