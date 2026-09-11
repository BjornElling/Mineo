import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import type { Page } from '@playwright/test';
import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';

import {
  expect,
  login,
  openPage,
  setFieldValue,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const EET_TABS = [
  'EET oplysninger',
  'Løbende ydelser',
  'Kapitalisering',
  'EET efter EAL',
  'Differencekrav',
] as const;

type EetDocumentTab = Exclude<(typeof EET_TABS)[number], 'EET oplysninger'>;

const EET_DOCUMENT_TABS = EET_TABS.slice(1) as readonly EetDocumentTab[];

const EXPECTED_PDF_TEXT_BY_TAB: Readonly<Record<
  EetDocumentTab,
  readonly string[]
>> = {
  'Løbende ydelser': [
    'Løbende ydelser (EET)',
    'Afgørelse',
    '400.000 kr.',
    '25 %',
  ],
  Kapitalisering: [
    'Kapitalisering (EET)',
    'Afgørelse 1. juni 2020 (25 %)',
    'Kapitaliseringsdato',
    'Beregnet kapitalbeløb',
  ],
  'EET efter EAL': [
    'EET efter EAL',
    'Specifikation',
    'Skadedato',
    '01-06-2018',
    'Erhvervsevnetab',
    '25 %',
    'Kapitaliseringsfaktor',
    '10',
    'Beregnet EET (efter EAL)',
  ],
  Differencekrav: [
    'Differencekrav (EET)',
    'EAL-krav',
    'Beregnet differencekrav',
  ],
};

const eetTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

const downloadButton = (page: Page) => page.locator('.row--label-right-hover')
  .filter({ hasText: 'Download specifikation' })
  .getByRole('button');

const expectPdfArtifactText = async (
  downloadPath: string,
  expectedText: readonly string[],
): Promise<void> => {
  const pdfBytes = await readFile(downloadPath);
  expect(pdfBytes.length).toBeGreaterThan(100);

  const pdfText = await extractPdfText(new Blob([pdfBytes], { type: 'application/pdf' }));
  for (const text of expectedText) {
    expect(pdfText).toContain(text);
  }
};

const afgoerelseRow = (page: Page, index: number) =>
  page.locator('tbody tr[data-mineo-row-id]').nth(index);

const setupValidSag = async (page: Page): Promise<void> => {
  await login(page);
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-06-2018');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadelidteFodselsdato"]'),
    '01-01-1970',
  );

  await openPage(page, 'Erhvervsevnetab');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="beregningsdato"]'),
    '01-06-2022',
  );
  await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');

  const row = afgoerelseRow(page, 0);
  const cell = (label: string) => row.getByRole('textbox', { name: label, exact: true });
  await setVerbatimFieldValueAndSettle(cell('Afgørelsesdato'), '01-06-2020');
  await setVerbatimFieldValueAndSettle(cell('Virkningsdato'), '01-01-2020');
  await setFieldValueAndSettle(cell('EET %'), '25');
  await row.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Endelig', exact: true }).click();
  await setVerbatimFieldValueAndSettle(cell('Kap.dato'), '01-06-2020');
  await setFieldValueAndSettle(cell('Kap. %'), '25');
};

test.describe('EET-siden – samlet fane- og downloadaudit', () => {
  test('viser alle fem faner og en synlig blokeret download på en tom sag', async ({
    page,
    runtimeErrors,
  }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');

    await expect(page.getByRole('tab')).toHaveCount(EET_TABS.length);
    for (const tabName of EET_TABS) {
      const tab = eetTab(page, tabName);
      await tab.click();
      await expect(tab).toHaveAttribute('aria-selected', 'true');

      if (tabName === 'EET oplysninger') {
        await expect(page.getByText('Download specifikation', { exact: true })).toHaveCount(0);
        continue;
      }

      const button = downloadButton(page);
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      await expect(button).toHaveAccessibleName('Indtastning mangler');
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('settler en åben editor før faneskift og bevarer værdien efter siden forlades', async ({
    page,
    runtimeErrors,
  }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');

    const beregningsdato = page.locator('input[name="beregningsdato"]');
    await setFieldValue(beregningsdato, '01-07-2026');
    await expect(beregningsdato).toHaveValue('01-07-2026');

    await eetTab(page, 'Løbende ydelser').click();
    await expect(eetTab(page, 'Løbende ydelser')).toHaveAttribute('aria-selected', 'true');
    await eetTab(page, 'EET oplysninger').click();
    await expect(beregningsdato).toHaveValue('01-07-2026');

    await openPage(page, 'Stamdata');
    await openPage(page, 'Erhvervsevnetab');
    await expect(eetTab(page, 'EET oplysninger')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('input[name="beregningsdato"]')).toHaveValue('01-07-2026');

    expect(runtimeErrors).toEqual([]);
  });

  test('holder alle fire dokumenter synlige og blokerede ved ugyldig EET-indtastning', async ({
    page,
    runtimeErrors,
  }) => {
    await setupValidSag(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(
      page.locator('input[name="skadedato"]'),
      '31-02-2020',
    );
    await expect(page.locator('input[name="skadedato"]')).toHaveAttribute('aria-invalid', 'true');
    await openPage(page, 'Erhvervsevnetab');

    for (const tabName of EET_DOCUMENT_TABS) {
      await eetTab(page, tabName).click();
      await expect(eetTab(page, tabName)).toHaveAttribute('aria-selected', 'true');
      const button = downloadButton(page);
      await expect(button).toBeVisible();
      await expect(button).toBeDisabled();
      await expect(button).toHaveAccessibleName('Fejl i indtastning');
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('kan hente en PDF fra hver af de fire beregningsfaner på en komplet sag', async ({
    page,
    runtimeErrors,
  }) => {
    await setupValidSag(page);

    for (const tabName of EET_DOCUMENT_TABS) {
      await eetTab(page, tabName).click();
      await expect(eetTab(page, tabName)).toHaveAttribute('aria-selected', 'true');
      const button = downloadButton(page);
      await expect(button).toBeEnabled();

      const downloadPromise = page.waitForEvent('download');
      await button.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);

      const downloadPath = await download.path();
      expect(downloadPath).not.toBeNull();
      if (downloadPath === null) throw new Error('PDF-downloadet blev ikke skrevet til en lokal fil.');
      await expectPdfArtifactText(downloadPath, EXPECTED_PDF_TEXT_BY_TAB[tabName]);
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('kan vælge Word og hente semantisk indhold fra EET-dokumentet', async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    await setupValidSag(page);

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();

    await openPage(page, 'Erhvervsevnetab');
    await eetTab(page, 'Løbende ydelser').click();

    const button = downloadButton(page);
    await expect(button).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const zip = await JSZip.loadAsync(await readFile(downloadPath!));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    expect(documentXml).toContain('Løbende ydelser (EET)');
    expect(documentXml).toContain('Afgørelse');
    expect(documentXml).toContain('400.000 kr.');
    expect(documentXml).toContain('25 %');

    await download.saveAs(testInfo.outputPath('eet-loebende-ydelser.docx'));
    expect(runtimeErrors).toEqual([]);
  });

  test('kan hente Word med kapitaliseringens synlige beregning', async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    await setupValidSag(page);

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();

    await openPage(page, 'Erhvervsevnetab');
    await eetTab(page, 'Kapitalisering').click();

    const afgoerelse = page.locator('.content-box').filter({ hasText: 'Afgørelse 1. juni 2020 (25 %)' });
    await expect(afgoerelse).toBeVisible();
    await expect(afgoerelse).toContainText('Kapitaliseringsdato');
    await expect(afgoerelse).toContainText('01-06-2020');
    await expect(afgoerelse).toContainText('Kapitaliseringsprocent');
    await expect(afgoerelse).toContainText('25 %');

    const kapitalbeløbRow = afgoerelse
      .locator('.row--label-right-hover')
      .filter({ hasText: 'Beregnet kapitalbeløb' });
    await expect(kapitalbeløbRow).toBeVisible();
    const visibleRowText = await kapitalbeløbRow.innerText();
    const visibleAmount = visibleRowText.match(/[\d.]+ kr\./g)?.at(-1);
    expect(visibleAmount).toBeDefined();

    const button = downloadButton(page);
    await expect(button).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const zip = await JSZip.loadAsync(await readFile(downloadPath!));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    expect(documentXml).toContain('Kapitalisering (EET)');
    expect(documentXml).toContain('Afgørelse 1. juni 2020 (25 %)');
    expect(documentXml).toContain('Kapitaliseringsdato');
    expect(documentXml).toContain('01-06-2020');
    expect(documentXml).toContain('Beregnet kapitalbeløb');
    expect(documentXml).toContain(visibleAmount!);

    await download.saveAs(testInfo.outputPath('eet-kapitalisering.docx'));
    expect(runtimeErrors).toEqual([]);
  });

  test('kan hente Word med EET efter EALs synlige beregning', async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    await setupValidSag(page);

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();

    await openPage(page, 'Erhvervsevnetab');
    await eetTab(page, 'EET efter EAL').click();
    await expect(eetTab(page, 'EET efter EAL')).toHaveAttribute('aria-selected', 'true');

    const specification = page.locator('.content-box').filter({
      has: page.getByText('Specifikation', { exact: true }),
    });
    await expect(specification).toBeVisible();
    await expect(specification).toContainText('Skadedato');
    await expect(specification).toContainText('01-06-2018');
    await expect(specification).toContainText('Erhvervsevnetab');
    await expect(specification).toContainText('25 %');
    await expect(specification).toContainText('Kapitaliseringsfaktor');
    await expect(specification).toContainText('10');
    await expect(specification).toContainText('Beregnet EET (efter EAL)');

    const visibleResultText = await specification.locator('.row--label-right-hover').last().innerText();
    const visibleAmount = visibleResultText.match(/[\d.]+ kr\./g)?.at(-1);
    expect(visibleAmount).toBeDefined();

    const button = downloadButton(page);
    await expect(button).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const zip = await JSZip.loadAsync(await readFile(downloadPath!));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    expect(documentXml).toContain('EET efter EAL');
    expect(documentXml).toContain('Specifikation');
    expect(documentXml).toContain('Skadedato');
    expect(documentXml).toContain('01-06-2018');
    expect(documentXml).toContain('Erhvervsevnetab');
    expect(documentXml).toContain('25 %');
    expect(documentXml).toContain('Kapitaliseringsfaktor');
    expect(documentXml).toContain('10');
    expect(documentXml).toContain('Beregnet EET (efter EAL)');
    expect(documentXml).toContain(visibleAmount!);

    await download.saveAs(testInfo.outputPath('eet-efter-eal.docx'));
    expect(runtimeErrors).toEqual([]);
  });

  test('kan hente Word med Differencekravets synlige beregning', async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    await setupValidSag(page);

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();

    await openPage(page, 'Erhvervsevnetab');
    await eetTab(page, 'Differencekrav').click();
    await expect(eetTab(page, 'Differencekrav')).toHaveAttribute('aria-selected', 'true');

    const differencekravRow = page.locator('.row--label-right-hover')
      .filter({ hasText: 'Beregnet differencekrav' });
    await expect(differencekravRow).toBeVisible();
    const visibleRowText = await differencekravRow.innerText();
    const visibleAmount = visibleRowText.match(/[\d.]+ kr\./g)?.at(-1);
    expect(visibleAmount).toBeDefined();

    const button = downloadButton(page);
    await expect(button).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await button.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const zip = await JSZip.loadAsync(await readFile(downloadPath!));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    expect(documentXml).toContain('Differencekrav (EET)');
    expect(documentXml).toContain('EAL-krav');
    expect(documentXml).toContain('Beregnet differencekrav');
    expect(documentXml).toContain(visibleAmount!);

    await download.saveAs(testInfo.outputPath('eet-differencekrav.docx'));
    expect(runtimeErrors).toEqual([]);
  });
});
