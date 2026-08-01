import { rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [outDir] = process.argv.slice(2);

if (!outDir) {
  throw new Error('Usage: node scripts/cleanup-minprocesrente-public.mjs <outDir>');
}

for (const relativePath of ['sw.js', 'manifest.json', 'icons', 'favicon-mineo.svg']) {
  rmSync(path.join(outDir, relativePath), { recursive: true, force: true });
}

// MinProcesrente er en offentlig beregner og SKAL kunne indekseres. Den delte
// public/robots.txt er sat til `Disallow: /` for Mineo (privat, bevidst noindex),
// og den kopieres med ind i dette build. Overskriv den derfor med en indekserbar
// robots.txt her, så Mineos default forbliver urørt. Jf. minprocesrente.html der
// bevidst udelader noindex-metaen.
writeFileSync(
  path.join(outDir, 'robots.txt'),
  ['User-agent: *', 'Allow: /', '', 'Sitemap: https://minprocesrente.dk/sitemap.xml', ''].join('\n'),
  'utf8'
);

writeFileSync(
  path.join(outDir, 'sitemap.xml'),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://minprocesrente.dk/</loc>',
    '    <changefreq>monthly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n'),
  'utf8'
);

// llms.txt følger llms.txt-anbefalingen: en Markdown-fil med mindst én H1 og links,
// så sprogmodeller/AI-agenter kan forstå hvad sitet er, og finde de relaterede sider.
writeFileSync(
  path.join(outDir, 'llms.txt'),
  [
    '# minProcesrente.dk',
    '',
    '> Gratis, klientbaseret beregner til procesrente efter renteloven. Al beregning sker',
    '> i browseren; ingen indtastede oplysninger sendes til en server.',
    '',
    '## Værktøj',
    '',
    '- [minProcesrente.dk](https://minprocesrente.dk): Beregn procesrente online — angiv beløb, rentedato og beregningsdato og få rente og specifikation som PDF.',
    '',
    '## Relaterede sider',
    '',
    '- [minEO.dk](https://mineo.dk): Erstatningsberegner til EAL- og ASL-opgørelser.',
    '- [minDomssamling.dk](https://mindomssamling.dk): Domssamling.',
    '- [minParadigmesamling.dk](https://minparadigmesamling.dk): Paradigmesamling.',
    '',
    '## Kontakt',
    '',
    '- [bel@fho.dk](mailto:bel@fho.dk)',
    '',
  ].join('\n'),
  'utf8'
);

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
