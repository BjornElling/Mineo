import { expect, login, readAutomationSnapshot, test } from './support/mineoTest';

/**
 * Broen er test-only og findes kun i det isolerede E2E-build. Produktionsartefaktets fravær er et
 * buildkrav, ikke en manglende brugerfunktion, så denne kontrol køres kun mod testbuildet.
 */
test.describe('Automatiseringsbroens browser-smoke', () => {
  test('eksponerer broens udlæsning på en ren sag', async ({ page }) => {
    await login(page);

    // En ren sag har ingen aktive issues. Hævdet gennem broen frem for gennem farver, så testen ikke kan
    // forveksle en rejected råtekst med en canonical bounds-fejl.
    const snapshot = await readAutomationSnapshot(page);
    expect(snapshot.fields).toEqual([]);
    expect(snapshot.rejectedAddresses).toEqual([]);
    expect(typeof snapshot.revision).toBe('number');
  });
});
