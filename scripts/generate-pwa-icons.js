#!/usr/bin/env node

/**
 * Genererer PNG-PWA-ikoner fra `public/favicon-mineo.svg`.
 *
 * Trust-kritisk:
 * - Ikoner er kun build-artefakter og må ikke påvirke runtime-logik.
 * - Rasterikoner i repoet undgår platformssærheder (fx manglende SVG-support til filikoner).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_SVG = path.join(ROOT, 'public', 'favicon-mineo.svg');
const OUT_DIR = path.join(ROOT, 'public', 'icons');

/** @param {number} size */
function renderPng(size) {
  const svg = fs.readFileSync(SRC_SVG, 'utf8');

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
  });

  return resvg.render().asPng();
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeIcon(filename, size) {
  const outPath = path.join(OUT_DIR, filename);
  fs.writeFileSync(outPath, renderPng(size));
  console.log(`✓ ${path.relative(ROOT, outPath)} (${size}x${size})`);
}

function main() {
  if (!fs.existsSync(SRC_SVG)) {
    console.error(`Missing source SVG: ${path.relative(ROOT, SRC_SVG)}`);
    process.exit(1);
  }

  ensureDir(OUT_DIR);

  writeIcon('mineo-icon-192.png', 192);
  writeIcon('mineo-icon-512.png', 512);
  writeIcon('mineo-apple-touch-icon-180.png', 180);
}

main();
