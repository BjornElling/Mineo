import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type FixtureOptions = {
  assetPath: string;
  writeAsset: boolean;
  indexScriptSrc?: string;
  /** Entry-chunkens størrelse i bytes (`assets/app.js`). */
  entryBytes?: number;
  /** En ekstra lazy chunk med den givne størrelse i bytes. */
  lazyChunkBytes?: number;
  /** Entry'en importerer statisk (transitivt) denne chunk, fx `vendor-jspdf-ABC.js`. */
  transitiveEntryImport?: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const verifyScript = join(repoRoot, 'scripts', 'verify-build-artifacts.mjs');

const writeMineoFixture = ({
  assetPath,
  writeAsset,
  indexScriptSrc = '/assets/app.js',
  entryBytes = 0,
  lazyChunkBytes,
  transitiveEntryImport,
}: FixtureOptions): string => {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'mineo-build-artifacts-'));
  mkdirSync(join(fixtureRoot, '.vite'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'assets'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'icons'), { recursive: true });

  writeFileSync(
    join(fixtureRoot, 'index.html'),
    '<script>mineo_app_settings_v1 prefers-color-scheme: dark</script>\n'
      + `<script src="${indexScriptSrc}"></script>\n`
  );
  writeFileSync(join(fixtureRoot, '_headers'), '');
  writeFileSync(join(fixtureRoot, 'manifest.json'), '{}\n');
  writeFileSync(join(fixtureRoot, 'sw.js'), "const BUILD_VERSION = 'fixture-build';\n");
  writeFileSync(
    join(fixtureRoot, 'pwa-assets.json'),
    `${JSON.stringify({ version: 'fixture-build', assets: [assetPath] }, null, 2)}\n`
  );
  writeFileSync(
    join(fixtureRoot, '.vite', 'manifest.json'),
    `${JSON.stringify({
      'index.html': {
        src: 'index.html',
        file: 'assets/app.js',
        isEntry: true,
        ...(transitiveEntryImport === undefined ? {} : { imports: ['_shared.js'] }),
      },
      ...(transitiveEntryImport === undefined ? {} : {
        '_shared.js': { file: 'assets/shared.js', imports: ['_heavy.js'] },
        '_heavy.js': { file: `assets/${transitiveEntryImport}` },
      }),
    }, null, 2)}\n`
  );
  writeFileSync(join(fixtureRoot, 'assets', 'app.js'), 'x'.repeat(entryBytes));
  if (lazyChunkBytes !== undefined) {
    writeFileSync(join(fixtureRoot, 'assets', 'lazy.js'), 'x'.repeat(lazyChunkBytes));
  }
  if (writeAsset && assetPath !== 'assets/app.js') {
    mkdirSync(dirname(join(fixtureRoot, assetPath)), { recursive: true });
    writeFileSync(join(fixtureRoot, assetPath), '');
  }

  return fixtureRoot;
};

const runVerify = (fixtureRoot: string): ReturnType<typeof spawnSync> => spawnSync(
  process.execPath,
  [verifyScript, 'mineo', fixtureRoot],
  { encoding: 'utf8' }
);

const output = (result: ReturnType<typeof spawnSync>): string => `${result.stdout}${result.stderr}`;

const withFixture = (options: FixtureOptions, assert: (result: ReturnType<typeof spawnSync>) => void): void => {
  const fixtureRoot = writeMineoFixture(options);
  try {
    assert(runVerify(fixtureRoot));
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
};

describe('verify-build-artifacts PWA-assets', () => {
  it('accepterer et build når alle PWA-assetstier findes i outDir', () => {
    withFixture({ assetPath: 'assets/app.js', writeAsset: true }, (result) => {
      expect(result.status).toBe(0);
      expect(output(result)).toContain('verificeret');
    });
  });

  it('afviser et build når index.html peger på en src-fil', () => {
    withFixture({
      assetPath: 'assets/app.js',
      writeAsset: true,
      indexScriptSrc: '/src/main.tsx',
    }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain(
        'mineo-buildets index.html peger ikke entydigt på et bygget asset.'
      );
    });
  });

  it('afviser et build når PWA-manifestet peger på en manglende asset', () => {
    withFixture({ assetPath: 'assets/mangler.js', writeAsset: false }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain(
        'PWA-assetmanifest peger på en asset, der ikke findes i buildet: assets/mangler.js.'
      );
    });
  });

  it('accepterer en entry-chunk og en lazy chunk lige på deres lofter', () => {
    withFixture({ assetPath: 'assets/app.js', writeAsset: true, entryBytes: 560_000, lazyChunkBytes: 750_000 }, (result) => {
      expect(output(result)).toContain('verificeret');
      expect(result.status).toBe(0);
    });
  });

  it('afviser en entry-chunk over budgettet og peger på den dynamiske import i main.tsx', () => {
    withFixture({ assetPath: 'assets/app.js', writeAsset: true, entryBytes: 560_001 }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('entry-chunk app.js er 560 kB (budget 560 kB)');
      expect(output(result)).toContain('src/main.tsx');
    });
  });

  it('afviser enhver chunk over loftet, også en lazy chunk', () => {
    withFixture({ assetPath: 'assets/app.js', writeAsset: true, lazyChunkBytes: 750_001 }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('chunk lazy.js er 750 kB (loft 750 kB)');
    });
  });

  it('afviser et build, hvor entry\'en transitivt importerer en dokument-vendor', () => {
    withFixture({ assetPath: 'assets/app.js', writeAsset: true, transitiveEntryImport: 'vendor-jspdf-ABC123.js' }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain('entry importerer statisk assets/vendor-jspdf-ABC123.js');
    });
  });

  it('godtager at entry\'en transitivt importerer en almindelig delt chunk', () => {
    withFixture({ assetPath: 'assets/app.js', writeAsset: true, transitiveEntryImport: 'vendor-zod-ABC123.js' }, (result) => {
      expect(output(result)).toContain('verificeret');
      expect(result.status).toBe(0);
    });
  });

  it('afviser en eksisterende asset med en sti, service-workeren ikke kan matche', () => {
    withFixture({ assetPath: 'assets/nested/app.js', writeAsset: true }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain(
        'PWA-assetmanifest indeholder en asset-sti, service-workeren ikke kan matche: assets/nested/app.js.'
      );
    });
  });
});
