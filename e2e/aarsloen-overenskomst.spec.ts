import { expect, login, openPage, setFieldValueAndSettle, setVerbatimFieldValueAndSettle, test } from './support/mineoTest';

test.describe('Årsløn med overenskomstens satser på én dato', () => {
  test('bevarer indtastninger ved skift, navigation, genindlæsning og undo', async ({ page, runtimeErrors, externalRequests }, testInfo) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');

    // I Procent uden helårsomregning læses ferie- og helligdagsvalget ikke og vises derfor ikke (BB-353); med
    // omregning står det under Beregningsprincipper, aldrig ovenfor i Lønforhold (siden udfyldes oppefra og ned).
    await expect(page.getByRole('checkbox', { name: 'Fuld løn under ferie:', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: 'Løn på helligdage', exact: true })).toHaveCount(0);
    await setFieldValueAndSettle(page.locator('input[name="feriePct"]'), '12,5');
    await setFieldValueAndSettle(page.locator('input[name="pensionPct"]'), '7');

    const row = page.locator('[data-mineo-table-navigation="true"] tbody tr').first();
    await setFieldValueAndSettle(row.getByRole('textbox').nth(0), '1');
    await setFieldValueAndSettle(row.getByRole('textbox').nth(1), '2024');
    await setFieldValueAndSettle(row.getByRole('textbox', { name: 'Løn', exact: true }), '1000');

    const grundlag = page.getByRole('combobox', { name: 'Tillæg beregnes på baggrund af', exact: true });
    await grundlag.click();
    await page.getByRole('option', { name: 'Overenskomst', exact: true }).click();
    const total = page.locator('.row--label-right-hover').filter({ hasText: 'Sammentælling af løn fra tabellen:' });
    const download = total.getByRole('button');
    await expect(download).toBeDisabled();
    // Alle blokerende mangler står i «Fejl og advarsler» (BB-350); tillæggene er låste og tomme (BB-351).
    const fejlboks = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(fejlboks).toContainText('Overenskomst mangler');
    await expect(fejlboks).toContainText('Reguleringsdato mangler');
    await expect(page.locator('input[name="pensionPct"]')).toBeDisabled();
    await expect(page.locator('input[name="pensionPct"]')).toHaveValue('');
    await page.getByRole('checkbox', { name: 'Fuld løn under ferie:', exact: true }).uncheck();
    await page.getByRole('combobox', { name: 'Vælg overenskomst', exact: true }).click();
    await page.getByRole('option', { name: /Bygge-.*anlæg/ }).click();
    const dato = page.locator('input[name="reguleringsdato"]');
    await setVerbatimFieldValueAndSettle(dato, '01-03-2024');
    await expect(page.locator('input[name="pensionPct"]')).toBeDisabled();
    await expect(page.locator('input[name="pensionPct"]')).toHaveValue('10,15');
    await expect(page.locator('input[name="shSoPct"]')).toHaveValue('8,80');
    await expect(page.locator('input[name="storeBededagPct"]')).toHaveValue('0,45');
    await expect(total).toContainText('1.341,08 kr.');
    await expect(download).toBeEnabled();
    await expect(fejlboks).toHaveCount(0);
    const downloaded = page.waitForEvent('download');
    await download.click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.pdf$/i);
    await page.getByRole('radio', { name: 'Måned', exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('aarsloen-overenskomst.png'), fullPage: true });

    await openPage(page, 'Stamdata');
    await openPage(page, 'Årslønsberegning');
    await page.reload();
    await expect(dato).toHaveValue('01-03-2024');
    await expect(total).toContainText('1.341,08 kr.');

    const bededag = page.getByRole('checkbox', { name: 'Beregn Store Bededagstillæg fra 1. januar 2024:', exact: true });
    await bededag.uncheck();
    await expect(page.locator('input[name="storeBededagPct"]')).toHaveValue('0,00');
    await page.keyboard.press('Control+z');
    await expect(bededag).toBeChecked();
    await expect(page.locator('input[name="storeBededagPct"]')).toHaveValue('0,45');

    await setVerbatimFieldValueAndSettle(dato, '28-02-2011');
    await expect(dato).toHaveAttribute('aria-invalid', 'true');
    await expect(download).toBeDisabled();
    await setVerbatimFieldValueAndSettle(dato, '01-03-2024');
    await grundlag.click();
    await page.getByRole('option', { name: 'Procent', exact: true }).click();
    await expect(page.locator('input[name="pensionPct"]')).toBeEnabled();
    await expect(page.locator('input[name="pensionPct"]')).toHaveValue('7,00');
    await expect(page.locator('input[name="feriePct"]')).toHaveValue('12,50');
    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('låser offentlige satser ved en dato uden for grænserne og åbner kun dem uden sats', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Årslønsberegning');
    await setFieldValueAndSettle(page.locator('input[name="pensionPct"]'), '7');
    await page.getByRole('combobox', { name: 'Tillæg beregnes på baggrund af', exact: true }).click();
    await page.getByRole('option', { name: 'Overenskomst', exact: true }).click();
    await page.getByRole('combobox', { name: 'Vælg overenskomst', exact: true }).click();
    await page.getByRole('option', { name: /Læreroverenskomsten/ }).click();
    const dato = page.locator('input[name="reguleringsdato"]');
    await setVerbatimFieldValueAndSettle(dato, '01-01-2100');
    const pension = page.locator('input[name="pensionPct"]');
    await expect(dato).toHaveAttribute('aria-invalid', 'true');
    await expect(pension).toBeDisabled();
    await expect(pension).toHaveValue('');
    await setVerbatimFieldValueAndSettle(dato, '01-03-2024');
    await expect(pension).toBeDisabled();
    await expect(pension).not.toHaveValue('');
    await expect(page.locator('input[name="shSoPct"]')).toBeEnabled();
    expect(runtimeErrors).toEqual([]);
  });

});
