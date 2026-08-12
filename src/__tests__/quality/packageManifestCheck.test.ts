import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type FixturePackageJson = {
  name: string;
  version: string;
  license: string;
  packageManager: string;
  engines: { node: string; npm: string };
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  allowScripts: Record<string, boolean>;
};

type FixtureLock = {
  name: string;
  version: string;
  lockfileVersion: number;
  requires: boolean;
  packages: Record<string, Record<string, unknown>>;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const checkScript = join(repoRoot, 'scripts', 'check-package-manifest.mjs');

const makeFixture = (): { packageJson: FixturePackageJson; packageLock: FixtureLock } => {
  const packageJson: FixturePackageJson = {
    name: 'manifest-test',
    version: '1.0.0',
    license: 'MIT',
    packageManager: 'npm@11.16.0',
    engines: { node: '>=24.18.0 <27', npm: '>=11.13.0 <12' },
    dependencies: { 'runtime-pkg': '^1.0.0' },
    devDependencies: { 'build-pkg': '^2.0.0' },
    allowScripts: { 'build-pkg@2.0.1': true },
  };
  const packageLock: FixtureLock = {
    name: packageJson.name,
    version: packageJson.version,
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': {
        name: packageJson.name,
        version: packageJson.version,
        license: packageJson.license,
        dependencies: packageJson.dependencies,
        devDependencies: packageJson.devDependencies,
        engines: packageJson.engines,
      },
      'node_modules/runtime-pkg': { version: '1.0.5' },
      'node_modules/build-pkg': { version: '2.0.1', dev: true, hasInstallScript: true },
    },
  };
  return { packageJson, packageLock };
};

const writeFixture = (fixture: { packageJson: FixturePackageJson; packageLock: FixtureLock }): string => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'mineo-package-manifest-'));
  writeFileSync(join(fixtureRoot, 'package.json'), `${JSON.stringify(fixture.packageJson, null, 2)}\n`);
  writeFileSync(join(fixtureRoot, 'package-lock.json'), `${JSON.stringify(fixture.packageLock, null, 2)}\n`);
  writeFileSync(join(fixtureRoot, '.nvmrc'), '24.18.0\n');
  return fixtureRoot;
};

const runCheck = (fixtureRoot: string): ReturnType<typeof spawnSync> => spawnSync(
  process.execPath,
  [checkScript, '--repo', fixtureRoot],
  { encoding: 'utf8' }
);

describe('check-package-manifest', () => {
  it('accepterer et konsistent package- og lock-manifest', () => {
    const fixtureRoot = writeFixture(makeFixture());
    try {
      const result = runCheck(fixtureRoot);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('stemmer');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('afviser en lockfil med et forældet dependency-manifest', () => {
    const fixture = makeFixture();
    fixture.packageLock.packages[''].devDependencies = { 'other-pkg': '^2.0.0' };
    const fixtureRoot = writeFixture(fixture);
    try {
      const result = runCheck(fixtureRoot);
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain('root.devDependencies');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('afviser en allowlist der ikke følger den låste install-script-version', () => {
    const fixture = makeFixture();
    fixture.packageJson.allowScripts = { 'build-pkg@2.0.0': true };
    const fixtureRoot = writeFixture(fixture);
    try {
      const result = runCheck(fixtureRoot);
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain('allowScripts');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('afviser en CI-runtime uden for engines', () => {
    const fixture = makeFixture();
    const fixtureRoot = writeFixture(fixture);
    writeFileSync(join(fixtureRoot, '.nvmrc'), '27.0.0\n');
    try {
      const result = runCheck(fixtureRoot);
      expect(result.status).toBe(1);
      expect(`${result.stdout}${result.stderr}`).toContain('.nvmrc');
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('kan læse den faktiske package.json uden at ændre den', () => {
    const before = readFileSync(join(repoRoot, 'package.json'), 'utf8');
    execFileSync(process.execPath, [checkScript], { encoding: 'utf8' });
    expect(readFileSync(join(repoRoot, 'package.json'), 'utf8')).toBe(before);
  });
});
