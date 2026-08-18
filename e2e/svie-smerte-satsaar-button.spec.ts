import { expect, login, openPage, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

/** Datoindtastning gennem den delte, tidsrobuste totrins-helper (se `support/mineoTest.ts`). */
const setDate = setVerbatimFieldValueAndSettle;

test.describe('Svie/smerte-satsår — Indsæt årstal', () => {
  test('indsætter satsåret fra opgørelsesdatoen, falder tilbage og er et tabstop', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();

    const opgoerelseDato = page.locator("input[name='opgørelseLavetDen']");
    const satsAar = page.locator("input[name='svieSmerteSatserAar']");
    const satsAarRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Hvilket års svie/smerte-satser lægges til grund?',
    });
    const insertButton = satsAarRow.getByRole('button', { name: 'Indsæt årstal' });

    await expect(insertButton).toBeVisible();
    const expectedSatsAarFromToday = await page.evaluate(() => {
      const today = new Date();
      const yearOneMonthAfterToday = today.getFullYear() + (today.getMonth() === 11 ? 1 : 0);
      return Math.min(yearOneMonthAfterToday, 2026);
    });
    await insertButton.click();
    await expect(satsAar).toHaveValue(String(expectedSatsAarFromToday));

    await setDate(opgoerelseDato, '01-12-2024');

    // December + én måned krydser året, så knappen må bruge 2025 frem for dags dato.
    await insertButton.click();
    await expect(satsAar).toHaveValue('2025');
    await expect(insertButton).toBeFocused();

    // Når 2027 endnu ikke er i satsdata, vælges i stedet den seneste komplette række (2026).
    await setDate(opgoerelseDato, '01-12-2026');
    await insertButton.press('Enter');
    await expect(satsAar).toHaveValue('2026');
    await expect(insertButton).toBeFocused();

    // Den sideintegrerede handling ligger lige efter sit årsfelt i den normale tastaturrækkefølge.
    await satsAar.focus();
    await satsAar.press('Tab');
    await expect(insertButton).toBeFocused();

    expect(runtimeErrors).toEqual([]);
  });
});
