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

const fillVarigeMenSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadelidteFodselsdato"]'),
    '01-03-1959',
  );
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadedato"]'),
    '01-04-2024',
  );

  await openPage(page, 'Varige mén');
  await setFieldValueAndSettle(page.locator('input[name="mengrad"]'), '15');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="beregningsdato"]'),
    '01-06-2024',
  );
};

test.describe('UI-004 – Varige mén fra input til Word-dokument', () => {
  test('viser méngodtgørelsen og henter Word med samme beregnede indhold', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillVarigeMenSag(page);

    const resultRow = page.locator('.row--label-right-hover').filter({
      has: page.getByTestId('varigemen-download'),
    });
    await expect(resultRow).toBeVisible();
    await expect(resultRow.getByText('103.377 kr.', { exact: true })).toBeVisible();

    await openPage(page, 'Indstillinger');
    await page.getByRole('combobox', { name: 'Download-format for dokumenter', exact: true }).click();
    await page.getByRole('option', { name: 'Word', exact: true }).click();

    await openPage(page, 'Varige mén');
    const downloadButton = page.getByTestId('varigemen-download');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.docx$/);

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Varige mén-Word blev ikke skrevet til en lokal fil.');

    const zip = await JSZip.loadAsync(await readFile(downloadPath));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    expect(documentXml).toBeDefined();
    if (documentXml === undefined) throw new Error('Varige mén-Word mangler word/document.xml.');

    expect(documentXml).toContain('Ménberegning');
    expect(documentXml).toContain('Beregnet méngodtgørelse');
    expect(documentXml).toContain('10.135 kr.');
    expect(documentXml).toContain('103.377 kr.');
    expect(documentXml).toContain('48.648 kr.');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
