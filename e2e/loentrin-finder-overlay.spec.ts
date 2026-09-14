import {
  expect,
  login,
  openPage,
  test,
} from './support/mineoTest';

import { BROWSER_LANE_TAG } from './support/lanes';

/**
 * Løntrin-finderens Tab-sekvens er eksplicit og skal måles i rigtige browser-motorer.
 * Derfor kører denne rejse i browserbanen, hvor især fokusflytning og Shift+Tab er observerbar.
 */
test.describe('Løntrin-finder: åbning, fokusfangst og lukning', { tag: BROWSER_LANE_TAG }, () => {
  test('holder fokus inde, lukker med Escape og gendanner fokus til triggeren', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: /Lønindkomst/ }).click();

    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' }).click();
    await page.getByRole('button', { name: 'Ja, tilføj' }).click();
    await page.locator('[name$=":harOverenskomst"]').check();

    await page.locator('[name$=":overenskomstFilter.arbejdsgiver"]').click();
    await page.getByRole('option', { name: 'KL', exact: true }).click();
    await page.locator('[name$=":overenskomstId"]').click();
    await page.getByRole('option', { name: /^KL-overenskomsten/ }).first().click();
    await page.locator('[name$=":loenudviklingBeregningsgrundlag"]').click();
    await page.getByRole('option', { name: 'Overenskomst', exact: true }).click();

    const finder = page.getByRole('button', { name: 'Find løntrin' });
    await expect(finder).toBeVisible();
    await finder.click();

    const dialog = page.getByRole('dialog', { name: 'Find løntrin' });
    await expect(dialog).toBeVisible();

    const ansaettelse = dialog.getByRole('combobox', { name: 'Ansættelse', exact: true });
    const beloeb = dialog.getByRole('textbox', { name: 'Månedsløn', exact: true });
    const dato = dialog.getByRole('textbox', { name: 'Dato', exact: true });
    const beregn = dialog.getByRole('button', { name: 'Beregn', exact: true });

    await expect(ansaettelse).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(beloeb).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dato).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(beregn).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(ansaettelse).toBeFocused();

    await page.keyboard.press('Shift+Tab');
    await expect(beregn).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(dato).toBeFocused();

    // Lukning fra et lukket felt må ikke efterlade fokus i det forsvundne overlay eller på body.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(finder).toBeFocused();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
