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
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12C');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
  const skadestype = page.getByRole('combobox', { name: 'Skadestype' });
  await skadestype.click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '01-01-2022');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), '1');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '01-02-2023');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Nej']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Ja']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2022');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2022');
};

const oevrigeKravRow = (page: Page, index: number) =>
  page.locator('[data-section-id="oevrige-krav"] tbody tr[data-mineo-row-id]').nth(index).locator('input[data-mineo-field-address]');

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
const summaryRow = (page: Page) => page.locator('.row--label-right-hover').filter({ hasText: /^Øvrige krav/ });

// Flade 12c (BB-228–BB-237): én vurdering pr. række, skjulte rækker er tavse, og sammendraget nævner kravet.
test.describe('Erstatningsopgørelse – øvrige krav', () => {
  test('melder én linje pr. række og tier om en række bag «Skjul»', async ({ page, runtimeErrors, externalRequests }) => {
    await login(page);
    await fillSag(page);

    // Række 1: fuld, men uden dato (valgfri). Række 2: kun beskrivelse.
    await setFieldValueAndSettle(oevrigeKravRow(page, 0).nth(1), 'Medicin');
    await setFieldValueAndSettle(oevrigeKravRow(page, 0).nth(2), '1250');
    await setFieldValueAndSettle(oevrigeKravRow(page, 1).nth(1), 'Transport');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Transport: «Beløb» er ikke udfyldt');
    await expect(errorBox(page)).not.toContainText('Medicin');
    await expect(errorBox(page)).not.toContainText('Dato');
    await expect(summaryRow(page)).toContainText('Fejl');

    // Kravvalget «Skjul» skjuler rækkerne: de er ikke udfyldt og må ikke tale (BB-228).
    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Skjul']").check();
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(summaryRow(page)).toContainText('Ikke rejst (skjult)');
    await expect(page.getByText('«Beløb» er ikke udfyldt')).toHaveCount(0);

    // Tilbage til «Ja»: rækkerne og deres fejl kommer igen.
    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Ja']").check();
    await expect(oevrigeKravRow(page, 1).nth(1)).toHaveValue('Transport');
    await setFieldValueAndSettle(oevrigeKravRow(page, 1).nth(2), '0');
    await expect(oevrigeKravRow(page, 1).nth(2)).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Transport: Beløbet skal være større end 0 kr.');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
