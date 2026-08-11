import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('Bekræftelsesdialog', () => {
  test('holder fokus i dialogen, lukker med Escape og bevarer en åben draft', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Renteberegning' }).click();

    const date = page.locator("input[name='beregningsdato']");
    const deleteAll = page.getByRole('button', { name: 'Slet alle indtastninger' });
    await expect(date).toBeVisible();

    await date.dblclick();
    await date.fill('01-01-2026');
    await date.press('Tab');
    await expect(date).toHaveValue('01-01-2026');
    await expect(deleteAll).toBeEnabled();

    await date.dblclick();
    await date.fill('02-02-2026');
    await deleteAll.click();

    const dialog = page.getByRole('dialog');
    const cancel = dialog.getByRole('button', { name: 'Annuller' });
    const confirm = dialog.getByRole('button', { name: 'Ja, slet' });
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(cancel).toBeFocused();
    await cancel.press('Tab');
    await expect(confirm).toBeFocused();
    await confirm.press('Tab');
    await expect(cancel).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(date).toBeFocused();
    await expect(date).toHaveValue('02-02-2026');

    await date.press('Tab');
    await deleteAll.click();
    await dialog.getByRole('button', { name: 'Ja, slet' }).click();
    await expect(dialog).toBeHidden();
    await expect(date).toHaveValue('');
    await expect(deleteAll).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
  });
});
