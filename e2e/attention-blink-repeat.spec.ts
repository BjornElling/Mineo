import { expect, login, openPage, test } from './support/mineoTest';

import { BROWSER_LANE_TAG } from './support/lanes';

/**
 * «Peg på dette felt»-markeringen skal komme IGEN ved hver udløsning
 * (`keyboard-navigation.md` §«Peg på dette felt»-markeringen).
 *
 * Testen kører i rigtige browsere og tæller `animationstart`, fordi det er den ENESTE måde at se en
 * GENSTART. Både «klassen er til stede» og et skærmbillede ville se ens ud, uanset om animationen
 * faktisk kørte igen – og det var netop forskellen mellem fejlen og rettelsen: klassen stod der hele
 * tiden, men animationen var spillet af. Målt før rettelsen gav tre klik 1, 1, 1; efter: 1, 2, 3.
 */

// Browserbanen: en genstartet CSS-animation er præcis dét, motorerne håndterer forskelligt, og
// testen fandt i sin tid en flakiness, der kun viste sig i nogle af dem.
test.describe('Gentagen feltmarkering', { tag: BROWSER_LANE_TAG }, () => {
  test('en afvist omregnings-aktivering ryster togglen og markerer cellen på stedet ved HVERT klik', async ({ page }) => {
    await login(page);
    // Brug den synlige navigation: direkte `goto` til den lazy route kunne i Firefox efterlade
    // arbejdsfladen tom, selv om brugeren altid når tabellen gennem sidemenuen.
    await openPage(page, 'Årslønsberegning');
    await expect(page).toHaveURL(/\/aarsloen$/);
    // Tabellen skal være monteret, før togglen kan afvises mod dens imperative handle.
    // Togglen ligger EFTER tabellen i DOM, så dens synlighed beviser ikke, at periodens celle-ref
    // allerede kan modtage markeringen – det var årsagen til den tværbrowser-flakiness, testen fandt.
    await expect(page.locator('input[placeholder="mm"]').first()).toBeVisible();

    await page.evaluate(() => {
      (window as unknown as { __blinkStarts: number; __blinkRemovals: number }).__blinkStarts = 0;
      (window as unknown as { __blinkRemovals: number }).__blinkRemovals = 0;
      (window as unknown as { __shakeStarts: number }).__shakeStarts = 0;
      document.addEventListener('animationstart', (event) => {
        const target = event.target as HTMLElement | null;
        if (target?.classList?.contains('mineo-field-attention-blink') === true) {
          (window as unknown as { __blinkStarts: number }).__blinkStarts += 1;
        }
        if (target?.classList?.contains('mineo-toggle-refusal-shake') === true) {
          (window as unknown as { __shakeStarts: number }).__shakeStarts += 1;
        }
      }, true);
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const target = mutation.target as HTMLElement;
          if (
            mutation.type === 'attributes'
            && mutation.attributeName === 'class'
            && mutation.oldValue?.split(/\s+/).includes('mineo-field-attention-blink') === true
            && !target.classList.contains('mineo-field-attention-blink')
          ) {
            (window as unknown as { __blinkRemovals: number }).__blinkRemovals += 1;
          }
        }
      }).observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
        attributeOldValue: true,
      });
    });
    const blinkStarts = () =>
      page.evaluate(() => (window as unknown as { __blinkStarts: number }).__blinkStarts);
    const blinkRemovals = () =>
      page.evaluate(() => (window as unknown as { __blinkRemovals: number }).__blinkRemovals);
    const shakeStarts = () =>
      page.evaluate(() => (window as unknown as { __shakeStarts: number }).__shakeStarts);

    // Uden gyldig periode afvises aktiveringen, og afvisningen peger på den celle, brugeren skal udfylde.
    const toggle = page.locator('input[name="omregningTilFuldtAar"]');

    // Togglen ryster selv, og cellen blinker HVOR den står – siden må ikke flytte sig
    // (page-component-contract §11.1b). Togglens position i viewporten afslører enhver scroll.
    const toggleTop = async () => (await toggle.boundingBox())?.y;
    await toggle.scrollIntoViewIfNeeded();
    const topBefore = await toggleTop();

    for (const attempt of [1, 2, 3]) {
      await toggle.click();
      await expect.poll(blinkStarts, { timeout: 3000 }).toBe(attempt);
      await expect.poll(shakeStarts, { timeout: 3000 }).toBe(attempt);
      await expect(toggle).not.toBeChecked();
      expect(await toggleTop()).toBe(topBefore);
      // Helperen fjerner klassen efter hele markeringen. Denne DOM-mutation er motoruafhængig, i
      // modsætning til `animationend`, som ikke nødvendigvis bobler fra den CSS-animerede descendant.
      await expect.poll(blinkRemovals, { timeout: 3000 }).toBe(attempt);
    }
  });
});
