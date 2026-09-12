import { readFile } from 'node:fs/promises';

import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';
import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('TD-032 – Årsløn med aktiv helårsomregning', () => {
  test('viser metode C for én måned og henter PDF med det omregnede beløb', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');

    // Nulstillede tillæg gør browserfacitets eneste beregningsgrundlag til den ene månedsløn.
    for (const fieldName of ['feriePct', 'fritvalgPct', 'shSoPct', 'storeBededagPct', 'pensionPct']) {
      await setFieldValueAndSettle(page.locator(`input[name="${fieldName}"]`), '0');
    }

    const table = page.locator('[data-mineo-table-navigation="true"]');
    const firstRow = table.locator('tbody tr').first();
    const rowInputs = firstRow.getByRole('textbox');

    await setFieldValueAndSettle(rowInputs.nth(0), '1');
    await setFieldValueAndSettle(rowInputs.nth(1), '2024');
    await setFieldValueAndSettle(rowInputs.nth(2), '1000');

    const omregningToggle = page.locator('input[name="omregningTilFuldtAar"]');
    await omregningToggle.check();
    await expect(omregningToggle).toBeChecked();

    await expect(page.getByText('Sammentælling af løn fra tabellen:', { exact: true }).locator('..'))
      .toContainText('1.000,00 kr.');
    const calculationBox = page.locator('.content-box').filter({
      has: page.getByText('Beregning', { exact: true }),
    });
    await expect(calculationBox.getByText('Antal måneder i den indtastede periode:', { exact: true }).locator('..'))
      .toContainText('1 måned');

    const calculatedRow = calculationBox.getByText('Beregnet årsløn (1.000,00 x 12):', { exact: true }).locator('..');
    await expect(calculatedRow).toContainText('12.000,00 kr.');

    const downloadButton = page.getByRole('button', { name: 'Download årsløn som PDF', exact: true });
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Årsløn-PDF blev ikke skrevet til en lokal fil.');

    const pdfText = await extractPdfText(new Blob([
      await readFile(downloadPath),
    ], { type: 'application/pdf' }));
    expect(pdfText).toContain('Antal måneder i den indtastede periode');
    expect(pdfText).toContain('1 måned');
    expect(pdfText).toContain('Beregnet årsløn (1.000,00 x 12)');
    expect(pdfText).toContain('12.000,00 kr.');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
