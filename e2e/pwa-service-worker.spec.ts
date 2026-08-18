import { expect, test } from './support/mineoTest';

/**
 * Service workers er blokeret i resten af suiten (`playwright.config.ts`): en cachet forgænger må
 * aldrig kunne besvare den næste tests requests. Netop denne fil har det modsatte formål, så den
 * åbner for dem i SIT eget testomfang.
 *
 * Åbningen stod før i miljøvariablen `PLAYWRIGHT_ALLOW_SERVICE_WORKERS`, og fordi ingen kørsel —
 * hverken lokalt eller i CI — satte den, blev filens to tests ALTID sprunget over. En test, der
 * aldrig kører, beskytter ingenting; den ligner blot dækning i optællingen. `test.use` udtrykker
 * det samme behov som en egenskab ved filen, så det ikke længere afhænger af, hvordan suiten startes.
 */
test.describe('Mineos ægte service-worker-forløb', () => {
  test.use({ serviceWorkers: 'allow' });

  test.skip(({ browserName }) => browserName !== 'chromium', 'Denne livscykluskontrol køres én gang i Chromium.');

  test('går fra waiting til active efter SKIP_WAITING i en rigtig service worker', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/sw.js?e2e-v1', {
        scope: '/e2e-service-worker/',
      });
      await registration.update();
      const deadline = Date.now() + 15_000;
      while (registration.active?.state !== 'activated' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (registration.active?.state !== 'activated') {
        throw new Error('Test-service-workeren blev ikke aktiv.');
      }
    });

    // En worker uden clients.claim() styrer først en ny navigation; det er netop den egenskab,
    // Mineos versionsmodel bygger på for at holde andre åbne dokumenter på deres egen version.
    await page.goto('/e2e-service-worker/');
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
      .toContain('e2e-v1');

    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.register('/sw.js?e2e-v2', {
        scope: '/e2e-service-worker/',
      });
      await registration.update();
      const deadline = Date.now() + 15_000;
      while (registration.waiting === null && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (registration.waiting === null) {
        throw new Error('Den nye service worker nåede ikke waiting.');
      }
      const waiting = registration.waiting;
      const activated = new Promise<void>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Service workeren blev ikke aktiv.')), 15_000);
        const onStateChange = (): void => {
          if (waiting.state === 'activated') {
            window.clearTimeout(timeout);
            waiting.removeEventListener('statechange', onStateChange);
            resolve();
          } else if (waiting.state === 'redundant') {
            window.clearTimeout(timeout);
            waiting.removeEventListener('statechange', onStateChange);
            reject(new Error('Den ventende service worker blev redundant.'));
          }
        };
        waiting.addEventListener('statechange', onStateChange);
      });

      waiting.postMessage({ type: 'SKIP_WAITING' });
      await activated;
      if (registration.active?.scriptURL !== waiting.scriptURL) {
        throw new Error('En anden worker blev aktiv end den, der stod waiting.');
      }
    });
  });

  /*
   * HER LÅ «gendanner et bfcache-dokument uden at starte det på ny».
   *
   * Testen kunne ikke lade sig gøre, og det viste den ikke: den sluttede med en `test.skip` på sin
   * egen «browseren valgte almindelig navigation»-gren, og den gren blev ramt HVER gang. Målt her:
   * dokumentet blev hentet igen ved tilbage-navigationen i alle kørsler — også når serveren gav en
   * bfcache-egnet `Cache-Control` i stedet for produktionens `no-store`, og også uden den
   * request-interception, testen ellers brugte til at sætte headeren.
   * Årsagen er Playwright selv — Chromium lægger ikke et dokument i bfcache, mens DevTools-protokollen
   * er tilsluttet, og den er tilsluttet i enhver Playwright-kørsel.
   *
   * Invarianten den skulle beskytte — at Mineo IKKE genindlæser sig selv ved en bfcache-gendannelse
   * (`App.tsx`) — er en FRAVÆRS-påstand om vores egen kode, ikke om browserens beslutning. Den er
   * derfor flyttet til `src/__tests__/quality/bfcacheReloadAbsence.test.ts`, hvor den faktisk kan
   * hævdes hver gang. Genopliv ikke testen her uden først at måle, at bfcache overhovedet indtræffer.
   */
});
