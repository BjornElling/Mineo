import type { Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
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

const eetTab = (page: Page, name: (typeof EET_TABS)[number]) =>
  page.getByRole('tab', { name, exact: true });

const afgoerelseRow = (page: Page) => page.locator('tbody tr[data-mineo-row-id]').first();

const setupValidEetSag = async (page: Page): Promise<void> => {
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

  const row = afgoerelseRow(page);
  const cell = (label: string) => row.getByRole('textbox', { name: label, exact: true });
  await setVerbatimFieldValueAndSettle(cell('Afgørelsesdato'), '01-06-2020');
  await setVerbatimFieldValueAndSettle(cell('Virkningsdato'), '01-01-2020');
  await setFieldValueAndSettle(cell('EET %'), '25');
  await row.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Endelig', exact: true }).click();
  await setVerbatimFieldValueAndSettle(cell('Kap.dato'), '01-06-2020');
  await setFieldValueAndSettle(cell('Kap. %'), '25');
};

test.describe('UI-003 – EETs fem faner gennem browser-reload', () => {
  test('bevarer udfyldt sag og aktiv Differencekrav-fane efter browser-reload', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await setupValidEetSag(page);

    const visibleEvidence: Readonly<Record<(typeof EET_TABS)[number], string>> = {
      'EET oplysninger': 'Grundlæggende oplysninger',
      'Løbende ydelser': 'Afgørelse 1. juni 2020 (25 %)',
      Kapitalisering: 'Kapitaliseringsdato',
      'EET efter EAL': 'Beregnet EET (efter EAL)',
      Differencekrav: 'Beregnet differencekrav',
    };

    for (const tabName of EET_TABS) {
      await eetTab(page, tabName).click();
      await expect(eetTab(page, tabName)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByText(visibleEvidence[tabName], { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByText('Beregnet differencekrav', { exact: true })).toBeVisible();

    await page.reload();

    await expect(page.locator('.page-title')).toHaveText('Erhvervsevnetab');
    await expect(eetTab(page, 'Differencekrav')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Beregnet differencekrav', { exact: true })).toBeVisible();

    await eetTab(page, 'EET oplysninger').click();
    await expect(eetTab(page, 'EET oplysninger')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('input[name="beregningsdato"]')).toHaveValue('01-06-2022');
    await expect(afgoerelseRow(page).getByRole('textbox', { name: 'EET %', exact: true }))
      .toHaveValue('25');

    await eetTab(page, 'Differencekrav').click();
    await expect(eetTab(page, 'Differencekrav')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Beregnet differencekrav', { exact: true })).toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
