import { expect, test, type Page } from '@playwright/test';

import { setVerbatimFieldValueAndSettle } from './support/mineoTest';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';
const CUTOFF_MESSAGE = 'Der er angivet svie/smerte efter datoen for en ménafgørelse (16-09-2024)';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

/** Datoindtastning gennem den delte, tidsrobuste totrins-helper (se `support/mineoTest.ts`). */
const setDate = setVerbatimFieldValueAndSettle;

test.describe('Svie/smerte efter ménafgørelse', () => {
  test('viser rød ring, konkret tooltip og samme fejl på Beregning', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    await page.getByRole('checkbox', { name: 'Truffet afgørelse om varige mén på 5 % eller derover' }).check();
    await setDate(page.locator("input[name='menAfgoerelseDato']"), '16-09-2024');

    const svieTable = page.locator('table').filter({ hasText: 'Tilstand' }).first();
    const row = svieTable.locator('tbody tr').first();
    const dateInputs = row.locator('input[data-mineo-field-address]');
    const fra = dateInputs.nth(0);
    const til = dateInputs.nth(1);
    await setDate(fra, '17-09-2024');
    await setDate(til, '01-10-2024');

    await row.getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await expect(fra).toHaveAttribute('aria-invalid', 'true');
    await expect(til).toHaveAttribute('aria-invalid', 'true');
    await fra.hover();
    await expect(page.getByRole('tooltip', { name: CUTOFF_MESSAGE })).toBeVisible();

    await page.mouse.move(0, 0);
    await page.getByRole('tab', { name: 'Beregning' }).click();
    const calculationPanel = page.getByRole('tabpanel').filter({ hasText: 'Fejl og advarsler' });
    await expect(calculationPanel.getByText(CUTOFF_MESSAGE, { exact: true })).toBeVisible();
    await expect(calculationPanel.getByText('Ingen gyldige datoer:', { exact: false })).toHaveCount(0);

    await page.screenshot({ path: testInfo.outputPath('svie-smerte-men-cutoff.png'), fullPage: false });
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});
