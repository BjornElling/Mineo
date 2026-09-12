import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';
import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const fillForsoergertabSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadelidteFodselsdato"]'),
    '15-03-1975',
  );
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadedato"]'),
    '10-06-2020',
  );

  await openPage(page, 'Forsørgertab');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="efterladteFodselsdato"]'),
    '20-08-1978',
  );
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="beregningsdato"]'),
    '01-07-2025',
  );
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="virkningsdato"]'),
    '10-06-2020',
  );
  await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');
  await setFieldValueAndSettle(page.locator('input[name="tilkendtForPeriodeAar"]'), '10');
};

test.describe('TD-042 – Forsørgertabets PDF-indhold', () => {
  test('viser resultatet og henter PDF med samme konkrete beregningsindhold', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillForsoergertabSag(page);

    const resultRow = page.getByText('Forsørgertabserstatning', { exact: true }).locator('..');
    await expect(resultRow).toBeVisible();
    await expect(resultRow.getByText('82.741 kr.', { exact: true })).toBeVisible();

    const downloadButton = page.getByTestId('forsoergertab-download');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Forsørgertab-PDF blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(downloadPath);
    const pdfText = await extractPdfText(new Blob([pdfBytes], { type: 'application/pdf' }));
    for (const expectedText of [
      'Forsørgertab',
      'Beregnet forsørgertab',
      'EAL-krav',
      'Løbende ydelser (efter ASL)',
      'Kapitalbeløb (efter ASL)',
      'Forsørgertabserstatning',
      '82.741 kr.',
    ]) {
      expect(pdfText, `Forsørgertab-PDF mangler «${expectedText}»`).toContain(expectedText);
    }

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
