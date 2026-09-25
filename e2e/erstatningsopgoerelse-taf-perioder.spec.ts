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
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12E');
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
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2024');
};

const vaelgBeregnesUdFra = async (page: Page, valg: 'Angivet månedsløn' | 'Angivet dagsløn'): Promise<void> => {
  await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
  await page.getByRole('option', { name: valg, exact: true }).click();
};

const tafSection = (page: Page) => page.locator('[data-section-id="taf"]');
const tabelRaekke = (page: Page, tabel: number, raekke: number) =>
  tafSection(page).locator('table').nth(tabel).locator('tbody tr[data-mineo-row-id]').nth(raekke)
    .locator('input[data-mineo-field-address]');
const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

// Flade 12e (BB-247–BB-257): TAF-periodens tabeller. Løse feriedage skjules i måneder, afledte kolonner siger
// deres ramme, og rækkereglerne når cellen.
test.describe('Erstatningsopgørelse – TAF-perioden', () => {
  test('skjuler løse feriedage i måneder og viser dem i arbejdsdage', async ({ page, runtimeErrors, externalRequests }) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet dagsløn');

    await expect(tafSection(page).getByText('TAF-arbejdsdage (i EO-perioden)')).toBeVisible();
    await expect(tafSection(page).getByText('Løse ferie-/feriefridage')).toBeVisible();
    await expect(tafSection(page).getByText('Feriedage (i TAF-perioden)')).toBeVisible();

    await setDate(tabelRaekke(page, 0, 0).nth(0), '01-01-2024');
    await setDate(tabelRaekke(page, 0, 0).nth(1), '31-01-2024');
    await setFieldValueAndSettle(tabelRaekke(page, 0, 0).nth(2), '999');
    await expect(tabelRaekke(page, 0, 0).nth(2)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 0, 0).nth(2)).toHaveAccessibleDescription(
      /Løse ferie-\/feriefridage overstiger mulige arbejdsdage i perioden \(maksimalt 22\)/
    );

    // I måneder fradrages løse feriedage ikke: kolonnen forsvinder, og den røde celle spærrer ikke længere.
    await vaelgBeregnesUdFra(page, 'Angivet månedsløn');
    await expect(tafSection(page).getByText('TAF-måneder (i EO-perioden)')).toBeVisible();
    await expect(tafSection(page).getByText('Løse ferie-/feriefridage')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).not.toContainText('Løse ferie-/feriefridage');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('farver overlap og en ferie uden for sit vindue', async ({ page, runtimeErrors, externalRequests }) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet dagsløn');

    await setDate(tabelRaekke(page, 0, 0).nth(0), '01-01-2024');
    await setDate(tabelRaekke(page, 0, 0).nth(1), '30-06-2024');
    await setDate(tabelRaekke(page, 0, 1).nth(0), '01-06-2024');
    await setDate(tabelRaekke(page, 0, 1).nth(1), '31-12-2024');
    await expect(tabelRaekke(page, 0, 0).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 0, 0).nth(0)).toHaveAccessibleDescription(
      /Perioden overlapper perioden 01-06-2024 - 31-12-2024/
    );

    await setDate(tabelRaekke(page, 1, 0).nth(0), '01-07-2017');
    await setDate(tabelRaekke(page, 1, 0).nth(1), '14-07-2017');
    await expect(tabelRaekke(page, 1, 0).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 1, 0).nth(0)).toHaveAccessibleDescription(
      /Ferien ligger før skadedatoen \(01-06-2018\)/
    );

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Der er overlappende TAF-perioder');
    await expect(errorBox(page)).toContainText(
      'Ferieperioden 01-07-2017 - 14-07-2017: Ferien ligger før skadedatoen (01-06-2018)'
    );

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
