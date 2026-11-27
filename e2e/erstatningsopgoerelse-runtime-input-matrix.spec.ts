import type { Page } from '@playwright/test';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const setDate = setVerbatimFieldValueAndSettle;

const visiblePanel = (page: Page) => page.locator('[role="tabpanel"]:visible');

/**
 * Afprøver fanemountingen med en delvist udfyldt sag.
 *
 * TAF- og beregningsgrundlagsfelterne er udfyldt, mens de øvrige EO-oplysninger bevidst står tomme.
 * Hver fane monteres først ved besøg, så samme sag skal kunne åbnes i alle faner uden en skjult
 * afhængighed til et felt, som en anden fane normalt udfylder.
 */
test.describe('Erstatningsopgørelse – runtime-matrix på tværs af faner', () => {
  test('monterer alle EO-faner med TAF og beregningsgrundlag, men øvrige felter tomme', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');

    await setDate(page.locator("input[name='tafBeregningsperiodeFra']"), '01-01-2023');
    await setDate(page.locator("input[name='tafBeregningsperiodeTil']"), '31-12-2023');

    const tafRow = page.locator('[data-section-id="taf"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first();
    await setDate(tafRow.getByRole('textbox', { name: 'Fra o.m.', exact: true }), '01-01-2024');
    await setDate(tafRow.getByRole('textbox', { name: 'Til o.m.', exact: true }), '31-12-2024');

    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await expect(visiblePanel(page).locator('[data-section-id="loenindkomst"] .section-header')).toHaveText('Ansættelsesforhold');

    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();
    const ydelsePanel = visiblePanel(page);
    await expect(ydelsePanel.locator('.section-header').first()).toHaveText('Offentlige ydelser');
    const ydelseRow = ydelsePanel.locator('table').filter({ hasText: 'Ydelse' }).first()
      .locator('tbody tr[data-mineo-row-id]').first();
    await setDate(ydelseRow.locator('input[data-mineo-field-address]').first(), '01-01-2024');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const beregningPanel = visiblePanel(page);
    await expect(beregningPanel.getByText('Fejl og advarsler', { exact: true })).toBeVisible();
    // Den delvise ydelsesrække melder sin egen fejl. Indtil den er rettet, kan perioden ikke kaldes uden indkomst,
    // så «Ingen indkomst i beregningsperioden» undertrykkes.
    await expect(beregningPanel).toContainText('Ydelsestype er ikke valgt');
    await expect(beregningPanel).not.toContainText('Ingen indkomst i beregningsperioden');
    await page.screenshot({ path: testInfo.outputPath('delvis-eo-beregning.png') });

    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Øvrigt fravær uden løn', exact: true }).check();
    const absence = page.locator("input[name='oevrigeFravaersdage']");
    await setFieldValueAndSettle(absence, '367');
    await expect(absence).toHaveAttribute('aria-invalid', 'true');
    const invalidDate = page.locator("input[name='tafBeregningsperiodeFra']");
    await setDate(invalidDate, '31-02-2023');
    await expect(invalidDate).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(beregningPanel.getByRole('button', { name: 'Der er intet gyldigt dagsgrundlag at hente' })).toBeDisabled();

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('tåler delvise svie/smerte-, øvrige krav- og ydelsesrækker i alle hovedfaner', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');

    await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Ja']").check();

    const svieRow = page.locator('[data-section-id="sviesmerte"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first();
    await setDate(svieRow.getByRole('textbox', { name: 'Fra o.m.', exact: true }), '01-01-2024');

    const oevrigeRow = page.locator('[data-section-id="oevrige-krav"] table').first()
      .locator('tbody tr[data-mineo-row-id]').first();
    await setDate(oevrigeRow.getByRole('textbox', { name: 'Dato', exact: true }), '01-01-2024');

    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await expect(visiblePanel(page).locator('[data-section-id="loenindkomst"] .section-header')).toHaveText('Ansættelsesforhold');

    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();
    const ydelsePanel = visiblePanel(page);
    const ydelseRow = ydelsePanel.locator('table').filter({ hasText: 'Ydelse' }).first()
      .locator('tbody tr[data-mineo-row-id]').first();
    await setDate(ydelseRow.locator('input[data-mineo-field-address]').first(), '01-01-2024');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(visiblePanel(page).getByText('Fejl og advarsler', { exact: true })).toBeVisible();
    await expect(visiblePanel(page)).not.toContainText('intern beregningsfejl');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
