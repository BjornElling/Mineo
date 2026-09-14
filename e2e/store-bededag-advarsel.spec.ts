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

const udfyldStoreBededagssag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.', exact: true }), 'SB-ADVARSEL');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn', exact: true }), 'Fiktiv skadelidt');
  const skadetype = page.getByRole('combobox', { name: 'Skadestype', exact: true });
  await skadetype.click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '01-01-2022');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), 'SB-001');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '01-01-2025');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2024');

  const tafRow = page.locator('table').filter({ hasText: 'TAF-måneder' }).first().locator('tbody tr').first();
  await setDate(tafRow.getByRole('textbox', { name: 'Fra o.m.', exact: true }), '01-01-2024');
  await setDate(tafRow.getByRole('textbox', { name: 'Til o.m.', exact: true }), '31-12-2024');

  const arbejdsstatus = page.getByRole('combobox', { name: 'Arbejdsstatus', exact: true });
  await arbejdsstatus.click();
  await page.getByRole('option', { name: 'Uarbejdsdygtig', exact: true }).click();

  const beregnesUdFra = page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true });
  await beregnesUdFra.click();
  await page.getByRole('option', { name: 'Angivet månedsløn', exact: true }).click();
  await setFieldValueAndSettle(page.locator("input[name='maanedsloenenUdgoer']"), '30000');
  await setFieldValueAndSettle(page.locator("input[name='angivetMaanedsloenBaseretPaa']"), 'Månedsløn');

  const loenudvikling = page.getByRole('combobox', {
    name: 'Lønudvikling beregnes ud fra',
    exact: true,
  });
  await loenudvikling.click();
  await page.getByRole('option', { name: 'Ingen', exact: true }).click();
};

test.describe('Store Bededag-advarsel i EO-beregningen', () => {
  test('viser advarslen uden at blokere download og følger issue-linket', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await udfyldStoreBededagssag(page);

    const holidayPay = page.getByRole('combobox', { name: 'Løn på helligdage', exact: true });
    await expect(holidayPay).toHaveValue('Almindelig løn');
    const storeBededagToggle = page.getByRole('checkbox', {
      name: 'Beregn Store Bededagstillæg fra 1. januar 2024:',
      exact: true,
    });
    await expect(storeBededagToggle).toBeVisible();
    await expect(storeBededagToggle).not.toBeChecked();

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const errorBox = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText(
      'Der vil sædvanligvis være krav på Store Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.',
    );

    const downloadRow = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' });
    const downloadButton = downloadRow.getByRole('button');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    const warningRow = errorBox.locator('.row--label-right-hover').filter({
      hasText: 'Der vil sædvanligvis være krav på Store Bededagstillæg',
    });
    await expect(warningRow).toBeVisible();
    const issueLink = warningRow.getByRole('button', { name: 'Indkomstgrundlag', exact: true });
    await expect(issueLink).toBeVisible();
    await issueLink.click();
    await expect(page.getByRole('tab', { name: 'EO oplysninger', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(storeBededagToggle).toBeVisible();
    // Issue-navigationens fælles kontrakt er synlig blinkmarkering af fokusmålet – ikke et
    // permanent programmatisk focus, som ville stjæle tastaturfokus fra brugerens aktuelle handling.
    await expect(storeBededagToggle).toHaveClass(/mineo-field-attention-blink/);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
