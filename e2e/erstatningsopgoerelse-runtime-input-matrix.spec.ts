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
 * Afprøver den tidligere fejlklasse gennem den faktiske fanemounting.
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
    await expect(beregningPanel).toContainText('Ingen indkomst i beregningsperioden');
    await page.screenshot({ path: testInfo.outputPath('delvis-eo-beregning.png') });

    await openPage(page, 'Indstillinger');
    const showControlTabs = page.getByRole('checkbox', {
      name: 'Vis kontrolfaner på Erstatningsopgørelse-side',
    });
    if (!(await showControlTabs.isChecked())) await showControlTabs.click();

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('button', { name: 'EO-kontrol', exact: true }).click();
    await expect(visiblePanel(page).getByText('Stamdata', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    await expect(visiblePanel(page).getByText('Kontroltabel', { exact: true }).first()).toBeVisible();

    // Afvigende input skal give feltfejl, aldrig uenighed mellem kontrollens to kolonner.
    // Hvert besøg genopbygger kontrollen fra den senest afsluttede revision.
    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Øvrigt fravær uden løn', exact: true }).check();
    for (const raw of ['1000', '']) {
      await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
      const absence = page.locator("input[name='oevrigeFravaersdage']");
      await setFieldValueAndSettle(absence, raw);
      if (raw !== '') await expect(absence).toHaveAttribute('aria-invalid', 'true');
      await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
      const summary = visiblePanel(page).locator('.content-box').filter({ hasText: 'Sammentælling' });
      await expect(summary).toBeVisible();
      const basisRows = summary.locator('table').first().locator('tbody tr');
      await expect(basisRows).toHaveCount(4);
      for (const row of await basisRows.all()) {
        await expect(row.getByRole('cell').nth(2)).toHaveText(await row.getByRole('cell').nth(1).innerText());
        await expect(row.getByRole('cell').last().locator('svg')).toHaveCSS('color', 'rgb(16, 185, 129)');
      }
    }
    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    const invalidDate = page.locator("input[name='tafBeregningsperiodeFra']");
    await setDate(invalidDate, '31-02-2023');
    await expect(invalidDate).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    const invalidRangeControl = visiblePanel(page).getByRole('row').filter({ hasText: 'Arbejdsdage i beregningsperiode' });
    await expect(invalidRangeControl.getByRole('cell').nth(1)).toHaveText('-');
    await expect(invalidRangeControl.getByRole('cell').nth(2)).toHaveText('-');
    await invalidRangeControl.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('kontroltabel-manglende-fravaer.png') });

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
