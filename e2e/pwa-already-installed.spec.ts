import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

/**
 * Enhedstestene beviser komponentens logik mod mocks. Denne test beviser det, mocks ikke kan:
 * at de RIGTIGE browser-signaler når frem — `getInstalledRelatedApps` og standalone-display-mode —
 * og at dialogen, knapperne og fokus opfører sig i en ægte browser-motor.
 *
 * Signalerne installeres via `addInitScript`, fordi ingen af dem kan fremkaldes ægte i en testbrowser:
 * Playwright kan hverken installere en PWA eller starte siden i et PWA-vindue.
 */

type InstallationScenario = 'installed' | 'notInstalled' | 'runningInPwa';

const applyScenario = async (page: Page, scenario: InstallationScenario): Promise<void> => {
  await page.addInitScript((activeScenario: InstallationScenario) => {
    // Browseren fyrer ikke `beforeinstallprompt` mod en testserver, så uden dette ville
    // «ikke installeret»-scenariet ikke kunne skelnes fra de øvrige.
    Object.defineProperty(navigator, 'getInstalledRelatedApps', {
      configurable: true,
      value: () => Promise.resolve(
        activeScenario === 'installed'
          ? [{ platform: 'webapp', url: 'https://mineo.example/manifest.json', id: 'https://mineo.example/' }]
          : []
      ),
    });

    if (activeScenario === 'runningInPwa') {
      // Efterlign PWA-vinduet: kun display-mode-forespørgslen må ændre svar, alle andre
      // media queries skal fortsat besvares af den ægte motor, så layoutet ikke forvrides.
      //
      // Det ÆGTE MediaQueryList-objekt returneres med `matches` overskrevet — det må ikke erstattes
      // af en objekt-kopi: `addEventListener`/`removeEventListener` ligger på prototypen, så en
      // spread ville tabe dem, og abonnementet i `useInstalledPwaDisplayMode` ville kaste.
      const nativeMatchMedia = window.matchMedia.bind(window);
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (query: string) => {
          const mediaQueryList = nativeMatchMedia(query);
          if (query.includes('display-mode: standalone')) {
            Object.defineProperty(mediaQueryList, 'matches', {
              configurable: true,
              get: () => true,
            });
          }
          return mediaQueryList;
        },
      });
    }
  }, scenario);
};

const openMineoPage = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page.getByText('Teknisk', { exact: true })).toBeVisible();
};

const clickInstallLink = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'Installér hjælpeprogram' }).click();
};

const exposeInstallPrompt = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const probe = { promptCalled: false, defaultPrevented: false };
    Object.defineProperty(window, '__mineoInstallPromptProbe', {
      configurable: true,
      value: probe,
    });

    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.defineProperties(event, {
      prompt: {
        configurable: true,
        value: () => {
          probe.promptCalled = true;
          return Promise.resolve();
        },
      },
      userChoice: {
        configurable: true,
        value: Promise.resolve({ outcome: 'accepted', platform: 'web' }),
      },
    });

    window.dispatchEvent(event);
    probe.defaultPrevented = event.defaultPrevented;
  });
};

test.describe('«Installér hjælpeprogram» når hjælpeprogrammet allerede er installeret', () => {
  test('testserveren leverer et origin-bundet PWA-id til desktop-browserens installationstjek', async ({ page }) => {
    await page.goto('/');

    const manifest = await page.evaluate(async () => (
      await fetch('/manifest.json', { cache: 'no-store' }).then((response) => response.json())
    )) as {
      id: string;
      launch_handler: { client_mode: string };
      related_applications: Array<{ platform: string; url: string; id: string }>;
      protocol_handlers: Array<{ protocol: string; url: string }>;
    };
    const expectedId = new URL('/', page.url()).href;
    const expectedManifestUrl = new URL('/manifest.json', page.url()).href;

    expect(manifest.id).toBe(expectedId);
    expect(manifest.launch_handler).toEqual({ client_mode: 'focus-existing' });
    expect(manifest.related_applications).toEqual([
      { platform: 'webapp', url: expectedManifestUrl, id: expectedId },
    ]);
    expect(manifest.protocol_handlers).toEqual([
      { protocol: 'web+mineo', url: '/?mineo-launch=%s' },
    ]);
  });

  test('på hjemmesiden med installeret hjælpeprogram: dialogen tilbyder browseråbning og fallback', async ({ page }) => {
    const runtimeSignals: string[] = [];
    page.on('pageerror', (error) => runtimeSignals.push(`pageerror: ${error.message}`));

    await applyScenario(page, 'installed');
    await openMineoPage(page);
    await clickInstallLink(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Hjælpeprogrammet er allerede installeret')).toBeVisible();
    await expect(dialog.getByText(/Du behøver ikke installere det igen/)).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Åbn program' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Åbn program' })).toHaveAttribute('href', 'web+mineo://open');
    await expect(dialog.getByRole('button', { name: 'Annuller' })).toBeVisible();
    await expect(dialog.getByText(/browseren bede om tilladelse/i)).toBeVisible();
    await expect(dialog.getByText(/computerens appmenu eller skrivebord/i)).toBeVisible();

    expect(runtimeSignals).toEqual([]);
  });

  test('«Annuller» lukker dialogen uden at åbne et vindue', async ({ page, context }) => {
    await applyScenario(page, 'installed');
    await openMineoPage(page);
    await clickInstallLink(page);

    const openedPages: unknown[] = [];
    context.on('page', (newPage) => openedPages.push(newPage));

    await page.getByRole('dialog').getByRole('button', { name: 'Annuller' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    expect(openedPages).toEqual([]);
    // Brugeren skal kunne fortsætte på siden bagefter; en efterladt modal-overlay ville blokere den.
    await expect(page.getByRole('button', { name: 'Installér hjælpeprogram' })).toBeEnabled();
  });

  test('Escape lukker dialogen og fokus vender tilbage til linket', async ({ page }) => {
    await applyScenario(page, 'installed');
    await openMineoPage(page);
    await clickInstallLink(page);
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).toBeHidden();
    // Tastaturbrugeren må ikke efterlades på `body` og skulle tabbe forfra gennem hele siden.
    await expect(page.getByRole('button', { name: 'Installér hjælpeprogram' })).toBeFocused();
  });

  test('inde i PWA-vinduet: dialogen siger «allerede åbent» og har kun Luk', async ({ page }) => {
    // Standalone-tilstanden fodrer appens egen display-mode-hook. Går den i stykker, render'er
    // fejlgrænsen i stedet for siden — og en dialog-assertion alene ville ikke afsløre det.
    const runtimeSignals: string[] = [];
    page.on('pageerror', (error) => runtimeSignals.push(`pageerror: ${error.message}`));

    await applyScenario(page, 'runningInPwa');
    await openMineoPage(page);
    await clickInstallLink(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Hjælpeprogrammet er allerede åbent')).toBeVisible();
    await expect(dialog.getByText(/Du behøver ikke installere det igen/)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Luk' })).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Åbn program' })).toBeHidden();
    await expect(dialog.getByRole('button')).toHaveCount(1);

    expect(runtimeSignals).toEqual([]);
  });

  test('inde i PWA-vinduet: «Luk» åbner ikke en dublet af vinduet', async ({ page, context }) => {
    await applyScenario(page, 'runningInPwa');
    await openMineoPage(page);
    await clickInstallLink(page);

    const openedPages: unknown[] = [];
    context.on('page', (newPage) => openedPages.push(newPage));

    await page.getByRole('dialog').getByRole('button', { name: 'Luk' }).click();

    await expect(page.getByRole('dialog')).toBeHidden();
    expect(openedPages).toEqual([]);
  });

  test('uden installation starter den normale installationsvej under brugerens klik', async ({ page }) => {
    await applyScenario(page, 'notInstalled');
    await openMineoPage(page);
    await exposeInstallPrompt(page);
    await clickInstallLink(page);

    await expect.poll(() => page.evaluate(() => (
      window as Window & { __mineoInstallPromptProbe?: { promptCalled: boolean; defaultPrevented: boolean } }
    ).__mineoInstallPromptProbe)).toEqual({ promptCalled: true, defaultPrevented: true });
    await expect(page.getByRole('dialog')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Installér hjælpeprogram' })).toBeVisible();
  });

  test('uden installprompt får brugeren en konkret fallback-besked', async ({ page }) => {
    await applyScenario(page, 'notInstalled');
    await openMineoPage(page);
    await clickInstallLink(page);

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Installationsdialogen kunne ikke åbnes')).toBeVisible();
    await expect(dialog.getByText(/installationsikonet i adresselinjen/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Luk' })).toBeVisible();
  });
});
