import { expect, login, openPage, setFieldValueAndSettle, test } from './support/mineoTest';

test.describe('Satser — afslutning af singleton-draft med Tab', () => {
  test('Tab og Shift+Tab afslutter Satsår og bevarer fokus på feltet', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Satser');

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
