import { expect, login, openPage, test } from './support/mineoTest';

test.describe('verificeret produktionsartefakt', () => {
  test('starter fra det uploadede build og monterer en hovedside uden browserfejl', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);

    await expect(page.getByText('Programmet', { exact: true })).toBeVisible();
    await openPage(page, 'Satser');
    await expect(page.locator('.page-title')).toHaveText(/^Arbejdsskadesatser\b/);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
