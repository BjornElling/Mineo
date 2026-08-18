import { expect, test, type Page } from '@playwright/test';

import { BROWSER_LANE_TAG } from './support/lanes';

/**
 * Det FÆLLES regelsæt for overlays (`keyboard-navigation.md` §Overlay-adfærd).
 *
 * Testene kører i rigtige browsere, fordi netop de to ting, de måler, ikke kan måles i JSDOM:
 *
 *  - **Tab-fangst.** JSDOM implementerer ikke browserens tab-traversering. En jsdom-test kan derfor
 *    være grøn, mens fokus i praksis vandrer ud af vinduet — det skete: en jsdom-test bekræftede,
 *    at `FocusTrap` var monteret, men fangsten virkede ikke, fordi sidens egen navigation overtog
 *    Tab. Fangst SKAL måles her.
 *  - **Tilbage-knappen.** Kræver ægte `history`-adfærd.
 *
 * Begge dele er netop dét, browsermotorerne gør forskelligt — Tab-rækkefølgen mellem knapper, links
 * og containere er ikke ens i Chromium, Gecko og WebKit. Derfor kører hele filen i browserbanen.
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const collectRuntimeErrors = (page: Page): string[] => {
  const runtimeErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  page.on('pageerror', (error) => runtimeErrors.push(error.message));
  return runtimeErrors;
};

const openLicense = async (page: Page) => {
  const trigger = page.locator('button.icon-text-link', { hasText: 'MIT-licensen' });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  return trigger;
};

/** Er fokus inde i et overlay lige nu? */
const focusIsInsideOverlay = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.activeElement?.closest('[data-mineo-overlay-root="true"]') !== null
    && document.activeElement?.closest('[data-mineo-overlay-root="true"]') !== undefined);

test.describe('Overlay: tastaturet bliver inde i vinduet', { tag: BROWSER_LANE_TAG }, () => {
  test('Tab forlader ALDRIG licensvinduet, uanset hvor mange gange der trykkes', async ({ page }) => {
    // Fundet: fokus vandrede ud i siden bagved. Årsagen var ikke en manglende `FocusTrap` — den var
    // monteret — men at `Container` ejer Tab for hele siden og kun gav slip på hændelser fra uden
    // for sit DOM-subtræ. Licensvinduet renderes INLINE og var derfor «indenfor».
    const runtimeErrors = collectRuntimeErrors(page);
    await login(page);
    await openLicense(page);

    for (let step = 0; step < 10; step += 1) {
      await page.keyboard.press('Tab');
      expect(await focusIsInsideOverlay(page), `Tab #${String(step + 1)} forlod overlayet`).toBe(true);
    }

    // Og samme vej tilbage.
    for (let step = 0; step < 5; step += 1) {
      await page.keyboard.press('Shift+Tab');
      expect(await focusIsInsideOverlay(page), `Shift+Tab #${String(step + 1)} forlod overlayet`).toBe(true);
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('bekræftelsesdialogen holder også tastaturet inde', async ({ page }) => {
    // Modprøven på den anden monteringsform: en PORTALERET MUI-dialog. Begge former skal opføre sig
    // ens — det er hele pointen med ét fælles regelsæt.
    await login(page);
    await page.getByRole('button', { name: /Slet alt/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    for (let step = 0; step < 8; step += 1) {
      await page.keyboard.press('Tab');
      expect(await focusIsInsideOverlay(page), `Tab #${String(step + 1)} forlod dialogen`).toBe(true);
    }
  });
});

test.describe('Overlay: lukkeveje', { tag: BROWSER_LANE_TAG }, () => {
  test('tilbage-knappen lukker vinduet OG bliver på siden', async ({ page }) => {
    // Brugerkrav 2026-08-15. Før navigerede tilbage SIDEN væk under det åbne vindue: målt gik
    // `/mineo` → `/mineo/stamdata`, så brugeren mistede både vinduet og sin plads.
    await login(page);
    const urlBefore = new URL(page.url()).pathname;
    const trigger = await openLicense(page);

    await page.goBack();

    await expect(page.getByRole('dialog')).toBeHidden();
    expect(new URL(page.url()).pathname).toBe(urlBefore);
    // Fokus skal tilbage til den knap, vinduet blev åbnet med — samme regel som de øvrige lukkeveje.
    await expect(trigger).toBeFocused();
  });

  /**
   * Lukkes overlayet ad en anden vej end tilbage-knappen, skal dets historik-trin FORBRUGES — ellers
   * ville det næste tilbage-tryk ramme et dødt trin og se ud som om, tilbage-knappen ikke virkede.
   *
   * Prøven er derfor funktionel: efter lukningen skal ét tilbage-tryk føre til den FORRIGE SIDE.
   * Testen bygger selv den historik op (`/mineo/stamdata` → `/mineo`), så målet er entydigt.
   *
   * To tidligere udkast målte det forkerte og er værd at nævne, fordi begge så rigtige ud:
   *  - «efterfølgende goBack forlader siden» — browser-specifikt, hvad der ligger under `/mineo`,
   *    så testen målte browserens historik-seed.
   *  - «history.length er tilbage på sin oprindelige værdi» — `history.back()` flytter POINTEREN
   *    og afkorter ikke stakken, så længden ændrer sig aldrig. Assertionen kunne pr. konstruktion
   *    ikke blive grøn, uanset om koden var rigtig.
   */
  for (const closing of [
    { name: 'Escape', act: async (page: Page) => { await page.keyboard.press('Escape'); } },
    { name: 'lukkeknappen', act: async (page: Page) => { await page.getByRole('button', { name: 'Luk' }).click(); } },
    {
      name: 'backdrop-klik',
      act: async (page: Page) => {
        await page.getByTestId('license-backdrop').click({ position: { x: 5, y: 5 } });
      },
    },
  ]) {
    test(`${closing.name} lukker og efterlader ikke et dødt historik-trin`, async ({ page }) => {
      await login(page);
      // Byg en kendt historik, så «tilbage» har et entydigt mål at lande på.
      await page.goto('/mineo/stamdata');
      await page.goto('/mineo');
      const urlBefore = new URL(page.url()).pathname;

      await openLicense(page);
      await closing.act(page);
      await expect(page.getByRole('dialog')).toBeHidden();
      // Lukningen må ikke i sig selv have navigeret væk.
      expect(new URL(page.url()).pathname).toBe(urlBefore);

      // Ét tilbage-tryk skal nu føre til den forrige SIDE — ikke forbruge overlayets døde trin.
      await page.goBack();
      await expect.poll(() => new URL(page.url()).pathname, { timeout: 4000 })
        .toBe('/mineo/stamdata');
    });
  }
});
