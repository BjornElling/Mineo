import { expect, test, type Page } from '@playwright/test';

const TEST_PASSWORD = 'Mineo-Codex-Test-2026';
const INSERT_EMPLOYMENT_PROMPT = 'Tryk på den blå knap for at indsætte et ansættelsesforhold.';
const EMPLOYMENT_NOTICE = 'Lønindkomst, tillæg og andre relevante oplysninger skal angives individuelt for hvert enkelt ansættelsesforhold.';

const login = async (page: Page): Promise<void> => {
  await page.goto('/');
  await page.getByLabel('Adgangskode').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Log ind' }).click();
  await expect(page).toHaveURL(/\/mineo$/);
};

test.describe('Dropdown-fokus og lønindkomstvejledning', () => {
  test('en tabel-dropdown bevarer den blå fokusramme ved hover efter Escape', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erhvervsevnetab' }).click();
    await page.getByRole('tab', { name: 'EET oplysninger' }).click();

    const dropdown = page.getByRole('combobox', { name: 'Afgørelsestype' }).first();
    await dropdown.click();
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('listbox')).toBeHidden();
    await expect(dropdown).toBeFocused();
    await dropdown.hover();

    const focusAppearance = await dropdown.evaluate((input) => {
      const root = input.closest<HTMLElement>('.MuiOutlinedInput-root');
      const outline = root?.querySelector<HTMLElement>('.MuiOutlinedInput-notchedOutline');
      if (!root || !outline) throw new Error('Mangler dropdownens fokusramme.');
      return {
        isFocused: root.classList.contains('Mui-focused'),
        borderColor: getComputedStyle(outline).borderColor,
        expectedColor: getComputedStyle(root).getPropertyValue('--color-input-border-focus').trim(),
      };
    });

    expect(focusAppearance.isFocused).toBe(true);
    expect(focusAppearance.borderColor).toBe('rgb(25, 118, 210)');
    expect(focusAppearance.expectedColor).toBe('#1976d2');
    expect(runtimeErrors).toEqual([]);
  });

  test('indsættelsesvejledningen vises kun før første ansættelsesforhold', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(message.text());
    });
    page.on('pageerror', (error) => runtimeErrors.push(error.message));

    await login(page);
    await page.getByRole('button', { name: 'Erstatningsopgørelse' }).click();
    await page.getByRole('tab', { name: 'Lønindkomst' }).click();

    await expect(page.getByText(INSERT_EMPLOYMENT_PROMPT, { exact: true })).toBeVisible();
    await expect(page.getByText(EMPLOYMENT_NOTICE)).toBeVisible();

    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold' }).click();
    await page.getByRole('button', { name: 'Ja, tilføj' }).click();

    await expect(page.getByText(INSERT_EMPLOYMENT_PROMPT, { exact: true })).toHaveCount(0);
    await expect(page.getByText(EMPLOYMENT_NOTICE)).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
