import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';
const MISSING_BEREGNINGSDATO_MESSAGE = 'Beregningsdato er ikke udfyldt';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('EET-fejloversigt', () => {
  test('viser manglende beregningsdato præcis én gang på Differencekrav', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
    await page.getByRole('tab', { name: 'Differencekrav' }).click();

    const issueRows = page.locator('.row--label-right-hover').filter({
      has: page.getByText(MISSING_BEREGNINGSDATO_MESSAGE, { exact: true }),
    });
    await expect(issueRows).toHaveCount(1);
    const issueLink = issueRows.getByRole('button', { name: 'Grundlæggende oplysninger', exact: true });
    await expect(issueLink).toHaveCount(1);
    await issueLink.click();
    await expect(page.getByRole('tab', { name: 'EET oplysninger' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('input[name="beregningsdato"]')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
