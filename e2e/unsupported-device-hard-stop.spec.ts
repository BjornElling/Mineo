import { expect, test } from './support/mineoTest';

// Testen overskriver kun den enkelte testkonteksts device-capabilities. Den skal ramme den
// produktionsmæssige device-gate i browseren, ikke en separat mobilvariant af buildet.
test.describe('Mineo – browser hard stop på touch-enhed', () => {
  test.use({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });

  test('viser kun unsupported-device-siden før auth og app-shell', async ({ page, runtimeErrors }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'minEO.dk' })).toBeVisible();
    await expect(page.getByText(/Derfor understøtter det ikke mobiltelefoner eller tablets/)).toBeVisible();
    await expect(page.getByLabel('Adgangskode')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Stamdata', exact: true })).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });
});
