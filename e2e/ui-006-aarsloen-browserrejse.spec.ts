import { readFile } from 'node:fs/promises';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('UI-006 – gyldig Årsløn-rejse fra tabel til download', () => {
  test('viser en samlet månedsløn og henter Årsløn som PDF', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');

    // Satsen sættes eksplicit til nul, så facit kun afhænger af den ene indtastede lønpost.
    for (const fieldName of ['feriePct', 'fritvalgPct', 'shSoPct', 'storeBededagPct', 'pensionPct']) {
      await setFieldValueAndSettle(page.locator(`input[name="${fieldName}"]`), '0');
    }

    const table = page.locator('[data-mineo-table-navigation="true"]');
    const firstRow = table.locator('tbody tr').first();
    const rowInputs = firstRow.getByRole('textbox');

    await setFieldValueAndSettle(rowInputs.nth(0), '1');
    await setFieldValueAndSettle(rowInputs.nth(1), '2024');
    await setFieldValueAndSettle(rowInputs.nth(2), '1000');

    await expect(firstRow).toContainText('1.000,00 kr.');

    const totalRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Sammentælling af løn fra tabellen:',
    });
    await expect(totalRow).toContainText('1.000,00 kr.');

    const downloadButton = page.getByRole('button', { name: 'Download årsløn som PDF', exact: true });
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    if (pdfPath === null) throw new Error('Årsløn-PDF blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(pdfPath);
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfBytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
