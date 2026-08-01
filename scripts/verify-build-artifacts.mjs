import { existsSync, readFileSync } from 'node:fs';
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
  for (const required of ['sw.js', 'manifest.json', 'icons']) requirePath(required);
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
} else {
  for (const forbidden of ['sw.js', 'manifest.json', 'icons', 'favicon-mineo.svg']) forbidPath(forbidden);
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
