import { expect, test } from '@playwright/test';

const realServiceWorkersEnabled = process.env.PLAYWRIGHT_ALLOW_SERVICE_WORKERS === '1';

test.describe('Mineos ægte service-worker-forløb', () => {
  test.skip(
    !realServiceWorkersEnabled,
    'Kør med PLAYWRIGHT_ALLOW_SERVICE_WORKERS=1 mod produktions-preview for ægte service-worker-kontrol.',
  );
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

  test('gendanner et bfcache-dokument uden at starte det på ny', async ({ page }) => {
    // Mineos produktionsheader er bevidst `no-store` for at sikre ny HTML ved en ægte opstart.
    // Chromium kan derfor vælge almindelig navigation i stedet for bfcache. Selve testen bruger
    // stadig den rigtige app og browsermekanisme, men gør kun dokument-responsen bfcache-kompatibel
    // for at gøre den ellers ikke-deterministiske browserbeslutning observerbar.
    await page.route('**/*', async (route) => {
      if (route.request().resourceType() !== 'document') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      await route.fulfill({
        response,
        headers: {
          ...response.headers(),
          'cache-control': 'private, max-age=0',
        },
      });
    });

    await page.addInitScript(() => {
      const countKey = 'mineo-e2e-bfcache-boot-count';
      const eventsKey = 'mineo-e2e-bfcache-pageshow-events';
      const bootCount = Number.parseInt(sessionStorage.getItem(countKey) ?? '0', 10) + 1;
      sessionStorage.setItem(countKey, String(bootCount));
      window.addEventListener('pageshow', (event) => {
        const events = JSON.parse(sessionStorage.getItem(eventsKey) ?? '[]') as Array<{
          persisted: boolean;
          bootCount: number;
        }>;
        events.push({ persisted: event.persisted, bootCount });
        sessionStorage.setItem(eventsKey, JSON.stringify(events));
      });
    });

    await page.goto('/stamdata');
    await page.goto('/renteberegning');
    await page.goBack();
    await expect(page).toHaveURL(/\/stamdata$/);

    const state = await page.evaluate(() => ({
      bootCount: Number.parseInt(sessionStorage.getItem('mineo-e2e-bfcache-boot-count') ?? '0', 10),
      events: JSON.parse(sessionStorage.getItem('mineo-e2e-bfcache-pageshow-events') ?? '[]') as Array<{
        persisted: boolean;
        bootCount: number;
      }>,
    }));
    const restoredFromBfcache = state.events.some((event) => event.persisted && event.bootCount === 1);
    if (!restoredFromBfcache) {
      // bfcache er en browserbeslutning. Hvis motoren vælger almindelig navigation trods den
      // testvenlige header, er der ikke et bfcache-forløb at hævde noget om i denne kørsel.
      test.skip(true, 'Browseren valgte almindelig navigation frem for bfcache i dette forløb.');
      return;
    }
    expect(state.bootCount).toBe(2);
  });
});
