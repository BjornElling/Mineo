#!/usr/bin/env node

/**
 * Generates PNG PWA icons from `public/favicon.svg`.
 *
 * Trust-critical note:
 * - Icons are build artifacts only; they must not affect runtime logic.
 * - Keeping raster icons in-repo avoids platform quirks (e.g. SVG not supported for file icons).
 */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.join(__dirname, '..');
const SRC_SVG = path.join(ROOT, 'public', 'favicon.svg');
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

  writeIcon('icon-192.png', 192);
  writeIcon('icon-512.png', 512);
  writeIcon('apple-touch-icon-180.png', 180);
}

main();

