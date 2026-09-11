import { expect, login, test } from './support/mineoTest';
import { BROWSER_LANE_TAG } from './support/lanes';

// Browserbanen er relevant her: Vites preloadError-signal og browserens 404-consolemelding er
// browsernære dele af den faktiske manglende-chunk-rejse.
test.describe('Lazy chunk recovery', { tag: BROWSER_LANE_TAG }, () => {
  test('viser recovery ved en faktisk manglende route-chunk og genindlæser først efter klik', async ({
    page,
    runtimeErrors,
  }) => {
    const missingChunkRequests: string[] = [];

    // Simulerer kun den eksterne fejl, som kontrakten beskriver: den allerede byggede, hash-navngivne
    // lazy chunk findes ikke længere på origin. Vite skal selv udløse `vite:preloadError`; testen må
    // ikke dispatch'e signalet direkte, for så ville den ikke bevise browserens dynamiske import.
    await page.route(/\/assets\/Erstatningsopgoerelse-[^/]+\.js$/, async (route) => {
      missingChunkRequests.push(route.request().url());
      await route.fulfill({
        status: 404,
        contentType: 'text/javascript',
        body: '',
      });
    });

    await login(page);
    await expect.poll(() => missingChunkRequests.length).toBeGreaterThan(0);

    const recoveryNotice = page.getByRole('alert').filter({
      hasText: 'En programdel skal genindlæses, før handlingen kan fortsætte.',
    });
    await expect(recoveryNotice).toBeVisible();
    await expect.poll(() => page.evaluate(() => (
      performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    )?.type ?? null))
      .toBe('navigate');

    await page.getByRole('button', { name: 'Genindlæs nu' }).click();

    await expect.poll(async () => {
      try {
        return await page.evaluate(() => (
          performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
        )?.type ?? null);
      } catch {
        return null;
      }
    }).toBe('reload');
    await expect(recoveryNotice).toBeVisible();
    // Firefox/WebKit rapporterer ikke nødvendigvis 404-consolefejlen eller gentager den fejlede
    // import efter reload. Det afgørende cross-browser-bevis er den første preload-fejl, synlig
    // recovery uden automatisk reload og den eksplicitte reload – ikke browserens logpolitik.
    expect(runtimeErrors.every((message) => message.includes('status of 404'))).toBe(true);
  });
});
