import { defineConfig, mergeConfig, type Connect, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import baseConfig from './vite.config';
import pwaManifest from './public/manifest.json';

/**
 * Chrome på desktop sammenligner den installerede PWA med et fuldt origin-bundet app-id i
 * `related_applications`. Dev/preview får en request-bundet variant, mens produktionsfilen er bundet
 * til Mineos faste offentlige origin (`https://mineo.dk`). Relative self-relationer ser korrekte ud i
 * manifestet, men Chromium returnerer ikke den installerede PWA fra `getInstalledRelatedApps()`, når
 * browserens installerede app-id er absolut. Det ville få hjemmesiden til at vise installationsfejlen
 * for en app, der faktisk allerede er installeret.
 */
const originBoundPwaManifest = (origin: string) => {
  const appId = new URL(pwaManifest.start_url, origin).href;

  return {
    ...pwaManifest,
    id: appId,
    related_applications: [
      {
        platform: 'webapp',
        url: new URL('/manifest.json', origin).href,
        id: appId,
      },
    ],
  };
};

const serveOriginBoundPwaManifest = (https: boolean): Connect.NextHandleFunction => (
  request,
  response,
  next,
): void => {
  const requestUrl = request.url;
  const host = request.headers.host;
  if (requestUrl === undefined || host === undefined) {
    next();
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl, `${https ? 'https' : 'http'}://${host}`);
  } catch {
    next();
    return;
  }

  if (parsedUrl.pathname !== '/manifest.json') {
    next();
    return;
  }

  response.statusCode = 200;
  response.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(originBoundPwaManifest(parsedUrl.origin)));
};

const mineoDevPwaManifest = (): Plugin => ({
  name: 'mineo-dev-pwa-manifest',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use(serveOriginBoundPwaManifest(Boolean(server.config.server.https)));
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveOriginBoundPwaManifest(Boolean(server.config.preview.https)));
  },
});

/**
 * Den aktive service worker læser manifestet under installation og cacher netop denne builds
 * immutable Vite-assets. Det gør en allerede åben PWA-version selvstændig, når en senere deploy
 * fjerner dens hash-navngivne lazy chunks.
 */
const mineoPwaAssetManifest = (): Plugin => ({
  name: 'mineo-pwa-asset-manifest',
  apply: 'build',
  generateBundle(_, bundle) {
    const assets = Object.keys(bundle)
      .filter((fileName) => fileName.startsWith('assets/'))
      .sort();

    this.emitFile({
      type: 'asset',
      fileName: 'pwa-assets.json',
      source: `${JSON.stringify({ assets })}\n`,
    });
  },
});

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [mineoPwaAssetManifest(), mineoDevPwaManifest()],
    build: {
      outDir: 'dist/mineo',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'index.html'),
        },
      },
    },
  })
);
