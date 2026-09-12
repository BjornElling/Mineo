import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type PackageScripts = Readonly<Record<string, string>>;

const repoRoot = process.cwd();
const RELEASE_GATE = 'verify:release:core';
const REQUIRED_BUILD_SCRIPTS = ['build:all', 'build:mineo', 'build:minprocesrente'] as const;

const readPackageScripts = (): PackageScripts => {
  const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
    scripts: PackageScripts;
  };
  return packageJson.scripts;
};

const reachableScripts = (start: string, scripts: PackageScripts): ReadonlySet<string> => {
  const reached = new Set<string>();
  const visit = (name: string): void => {
    if (reached.has(name)) return;
    reached.add(name);

    for (const referenced of scripts[name]?.matchAll(/npm run ([\w:-]+)/g) ?? []) {
      visit(referenced[1]!);
    }
  };

  visit(start);
  return reached;
};

const releaseGateBuildsBothVariants = (scripts: PackageScripts): boolean => {
  const reached = reachableScripts(RELEASE_GATE, scripts);
  return REQUIRED_BUILD_SCRIPTS.every((script) => reached.has(script));
};

describe('verify:release:core – build-wiringens liveness', () => {
  it('når begge deploybare buildvarianter gennem build:all', () => {
    const scripts = readPackageScripts();

    expect(releaseGateBuildsBothVariants(scripts)).toBe(true);
  });

  it('afviser et release-flow, hvor standalone-buildet er fjernet fra kæden', () => {
    const scripts: PackageScripts = {
      [RELEASE_GATE]: 'npm run build:all',
      'build:all': 'npm run build:mineo',
      'build:mineo': 'vite build --config vite.mineo.config.ts',
      'build:minprocesrente': 'vite build --config vite.minprocesrente.config.ts',
    };

    expect(releaseGateBuildsBothVariants(scripts)).toBe(false);
  });
});
