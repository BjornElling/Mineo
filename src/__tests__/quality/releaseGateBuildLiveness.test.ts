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

const commitGateRunsQualityGuards = (scripts: PackageScripts, hook: string): boolean =>
  /^\s*npm run check:commit\s*$/m.test(hook)
  && reachableScripts('check:commit', scripts).has('check:quality')
  && scripts['check:quality'] === 'vitest run src/__tests__/quality';

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

describe('pre-commit – kvalitetsværnenes liveness', () => {
  const readHook = (): string => readFileSync(join(repoRoot, '.husky/pre-commit'), 'utf8');

  it('kører hele quality-mappen gennem den faste commit-kontrol', () => {
    expect(commitGateRunsQualityGuards(readPackageScripts(), readHook())).toBe(true);
  });

  it('afviser fjernelse af quality-kontrollen fra den levende commit-kæde', () => {
    const scripts = readPackageScripts();
    const original = scripts['check:commit']!;
    const changed = original.replace(/\s*&& npm run check:quality\b/, '');
    expect(changed).not.toBe(original);
    expect(commitGateRunsQualityGuards({ ...scripts, 'check:commit': changed }, readHook())).toBe(false);
  });

  it('afviser et håndvalgt udsnit i stedet for hele quality-mappen', () => {
    const scripts = { ...readPackageScripts(), 'check:quality': 'vitest run src/__tests__/quality/e2eLoginAwaitGuard.test.ts' };
    expect(commitGateRunsQualityGuards(scripts, readHook())).toBe(false);
  });

  it('afviser en hook, der ikke længere kalder commit-kontrollen', () => {
    const original = readHook();
    const changed = original.replace(/^npm run check:commit\s*$/m, '');
    expect(changed).not.toBe(original);
    expect(commitGateRunsQualityGuards(readPackageScripts(), changed)).toBe(false);
  });
});
