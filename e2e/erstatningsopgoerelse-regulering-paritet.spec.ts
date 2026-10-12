import { readFile } from 'node:fs/promises';
import JSZip from 'jszip';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { encryptToString } from '../src/utils/encryption';
import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';
import { expect, login, openPage, test } from './support/mineoTest';

type Page = Parameters<typeof openPage>[0];

const loadCase = async (page: Page, bytes: Buffer, overwrite = false): Promise<void> => {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent', exact: true }).click();
  await (await chooserPromise).setFiles({
    name: 'fiktiv-reguleringssag.eo', mimeType: 'application/octet-stream', buffer: bytes,
  });
  if (overwrite) {
    const dialog = page.getByRole('dialog').filter({ hasText: 'Erstat de aktuelle indtastninger?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Erstat', exact: true }).click();
    await expect(dialog).toBeHidden();
  }
  await expect(page.locator('input[name="journalnr"]')).toHaveValue('REGULERING-FIKTIV');
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

const downloadCaseDocument = async (page: Page): Promise<Buffer> => {
  await openPage(page, 'Erstatningsopgørelse');
  await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
  const button = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' }).getByRole('button');
  await expect(button).toBeEnabled();
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const path = await (await downloadPromise).path();
  if (path === null) throw new Error('Erstatningsopgørelsen blev ikke skrevet til en lokal fil.');
  return readFile(path);
};

const expectCorrectRegulation = (text: string): void => {
  const normalized = text.replace(/\s+/g, ' ');
  for (const value of ['2,28', '110.044,38', '126.544,38']) {
    expect(normalized).toContain(value);
  }
  expect(normalized).not.toContain('21,92');
  expect(normalized).not.toContain('146.228,86');
};

test.describe('Manuel regulering – samme grundlag på skærm og i dokumenter', () => {
  test('bevarer tillæg fra en ældre .eo-fil gennem PDF, Gem/Hent og Word', async ({
    page, runtimeErrors, runtimeSignals, externalRequests,
  }, testInfo) => {
    // Browserens native pickers kan ikke betjenes af Playwright. Brug den almindelige
    // filinput-/download-fallback, så selve Hent/Gem og valideringen stadig kører gennem UI.
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
      Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
    });
    await login(page);
    await openPage(page, 'Stamdata');
    // Den gamle basisrække har kun grundløn. Tillæggene er afsluttet input på ansættelsesforholdet.
    // Netop denne gyldige struktur gav før 2,28 % i bilaget og 21,92 % i selve kravet.
    await loadCase(page, Buffer.from(await encryptToString(caseFixture)));
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    const regulationTable = page.locator('table').filter({ hasText: 'Grundløn' }).first();
    const baseRow = regulationTable.locator('tbody tr').first();
    await expect(baseRow.getByRole('textbox', { name: 'Grundløn', exact: true })).toHaveValue('33.436,04');
    const baseInputs = baseRow.locator('input');
    await expect(baseInputs.nth(2)).toHaveValue('15,00 %');
    await expect(baseInputs.nth(4)).toHaveValue('7,43 %');
    await expect(baseInputs.nth(5)).toHaveValue('12,00 %');
    await baseRow.scrollIntoViewIfNeeded();
    await testInfo.attach('manuel-regulering-basisraekke', {
      body: await page.screenshot(), contentType: 'image/png',
    });

    const pdf = await downloadCaseDocument(page);
    await testInfo.attach('erstatningsopgoerelse-pdf', { body: pdf, contentType: 'application/pdf' });
    const pdfText = await extractPdfText(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }));
    expectCorrectRegulation(pdfText);
    // Både kravets anvendte procent og reguleringsbilagets procent skal være til stede.
    expect(pdfText.match(/2,28/g)?.length).toBeGreaterThanOrEqual(2);

    const savePromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Gem', exact: true }).click();
    const savedPath = await (await savePromise).path();
    if (savedPath === null) throw new Error('Den gemte reguleringssag mangler.');
    await loadCase(page, await readFile(savedPath), true);

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();
    const zip = await JSZip.loadAsync(await downloadCaseDocument(page));
    const xml = await zip.file('word/document.xml')?.async('string');
    if (xml === undefined) throw new Error('Erstatningsopgørelsens Word mangler word/document.xml.');
    const wordText = xml.replace(/<[^>]*>/g, '');
    expectCorrectRegulation(wordText);
    expect(wordText.match(/2,28/g)?.length).toBeGreaterThanOrEqual(2);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
