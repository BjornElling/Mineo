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
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12F');
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

const vaelgBeregnesUdFra = async (
  page: Page,
  valg: 'Beregningsperiode' | 'Angivet månedsløn' | 'Angivet dagsløn',
): Promise<void> => {
  await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
  await page.getByRole('option', { name: valg, exact: true }).click();
};

const sektion = (page: Page) => page.locator('[data-section-id="taf-beregningsgrundlag"]');
const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

// Flade 12f (BB-258–BB-272): beregningsgrundlaget for TAF. Basisbanen er nok – intet her afhænger af motor
// eller viewport.
test.describe('Erstatningsopgørelse – beregningsgrundlaget for TAF', () => {
  test('i måneder skjules ferien, og for meget fravær farver feltet frem for at give en intern fejl', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Beregningsperiode');
    await setDate(page.locator("input[name='tafBeregningsperiodeFra']"), '01-06-2017');
    await setDate(page.locator("input[name='tafBeregningsperiodeTil']"), '31-05-2018');

    // Uden et ansættelsesforhold, der gør enheden til arbejdsdage, opgøres i måneder: ferie og løse dage
    // fradrages ikke og vises ikke (BB-263).
    await expect(sektion(page).getByText('Ferie i beregningsperioden:')).toHaveCount(0);
    await expect(sektion(page).getByText('Løse ferie-/feriefridage')).toHaveCount(0);

    await page.getByRole('checkbox', { name: 'Øvrigt fravær uden løn', exact: true }).click();
    const fravaer = page.getByRole('textbox', { name: 'Antal fraværsdage (mandag-fredag)', exact: true });
    await setFieldValueAndSettle(fravaer, '300');
    await expect(fravaer).toHaveAttribute('aria-invalid', 'true');
    await expect(fravaer).toHaveAccessibleDescription(/Fraværet overstiger beregningsperioden \(højst 249 fraværsdage\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Fraværet overstiger beregningsperioden (højst 249 fraværsdage)');
    await expect(errorBox(page)).not.toContainText('intern beregningsfejl');
    // Sektionslinket bærer skærmens overskrift (BB-270).
    await expect(errorBox(page).getByRole('button', { name: 'Indtægt før skadedatoen', exact: true }).first()).toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('angivet månedsløn: 0 kr. er rødt, en lav løn er gul, og feltet viser sætningens form', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet månedsløn');

    const maanedsloen = page.locator("input[name='maanedsloenenUdgoer']");
    await setFieldValueAndSettle(maanedsloen, '0');
    await expect(maanedsloen).toHaveAttribute('aria-invalid', 'true');
    await expect(maanedsloen).toHaveAccessibleDescription(/Månedslønnen skal være større end 0 kr\./);

    await setFieldValueAndSettle(maanedsloen, '2000');
    await expect(maanedsloen).toHaveAttribute('aria-invalid', 'false');
    await expect(maanedsloen).toHaveAccessibleDescription(/Månedslønnen er usædvanlig lav – er det en dagsløn\?/);

    await expect(page.locator("input[name='angivetMaanedsloenBaseretPaa']")).toHaveAttribute('placeholder', 'fx lønsedler for 2017');
    await expect(sektion(page).getByText(
      'Det angivne beløb afspejler månedslønnen per dato (hvis forskellig fra skadedatoen)', { exact: true },
    )).toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('overlap mellem beregningsperioden og en TAF-periode farver begge datoer (BB-262)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-06-2018');
    await vaelgBeregnesUdFra(page, 'Beregningsperiode');
    await setDate(page.locator("input[name='tafBeregningsperiodeFra']"), '01-07-2017');
    await setDate(page.locator("input[name='tafBeregningsperiodeTil']"), '30-06-2018');

    const tafRaekke = page.locator('[data-section-id="taf"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first().locator('input[data-mineo-field-address]');
    await setDate(tafRaekke.nth(0), '01-06-2018');
    await setDate(tafRaekke.nth(1), '30-06-2018');

    const fra = page.locator("input[name='tafBeregningsperiodeFra']");
    await expect(fra).toHaveAttribute('aria-invalid', 'true');
    await expect(fra).toHaveAccessibleDescription(/Perioden overlapper TAF-perioden 01-06-2018 - 30-06-2018/);
    await expect(tafRaekke.nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tafRaekke.nth(0)).toHaveAccessibleDescription(/Perioden overlapper beregningsperioden 01-07-2017 - 30-06-2018/);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
