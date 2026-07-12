import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

describe('cleanup-minprocesrente-public', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'mineo-minprocesrente-public-'));
    writeFileSync(join(tempDir, 'sw.js'), '');
    writeFileSync(join(tempDir, 'manifest.json'), '{}');
    mkdirSync(join(tempDir, 'icons'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('fjerner Mineo-PWA-assets og skriver no-cache headers for HTML', () => {
    execFileSync('node', [resolve('scripts/cleanup-minprocesrente-public.mjs'), tempDir], { encoding: 'utf8' });

    expect(existsSync(join(tempDir, 'sw.js'))).toBe(false);
    expect(existsSync(join(tempDir, 'manifest.json'))).toBe(false);
    expect(existsSync(join(tempDir, 'icons'))).toBe(false);

    const headers = readFileSync(join(tempDir, '_headers'), 'utf8');
    expect(headers).toContain('/index.html\n  Cache-Control: no-cache, no-store, must-revalidate');
    expect(headers).toContain('/minprocesrente.html\n  Cache-Control: no-cache, no-store, must-revalidate');
    expect(headers).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable');
  });

  it('overskriver den delte Disallow-robots.txt med en indekserbar robots.txt', () => {
    // Simulér at Mineos delte public/robots.txt (Disallow: /) er kopieret med ind i buildet.
    writeFileSync(join(tempDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

    execFileSync('node', [resolve('scripts/cleanup-minprocesrente-public.mjs'), tempDir], { encoding: 'utf8' });

    const robots = readFileSync(join(tempDir, 'robots.txt'), 'utf8');
    expect(robots).toContain('Allow: /');
    expect(robots).not.toContain('Disallow: /');
    expect(robots).toContain('Sitemap: https://minprocesrente.dk/sitemap.xml');
  });

  it('skriver en sitemap.xml med sitets kanoniske URL', () => {
    execFileSync('node', [resolve('scripts/cleanup-minprocesrente-public.mjs'), tempDir], { encoding: 'utf8' });

    const sitemap = readFileSync(join(tempDir, 'sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://minprocesrente.dk/</loc>');
    expect(sitemap).toContain('urlset');
  });

  it('skriver en llms.txt der følger anbefalingen (H1 + links)', () => {
    execFileSync('node', [resolve('scripts/cleanup-minprocesrente-public.mjs'), tempDir], { encoding: 'utf8' });

    const llms = readFileSync(join(tempDir, 'llms.txt'), 'utf8');
    // Mindst én H1-header.
    expect(llms).toMatch(/^# .+/m);
    // Mindst ét Markdown-link.
    expect(llms).toMatch(/\[[^\]]+\]\([^)]+\)/);
    expect(llms).toContain('https://minprocesrente.dk');
  });
});
