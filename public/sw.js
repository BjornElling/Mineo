/* Service worker til PWA-installation og versionssikre lazy assets.
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

const CACHE_PREFIX = 'mineo-build-assets:';
const ASSET_MANIFEST_PATH = '/pwa-assets.json';
const ASSET_PATH_PATTERN = /^\/assets\/[A-Za-z0-9._-]+$/;

const getBuildCacheName = () => {
  const version = new URL(self.location.href).searchParams.get('v');
  if (version === null || version === '') {
    throw new Error('Service worker mangler build-version.');
  }
  return `${CACHE_PREFIX}${version}`;
};

const getAssetUrls = async () => {
  const response = await fetch(ASSET_MANIFEST_PATH, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`PWA-assetmanifest kunne ikke hentes (${response.status}).`);
  }

  const payload = await response.json();
  if (!payload || !Array.isArray(payload.assets) || payload.assets.length === 0) {
    throw new Error('PWA-assetmanifest har ugyldigt indhold.');
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

self.addEventListener('activate', (event) => {
  // Tidligere build-caches slettes bevidst ikke. En ny worker kan tage kontrol over en anden åben
  // klient, mens den stadig afvikler gamle lazy imports; dens eksakte hash-assets skal derfor leve
  // videre, indtil browserens egen lagerrydning eller brugeren rydder website-data.
  event.waitUntil(self.clients.claim());
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
  if (event?.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
