import {
  expect,
  login,
  openPage,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const dependencyRow = (page: Parameters<typeof openPage>[0]) =>
  page.locator('.row--label-right-hover').filter({
    has: page.getByText('Skadedato', { exact: true }),
  });

test.describe('EETs stamdataafhængighed', () => {
  test('viser manglende skadedato ved ASL-årslønnen og fører til feltet', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');

    const row = dependencyRow(page);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Mangler (angiv i Stamdata)');
    await row.getByText('Stamdata', { exact: true }).click();

    await expect(page).toHaveURL(/\/stamdata$/);
    await expect(page.locator('input[name="skadedato"]')).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('forklarer ugyldig skadedato ved ASL-årslønnen', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '31-02-2020');

    await openPage(page, 'Erhvervsevnetab');
    const row = dependencyRow(page);
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Ugyldig værdi (ret i Stamdata)');
    expect(runtimeErrors).toEqual([]);
  });
});
