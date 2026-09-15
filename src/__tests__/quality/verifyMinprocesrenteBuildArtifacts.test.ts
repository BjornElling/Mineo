import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Manifest = Readonly<Record<string, Readonly<{ src: string }>>>;

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const verifyScript = join(repoRoot, 'scripts', 'verify-build-artifacts.mjs');

const writeStandaloneFixture = (manifest: Manifest): string => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'mineo-minprocesrente-build-'));
  mkdirSync(join(fixtureRoot, '.vite'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'assets'), { recursive: true });

  writeFileSync(join(fixtureRoot, 'index.html'), '<script src="/assets/app.js"></script>\n');
  writeFileSync(join(fixtureRoot, '_headers'), '');
  writeFileSync(join(fixtureRoot, '.vite', 'manifest.json'), `${JSON.stringify(manifest)}\n`);
  writeFileSync(join(fixtureRoot, 'assets', 'app.js'), '');

  return fixtureRoot;
};

const runVerify = (fixtureRoot: string): ReturnType<typeof spawnSync> => spawnSync(
  process.execPath,
  [verifyScript, 'minprocesrente', fixtureRoot],
  { encoding: 'utf8' },
);

const output = (result: ReturnType<typeof spawnSync>): string => `${result.stdout}${result.stderr}`;

const withFixture = (manifest: Manifest, assert: (result: ReturnType<typeof spawnSync>) => void): void => {
  const fixtureRoot = writeStandaloneFixture(manifest);
  try {
    assert(runVerify(fixtureRoot));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

describe('verify-build-artifacts standalone-variant', () => {
  it('accepterer standalone-entryen og afviser en Mineo-entry i samme variantgren', () => {
    withFixture({ 'minprocesrente.html': { src: 'minprocesrente.html' } }, (result) => {
      expect(result.status).toBe(0);
      expect(output(result)).toContain('minprocesrente-buildets entry, manifest og variantfiler er verificeret.');
    });

    withFixture(
      {
        'minprocesrente.html': { src: 'minprocesrente.html' },
        'src/main.tsx': { src: 'src/main.tsx' },
      },
      (result) => {
        expect(result.status).toBe(1);
        expect(output(result)).toContain(
          'MinProcesrente-buildet indeholder en Mineo-entry: src/main.tsx.',
        );
      },
    );
  });
});
