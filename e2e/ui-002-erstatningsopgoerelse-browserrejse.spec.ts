import { readFile } from 'node:fs/promises';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const setDate = setVerbatimFieldValueAndSettle;

test.describe('UI-002 – erstatningsopgørelsens række til dokument', () => {
  test('fører en offentlig ydelsesrække fra synligt resultat til EO-PDF', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);

    // Stamdata-datoerne giver dokumentet et konkret sagsgrundlag, uden at testen blander andre beregningsgrene ind.
    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'UI-002');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
    const skadestype = page.getByRole('combobox', { name: 'Skadestype' });
    await skadestype.click();
    await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
    await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
    await setDate(page.locator("input[name='skadedato']"), '01-01-2022');

    await openPage(page, 'Erstatningsopgørelse');
    await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), 'EO-002');
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

    await setDate(inputs.nth(0), '01-01-2022');
    await setDate(inputs.nth(1), '01-01-2022');
    await setFieldValueAndSettle(inputs.nth(2), '1000');
    const ydelsestype = row.getByRole('combobox');
    await ydelsestype.click();
    await page.getByRole('option', { name: 'Dagpenge', exact: true }).click();

    // Rækken skal vise de afledte kolonner, før testen går videre til beregningsfanen.
    await expect(row.locator('td').nth(5)).toHaveText('Kalenderdage');
    await expect(row.locator('td').nth(6)).toHaveText('1');
    await expect(row.locator('td').nth(7)).toContainText('1.000');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const downloadRow = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' });
    const downloadButton = downloadRow.getByRole('button');
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    if (pdfPath === null) throw new Error('EO-PDF-downloadet blev ikke skrevet til en lokal fil.');
    const pdfBytes = await readFile(pdfPath);
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
