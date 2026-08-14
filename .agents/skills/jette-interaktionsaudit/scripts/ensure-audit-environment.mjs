#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(getOption('--repo') ?? process.cwd());
const checkOnly = process.argv.includes('--check-only');
const auditRoot = path.join(repoRoot, 'test-results', 'runtime-input-audit');
const environmentPath = path.join(auditRoot, 'environment.json');

const DIRECT_PLAYWRIGHT_PACKAGES = ['@playwright/cli', '@playwright/mcp', '@playwright/test'];
const CLI_MCP_PACKAGES = ['@playwright/cli', '@playwright/mcp'];
const BROWSERS = ['chromium', 'firefox', 'webkit'];

const repairs = [];
const warnings = [];

await main();

async function main() {
  let manifest = await readJson(path.join(repoRoot, 'package.json'));
  let lockfile = await readJson(path.join(repoRoot, 'package-lock.json'));

  let packages = await inspectDirectPackages(manifest, lockfile);
  const packageRepairNeeded = packages.some((entry) => entry.status === 'missing' || entry.status === 'behind');

  if (packageRepairNeeded && !checkOnly) {
    await runNpmPreservingAheadVersions(packages, [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--prefer-offline',
    ]);
    repairs.push('npm installerede manglende eller bagudstående Playwright-pakker efter den eksisterende manifest/lockfile-kilde');
    manifest = await readJson(path.join(repoRoot, 'package.json'));
    lockfile = await readJson(path.join(repoRoot, 'package-lock.json'));
    packages = await inspectDirectPackages(manifest, lockfile);
  }

  await alignCliMcpRuntime(packages, checkOnly);
  packages = await inspectDirectPackages(manifest, lockfile);

  const cliSkill = await synchronizeCliSkill(checkOnly);
  const browserStatus = await ensureBrowsers(packages, checkOnly);

  const result = {
    schemaVersion: 1,
    checkedAt: new Date().toISOString(),
    repo: repoRoot,
    mode: checkOnly ? 'check-only' : 'repair',
    packages,
    cliSkill,
    browsers: browserStatus,
    repairs,
    warnings,
  };

  await mkdir(auditRoot, { recursive: true });
  await writeFile(environmentPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  printSummary(result);

  const blockingProblems = [
    ...packages.filter((entry) => entry.status === 'missing' || entry.status === 'behind'),
    ...packages.filter((entry) => entry.status === 'unknown'),
  ];
  if (blockingProblems.length > 0 || browserStatus.unresolved.length > 0) {
    process.exitCode = 1;
  }
}

async function inspectDirectPackages(manifest, lockfile) {
  const result = [];
  for (const name of DIRECT_PLAYWRIGHT_PACKAGES) {
    const packageJson = await readOptionalJson(packagePath(repoRoot, name));
    const declared = manifest.devDependencies?.[name] ?? manifest.dependencies?.[name] ?? null;
    const locked = lockfile.packages?.[`node_modules/${name}`]?.version ?? null;
    const installed = packageJson?.version ?? null;
    const status = classifyVersion(installed, locked);

    result.push({
      name,
      declared,
      locked,
      installed,
      status,
      runtime: packageJson?.dependencies?.playwright ?? null,
      runtimeResolved: packageJson
        ? await resolveRuntimeVersion(repoRoot, name, 'playwright')
        : null,
    });
  }
  return result;
}

async function alignCliMcpRuntime(packages, isCheckOnly) {
  const entries = packages.filter((entry) => CLI_MCP_PACKAGES.includes(entry.name));
  const runtimeVersions = entries
    .map((entry) => entry.runtimeResolved ?? entry.runtime)
    .filter((version) => typeof version === 'string');

  if (runtimeVersions.length < 2 || new Set(runtimeVersions).size === 1) return;

  const highestRuntime = runtimeVersions.reduce((highest, current) => (
    compareVersions(current, highest) > 0 ? current : highest
  ));
  const lagging = entries.filter((entry) => {
    const runtime = entry.runtimeResolved ?? entry.runtime;
    return typeof runtime === 'string' && compareVersions(runtime, highestRuntime) < 0;
  });

  if (lagging.length === 0) return;

  if (isCheckOnly) {
    warnings.push(`CLI/MCP-runtime er ikke ens; bagudstående: ${lagging.map((entry) => entry.name).join(', ')}`);
    return;
  }

  const latest = await Promise.all(lagging.map(async (entry) => ({
    name: entry.name,
    metadata: await readLatestPackageMetadata(entry.name),
  })));
  const updateable = latest.filter(({ metadata }) => {
    const runtime = metadata?.dependencies?.playwright;
    return typeof runtime === 'string' && compareVersions(runtime, highestRuntime) >= 0;
  });

  if (updateable.length === 0) {
    warnings.push(`CLI/MCP-runtime er ikke ens, og npm tilbyder ingen opdatering af ${lagging.map((entry) => entry.name).join(', ')} til den eksisterende højeste runtime`);
    return;
  }

  await runNpmPreservingAheadVersions(packages, [
    'install',
    '--save-dev',
    ...updateable.map(({ name }) => `${name}@latest`),
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ]);
  repairs.push(`opdaterede bagudstående CLI/MCP-pakke(r): ${updateable.map(({ name }) => name).join(', ')}`);
}

async function runNpmPreservingAheadVersions(packages, argumentsList) {
  const aheadVersions = packages
    .filter((entry) => entry.status === 'ahead' && entry.installed)
    .map((entry) => ({ name: entry.name, version: entry.installed }));

  await runNpm(argumentsList);

  if (aheadVersions.length === 0) return;

  let manifest = await readJson(path.join(repoRoot, 'package.json'));
  let lockfile = await readJson(path.join(repoRoot, 'package-lock.json'));
  let current = await inspectDirectPackages(manifest, lockfile);
  const downgraded = aheadVersions.filter(({ name, version }) => {
    const installed = current.find((entry) => entry.name === name)?.installed;
    return installed === null || installed === undefined || compareVersions(installed, version) < 0;
  });

  if (downgraded.length === 0) return;

  await Promise.all(downgraded.map(({ name, version }) => runNpm([
    'install',
    '--no-save',
    `${name}@${version}`,
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
  ])));
  repairs.push(`genoprettede forudgående højere versioner uden nedgradering: ${downgraded.map(({ name }) => name).join(', ')}`);

  manifest = await readJson(path.join(repoRoot, 'package.json'));
  lockfile = await readJson(path.join(repoRoot, 'package-lock.json'));
  current = await inspectDirectPackages(manifest, lockfile);
  const stillDowngraded = downgraded.filter(({ name, version }) => {
    const installed = current.find((entry) => entry.name === name)?.installed;
    return installed === null || installed === undefined || compareVersions(installed, version) < 0;
  });
  if (stillDowngraded.length > 0) {
    warnings.push(`npm kunne ikke bevare højere version(er) uden nedgradering: ${stillDowngraded.map(({ name }) => name).join(', ')}`);
  }
}

async function synchronizeCliSkill(isCheckOnly) {
  const help = await runNpx(['--no-install', 'playwright-cli', '--help'], true);
  const helpText = `${help.stdout}\n${help.stderr}`;
  const mismatch = helpText.includes('does not match the tool version');

  if (mismatch && isCheckOnly) {
    warnings.push('playwright-cli-skillen matcher ikke den installerede CLI');
  } else if (mismatch) {
    await runNpx(['--no-install', 'playwright-cli', 'install', '--skills=agents']);
    repairs.push('synkroniserede den projektlokale playwright-cli-skill med CLI-versionen');
  }

  const skillPath = path.join(repoRoot, '.agents', 'skills', 'playwright-cli', 'SKILL.md');

  return {
    version: parseVersion(helpText),
    mismatch,
    synchronized: !mismatch || !isCheckOnly,
    skillPath: path.relative(repoRoot, skillPath),
  };
}

async function ensureBrowsers(packages, isCheckOnly) {
  const list = await runMineoPlaywright(['install', '--list'], true);
  const listText = `${list.stdout}\n${list.stderr}`;
  const required = [];

  for (const name of ['@playwright/test', '@playwright/cli']) {
    const browserFile = await resolveBrowserManifest(repoRoot, name);
    if (!browserFile) {
      warnings.push(`Kunne ikke finde browsers.json for ${name}`);
      continue;
    }
    const browserManifest = await readJson(browserFile);
    for (const browser of browserManifest.browsers ?? []) {
      if (!BROWSERS.includes(browser.name) || !browser.installByDefault) continue;
      const revision = browser.revisionOverrides?.[process.platform] ?? browser.revision;
      required.push({ source: name, name: browser.name, revision: String(revision) });
    }
  }

  const missing = required.filter(({ name, revision }) => !hasBrowserRevision(listText, name, revision));
  const installed = [...new Set(required.map(({ name, revision }) => ({ name, revision })))]
    .map(({ name, revision }) => ({ name, revision, present: hasBrowserRevision(listText, name, revision) }));

  if (missing.length > 0 && !isCheckOnly) {
    const testMissing = missing.filter(({ source }) => source === '@playwright/test');
    const cliMissing = missing.filter(({ source }) => source === '@playwright/cli');

    if (testMissing.length > 0) {
      await runMineoPlaywright(['install', ...BROWSERS]);
      repairs.push('installerede Mineos Playwright Test-browserrevisioner uden at fjerne nyere lokale revisioner');
    }
    for (const browser of [...new Set(cliMissing.map(({ name }) => name))]) {
      await runNpx(['--no-install', 'playwright-cli', 'install-browser', browser]);
      repairs.push(`installerede CLI-browseren ${browser} uden at fjerne nyere lokale revisioner`);
    }

    const refreshed = await runMineoPlaywright(['install', '--list'], true);
    const refreshedText = `${refreshed.stdout}\n${refreshed.stderr}`;
    return {
      required,
      installed: installed.map((entry) => ({
        ...entry,
        present: hasBrowserRevision(refreshedText, entry.name, entry.revision),
      })),
      unresolved: missing.filter(({ name, revision }) => !hasBrowserRevision(refreshedText, name, revision)),
    };
  }

  return { required, installed, unresolved: missing };
}

async function resolveBrowserManifest(root, packageName) {
  const packageDir = path.dirname(packagePath(root, packageName));
  const nested = path.join(packageDir, 'node_modules', 'playwright-core', 'browsers.json');
  const rootManifest = path.join(root, 'node_modules', 'playwright-core', 'browsers.json');
  if (await exists(nested)) return nested;
  if (await exists(rootManifest)) return rootManifest;
  return null;
}

async function readLatestPackageMetadata(name) {
  const result = await runNpm(['view', `${name}@latest`, 'version', 'dependencies', '--json'], true);
  if (!result.ok) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

async function resolveRuntimeVersion(root, packageName, dependencyName) {
  const packageDir = path.dirname(packagePath(root, packageName));
  const nested = await readOptionalJson(path.join(packageDir, 'node_modules', dependencyName, 'package.json'));
  if (nested?.version) return nested.version;
  const rootPackage = await readOptionalJson(packagePath(root, dependencyName));
  return rootPackage?.version ?? null;
}

async function runNpm(argumentsList, allowFailure = false) {
  return runExecutable(process.platform === 'win32' ? 'npm.cmd' : 'npm', argumentsList, allowFailure);
}

async function runNpx(argumentsList, allowFailure = false) {
  return runExecutable(process.platform === 'win32' ? 'npx.cmd' : 'npx', argumentsList, allowFailure);
}

async function runMineoPlaywright(argumentsList, allowFailure = false) {
  return runExecutable('node', [
    path.join('node_modules', '@playwright', 'test', 'cli.js'),
    ...argumentsList,
  ], allowFailure);
}

async function runExecutable(command, argumentsList, allowFailure) {
  try {
    const executable = process.platform === 'win32' ? (process.env.ComSpec ?? 'cmd.exe') : command;
    const executableArguments = process.platform === 'win32'
      ? ['/d', '/s', '/c', [command, ...argumentsList].join(' ')]
      : argumentsList;
    const result = await execFileAsync(executable, executableArguments, {
      cwd: repoRoot,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      encoding: 'utf8',
    });
    return { ok: true, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const stdout = typeof error?.stdout === 'string' ? error.stdout : '';
    const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
    if (allowFailure) return { ok: false, stdout, stderr };
    const reason = stderr || stdout || (error instanceof Error ? error.message : String(error));
    throw new Error(`${command} ${argumentsList.join(' ')} fejlede:\n${reason}`);
  }
}

function classifyVersion(installed, expected) {
  if (!installed) return 'missing';
  if (!expected) return 'unknown';
  const comparison = compareVersions(installed, expected);
  if (comparison < 0) return 'behind';
  if (comparison > 0) return 'ahead';
  return 'current';
}

function compareVersions(left, right) {
  const leftParts = parseComparableVersion(left);
  const rightParts = parseComparableVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts.numbers[index] !== rightParts.numbers[index]) {
      return leftParts.numbers[index] > rightParts.numbers[index] ? 1 : -1;
    }
  }
  if (leftParts.pre === rightParts.pre) return 0;
  if (!leftParts.pre) return 1;
  if (!rightParts.pre) return -1;
  return leftParts.pre > rightParts.pre ? 1 : -1;
}

function parseComparableVersion(value) {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-(.+))?$/.exec(value);
  if (!match) return { numbers: [0, 0, 0], pre: value };
  return {
    numbers: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)],
    pre: match[4] ?? '',
  };
}

function hasBrowserRevision(text, browser, revision) {
  return text.includes(`${browser}-${revision}`);
}

function parseVersion(text) {
  return text.match(/\b\d+\.\d+\.\d+(?:-[\w.-]+)?\b/)?.[0] ?? null;
}

function packagePath(root, packageName) {
  return path.join(root, 'node_modules', ...packageName.split('/'), 'package.json');
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readOptionalJson(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

async function exists(filePath) {
  try {
    await readFile(filePath, { encoding: null });
    return true;
  } catch {
    return false;
  }
}

function getOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function printSummary(result) {
  const packageSummary = result.packages.map((entry) => `${entry.name}=${entry.installed ?? 'mangler'} (${entry.status})`).join(', ');
  const browserSummary = result.browsers.installed.map((entry) => `${entry.name}-${entry.revision}:${entry.present ? 'ok' : 'mangler'}`).join(', ');
  console.info(`Auditmiljø: ${packageSummary}`);
  console.info(`Browserrevisioner: ${browserSummary || 'ukendt'}`);
  if (result.repairs.length > 0) console.info(`Selvreparationer: ${result.repairs.join(' | ')}`);
  if (result.warnings.length > 0) console.warn(`Miljøadvarsler: ${result.warnings.join(' | ')}`);
  console.info(`Checkpoint: ${path.relative(repoRoot, environmentPath)}`);
}
