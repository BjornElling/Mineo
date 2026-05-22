import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [outDir, sourceHtml] = process.argv.slice(2);

if (!outDir || !sourceHtml) {
  throw new Error('Usage: node scripts/ensure-build-index.mjs <outDir> <sourceHtml>');
}

const sourcePath = path.join(outDir, sourceHtml);
const targetPath = path.join(outDir, 'index.html');

if (!existsSync(sourcePath)) {
  throw new Error(`Build HTML not found: ${sourcePath}`);
}

copyFileSync(sourcePath, targetPath);
