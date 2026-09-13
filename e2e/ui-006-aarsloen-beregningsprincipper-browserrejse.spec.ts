import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const fillDatoPeriode = async (page: Page): Promise<void> => {
  await openPage(page, 'Årslønsberegning');
  await page.getByRole('radio', { name: 'Dato', exact: true }).check();

  const firstRow = page.locator('[data-mineo-table-navigation="true"] tbody tr').first();
  await setVerbatimFieldValueAndSettle(
    firstRow.getByRole('textbox', { name: 'Dato fra', exact: true }),
    '01-04-2023',
  );
  await setVerbatimFieldValueAndSettle(
    firstRow.getByRole('textbox', { name: 'Dato til', exact: true }),
    '30-04-2023',
  );
  await setFieldValueAndSettle(
    firstRow.getByRole('textbox', { name: 'Løn', exact: true }),
    '10000',
  );
};

test.describe('UI-006 – Årslønnens beregningsprincipper', () => {
  test('viser afhængige ferie-/SH-valg og henter SH-dage som PDF', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await fillDatoPeriode(page);

    const omregning = page.getByRole('checkbox', { name: 'Omregning til fuldt år:', exact: true });
    await expect(omregning).toBeVisible();
    await omregning.check();
    await expect(omregning).toBeChecked();

    const fuldLoenUnderFerie = page.getByRole('checkbox', {
      name: 'Fuld løn under ferie:',
      exact: true,
    });
    const retTilSjetteFerieuge = page.getByRole('checkbox', {
      name: 'Ret til 6. ferieuge:',
      exact: true,
    });
    const antalFeriedage = page.locator('input[name="antalFeriedage"]');

    await expect(fuldLoenUnderFerie).toBeChecked();
    await expect(retTilSjetteFerieuge).toBeHidden();
    await expect(antalFeriedage).toBeHidden();

    await fuldLoenUnderFerie.uncheck();
    await expect(fuldLoenUnderFerie).not.toBeChecked();
    await expect(retTilSjetteFerieuge).toBeVisible();
    await expect(retTilSjetteFerieuge).toBeChecked();
    await expect(antalFeriedage).toBeVisible();

    const loenPaaHelligdage = page.getByRole('combobox', {
      name: 'Løn på helligdage',
      exact: true,
    });
    await loenPaaHelligdage.click();
    await page.getByRole('option', { name: 'SH-udbetaling', exact: true }).click();

    const shDageRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Antal SH-dage i de indtastede perioder:',
    });
    await expect(shDageRow).toBeVisible();
    await expect(shDageRow).toContainText('3');

    const shDageDownload = shDageRow.getByRole('button');
    await expect(shDageDownload).toBeEnabled();
    await expect(shDageDownload).toHaveAccessibleName('Download SH-dage som PDF');

    const downloadPromise = page.waitForEvent('download');
    await shDageDownload.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('SH-dage-PDF blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(downloadPath);
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfBytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
