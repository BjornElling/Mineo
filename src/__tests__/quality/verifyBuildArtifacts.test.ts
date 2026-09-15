import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type FixtureOptions = {
  assetPath: string;
  writeAsset: boolean;
  indexScriptSrc?: string;
};

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const verifyScript = join(repoRoot, 'scripts', 'verify-build-artifacts.mjs');

const writeMineoFixture = ({ assetPath, writeAsset, indexScriptSrc = '/assets/app.js' }: FixtureOptions): string => {
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
    `${JSON.stringify({ 'index.html': { src: 'index.html' } }, null, 2)}\n`
  );
  writeFileSync(join(fixtureRoot, 'assets', 'app.js'), '');
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

  it('afviser en eksisterende asset med en sti, service-workeren ikke kan matche', () => {
    withFixture({ assetPath: 'assets/nested/app.js', writeAsset: true }, (result) => {
      expect(result.status).toBe(1);
      expect(output(result)).toContain(
        'PWA-assetmanifest indeholder en asset-sti, service-workeren ikke kan matche: assets/nested/app.js.'
      );
    });
  });
});
