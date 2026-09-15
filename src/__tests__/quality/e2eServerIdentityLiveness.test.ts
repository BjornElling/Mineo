import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const readRepoFile = (relativePath: string): string => readFileSync(join(repoRoot, relativePath), 'utf8');

const expectInOrder = (source: string, fragments: readonly string[]): void => {
  let previousIndex = -1;
  for (const fragment of fragments) {
    const index = source.indexOf(fragment, previousIndex + 1);
    expect(index, `Mangler eller forkert placeret fragment: ${fragment}`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
};

describe('E2E-buildserverens identitetsliveness', () => {
  it('holder server, portoprydning og E2E-indgangen på samme identitetskontrakt', () => {
    const serverSource = readRepoFile('scripts/serve-e2e-builds.mjs');
    const cleanupSource = readRepoFile('scripts/free-e2e-port.mjs');
    const runnerSource = readRepoFile('scripts/run-e2e.mjs');
    const packageJson = JSON.parse(readRepoFile('package.json')) as {
      scripts: Readonly<Record<string, string>>;
    };

    const sharedIdentityImport = "import { IDENTITY_PATH, SERVER_IDENTITY } from './e2e-server-identity.mjs';";
    expect(serverSource).toContain(sharedIdentityImport);
    expect(cleanupSource).toContain(sharedIdentityImport);

    expectInOrder(serverSource, [
      'if (pathname === IDENTITY_PATH)',
      'server: SERVER_IDENTITY',
    ]);
    expectInOrder(cleanupSource, [
      'fetch(new URL(IDENTITY_PATH, baseURL)',
      'body?.server === SERVER_IDENTITY',
    ]);

    expect(packageJson.scripts['test:e2e']).toBe('node scripts/run-e2e.mjs');
    expectInOrder(runnerSource, [
      "runStep(process.execPath, ['scripts/check-e2e-lane-tags.mjs']);",
      "runStep(process.execPath, ['scripts/free-e2e-port.mjs']);",
      "[playwrightCli, 'test', ...playwrightArgs]",
    ]);
  });
});
