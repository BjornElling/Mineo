import { readFile } from 'node:fs/promises';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('CALC-002 – uge-løn fra tabel til helårsomregning', () => {
  test('viser 10 ugers løn som 521.400,00 kr. og henter Årsløn-PDF', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');

    await page.getByRole('radio', { name: 'Uge', exact: true }).check();

    const table = page.locator('[data-mineo-table-navigation="true"]');
    const firstRow = table.locator('tbody tr').first();
    await setVerbatimFieldValueAndSettle(
      firstRow.getByRole('textbox', { name: 'Uge fra', exact: true }),
      '01/2024',
    );
    await setVerbatimFieldValueAndSettle(
      firstRow.getByRole('textbox', { name: 'Uge til', exact: true }),
      '10/2024',
    );
    await setFieldValueAndSettle(
      firstRow.getByRole('textbox', { name: 'Løn', exact: true }),
      '100000',
    );

    await expect(firstRow).toContainText('100.000,00 kr.');
    await expect(page.getByRole('checkbox', { name: 'Omregning til fuldt år:', exact: true })).not.toBeChecked();

    const totalRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Sammentælling af løn fra tabellen:',
    });
    await expect(totalRow).toContainText('100.000,00 kr.');

    const omregningToggle = page.getByRole('checkbox', { name: 'Omregning til fuldt år:', exact: true });
    await omregningToggle.check();
    await expect(omregningToggle).toBeChecked();

    const calculationBox = page.locator('.content-box').filter({
      has: page.getByText('Beregning', { exact: true }),
    });
    await expect(calculationBox.getByText('Antal uger i den indtastede periode:', { exact: true }).locator('..'))
      .toContainText('10 uger');
    await expect(calculationBox.getByText(
      'Beregnet årsløn (100.000,00 / 10 x 52,14):',
      { exact: true },
    ).locator('..')).toContainText('521.400,00 kr.');

    const downloadButton = page.getByRole('button', { name: 'Download årsløn som PDF', exact: true });
    await expect(downloadButton).toBeVisible();
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Årsløn-PDF blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(downloadPath);
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfBytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
