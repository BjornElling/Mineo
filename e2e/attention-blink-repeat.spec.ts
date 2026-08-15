import { expect, test, type Page } from '@playwright/test';

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

test('en afvist omregnings-aktivering markerer cellen ved HVERT klik', async ({ page }) => {
  await login(page);
  await page.goto('/aarsloen');
  // Tabellen skal være monteret, før togglen kan afvises mod den.
  await expect(page.locator('input[role="checkbox"]').first()).toBeVisible();

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

  // Togglen er den første kontakt på siden; uden gyldig periode afvises aktiveringen, og
  // afvisningen peger på den celle, brugeren skal udfylde.
  const toggle = page.locator('input[role="checkbox"]').first();

  for (const attempt of [1, 2, 3]) {
    await toggle.click();
    await expect.poll(blinkStarts, { timeout: 3000 }).toBe(attempt);
    // Lad markeringen løbe helt ud, så næste runde ikke bare aflæser den forrige animation.
    await page.waitForTimeout(BLINK_SETTLE_MS);
  }
});
