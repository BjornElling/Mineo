import {
  expect,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('MinProcesrente – gyldig beregning, PDF og exit-guard', () => {
  test('beregner en dokumenteret rentelinje, henter PDF og advarer ved forsøg på at forlade siden', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await page.goto('/minprocesrente.html');

    await setVerbatimFieldValueAndSettle(
      page.locator('input[name="beregningsdato"]'),
      '19-08-2026',
    );

    // Værdierne følger den dokumenterede gyldige MinProcesrente-rejse i brugerblikket.
    const row = page.locator('tbody tr[data-mineo-row-id]').first();
    await setFieldValueAndSettle(row.getByRole('textbox', { name: 'Beløb' }), '100000');
    await setVerbatimFieldValueAndSettle(
      row.getByRole('textbox', { name: 'Forfaldsdato' }),
      '01-01-2020',
    );

    const calculatedInterest = row.getByRole('cell').nth(5);
    await expect(calculatedInterest).toHaveText(/^\d{1,3}(?:\.\d{3})*,\d{2} kr\.$/);

    const rowDownload = row.getByRole('button', { name: 'Download PDF-specifikation for række 1' });
    const overviewDownload = page.getByRole('button', { name: 'Download samlet oversigt' });
    await expect(rowDownload).toBeEnabled();
    await expect(overviewDownload).toBeEnabled();

    // Standalone-fladen skal advare, når afsluttet brugerinput endnu ikke er hentet som PDF.
    const pendingNavigation = page.goto('/minprocesrente.html?exit-guard-check=1', {
      waitUntil: 'domcontentloaded',
    }).catch((error: unknown) => {
      // En afvist beforeunload-dialog annullerer navigationen og rapporteres af Playwright som ERR_ABORTED.
      expect(String(error)).toContain('net::ERR_ABORTED');
    });
    const exitDialog = await page.waitForEvent('dialog');
    expect(exitDialog.type()).toBe('beforeunload');
    expect(exitDialog.message()).toBe('');
    await exitDialog.dismiss();
    await pendingNavigation;
    await expect(page).toHaveURL(/\/minprocesrente\.html$/);

    const downloadPromise = page.waitForEvent('download');
    await rowDownload.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await download.saveAs(testInfo.outputPath('minprocesrente-rentelinje.pdf'));

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
