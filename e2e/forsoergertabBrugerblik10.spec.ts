import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';
import type { Page } from '@playwright/test';

/**
 * Brugerblikkets flade 10 (2026-11-18): de tre rettede fund på Forsørgertab, målt som brugeren møder dem.
 *
 * - BB-403: en efterladt, der er født efter virkningsdatoen, gør feltet rødt og spærrer dokumentet.
 * - BB-404: et kønsvalg spærrer ikke længere en ren EAL-sag; kønnet vises først ved påbegyndt ASL-ydelse.
 * - BB-405: «Indsæt dags dato» er inaktiv, når dags dato ligger før virkningsdatoen.
 *
 * Uret fastlåses, fordi BB-405 netop handler om forholdet mellem dags dato og en fremtidig virkningsdato.
 */

const fillStamdata = async (page: Page, skadedato: string): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), '15-03-1975');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), skadedato);
  await openPage(page, 'Forsørgertab');
};

const koenRow = (page: Page) => page.locator('.row--label-right-hover').filter({ hasText: 'Skadelidtes køn' });

test.describe('Forsørgertab – brugerblik flade 10', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-18T12:00:00'));
    await login(page);
  });

  test('BB-403: efterladtes fødselsdato efter virkningsdatoen spærrer dokumentet', async ({ page, runtimeErrors }) => {
    await fillStamdata(page, '10-06-2020');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-07-2025');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="virkningsdato"]'), '10-06-2020');
    await setFieldValueAndSettle(page.locator('input[name="tilkendtForPeriodeAar"]'), '1');
    const efterladte = page.locator('input[name="efterladteFodselsdato"]');
    await setVerbatimFieldValueAndSettle(efterladte, '01-01-2022');

    await expect(efterladte).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByText('121.251 kr.')).toHaveCount(0);
    await expect(page.getByTestId('forsoergertab-download')).toBeDisabled();

    // Samme dag som virkningsdatoen er tilladt.
    await setVerbatimFieldValueAndSettle(efterladte, '10-06-2020');
    await expect(efterladte).not.toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('forsoergertab-download')).toBeEnabled();

    expect(runtimeErrors).toEqual([]);
  });

  test('BB-404: kønnet vises først ved påbegyndt ASL-ydelse og spærrer ikke en EAL-sag', async ({ page, runtimeErrors }) => {
    await fillStamdata(page, '10-06-2013');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '28-02-2015');
    await setFieldValueAndSettle(page.locator('input[name="ealAarsloen"]'), '450000');

    await expect(koenRow(page)).toHaveCount(0);
    await expect(page.getByTestId('forsoergertab-download')).toBeEnabled();

    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '400000');
    await expect(koenRow(page)).toHaveCount(1);
    await expect(page.getByTestId('forsoergertab-download')).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
  });

  test('BB-405: «Indsæt dags dato» er inaktiv før virkningsdatoen og bevarer beregningsdatoen', async ({ page, runtimeErrors }) => {
    await fillStamdata(page, '10-06-2020');
    const beregningsdato = page.locator('input[name="beregningsdato"]');
    await setVerbatimFieldValueAndSettle(beregningsdato, '01-12-2026');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="virkningsdato"]'), '01-12-2026');

    const button = page.getByRole('button', { name: 'Dags dato er før virkningsdatoen (01-12-2026)' });
    await expect(button).toBeDisabled();
    await expect(beregningsdato).toHaveValue('01-12-2026');
    await expect(page.getByRole('button', { name: 'Indsæt dags dato' })).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });
});
