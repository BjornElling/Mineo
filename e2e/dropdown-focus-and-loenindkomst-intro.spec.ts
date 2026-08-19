import { expect, login, openPage, test } from './support/mineoTest';

import { BROWSER_LANE_TAG } from './support/lanes';

const INSERT_EMPLOYMENT_PROMPT = 'Tryk på den blå knap for at indsætte et ansættelsesforhold.';
const EMPLOYMENT_NOTICE = 'Lønindkomst, tillæg og andre relevante oplysninger skal angives individuelt for hvert enkelt ansættelsesforhold.';

// Browserbanen: fokusrammen efter Escape afhænger af motorens `:focus-visible`-heuristik, som er
// forskellig i Chromium, Gecko og WebKit – det er dén forskel, testen skal fange.
test.describe('Dropdown-fokus og lønindkomstvejledning', { tag: BROWSER_LANE_TAG }, () => {
  test('en tabel-dropdown bevarer den blå fokusramme ved hover efter Escape', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');
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

  test('indsættelsesvejledningen vises kun før første ansættelsesforhold', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
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
