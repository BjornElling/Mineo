import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

const EXPECTED_OVERSIGT_TEXT = [
  'Procesrente - oversigt',
  'Rente beregnes til og med 31-12-2020.',
  'Beløb',
  'Rentedato',
  'Beregnet rente',
  '10.000,00 kr.',
  '01-01-2020',
  '805,00 kr.',
  '5.000,00 kr.',
  '402,50 kr.',
  'Samlet rentebeløb',
  '1.207,50 kr.',
  'Beregningsprincipper',
  'Rente beregnes i henhold til renteloven.',
] as const;

const normalizeDocumentText = (text: string): string => text
  .replace(/\u00a0/g, ' ')
  .replace(/\u2013/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const expectTextSequence = (text: string, channel: string): void => {
  let previousIndex = -1;
  for (const expectedText of EXPECTED_OVERSIGT_TEXT) {
    const index = text.indexOf(expectedText, previousIndex + 1);
    expect(index, `${channel} mangler eller omarrangerer ${expectedText}`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
};

// E2E-specs må ikke importere Word-testharnessets generator-session: den trækker klientmoduler
// med browserbuild-typer ind i E2E-typechecket. Her er den nødvendige XML-tekstudlæsning derfor
// begrænset til samme tag-/tabrensning som harnessets offentligt observerede tekstfacit.
const wordXmlToPlainText = (xml: string): string => xml
  .replace(/<w:tab\/>/g, ' ')
  .replace(/<[^>]+>/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const expectOversigtPdfText = async (downloadPath: string): Promise<string> => {
  const pdfBytes = await readFile(downloadPath);
  expect(pdfBytes.length).toBeGreaterThan(100);
  expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  expect(pdfBytes.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);

  return normalizeDocumentText(await extractPdfText(new Blob([pdfBytes], { type: 'application/pdf' })));
};

const expectOversigtWordText = async (downloadPath: string): Promise<string> => {
  const zip = await JSZip.loadAsync(await readFile(downloadPath));
  const documentXml = await zip.file('word/document.xml')?.async('string');
  expect(documentXml).toBeDefined();
  if (documentXml === undefined) throw new Error('Oversigtens Word-dokument mangler word/document.xml.');

  return normalizeDocumentText(wordXmlToPlainText(documentXml));
};

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

  test('henter samlet renteoversigt som PDF og Word med samme synlige indhold', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Renteberegning');

    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Beregningsdato' }), '31-12-2020');

    const firstRow = page.locator('tbody tr').first();
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Beløb' }), '10000');
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Forfaldsdato' }), '01-01-2020');
    const secondRow = page.locator('tbody tr').nth(1);
    await setFieldValueAndSettle(secondRow.getByRole('textbox', { name: 'Beløb' }), '5000');
    await setFieldValueAndSettle(secondRow.getByRole('textbox', { name: 'Forfaldsdato' }), '01-01-2020');

    await expect(firstRow.getByText('805,00 kr.', { exact: true })).toBeVisible();
    const summaryRow = page.locator('tfoot tr');
    await expect(summaryRow).toContainText('Samlet rentebeløb');
    await expect(summaryRow).toContainText('1.207,50 kr.');
    const overviewRow = page.locator('.row--label-right-hover').filter({ hasText: 'Download samlet oversigt' });
    await expect(overviewRow).toBeVisible();

    const pdfButton = overviewRow.getByRole('button', { name: 'Download samlet oversigt' });
    await expect(pdfButton).toBeEnabled();

    const pdfDownloadPromise = page.waitForEvent('download');
    await pdfButton.click();
    const pdfDownload = await pdfDownloadPromise;
    expect(pdfDownload.suggestedFilename()).toMatch(/\.pdf$/i);
    const pdfPath = await pdfDownload.path();
    expect(pdfPath).not.toBeNull();
    if (pdfPath === null) throw new Error('Oversigtens PDF blev ikke skrevet til en lokal fil.');
    const pdfText = await expectOversigtPdfText(pdfPath);

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();
    await openPage(page, 'Renteberegning');

    const wordOverviewRow = page.locator('.row--label-right-hover').filter({ hasText: 'Download samlet oversigt' });
    const wordSummaryRow = page.locator('tfoot tr');
    await expect(wordSummaryRow).toContainText('Samlet rentebeløb');
    await expect(wordSummaryRow).toContainText('1.207,50 kr.');
    await expect(wordOverviewRow).toBeVisible();
    const wordButton = wordOverviewRow.getByRole('button', { name: 'Download samlet oversigt' });
    await expect(wordButton).toBeEnabled();

    const wordDownloadPromise = page.waitForEvent('download');
    await wordButton.click();
    const wordDownload = await wordDownloadPromise;
    expect(wordDownload.suggestedFilename()).toMatch(/\.docx$/i);
    const wordPath = await wordDownload.path();
    expect(wordPath).not.toBeNull();
    if (wordPath === null) throw new Error('Oversigtens Word-dokument blev ikke skrevet til en lokal fil.');
    const wordText = await expectOversigtWordText(wordPath);

    for (const expectedText of EXPECTED_OVERSIGT_TEXT) {
      expect(pdfText, `PDF mangler ${expectedText}`).toContain(expectedText);
      expect(wordText, `Word mangler ${expectedText}`).toContain(expectedText);
    }
    expectTextSequence(pdfText, 'PDF');
    expectTextSequence(wordText, 'Word');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
