import { expect, login, test } from './support/mineoTest';

test.describe('Mineo browser-smoke', () => {
  test('åbner Mineo gennem den synlige loginformular uden browserfejl eller ekstern trafik', async ({
    page,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);

    await expect(page.getByText('Programmet', { exact: true })).toBeVisible();
    await expect(page.getByText('Teknisk', { exact: true })).toBeVisible();

    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
