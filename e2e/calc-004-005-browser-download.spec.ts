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
    '01-01-1980',
  );
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="skadedato"]'),
    '01-01-2015',
  );

  await openPage(page, 'Varige mén');
  await setFieldValueAndSettle(page.locator('input[name="mengrad"]'), '10');
  await setVerbatimFieldValueAndSettle(
    page.locator('input[name="beregningsdato"]'),
    '01-01-2020',
  );
};

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

test.describe('CALC-004/CALC-005 – gyldig browserrejse og PDF-download', () => {
  test('CALC-004 viser beregnet ménbeløb og henter PDF på en gyldig sag', async ({
    page,
    runtimeErrors,
  }) => {
    await login(page);
    await fillVarigeMenSag(page);

    const resultRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Beregnet méngodtgørelse',
    }).last();
    await expect(resultRow).toBeVisible();
    await expect(resultRow.getByText('91.800 kr.', { exact: true })).toBeVisible();

    const downloadButton = page.getByTestId('varigemen-download');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    expect(runtimeErrors).toEqual([]);
  });

  test('CALC-005 viser beregnet forsørgertab og henter PDF på en gyldig sag', async ({
    page,
    runtimeErrors,
  }) => {
    await login(page);
    await fillForsoergertabSag(page);

    const resultRow = page.locator('.row--label-right-hover').filter({
      has: page.getByText('Forsørgertabserstatning', { exact: true }),
    });
    await expect(resultRow).toBeVisible();
    await expect(resultRow.getByText('82.741 kr.', { exact: true })).toBeVisible();

    const downloadButton = page.getByTestId('forsoergertab-download');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    expect(runtimeErrors).toEqual([]);
  });
});
