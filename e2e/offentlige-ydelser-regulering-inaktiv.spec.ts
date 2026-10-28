import { expect, login, openPage, setFieldValueAndSettle, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

test.describe('Offentlige ydelser – regulering følger beregningsgrundlaget', () => {
  test('inaktiverer uden bidrag og bevarer valget, når ydelsen flyttes ud og ind af perioden', async ({ page, runtimeErrors, runtimeSignals, externalRequests }, testInfo) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
    await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
    await page.getByRole('option', { name: 'Beregningsperiode', exact: true }).click();
    await setVerbatimFieldValueAndSettle(page.locator("input[name='tafBeregningsperiodeFra']"), '01-01-2022');
    await setVerbatimFieldValueAndSettle(page.locator("input[name='tafBeregningsperiodeTil']"), '31-12-2022');
    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();

    const toggle = page.locator("input[name='regulerOffentligeYdelser']");
    const label = page.locator('label').filter({ hasText: 'Offentlige ydelser i beregningsperioden reguleres' });
    const inactiveText = 'Der indgår ikke offentlige ydelser i beregningsgrundlaget for TAF.';
    const activeText = 'Offentlige ydelser, der indgår i beregningsgrundlaget, opreguleres til erstatningsåret ved beregning af TAF.';
    await expect(toggle).toBeDisabled();
    const inactiveColor = await label.evaluate(element => getComputedStyle(element).color);
    await label.getByRole('img').hover();
    await expect(page.getByRole('tooltip')).toHaveText(inactiveText);
    await page.screenshot({ path: testInfo.outputPath('regulering-inaktiv.png') });

    // Et klik på den inaktive toggle ryster den (page-component-contract §11.1b). MUI giver den
    // deaktiverede switch-knap `pointer-events: none`, så klikket skal fanges på switchens rod.
    const switchRoot = page.locator('.MuiSwitch-root').filter({ has: toggle });
    const checkedBefore = await toggle.isChecked();
    await switchRoot.click();
    await expect(switchRoot).toHaveClass(/mineo-toggle-refusal-shake/);
    expect(await toggle.isChecked()).toBe(checkedBefore);

    const row = page.locator('table').filter({ hasText: 'Ydelse' }).first().locator('tbody tr[data-mineo-row-id]').first();
    const inputs = row.locator('input[data-mineo-field-address]');
    await setVerbatimFieldValueAndSettle(inputs.nth(0), '01-01-2021');
    await setVerbatimFieldValueAndSettle(inputs.nth(1), '31-12-2021');
    await setFieldValueAndSettle(inputs.nth(2), '1000');
    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Dagpenge', exact: true }).click();
    await expect(toggle).toBeDisabled();

    await setVerbatimFieldValueAndSettle(inputs.nth(1), '31-12-2022');
    await expect(toggle).toBeEnabled();
    expect(await label.evaluate(element => getComputedStyle(element).color)).not.toBe(inactiveColor);
    await label.getByRole('img').hover();
    await expect(page.getByRole('tooltip')).toHaveText(activeText);
    await page.screenshot({ path: testInfo.outputPath('regulering-aktiv.png') });
    await toggle.uncheck();

    await setVerbatimFieldValueAndSettle(inputs.nth(1), '31-12-2021');
    await expect(toggle).toBeDisabled();
    await expect(toggle).not.toBeChecked();
    await label.getByRole('img').hover();
    await expect(page.getByRole('tooltip')).toHaveText(inactiveText);
    await setVerbatimFieldValueAndSettle(inputs.nth(1), '31-12-2022');
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();

    await toggle.check();
    await setFieldValueAndSettle(inputs.nth(2), '0');
    await expect(toggle).toBeDisabled();
    await setFieldValueAndSettle(inputs.nth(2), '1000');
    await expect(toggle).toBeEnabled();
    await expect(toggle).toBeChecked();
    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
