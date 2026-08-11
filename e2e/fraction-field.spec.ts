import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('Brøkfeltet', () => {
  test('normaliserer indledende nuller og viser konkret fejl ved nævner nul', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();

    const input = page.locator("input[name='forligAnsvarsgradBroek']");
    await expect(input).toBeVisible();

    await input.dblclick();
    await input.fill('02/04');
    await input.press('Tab');
    await expect(input).toHaveValue('2/4');
    await expect(input).toHaveAttribute('aria-invalid', 'false');

    await input.dblclick();
    await input.fill('1/0');
    await input.press('Tab');
    await expect(input).toHaveValue('1/0');
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await input.focus();
    await input.hover();
    await expect(page.getByText('Nævneren må ikke være 0', { exact: true })).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });
});
