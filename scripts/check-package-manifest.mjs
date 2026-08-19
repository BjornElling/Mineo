#!/usr/bin/env node
/**
 * Kontrollerer, at npm-manifestet og den låste installation beskriver samme
 * projekt, og at projektets eksplicitte install-script-allowlist stadig passer
 * til de versioner npm faktisk har låst.
 *
 * `npm ci --dry-run` ligger foran denne kontrol i npm-scriptet. Den er npm's
 * egen resolver-kontrol; dette script kontrollerer de ekstra projektregler,
 * som npm ikke kan kende, især `.nvmrc` og `allowScripts`.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { satisfiesRange } from './version-range.mjs';

const defaultRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lockedRootFields = [
  'name',
  'version',
  'license',
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
  'engines',
];

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)])
  );
};

const isEqual = (left, right) => JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));

const readJson = (repoRoot, fileName) => JSON.parse(readFileSync(join(repoRoot, fileName), 'utf8'));

const readExactVersion = (repoRoot, fileName) => {
  const value = readFileSync(join(repoRoot, fileName), 'utf8').trim();
  if (!/^v?\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${fileName} skal indeholde én fuld version, men indeholder '${value}'.`);
  }
  return value;
};

const packageNameFromLockPath = (lockPath) => {
  const marker = 'node_modules/';
  const markerIndex = lockPath.lastIndexOf(marker);
  return markerIndex === -1 ? null : lockPath.slice(markerIndex + marker.length);
};

const readPackageManagerVersion = (packageManager) => {
  if (typeof packageManager !== 'string') return null;
  const match = /^npm@(\d+\.\d+\.\d+)$/.exec(packageManager);
  return match?.[1] ?? null;
};

const validatePackageManifest = (repoRoot) => {
  const packageJson = readJson(repoRoot, 'package.json');
  const packageLock = readJson(repoRoot, 'package-lock.json');
  const lockRoot = packageLock.packages?.[''];
  const problems = [];

  if (packageLock.lockfileVersion !== 3) {
    problems.push(`package-lock.json bruger lockfileVersion ${packageLock.lockfileVersion}; forventede 3.`);
  }
  if (packageLock.requires !== true) {
    problems.push('package-lock.json mangler den forventede requires=true-markering.');
  }
  if (!isObject(lockRoot)) {
    problems.push('package-lock.json mangler packages[""] for projektets root-manifest.');
  } else {
    for (const field of lockedRootFields) {
      if (!isEqual(packageJson[field], lockRoot[field])) {
        problems.push(`package-lock.json → root.${field} stemmer ikke med package.json.`);
      }
    }
  }

  const engines = packageJson.engines;
  if (!isObject(engines) || typeof engines.node !== 'string' || typeof engines.npm !== 'string') {
    problems.push('package.json → engines skal angive både node og npm.');
  } else {
    try {
      const ciNode = readExactVersion(repoRoot, '.nvmrc');
      if (!satisfiesRange(ciNode, engines.node)) {
        problems.push(`.nvmrc (${ciNode}) ligger uden for package.json → engines.node (${engines.node}).`);
      }
    } catch (error) {
      problems.push(error instanceof Error ? error.message : String(error));
    }

    const packageManagerVersion = readPackageManagerVersion(packageJson.packageManager);
    if (packageManagerVersion === null) {
      problems.push('package.json → packageManager skal være npm@X.Y.Z.');
    } else if (!satisfiesRange(packageManagerVersion, engines.npm)) {
      problems.push(
        `packageManager (${packageManagerVersion}) ligger uden for package.json → engines.npm (${engines.npm}).`
      );
    }
  }

  const lockPackages = packageLock.packages;
  if (!isObject(lockPackages)) {
    problems.push('package-lock.json mangler packages-kortet.');
  } else {
    // Platformafhængige optionalDependencies (fx fsevents) kan have install-scripts,
    // uden at de skal tillades på alle platforme. Ikke-optionelle scriptpakker skal
    // derimod altid stå i allowScripts; en ny sådan package må ikke snige sig ind
    // gennem en dependency-opdatering uden en bevidst vurdering.
    const expectedRequiredAllowScripts = new Set();
    for (const [lockPath, lockEntry] of Object.entries(lockPackages)) {
      if (lockPath === '' || !isObject(lockEntry) || lockEntry.hasInstallScript !== true || lockEntry.optional === true) {
        continue;
      }
      const packageName = packageNameFromLockPath(lockPath);
      if (packageName !== null && typeof lockEntry.version === 'string' && lockEntry.optional !== true) {
        expectedRequiredAllowScripts.add(`${packageName}@${lockEntry.version}`);
      }
    }

    const allowScripts = packageJson.allowScripts;
    if (!isObject(allowScripts)) {
      problems.push('package.json mangler allowScripts-kortet.');
    } else {
      const actualAllowScripts = new Set();
      for (const [packageAtVersion, allowed] of Object.entries(allowScripts)) {
        if (allowed !== true) {
          problems.push(`allowScripts.${packageAtVersion} skal have værdien true.`);
          continue;
        }
        actualAllowScripts.add(packageAtVersion);
        const match = /^(.+)@([^@]+)$/.exec(packageAtVersion);
        const packageName = match?.[1];
        const expectedVersion = match?.[2];
        const lockEntry = packageName === undefined ? undefined : lockPackages[`node_modules/${packageName}`];
        if (!isObject(lockEntry)) {
          problems.push(`allowScripts.${packageAtVersion} findes ikke som top-level package i package-lock.json.`);
        } else if (lockEntry.version !== expectedVersion) {
          problems.push(
            `allowScripts.${packageAtVersion} matcher ikke package-lock.json-versionen ${lockEntry.version}.`
          );
        } else if (lockEntry.hasInstallScript !== true) {
          problems.push(`allowScripts.${packageAtVersion} peger på en package uden install-script.`);
        }
      }

      for (const packageAtVersion of expectedRequiredAllowScripts) {
        if (!actualAllowScripts.has(packageAtVersion)) {
          problems.push(`package-lock.json kræver allowScripts.${packageAtVersion}, men den mangler i package.json.`);
        }
      }
    }
  }

  return problems;
};

const getRepoRoot = () => {
  const repoFlagIndex = process.argv.indexOf('--repo');
  return repoFlagIndex === -1 ? defaultRepoRoot : resolve(process.argv[repoFlagIndex + 1] ?? '');
};

const main = () => {
  const repoRoot = getRepoRoot();
  const problems = validatePackageManifest(repoRoot);
  if (problems.length > 0) {
    console.error('\nPackage-manifest matcher ikke den låste installation:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error('\nKør `npm install` efter en bevidst manifestændring, og kontrollér derefter igen.\n');
    process.exitCode = 1;
    return;
  }
  console.log('check:package-manifest – package.json, package-lock.json, .nvmrc og allowScripts stemmer.');
};

const isMain = process.argv[1] !== undefined
  && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    main();
  } catch (error) {
    console.error(`\nPackage-manifestkontrollen kunne ikke gennemføres: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

export { validatePackageManifest };
