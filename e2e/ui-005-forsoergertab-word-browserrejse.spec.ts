import { readFile } from 'node:fs/promises';

import JSZip from 'jszip';
import type { Page } from '@playwright/test';

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

test.describe('UI-005 – Forsørgertab fra input til Word-dokument', () => {
  test('viser nettokravet og henter Word med samme beregnede indhold', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillForsoergertabSag(page);

    const resultRow = page.getByText('Forsørgertabserstatning', { exact: true }).locator('..');
    await expect(resultRow).toBeVisible();
    await expect(resultRow.getByText('82.741 kr.', { exact: true })).toBeVisible();

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();

    await openPage(page, 'Forsørgertab');
    const downloadButton = page.getByTestId('forsoergertab-download');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Forsørgertab-Word blev ikke skrevet til en lokal fil.');

    const zip = await JSZip.loadAsync(await readFile(downloadPath));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    if (documentXml === undefined) throw new Error('Forsørgertab-Word mangler word/document.xml.');

    expect(documentXml).toContain('Forsørgertab');
    expect(documentXml).toContain('Beregnet forsørgertab');
    expect(documentXml).toContain('EAL-krav');
    expect(documentXml).toContain('82.741 kr.');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
