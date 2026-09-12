import { readFile } from 'node:fs/promises';

import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('TD-043 – renteberegningens afrunding mellem UI og dokument', () => {
  test('viser motorens sum i UI og dokumentets afrundede delsum i PDF', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Renteberegning');

    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Beregningsdato' }), '02-07-2024');

    const firstRow = page.locator('tbody tr').first();
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Beløb' }), '100000');
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Forfaldsdato' }), '30-06-2024');

    await expect(firstRow.getByText('94,95 kr.', { exact: true })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await firstRow.getByRole('button', {
      name: 'Download PDF-specifikation for række 1',
    }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('PDF-downloadet blev ikke skrevet til en lokal fil.');

    const pdfText = await extractPdfText(new Blob([
      await readFile(downloadPath),
    ], { type: 'application/pdf' }));
    expect(pdfText).toContain('94,94 kr.');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
