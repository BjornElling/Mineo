import { expect, login, test } from './support/mineoTest';
import { readFileSync } from 'node:fs';

test.describe('Venteskærm ved en ny programversion', () => {
  for (const path of ['/', '/open']) {
    for (const colorScheme of ['light', 'dark'] as const) {
      test(`${path} viser opdateringen før programkoden er hentet, ${colorScheme}`, async ({ page, runtimeErrors }, testInfo) => {
        await page.emulateMedia({ colorScheme });
        await page.addInitScript(() => {
          // Kun læsesvaret erstattes; testen skriver hverken brugerdata eller worker-caches.
          Object.defineProperty(window, 'caches', {
            configurable: true,
            value: { keys: async () => ['mineo-build-assets:tidligere-testversion'] },
          });
          const probe = { shownAt: 0, removedAt: 0 };
          Object.assign(window, { __startupUpdateProbe: probe });
          new MutationObserver(() => {
            const screen = document.getElementById('mineo-startup-update');
            if (screen && !screen.hidden && !probe.shownAt) probe.shownAt = Number(screen.dataset.shownAt);
            if (!screen && probe.shownAt && !probe.removedAt) probe.removedAt = performance.now();
          }).observe(document, { childList: true, subtree: true, attributes: true });
        });
        let releaseAssets = (): void => {};
        const assetsHeld = new Promise<void>((resolve) => { releaseAssets = resolve; });
        await page.route('**/assets/*.js', async (route) => {
          await assetsHeld;
          await route.continue();
        });
        // Opstarten og målingen skal køre samtidig: login kan først afsluttes, når målingen
        // frigiver programkoden. Begge forløb afventes, også hvis målingen fejler.
        const startupResults = await Promise.allSettled([
          (async () => { await login(page, path); })(),
          (async () => {
            try {
              const screen = page.getByRole('status');
              await expect(screen).toHaveText('Vent venligst, opdatering indlæses');
              await expect(screen).toBeVisible();
              // Programmets egen flade, så overgangen til programmet ikke skifter baggrund.
              await expect(page.locator('#mineo-startup-update')).toHaveCSS('background-color', colorScheme === 'dark' ? 'rgb(20, 20, 20)' : 'rgb(248, 249, 250)');
              // Programkoden er holdt tilbage, så Montserrat kan kun komme fra HTML'ens egen skriftflade.
              await expect.poll(() => page.evaluate(async () => {
                await document.fonts.ready;
                return [...document.fonts].some((font) => font.family.replace(/['"]/g, '') === 'Montserrat' && font.status === 'loaded');
              })).toBe(true);
              await page.screenshot({ path: testInfo.outputPath('venteskaerm.png') });
            } finally {
              releaseAssets();
            }
          })(),
        ]);
        for (const result of startupResults) {
          if (result.status === 'rejected') throw result.reason;
        }
        await expect(page.locator('#mineo-startup-update')).toHaveCount(0);
        const duration = await page.evaluate(() => {
          const probe = (window as Window & { __startupUpdateProbe?: { shownAt: number; removedAt: number } }).__startupUpdateProbe;
          if (!probe) throw new Error('Opstartsvisningen blev ikke målt.');
          return probe.removedAt - probe.shownAt;
        });
        expect(duration).toBeGreaterThanOrEqual(1000);
        expect(runtimeErrors).toEqual([]);
      });
    }
  }

  test('viser ingen opdatering ved normal opstart', async ({ page, runtimeErrors }) => {
    await page.addInitScript(() => {
      Object.assign(window, { __startupUpdateWasVisible: false });
      new MutationObserver(() => {
        const screen = document.getElementById('mineo-startup-update');
        if (screen && !screen.hidden) Object.assign(window, { __startupUpdateWasVisible: true });
      }).observe(document, { childList: true, subtree: true, attributes: true });
    });
    await login(page);
    expect(await page.evaluate(() => Reflect.get(window, '__startupUpdateWasVisible'))).toBe(false);
    expect(runtimeErrors).toEqual([]);
  });

  test('indlæser en .eo-fil afleveret under venteskærmen efter login', async ({ page, runtimeErrors }) => {
    const content = readFileSync('src/__tests__/fixtures/persistence/3.12-predecessor.eo', 'utf8');
    await page.addInitScript(({ content }) => {
      Object.defineProperty(window, 'caches', {
        configurable: true,
        value: { keys: async () => ['mineo-build-assets:tidligere-testversion'] },
      });
      // En ægte, klonbar browser-handle bruger det normale IndexedDB- og load-forløb.
      // Kun operativsystemets aflevering gennem launchQueue erstattes.
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: {
          setConsumer: (consumer: (params: { files: FileSystemFileHandle[] }) => Promise<void>) => {
            void (async () => {
              const directory = await navigator.storage.getDirectory();
              const handle = await directory.getFileHandle('venteskaerm.eo', { create: true });
              const writable = await handle.createWritable();
              await writable.write(content);
              await writable.close();
              await consumer({ files: [handle] });
            })();
          },
        },
      });
    }, { content });
    await login(page, '/open');
    await expect(page.getByRole('textbox', { name: 'Journalnr.', exact: true })).toHaveValue('J-312');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });
});
