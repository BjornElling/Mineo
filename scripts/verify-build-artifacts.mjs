import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [variant, outDir, ...options] = process.argv.slice(2);
if (!['mineo', 'minprocesrente'].includes(variant) || !outDir) {
  throw new Error('Brug: node scripts/verify-build-artifacts.mjs <mineo|minprocesrente> <outDir> [--allow-automation-bridge]');
}
if (options.some((option) => option !== '--allow-automation-bridge')) {
  throw new Error(`Ukendt verify-build-artifacts-flag: ${options.join(', ')}`);
}
const allowAutomationBridge = options.includes('--allow-automation-bridge');

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
// Standalone-buildet får i E2E et afgrænset `/minprocesrente/`-basepath, så de to app-varianters
// hashed assets ikke kan kollidere. Begge former er byggede assets; en `/src/`-reference er aldrig det.
if (/src="\/src\//.test(html) || !/src="(?:\/[^\"]*)?\/assets\//.test(html)) {
  throw new Error(`${variant}-buildets index.html peger ikke entydigt på et bygget asset.`);
}

const manifest = JSON.parse(readFileSync(path.join(outDir, '.vite/manifest.json'), 'utf8'));
const manifestSources = Object.entries(manifest)
  .flatMap(([key, value]) => [key, value?.src])
  .filter((value) => typeof value === 'string');

/**
 * Størrelsesbudget. Vites `chunkSizeWarningLimit` er kun en advarsel, der let glider forbi i en lang
 * build-log; her bliver den en fejl.
 *
 * - Enhver lazy chunk har loftet 750 kB. En chunk derover er næsten altid en ny tung afhængighed eller
 *   et datamodul, der burde have sin egen codeSplitting-gruppe (`vite.config.ts`).
 * - Entry-chunken har et budget pr. variant med ca. 15 % luft. I Mineo hentes og evalueres den, før
 *   opstartens opdateringstjek kan vise venteskærmen, så programmet hører hjemme bag den dynamiske
 *   import i `src/main.tsx`. MinProcesrentes entry bærer selve beregneren og er derfor større.
 */
const KB = 1000; // Samme enhed som Vites build-rapport.
const MAX_CHUNK_BYTES = 750 * KB;
const ENTRY_CHUNK_BUDGET_BYTES = { mineo: 560 * KB, minprocesrente: 1100 * KB };

const entryFiles = new Set(
  Object.values(manifest)
    .filter((entry) => entry?.isEntry === true && typeof entry.file === 'string')
    .map((entry) => entry.file),
);
const assetsDir = path.join(outDir, 'assets');
for (const name of (existsSync(assetsDir) ? readdirSync(assetsDir) : []).filter((file) => file.endsWith('.js'))) {
  const bytes = statSync(path.join(assetsDir, name)).size;
  const isEntry = entryFiles.has(`assets/${name}`);
  const limit = isEntry ? ENTRY_CHUNK_BUDGET_BYTES[variant] : MAX_CHUNK_BYTES;
  if (bytes <= limit) continue;
  throw new Error(isEntry
    ? `${variant}-buildets entry-chunk ${name} er ${Math.round(bytes / KB)} kB (budget ${limit / KB} kB). `
      + 'En ny statisk import i opstartsvejen hører hjemme bag en dynamisk import (se src/main.tsx).'
    : `${variant}-buildets chunk ${name} er ${Math.round(bytes / KB)} kB (loft ${limit / KB} kB). `
      + 'Del den op med en dynamisk import eller en codeSplitting-gruppe.');
}

if (variant === 'mineo') {
  for (const required of ['sw.js', 'manifest.json', 'pwa-assets.json', 'icons']) requirePath(required);
  if (!manifestSources.some((source) => source.endsWith('index.html'))) {
    throw new Error('Mineo-buildets manifest mangler index.html-entryen.');
  }
  const entryFile = manifest['index.html']?.file;
  if (typeof entryFile !== 'string' || !existsSync(path.join(outDir, entryFile))) {
    throw new Error('Mineo-buildets manifest peger ikke på en eksisterende entry-chunk.');
  }

  // Dokument-writernes vendorer (PDF/Word) må kun hentes ved download. Ligger et lille delt modul i
  // en af deres chunks, importerer entry'en fra den, og hele vendoren hentes og evalueres ved hver
  // opstart – sådan var det med jsPDF, før Vites preload-hjælper og Babels hjælpere fik egne chunks.
  const staticEntryFiles = new Set();
  const pendingKeys = ['index.html'];
  while (pendingKeys.length > 0) {
    const entry = manifest[pendingKeys.pop()];
    if (entry === undefined || staticEntryFiles.has(entry.file)) continue;
    staticEntryFiles.add(entry.file);
    pendingKeys.push(...(entry.imports ?? []));
  }
  const eagerDocumentVendor = [...staticEntryFiles].find((file) =>
    /(^|\/)vendor-(jspdf|jspdf-autotable|docx|html2canvas)-[^/]+\.js$/.test(file));
  if (eagerDocumentVendor !== undefined) {
    throw new Error(
      `Mineo-buildets entry importerer statisk ${eagerDocumentVendor}; dokument-vendorerne må kun indlæses ved `
      + 'download. Giv det delte modul, entry\'en henter derfra, sin egen gruppe i SHARED_CHUNK_GROUPS.',
    );
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
  // helst – og hele deploybeskyttelsen forsvinde tavst. Værnet skal fange det her, i buildet.
  const ASSET_PATH_PATTERN = /^assets\/[A-Za-z0-9._-]+$/;
  const invalidAsset = pwaAssets.assets.find(
    (asset) => typeof asset !== 'string' || !ASSET_PATH_PATTERN.test(asset)
  );
  if (invalidAsset !== undefined) {
    throw new Error(
      `Mineo-buildets PWA-assetmanifest indeholder en asset-sti, service-workeren ikke kan matche: ${String(invalidAsset)}.`
    );
  }

  // PWA-assetmanifestet bruges direkte af service-workeren. En sti der ikke findes kan ellers give
  // et grønt build, som først fejler ved installation og efterlader den åbne session uden lazy assets.
  const missingAsset = pwaAssets.assets.find((asset) => !existsSync(path.join(outDir, asset)));
  if (missingAsset !== undefined) {
    throw new Error(`Mineo-buildets PWA-assetmanifest peger på en asset, der ikke findes i buildet: ${missingAsset}.`);
  }

  // Worker og assetmanifest skal bære SAMME version. Workeren afviser at installere mod et manifest
  // fra en anden build, så et par ude af trit ville give et build helt uden versionscache – og
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
  // testkørsel – den er en obligatorisk del af den build, som faktisk kan deployes.
  const bundleNames = readdirSync(path.join(outDir, 'assets')).filter((name) => name.endsWith('.js'));
  const automationBridgeKey = '__mineoAutomation';
  const bridgeBundle = bundleNames.find((name) =>
    readFileSync(path.join(outDir, 'assets', name), 'utf8').includes(automationBridgeKey)
  );
  // Kun Playwrights eksplicitte E2E-build må bære den skrivebeskyttede introspektionsbro. Det
  // almindelige build:mineo passerer aldrig flaget og bevarer dermed det deploybare fraværsværn.
  if (bridgeBundle !== undefined && !allowAutomationBridge) {
    throw new Error(`Mineo-produktionsbuildet indeholder automatiseringsbroens globale nøgle i ${bridgeBundle}.`);
  }
} else {
  for (const forbidden of ['sw.js', 'manifest.json', 'pwa-assets.json', 'icons', 'favicon-mineo.svg']) forbidPath(forbidden);
  const manifestEntries = new Map(Object.entries(manifest));
  const resolveManifestFile = (entryKey, file) => {
    if (typeof file !== 'string' || file.trim() === '') {
      throw new Error(`MinProcesrente-buildets manifest-entry ${entryKey} mangler en filreference.`);
    }
    const normalized = file.replaceAll('\\', '/');
    const normalizedPosix = path.posix.normalize(normalized);
    if (
      path.posix.isAbsolute(normalized)
      || /^[A-Za-z]:\//.test(normalized)
      || normalizedPosix === '..'
      || normalizedPosix.startsWith('../')
    ) {
      throw new Error(`MinProcesrente-buildets manifest-entry ${entryKey} har en ugyldig filreference: ${file}.`);
    }
    const target = path.resolve(outDir, ...normalizedPosix.split('/'));
    const resolvedOutDir = path.resolve(outDir);
    if (target !== resolvedOutDir && !target.startsWith(`${resolvedOutDir}${path.sep}`)) {
      throw new Error(`MinProcesrente-buildets manifest-entry ${entryKey} peger uden for buildmappen: ${file}.`);
    }
    return target;
  };

  for (const [entryKey, entry] of manifestEntries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error(`MinProcesrente-buildets manifest-entry ${entryKey} har et ugyldigt format.`);
    }
    const target = resolveManifestFile(entryKey, entry.file);
    if (!existsSync(target) || !statSync(target).isFile()) {
      throw new Error(`MinProcesrente-buildets manifestrefererede fil mangler: ${entry.file} (fra ${entryKey}).`);
    }
    for (const referenceField of ['imports', 'dynamicImports']) {
      const references = entry[referenceField];
      if (references === undefined) continue;
      if (!Array.isArray(references)) {
        throw new Error(`MinProcesrente-buildets manifest-entry ${entryKey} har en ugyldig ${referenceField}-liste.`);
      }
      for (const reference of references) {
        if (typeof reference !== 'string' || !manifestEntries.has(reference)) {
          throw new Error(
            `MinProcesrente-buildets manifest-entry ${entryKey} refererer fra ${referenceField} til en ukendt entry: ${String(reference)}.`,
          );
        }
      }
    }
  }
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
