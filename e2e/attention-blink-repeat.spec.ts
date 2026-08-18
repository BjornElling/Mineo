import { expect, test, type Page } from '@playwright/test';

import { BROWSER_LANE_TAG } from './support/lanes';

/**
 * «Peg på dette felt»-markeringen skal komme IGEN ved hver udløsning
 * (`keyboard-navigation.md` §«Peg på dette felt»-markeringen).
 *
 * Testen kører i rigtige browsere og tæller `animationstart`, fordi det er den ENESTE måde at se en
 * GENSTART. Både «klassen er til stede» og et skærmbillede ville se ens ud, uanset om animationen
 * faktisk kørte igen — og det var netop forskellen mellem fejlen og rettelsen: klassen stod der hele
 * tiden, men animationen var spillet af. Målt før rettelsen gav tre klik 1, 1, 1; efter: 1, 2, 3.
 */

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

/** Animationens samlede løbetid (0,5 s × 3) plus luft, så næste klik måler en ægte genstart. */
const BLINK_SETTLE_MS = 1800;

// Browserbanen: en genstartet CSS-animation er præcis dét, motorerne håndterer forskelligt, og
// testen fandt i sin tid en flakiness, der kun viste sig i nogle af dem.
test.describe('Gentagen feltmarkering', { tag: BROWSER_LANE_TAG }, () => {
  test('en afvist omregnings-aktivering markerer cellen ved HVERT klik', async ({ page }) => {
    await login(page);
    // Brug den synlige navigation: direkte `goto` til den lazy route kunne i Firefox efterlade
    // arbejdsfladen tom, selv om brugeren altid når tabellen gennem sidemenuen.
    await page.getByRole('button', { name: 'Årslønsberegning' }).click();
    await expect(page).toHaveURL(/\/aarsloen$/);
    // Tabellen skal være monteret, før togglen kan afvises mod dens imperative handle.
    // Togglen ligger EFTER tabellen i DOM, så dens synlighed beviser ikke, at periodens celle-ref
    // allerede kan modtage markeringen — det var årsagen til den tværbrowser-flakiness, testen fandt.
    await expect(page.locator('input[placeholder="mm"]').first()).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __blinkStarts: number }).__blinkStarts = 0;
      document.addEventListener('animationstart', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.classList?.contains('mineo-field-attention-blink') === true) {
          (window as unknown as { __blinkStarts: number }).__blinkStarts += 1;
        }
      }, true);
    });
    const blinkStarts = () =>
      page.evaluate(() => (window as unknown as { __blinkStarts: number }).__blinkStarts);

    // Uden gyldig periode afvises aktiveringen, og afvisningen peger på den celle, brugeren skal udfylde.
    const toggle = page.locator('input[name="omregningTilFuldtAar"]');

    for (const attempt of [1, 2, 3]) {
      await toggle.click();
      await expect.poll(blinkStarts, { timeout: 3000 }).toBe(attempt);
      // Lad markeringen løbe helt ud, så næste runde ikke bare aflæser den forrige animation.
      await page.waitForTimeout(BLINK_SETTLE_MS);
    }
  });
});
