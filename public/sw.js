/* Minimal service worker til PWA-installation.
 *
 * Trust-kritisk:
 * - Ingen precache.
 * - Ingen runtime-cache.
 * - Ingen fetch-interception.
 *
 * Dermed kan service worker'en ikke servere forældet beregningslogik eller gamle assets.
 */

self.addEventListener('install', (event) => {
  // Bevidst tom: ingen precache.
  // Aktivér straks (ingen cache => lav risiko for forældede assets).
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Claim klienter, så service worker'en er aktiv for installability, men uden caching.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
