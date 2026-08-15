import { expect, login, readAutomationSnapshot, test } from './support/mineoTest';

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

  test('eksponerer automatiseringsbroens udlæsning på en ren sag', async ({ page }) => {
    await login(page);

    // En ren sag har ingen aktive issues. Hævdet gennem broen frem for gennem farver, så testen ikke kan
    // forveksle en rejected råtekst med en canonical bounds-fejl.
    const snapshot = await readAutomationSnapshot(page);
    expect(snapshot.fields).toEqual([]);
    expect(snapshot.rejectedAddresses).toEqual([]);
    expect(typeof snapshot.revision).toBe('number');
  });
});
