import { expect, test, type Locator, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

const setDate = async (input: Locator, value: string): Promise<void> => {
  await input.dblclick();
  await input.fill(value);
  await input.press('Tab');
  await expect(input).toHaveValue(value);
};

test.describe('Svie/smerte-satsår — Indsæt aktuelt årstal', () => {
  test('indsætter satsåret fra opgørelsesdatoen, falder tilbage og er et tabstop', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();

    const opgoerelseDato = page.locator("input[name='opgørelseLavetDen']");
    const satsAar = page.locator("input[name='svieSmerteSatserAar']");
    const satsAarRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Hvilket års svie/smerte-satser lægges til grund?',
    });
    const insertButton = satsAarRow.getByRole('button', { name: 'Indsæt aktuelt årstal' });

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
