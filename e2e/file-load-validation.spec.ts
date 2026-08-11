import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('Filvalidering ved Hent', () => {
  test('viser forventelig filfejl uden teknisk fejlregistrering', async ({ page, browserName }) => {
    // Chrome/Edge bruger den native File System Access-picker, mens WebKit gennemløber den testbare
    // fallback-inputflade, som er den konkrete OBS-008-reproduktion.
    test.skip(browserName !== 'webkit', 'OBS-008-fallbacken testes i WebKit');
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Hent' }).click();

    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
    await fileInput.setInputFiles({
      name: 'forkert.yml',
      mimeType: 'text/yaml',
      buffer: Buffer.from('ikke en Mineo-fil'),
    });

    await expect(page.getByText('Valgt fil er ikke en .eo fil', { exact: true })).toBeVisible();
    await expect(page.getByText('Teknisk fejl registreret', { exact: true })).toHaveCount(0);
    expect(runtimeErrors).toEqual([]);
  });
});
