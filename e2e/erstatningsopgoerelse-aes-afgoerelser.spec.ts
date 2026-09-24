import type { Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const setDate = setVerbatimFieldValueAndSettle;

const fillSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12D');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
  const skadestype = page.getByRole('combobox', { name: 'Skadestype' });
  await skadestype.click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '01-06-2018');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), '1');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '01-02-2025');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Nej']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2024');
};

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

// Flade 12d (BB-242, BB-243): en afgørelse dateret efter «Opgørelse lavet den» får en gul, ikke-blokerende
// ring med samme tekst som «Fejl og advarsler», og feltet hedder det samme begge steder som på skærmen.
test.describe('Erstatningsopgørelse – AES-afgørelser', () => {
  test('advarer ikke-blokerende om en ménafgørelse efter opgørelsens dato', async ({ page, runtimeErrors, externalRequests }) => {
    await login(page);
    await fillSag(page);

    await page.locator("[data-section-id='aes'] input[name='varigeMenAfgorelse']").check();
    const menDato = page.getByRole('textbox', { name: 'Dato for første ménafgørelse' });
    await setDate(menDato, '01-06-2025');

    await expect(menDato).toHaveAttribute('aria-invalid', 'false');
    await expect(menDato).toHaveAccessibleDescription(/Afgørelsen er dateret efter opgørelsens dato \(01-02-2025\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText(
      'Dato for første ménafgørelse: Afgørelsen er dateret efter opgørelsens dato (01-02-2025)'
    );
    await expect(page.getByRole('button', { name: /Download som PDF/ })).toBeEnabled();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
