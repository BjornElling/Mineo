import { expect, test } from '@playwright/test';

import { setFieldValueAndSettle } from './support/mineoTest';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('Satser — afslutning af singleton-draft med Tab', () => {
  test('Tab og Shift+Tab afslutter Satsår og bevarer fokus på feltet', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Satser' }).click();

    const input = page.locator('input[name="aargang"]');
    const download = page.locator('main').getByRole('button');
    await expect(input).toBeVisible();
    await expect(input).toHaveValue('2026');

    await setFieldValueAndSettle(input, '2027');

    await expect(input).toBeFocused();
    await expect(input).toHaveValue('2027');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(download).toBeDisabled();
    await expect(page.getByText('Vælg et gyldigt år for at se satserne.')).toBeVisible();

    await input.click();
    await expect(input).toBeEditable();
    await input.fill('2026');
    await input.press('Shift+Tab');

    await expect(input).toBeFocused();
    await expect(input).toHaveValue('2026');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(download).toBeEnabled();
    await expect(page.getByText('Arbejdsskadesatser 2026')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
