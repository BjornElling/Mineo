import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [outDir] = process.argv.slice(2);

if (!outDir) {
  throw new Error('Usage: node scripts/cleanup-minprocesrente-public.mjs <outDir>');
}

for (const relativePath of ['sw.js', 'manifest.json', 'icons']) {
  rmSync(path.join(outDir, relativePath), { recursive: true, force: true });
}

writeFileSync(
  path.join(outDir, '_headers'),
  [
    '/',
    '  Cache-Control: no-cache, no-store, must-revalidate',
    '',
    '/index.html',
    '  Cache-Control: no-cache, no-store, must-revalidate',
    '',
    '/minprocesrente.html',
    '  Cache-Control: no-cache, no-store, must-revalidate',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
  'utf8'
);
