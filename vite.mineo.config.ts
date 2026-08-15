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

const SERVICE_WORKER_SOURCE_PATH = path.resolve(__dirname, 'sw/mineoServiceWorker.js');
const SERVICE_WORKER_VERSION_PLACEHOLDER = '__MINEO_BUILD_VERSION__';

/**
 * Build-versionen kommer fra `.env.build-info.local` (genereret af `scripts/generate-build-info.mjs`)
 * og eksponeres til app-koden som `import.meta.env.VITE_APP_VERSION` i `vite.config.ts`. Node-siden
 * af buildet kan ikke læse `src/config/buildInfo.ts` — det er app-kode — så versionen læses her fra
 * samme `define`, som app-koden selv får sin fra. Én kilde, to forbrugere.
 */
const resolveBuildVersion = (define: Record<string, unknown> | undefined): string => {
  const defined = define?.['import.meta.env.VITE_APP_VERSION'];
  const version = typeof defined === 'string' ? (JSON.parse(defined) as unknown) : undefined;
  if (typeof version !== 'string' || version.trim() === '') {
    throw new Error(
      'Mineo-buildet mangler VITE_APP_VERSION. Kør scripts/generate-build-info.mjs før build: '
      + 'en service worker uden ægte build-version kan hverken navngive sin cache eller opdage en deploy.'
    );
  }
  return version.trim();
};

/**
 * Emitterer buildets to PWA-artefakter som ét sammenhængende par:
 *
 * - `sw.js` med build-versionen indbagt i sine bytes. Det er dét, der gør `registration.update()`
 *   i stand til at opdage en deploy i en åben session — registrerings-URL'ens query ændrer sig jo
 *   ikke, så længe klienten kører den samme build.
 * - `pwa-assets.json` med `version` OG `assets`. Versionsfeltet har to forbrugere: workeren afviser
 *   at installere mod et manifest fra en anden build, og klienten bruger det som det autoritative
 *   svar på «er den udrullede build en anden end den, dette dokument kører?».
 *
 * De to filer skal altid bære samme version; `scripts/verify-build-artifacts.mjs` håndhæver det.
 */
const mineoPwaArtifacts = (): Plugin => {
  let buildVersion = '';

  return {
    name: 'mineo-pwa-artifacts',
    apply: 'build',
    configResolved(config) {
      buildVersion = resolveBuildVersion(config.define);
    },
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle)
        .filter((fileName) => fileName.startsWith('assets/'))
        .sort();

      const workerSource = readFileSync(SERVICE_WORKER_SOURCE_PATH, 'utf8');
      if (!workerSource.includes(SERVICE_WORKER_VERSION_PLACEHOLDER)) {
        throw new Error(
          `Service-worker-kilden mangler ${SERVICE_WORKER_VERSION_PLACEHOLDER}; versionen ville ikke blive indbagt.`
        );
      }

      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: workerSource.replaceAll(SERVICE_WORKER_VERSION_PLACEHOLDER, buildVersion),
      });

      this.emitFile({
        type: 'asset',
        fileName: 'pwa-assets.json',
        source: `${JSON.stringify({ version: buildVersion, assets })}\n`,
      });
    },
  };
};

export default defineConfig(
  mergeConfig(baseConfig, {
    plugins: [mineoPwaArtifacts(), mineoDevPwaManifest()],
    server: {
      // Mineos modultræ er stort, og den første transform af det koster over 30 sekunder på
      // Windows. Uden opvarmning betales den regning først når browserne forbinder — og under en
      // E2E-kørsel rammer alle workers devserveren samtidig i netop det øjeblik. Opvarmningen
      // flytter kaskaden til serverens opstart, hvor den overlapper med browserstarten i stedet
      // for at konkurrere med den.
      warmup: {
        clientFiles: ['./src/main.tsx'],
      },
    },
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
