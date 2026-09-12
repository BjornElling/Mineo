import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('UI-009 – device-lokale indstillinger', () => {
  test('bevarer tema og dokumentformat efter reload uden at miste sagsinput', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');

    const journalnr = page.getByRole('textbox', { name: 'Journalnr.' });
    await setFieldValueAndSettle(journalnr, 'UI009-FIKTIV-SAG');
    await expect(journalnr).toHaveValue('UI009-FIKTIV-SAG');

    await openPage(page, 'Indstillinger');

    const darkTheme = page.getByRole('radio', { name: 'Mørkt', exact: true });
    await darkTheme.check();
    await expect(darkTheme).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-mineo-theme', 'dark');

    const documentFormat = page.getByRole('combobox', { name: 'Download-format for dokumenter' });
    await documentFormat.click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();
    await expect(documentFormat).toHaveValue('Word');

    await page.reload();

    await expect(page.locator('.page-title')).toHaveText('Indstillinger');
    await expect(page.getByRole('radio', { name: 'Mørkt', exact: true })).toBeChecked();
    await expect(page.locator('html')).toHaveAttribute('data-mineo-theme', 'dark');
    await expect(
      page.getByRole('combobox', { name: 'Download-format for dokumenter' }),
    ).toHaveValue('Word');

    await openPage(page, 'Stamdata');
    await expect(page.getByRole('textbox', { name: 'Journalnr.' })).toHaveValue('UI009-FIKTIV-SAG');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
