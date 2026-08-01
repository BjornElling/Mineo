import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_ROUTES } from '../../config/pageNavigation';

const HEADERS_PATH = resolve('public/_headers');

const readHeaders = (): string => readFileSync(HEADERS_PATH, 'utf8');

const expectNoCacheRule = (headers: string, path: string): void => {
  const escapedPath = path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  expect(headers).toMatch(new RegExp(`(^|\\r?\\n)${escapedPath}\\r?\\n  Cache-Control: no-cache, no-store, must-revalidate(\\r?\\n|$)`));
};

describe('PWA cache headers', () => {
  it('revaliderer HTML, manifest, service worker og alle SPA-ruter', () => {
    const headers = readHeaders();

    for (const path of [
      '/',
      '/index.html',
      '/open',
      '/manifest.json',
      '/sw.js',
      ...Object.values(APP_ROUTES),
      '/indstillinger',
      '/mineo',
    ]) {
      expectNoCacheRule(headers, path);
    }
  });

  it('beholder immutable cache på hashed Vite-assets', () => {
    const headers = readHeaders();

    expect(headers).toContain('/assets/*\n  Cache-Control: public, max-age=31536000, immutable');
  });
});
