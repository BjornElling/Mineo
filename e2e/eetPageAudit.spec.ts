import type { Page } from '@playwright/test';

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

const EET_DOCUMENT_TABS = EET_TABS.slice(1);

const eetTab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });

const downloadButton = (page: Page) => page.locator('.row--label-right-hover')
  .filter({ hasText: 'Download specifikation' })
  .getByRole('button');

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
    }

    expect(runtimeErrors).toEqual([]);
  });
});
