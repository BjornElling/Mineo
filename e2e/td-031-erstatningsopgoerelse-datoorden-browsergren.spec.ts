import type { Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
  readAutomationSnapshot,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const setDate = setVerbatimFieldValueAndSettle;

const fillErstatningsopgoerelseSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'TD031-DATOORDEN');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
  const skadetype = page.getByRole('combobox', { name: 'Skadestype' });
  await skadetype.click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '01-01-2022');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), 'TD31-D');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '01-02-2022');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Nej']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2022');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2022');

  await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();
  const table = page.locator('table').filter({ hasText: 'Ydelse' }).first();
  const row = table.locator('tbody tr[data-mineo-row-id]').first();
  const inputs = row.locator('input[data-mineo-field-address]');

  // Til-datoen sættes først, så dens aktive min-grænse ikke afviser den værdi, der skal indgå i
  // den efterfølgende omvendte, men kalendergyldige periode.
  await setDate(inputs.nth(1), '01-02-2022');
  await setDate(inputs.nth(0), '01-03-2022');
  await setFieldValueAndSettle(inputs.nth(2), '1000');
  const ydelsestype = row.getByRole('combobox');
  await ydelsestype.click();
  await page.getByRole('option', { name: 'Dagpenge', exact: true }).click();
};

test.describe('TD-031 – datoorden i offentlig ydelsesrække', () => {
  test('blokerer EO-download ved omvendt, kalendergyldig periode', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await fillErstatningsopgoerelseSag(page);

    const table = page.locator('table').filter({ hasText: 'Ydelse' }).first();
    const row = table.locator('tbody tr[data-mineo-row-id]').first();
    const fromDate = row.locator('input[data-mineo-field-address]').nth(0);
    await expect(fromDate).toHaveValue('01-03-2022');
    await expect(row.locator('input[data-mineo-field-address]').nth(1)).toHaveValue('01-02-2022');
    await expect(fromDate).toHaveAttribute('aria-invalid', 'true');
    await expect(row.getByRole('combobox')).toHaveValue('Dagpenge');
    await expect(row.locator('input[data-mineo-field-address]').nth(2)).toHaveValue('1.000,00');
    const inputSnapshot = await readAutomationSnapshot(page);
    expect(inputSnapshot.rejectedAddresses).toEqual([]);
    expect(inputSnapshot.fields.map((field) => field.issue.message)).toEqual(expect.arrayContaining([
      'Fra-dato skal være før til-dato (01-02-2022)',
      'Til-dato skal være efter fra-dato (01-03-2022)',
    ]));
    await fromDate.hover();
    await expect(page.getByRole('tooltip', {
      name: 'Fra-dato skal være før til-dato (01-02-2022)',
      exact: true,
    })).toBeVisible();
    await row.locator('input[data-mineo-field-address]').nth(1).hover();
    await expect(page.getByRole('tooltip', {
      name: 'Til-dato skal være efter fra-dato (01-03-2022)',
      exact: true,
    })).toBeVisible();

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const errorBox = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(errorBox).toBeVisible();

    const downloadRow = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' });
    const downloadButton = downloadRow.getByRole('button');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeDisabled();
    await expect(downloadButton).toHaveAccessibleName('Opgørelse kan ikke hentes, når der er fejl ovenfor');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
