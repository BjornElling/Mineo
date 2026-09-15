import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type ManifestEntry = Readonly<{
  file: string;
  src?: string;
  imports?: readonly string[];
  dynamicImports?: readonly string[];
}>;
type Manifest = Readonly<Record<string, ManifestEntry>>;

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
  for (const entry of Object.values(manifest)) {
    const filePath = join(fixtureRoot, ...entry.file.split('/'));
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, '');
  }

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
  it('kontrollerer entryens fil samt statiske og dynamiske manifestreferencer', () => {
    withFixture({
      'minprocesrente.html': {
        file: 'assets/app.js',
        src: 'minprocesrente.html',
        imports: ['shared.js'],
        dynamicImports: ['src/document.ts'],
      },
      'shared.js': { file: 'assets/shared.js' },
      'src/document.ts': { file: 'assets/document.js' },
    }, (result) => {
      expect(result.status).toBe(0);
      expect(output(result)).toContain('minprocesrente-buildets entry, manifest og variantfiler er verificeret.');
    });

    withFixture(
      {
        'minprocesrente.html': { file: 'assets/app.js', src: 'minprocesrente.html' },
        'src/main.tsx': { file: 'assets/main.js', src: 'src/main.tsx' },
      },
      (result) => {
        expect(result.status).toBe(1);
        expect(output(result)).toContain(
          'MinProcesrente-buildet indeholder en Mineo-entry: src/main.tsx.',
        );
      },
    );
  });

  it('afviser en manifestreference til en fil, der mangler i buildet', () => {
    const fixtureRoot = writeStandaloneFixture({
      'minprocesrente.html': {
        file: 'assets/app.js',
        src: 'minprocesrente.html',
        dynamicImports: ['document.js'],
      },
      'document.js': { file: 'assets/document.js' },
    });
    try {
      rmSync(join(fixtureRoot, 'assets', 'document.js'));
      const result = runVerify(fixtureRoot);
      expect(result.status).toBe(1);
      expect(output(result)).toContain(
        'MinProcesrente-buildets manifestrefererede fil mangler: assets/document.js (fra document.js).',
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it('afviser en import, der ikke peger på en manifest-entry', () => {
    withFixture({
      'minprocesrente.html': {
        file: 'assets/app.js',
        src: 'minprocesrente.html',
        imports: ['missing.js'],
      },
    }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain(
        'MinProcesrente-buildets manifest-entry minprocesrente.html refererer fra imports til en ukendt entry: missing.js.',
      );
    });
  });
});
