import { readFile } from 'node:fs/promises';

import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';
import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('UI-008 – Satser', () => {
  test('vælger 2024, viser de delte minimumssatser og henter PDF-specifikationen', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Satser');

    const yearInput = page.locator('input[name="aargang"]');
    await setFieldValueAndSettle(yearInput, '2024');

    await expect(yearInput).toHaveValue('2024');
    await expect(page.getByText('Arbejdsskadesatser 2024', { exact: true })).toBeVisible();

    const aslSection = page.locator('.content-box').filter({
      has: page.getByText('Arbejdsskadesikringsloven', { exact: true }),
    });
    await expect(aslSection).toBeVisible();
    await expect(aslSection.locator('.row--label-right-hover').filter({
      hasText: 'Minimum årsløn (skader før 1.7.2024)',
    })).toContainText('227.000 kr.');
    await expect(aslSection.locator('.row--label-right-hover').filter({
      hasText: 'Minimum årsløn (skader fra 1.7.2024)',
    })).toContainText('257.000 kr.');
    await expect(aslSection.locator('.row--label-right-hover').filter({
      hasText: 'Reguleringsprocent for erhvervsevnetab (fra 2024)',
    })).toContainText('0 %');

    const downloadButton = page.locator('.row--label-right-hover').filter({
      hasText: 'Download specifikation',
    }).getByRole('button');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Arbejdsskadesatser 2024.pdf');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('PDF-downloadet blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(downloadPath);
    const pdfText = await extractPdfText(new Blob([pdfBytes], { type: 'application/pdf' }));
    expect(pdfText).toContain('Arbejdsskadesatser 2024');
    expect(pdfText).toContain('Minimum årsløn (skader før 1.7.2024)');
    expect(pdfText).toContain('227.000 kr.');
    expect(pdfText).toContain('Minimum årsløn (skader fra 1.7.2024)');
    expect(pdfText).toContain('257.000 kr.');
    expect(pdfText).toContain('Reguleringsprocent for erhvervsevnetab (fra 2024)');
    expect(pdfText).toContain('0 %');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('vælger historiske 2020-satser og henter PDF med de gamle satsserier', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Satser');

    const yearInput = page.locator('input[name="aargang"]');
    await setFieldValueAndSettle(yearInput, '2020');

    await expect(yearInput).toHaveValue('2020');
    await expect(page.getByText('Arbejdsskadesatser 2020', { exact: true })).toBeVisible();

    const ealSection = page.locator('.content-box').filter({
      has: page.getByText('Erstatningsansvarsloven', { exact: true }),
    });
    await expect(ealSection.locator('.row--label-right-hover').filter({
      hasText: 'Godtgørelse for svie og smerte',
    })).toContainText('210 kr./sygedag');

    const aslSection = page.locator('.content-box').filter({
      has: page.getByText('Arbejdsskadesikringsloven', { exact: true }),
    });
    await expect(aslSection.locator('.row--label-right-hover').filter({
      hasText: 'Minimum årsløn',
    }).first()).toContainText('206.000 kr.');
    await expect(aslSection.locator('.row--label-right-hover').filter({
      hasText: 'Reguleringsprocent for erhvervsevnetab',
    }).first()).toContainText('50,1 %');

    const downloadButton = page.locator('.row--label-right-hover').filter({
      hasText: 'Download specifikation',
    }).getByRole('button');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('Arbejdsskadesatser 2020.pdf');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    if (downloadPath === null) throw new Error('Satser-PDF blev ikke skrevet til en lokal fil.');

    const pdfBytes = await readFile(downloadPath);
    expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const pdfText = await extractPdfText(new Blob([pdfBytes], { type: 'application/pdf' }));
    expect(pdfText).toContain('Arbejdsskadesatser 2020');
    expect(pdfText).toContain('Godtgørelse for svie og smerte');
    expect(pdfText).toContain('210 kr./sygedag');
    expect(pdfText).toContain('Minimum årsløn');
    expect(pdfText).toContain('206.000 kr.');
    expect(pdfText).toContain('Reguleringsprocent for erhvervsevnetab');
    expect(pdfText).toContain('50,1 %');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
