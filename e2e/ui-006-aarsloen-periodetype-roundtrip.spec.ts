import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('UI-006 – Årslønnens periodeskift', () => {
  test('bevarer måned og år gennem Måned → Dato → Måned', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');

    const table = page.locator('[data-mineo-table-navigation="true"]');
    const firstRow = table.locator('tbody tr').first();
    let rowInputs = firstRow.getByRole('textbox');

    await setFieldValueAndSettle(rowInputs.nth(0), '1');
    await setFieldValueAndSettle(rowInputs.nth(1), '2025');
    await setFieldValueAndSettle(rowInputs.nth(2), '30000');
    await expect(rowInputs.nth(0)).toHaveValue('1');
    await expect(rowInputs.nth(1)).toHaveValue('2025');
    await expect(rowInputs.nth(2)).toHaveValue('30.000,00');

    await page.getByRole('radio', { name: 'Dato', exact: true }).check();
    await expect(firstRow.getByRole('textbox', { name: 'Dato fra', exact: true })).toBeVisible();
    await setVerbatimFieldValueAndSettle(
      firstRow.getByRole('textbox', { name: 'Dato fra', exact: true }),
      '01-01-2025',
    );
    await setVerbatimFieldValueAndSettle(
      firstRow.getByRole('textbox', { name: 'Dato til', exact: true }),
      '31-01-2025',
    );
    await expect(firstRow.getByRole('textbox').nth(2)).toHaveValue('30.000,00');

    await page.getByRole('radio', { name: 'Måned', exact: true }).check();
    rowInputs = firstRow.getByRole('textbox');
    await expect(rowInputs.nth(0)).toHaveValue('1');
    await expect(rowInputs.nth(1)).toHaveValue('2025');
    await expect(rowInputs.nth(2)).toHaveValue('30.000,00');
    await expect(firstRow).toContainText('30.000,00 kr.');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
