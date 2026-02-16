/* Minimal service worker for PWA installability.
 *
 * Trust-critical note:
 * - No precache.
 * - No runtime cache.
 * - No fetch interception.
 *
 * This avoids serving stale calculation logic/assets from a cache.
 */

self.addEventListener('install', (event) => {
  // Intentionally empty: do not precache.
  // Activate immediately (no caching => low risk of serving stale assets).
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Claim clients so the SW is "active" for installability, but do not cache anything.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
