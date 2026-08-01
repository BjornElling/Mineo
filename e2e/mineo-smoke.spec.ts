import { expect, test } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

test.describe('Mineo browser-smoke', () => {
  test('åbner Mineo gennem den synlige loginformular uden browserfejl eller ekstern trafik', async ({
    page,
  }) => {
    const browserErrors: string[] = [];
    const externalRequests: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.protocol.startsWith('http') && url.origin !== 'http://127.0.0.1:4173') {
        externalRequests.push(request.url());
      }
    });

    await page.goto('/');

    const passwordInput = page.getByLabel('Adgangskode');
    await expect(passwordInput).toBeVisible();
    await passwordInput.fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Log ind' }).click();

    await expect(page).toHaveURL(/\/mineo$/);
    await expect(page.getByText('Programmet', { exact: true })).toBeVisible();
    await expect(page.getByText('Teknisk', { exact: true })).toBeVisible();

    expect(browserErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
