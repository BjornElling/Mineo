/* Service worker til PWA-installation og versionssikre lazy assets.
 *
 * KILDEFIL — ikke et deploybart asset. `__MINEO_BUILD_VERSION__` substitueres af
 * `mineoServiceWorkerBundle`-pluginet i `vite.mineo.config.ts`, som emitterer den færdige
 * `sw.js`. Filen ligger derfor bevidst UDEN for `public/`: lå den der, ville publicDir-kopieringen
 * overskrive det emitterede output med den usubstituerede kilde.
 *
 * Versionen er indbagt i selve filens bytes — ikke kun i registrerings-URL'ens query. Det er
 * forskellen på, om `registration.update()` overhovedet kan opdage en deploy: query'en er den
 * samme, så længe klienten kører den samme build, mens bytes ændrer sig ved hver ny build.
 *
 * Trust-kritisk:
 * - Kun immutable, hash-navngivne Vite-assets precaches.
 * - Ingen runtime-cache.
 * - Ingen HTML-/rute-/API-interception.
 *
 * Den aktive app-version skal kunne hente sine egne lazy chunks, selv om en senere deploy har
 * fjernet dem fra origin. Hash-navne gør det sikkert at beholde tidligere build-caches: et navn
 * peger altid på samme indhold, og nye navigationer beder kun om den nye app-shells hashes.
 */

const BUILD_VERSION = '__MINEO_BUILD_VERSION__';
const CACHE_PREFIX = 'mineo-build-assets:';
const ASSET_MANIFEST_PATH = '/pwa-assets.json';
const ASSET_PATH_PATTERN = /^\/assets\/[A-Za-z0-9._-]+$/;

const getBuildCacheName = () => `${CACHE_PREFIX}${BUILD_VERSION}`;

const getAssetUrls = async () => {
  const response = await fetch(ASSET_MANIFEST_PATH, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`PWA-assetmanifest kunne ikke hentes (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.assets) || payload.assets.length === 0) {
    throw new Error('PWA-assetmanifest har ugyldigt indhold.');
  }

  // Manifestet hentes fra origin, mens versionen er indbagt i workeren. Lander en deploy mellem
  // de to, ville en cache NAVNGIVET denne build blive fyldt med den NÆSTE builds assets — og denne
  // builds egne lazy chunks ville aldrig blive cachet. Fejlen ville først vise sig ved et senere
  // download. Derfor fail-closed her, på samme linje som en ufuldstændig cache.
  if (payload.version !== BUILD_VERSION) {
    throw new Error(
      `PWA-assetmanifestet hører til en anden build (${String(payload.version)} ≠ ${BUILD_VERSION}).`
    );
  }

  const assetPaths = payload.assets.map((asset) => `/${asset}`);
  if (!assetPaths.every((assetPath) => ASSET_PATH_PATTERN.test(assetPath))) {
    throw new Error('PWA-assetmanifest indeholder en ugyldig asset-sti.');
  }
  return assetPaths;
};

const precacheBuildAssets = async () => {
  const [cacheName, assetUrls] = await Promise.all([Promise.resolve(getBuildCacheName()), getAssetUrls()]);
  const cache = await caches.open(cacheName);
  await cache.addAll(assetUrls);
};

const findCachedAsset = async (request) => {
  const cacheNames = await caches.keys();
  const buildCacheNames = cacheNames.filter((cacheName) => cacheName.startsWith(CACHE_PREFIX));

  for (const cacheName of buildCacheNames) {
    const cache = await caches.open(cacheName);
    const response = await cache.match(request);
    if (response) return response;
  }
  return undefined;
};

self.addEventListener('install', (event) => {
  // En worker installeres kun, når ALLE den versions immutable assets er i cache. En halv cache
  // ville være værre end ingen worker: den kunne først fejle under en senere download.
  event.waitUntil(precacheBuildAssets());
});

self.addEventListener('activate', () => {
  // INGEN `clients.claim()`. En nyaktiveret worker må aldrig overtage et allerede åbent dokument:
  // invariantet er, at en åben session kører videre på sin egen version, indtil brugeren starter en
  // ny. Med claim ville et andet fanebladss levende sag kunne skifte version under hænderne på
  // brugeren. Klienter, der starter EFTER aktiveringen, styres af denne worker uden videre.
  //
  // Tidligere build-caches slettes bevidst ikke: en anden åben klient kan stadig afvikle gamle lazy
  // imports, og dens eksakte hash-assets skal leve videre, indtil browserens egen lagerrydning eller
  // brugeren rydder website-data.
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !ASSET_PATH_PATTERN.test(url.pathname)) return;

  // Interceptionen er med vilje snæver: hverken HTML, SPA-ruter, worker, manifest eller data kan
  // komme fra en gammel cache. Kun immutable hash-assets må overleve en deploy.
  event.respondWith(findCachedAsset(request).then((response) => response ?? fetch(request)));
});

self.addEventListener('message', (event) => {
  // MÅ IKKE FJERNES. En ventende worker aktiverer af sig selv først, når den gamle kontrollerer NUL
  // klienter, og en almindelig genindlæsning når aldrig nul: det gamle dokument lever, indtil
  // svarets headere er modtaget. Uden denne besked ville en installeret PWA, som brugeren sjældent
  // lukker helt, i praksis aldrig kunne opdatere.
  //
  // Sikkerheden ligger i, HVORNÅR klienten sender beskeden: `serviceWorkerBootstrap` sender den kun
  // før render, hvor der ikke findes brugerarbejde, og genindlæser umiddelbart efter, så dokument og
  // worker altid er samme build.
  if (event?.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
