import { readFile } from 'node:fs/promises';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('UI-007 – Mineos renteberegning', () => {
  test('beregner en rentekravsrække og henter dens PDF-specifikation', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Renteberegning');

    const beregningsdato = page.getByRole('textbox', { name: 'Beregningsdato' });
    await setFieldValueAndSettle(beregningsdato, '31-12-2020');
    await expect(beregningsdato).toHaveValue('31-12-2020');

    const firstRow = page.locator('tbody tr').first();
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Beløb' }), '10000');
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Forfaldsdato' }), '01-01-2020');

    await expect(firstRow.getByRole('textbox', { name: 'Beløb' })).toHaveValue('10.000,00');
    await expect(firstRow.getByRole('textbox', { name: 'Forfaldsdato' })).toHaveValue('01-01-2020');
    await expect(firstRow.getByText('01-01-2020', { exact: true })).toBeVisible();
    await expect(firstRow.getByText('805,00 kr.', { exact: true })).toBeVisible();

    const downloadButton = firstRow.getByRole('button', {
      name: 'Download PDF-specifikation for række 1',
    });
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    const pdfPath = await download.path();
    expect(pdfPath).not.toBeNull();
    if (pdfPath === null) throw new Error('PDF-downloadet blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(pdfPath);
    expect(pdfBytes.length).toBeGreaterThan(100);
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(pdfBytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
