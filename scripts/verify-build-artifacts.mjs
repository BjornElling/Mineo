import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [variant, outDir] = process.argv.slice(2);
if (!['mineo', 'minprocesrente'].includes(variant) || !outDir) {
  throw new Error('Brug: node scripts/verify-build-artifacts.mjs <mineo|minprocesrente> <outDir>');
}

const requirePath = (relativePath) => {
  if (!existsSync(path.join(outDir, relativePath))) {
    throw new Error(`${variant}-buildet mangler ${relativePath}.`);
  }
};

const forbidPath = (relativePath) => {
  if (existsSync(path.join(outDir, relativePath))) {
    throw new Error(`${variant}-buildet må ikke indeholde ${relativePath}.`);
  }
};

requirePath('index.html');
requirePath('_headers');
requirePath('.vite/manifest.json');

const html = readFileSync(path.join(outDir, 'index.html'), 'utf8');
if (/src="\/src\//.test(html) || !/src="\/assets\//.test(html)) {
  throw new Error(`${variant}-buildets index.html peger ikke entydigt på et bygget asset.`);
}

const manifest = JSON.parse(readFileSync(path.join(outDir, '.vite/manifest.json'), 'utf8'));
const manifestSources = Object.entries(manifest)
  .flatMap(([key, value]) => [key, value?.src])
  .filter((value) => typeof value === 'string');

if (variant === 'mineo') {
  for (const required of ['sw.js', 'manifest.json', 'pwa-assets.json', 'icons']) requirePath(required);
  if (!manifestSources.some((source) => source.endsWith('index.html'))) {
    throw new Error('Mineo-buildets manifest mangler index.html-entryen.');
  }
  if (
    html.includes('MINEO_THEME_BOOTSTRAP')
    || !html.includes('mineo_app_settings_v1')
    || !html.includes('prefers-color-scheme: dark')
  ) {
    throw new Error('Mineo-buildets synkrone theme-bootstrap er ikke injiceret korrekt.');
  }
  const pwaAssets = JSON.parse(readFileSync(path.join(outDir, 'pwa-assets.json'), 'utf8'));
  if (!Array.isArray(pwaAssets.assets) || pwaAssets.assets.length === 0) {
    throw new Error('Mineo-buildets PWA-assetmanifest mangler immutable Vite-assets.');
  }
  // Samme mønster som service-workerens `ASSET_PATH_PATTERN`. Skiftede `chunkFileNames` en dag til
  // en nested sti (`assets/js/...`), ville workerens interception holde op med at matche noget som
  // helst — og hele deploybeskyttelsen forsvinde tavst. Værnet skal fange det her, i buildet.
  const ASSET_PATH_PATTERN = /^assets\/[A-Za-z0-9._-]+$/;
  const invalidAsset = pwaAssets.assets.find(
    (asset) => typeof asset !== 'string' || !ASSET_PATH_PATTERN.test(asset)
  );
  if (invalidAsset !== undefined) {
    throw new Error(
      `Mineo-buildets PWA-assetmanifest indeholder en asset-sti, service-workeren ikke kan matche: ${String(invalidAsset)}.`
    );
  }

  // Worker og assetmanifest skal bære SAMME version. Workeren afviser at installere mod et manifest
  // fra en anden build, så et par ude af trit ville give et build helt uden versionscache — og
  // dermed uden beskyttelse mod at en åben session mister sine lazy chunks efter næste deploy.
  const serviceWorkerSource = readFileSync(path.join(outDir, 'sw.js'), 'utf8');
  if (serviceWorkerSource.includes('__MINEO_BUILD_VERSION__')) {
    throw new Error('Mineo-buildets service worker har ikke fået sin build-version indbagt.');
  }
  const workerVersion = /const BUILD_VERSION = '([^']+)'/.exec(serviceWorkerSource)?.[1];
  if (!workerVersion) {
    throw new Error('Mineo-buildets service worker mangler en læsbar BUILD_VERSION.');
  }
  if (typeof pwaAssets.version !== 'string' || pwaAssets.version.trim() === '') {
    throw new Error('Mineo-buildets PWA-assetmanifest mangler en build-version.');
  }
  if (pwaAssets.version !== workerVersion) {
    throw new Error(
      `Mineo-buildets service worker (${workerVersion}) og assetmanifest (${pwaAssets.version}) hører til hver sin build.`
    );
  }

  // Produktionsbuildet må ikke indeholde den DEV-/test-only introspektionsbro. Denne kontrol ligger
  // efter bundlingen, så den aldrig kan blive falsk grøn blot fordi `dist/mineo` ikke findes i en ren
  // testkørsel — den er en obligatorisk del af den build, som faktisk kan deployes.
  const bundleNames = readdirSync(path.join(outDir, 'assets')).filter((name) => name.endsWith('.js'));
  const automationBridgeKey = '__mineoAutomation';
  const bridgeBundle = bundleNames.find((name) =>
    readFileSync(path.join(outDir, 'assets', name), 'utf8').includes(automationBridgeKey)
  );
  if (bridgeBundle !== undefined) {
    throw new Error(`Mineo-produktionsbuildet indeholder automatiseringsbroens globale nøgle i ${bridgeBundle}.`);
  }
} else {
  for (const forbidden of ['sw.js', 'manifest.json', 'pwa-assets.json', 'icons', 'favicon-mineo.svg']) forbidPath(forbidden);
  if (!manifestSources.some((source) => source.endsWith('minprocesrente.html'))) {
    throw new Error('MinProcesrente-buildets manifest mangler standalone-entryen.');
  }
  const forbiddenSource = manifestSources.find((source) =>
    /(^|\/)(main\.tsx|App\.tsx|AuthGate\.tsx|serviceWorkerBootstrap\.ts)$/.test(source)
  );
  if (forbiddenSource) {
    throw new Error(`MinProcesrente-buildet indeholder en Mineo-entry: ${forbiddenSource}.`);
  }
}

console.log(`${variant}-buildets entry, manifest og variantfiler er verificeret.`);
