import {
  clearFieldBlinkRecording,
  expect,
  login,
  openPage,
  readFieldBlinkRecording,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  startFieldBlinkRecording,
  test,
} from './support/mineoTest';

const CUTOFF_MESSAGE = 'Der er angivet svie/smerte på eller efter datoen for en ménafgørelse (16-09-2024)';
const PERIOD_CUTOFF_MESSAGE = 'Hele perioden ligger på eller efter datoen for ménafgørelsen (16-09-2024)';

/** Datoindtastning gennem den delte, tidsrobuste totrins-helper (se `support/mineoTest.ts`). */
const setDate = setVerbatimFieldValueAndSettle;

test.describe('Svie/smerte efter ménafgørelse', () => {
  test('viser konkret feltfejl og samlet periodefejl på Beregning', async ({ page, runtimeErrors }, testInfo) => {

    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    await page.getByRole('checkbox', { name: 'Truffet afgørelse om varige mén på 5 % eller derover' }).check();
    await setDate(page.locator("input[name='menAfgoerelseDato']"), '16-09-2024');

    const svieTable = page.locator('table').filter({ hasText: 'Tilstand' }).first();
    const row = svieTable.locator('tbody tr').first();
    const dateInputs = row.locator('input[data-mineo-field-address]');
    const fra = dateInputs.nth(0);
    const til = dateInputs.nth(1);
    await setDate(fra, '17-09-2024');
    await setDate(til, '01-10-2024');

    await row.getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await expect(fra).toHaveAttribute('aria-invalid', 'true');
    await expect(til).toHaveAttribute('aria-invalid', 'true');
    await fra.hover();
    await expect(page.getByRole('tooltip', { name: CUTOFF_MESSAGE })).toBeVisible();

    await page.mouse.move(0, 0);
    await page.getByRole('tab', { name: 'Beregning' }).click();
    const calculationPanel = page.getByRole('tabpanel').filter({ hasText: 'Fejl og advarsler' });
    await expect(calculationPanel.getByText(PERIOD_CUTOFF_MESSAGE, { exact: true })).toBeVisible();
    await expect(calculationPanel.getByText(PERIOD_CUTOFF_MESSAGE, { exact: true })).toHaveCount(1);
    await expect(calculationPanel.getByText(CUTOFF_MESSAGE, { exact: true })).toHaveCount(0);
    await expect(calculationPanel.getByText('Ingen gyldige datoer:', { exact: false })).toHaveCount(0);

    await page.screenshot({ path: testInfo.outputPath('svie-smerte-men-cutoff.png'), fullPage: false });
    expect(runtimeErrors).toEqual([]);
  });

  test('beskriver en periode, der begynder på ménafgørelsesdatoen, som på eller efter', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    await page.getByRole('checkbox', { name: 'Truffet afgørelse om varige mén på 5 % eller derover' }).check();
    await setDate(page.locator("input[name='menAfgoerelseDato']"), '16-09-2024');

    const row = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]').first();
    const dates = row.locator('input[data-mineo-field-address]');
    const fra = dates.nth(0);
    const til = dates.nth(1);
    await setDate(fra, '16-09-2024');
    await setDate(til, '20-09-2024');
    await row.getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await expect(fra).toHaveAttribute('aria-invalid', 'true');
    await fra.hover();
    await expect(page.getByRole('tooltip', { name: CUTOFF_MESSAGE })).toBeVisible();
    await page.mouse.move(0, 0);
    await page.getByRole('tab', { name: 'Beregning' }).click();
    const calculationPanel = page.getByRole('tabpanel').filter({ hasText: 'Fejl og advarsler' });
    await expect(calculationPanel.getByText(PERIOD_CUTOFF_MESSAGE, { exact: true })).toBeVisible();
    await expect(calculationPanel.getByText(
      'Hele perioden ligger efter datoen for ménafgørelsen (16-09-2024)',
      { exact: true },
    )).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('viser cutoff og manglende til-dato sammen og linker til fra-datoen', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    await page.getByRole('checkbox', { name: 'Truffet afgørelse om varige mén på 5 % eller derover' }).check();
    await setDate(page.locator("input[name='menAfgoerelseDato']"), '16-09-2024');

    const row = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]').first();
    const from = row.locator('input[data-mineo-field-address]').nth(0);
    const fromAddress = await from.getAttribute('data-mineo-field-address');
    if (fromAddress === null) throw new Error('Svie/smerte-rækken mangler Fra-feltadresse.');
    await setDate(from, '16-09-2024');
    await row.getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const summary = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    const periodError = summary.locator('.row--label-right-hover').filter({ hasText: PERIOD_CUTOFF_MESSAGE });
    await expect(periodError).toHaveCount(1);
    await expect(periodError).toContainText(PERIOD_CUTOFF_MESSAGE);
    await expect(periodError).toContainText('Til-dato er ikke angivet');

    await startFieldBlinkRecording(page);
    await periodError.getByRole('button', { name: 'Svie- og smertegodtgørelse', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'EO oplysninger', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(fromAddress);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('viser cutoff med manglende Fra-dato og linker til den røde Til-dato (BB-346)', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    await page.getByRole('checkbox', { name: 'Truffet afgørelse om varige mén på 5 % eller derover' }).check();
    await setDate(page.locator("input[name='menAfgoerelseDato']"), '16-09-2024');

    const row = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]').first();
    const dates = row.locator('input[data-mineo-field-address]');
    const fra = dates.nth(0);
    const til = dates.nth(1);
    const tilAddress = await til.getAttribute('data-mineo-field-address');
    if (tilAddress === null) throw new Error('Svie/smerte-rækken mangler Til-feltadresse.');
    await setDate(til, '01-10-2024');
    await row.getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await expect(fra).toHaveValue('');
    await expect(til).toHaveAttribute('aria-invalid', 'true');
    await expect(til).toHaveAccessibleDescription(new RegExp(CUTOFF_MESSAGE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await til.hover();
    await expect(page.getByRole('tooltip', { name: CUTOFF_MESSAGE })).toBeVisible();

    await page.mouse.move(0, 0);
    await page.getByRole('tab', { name: 'Beregning' }).click();
    const summary = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    const rowError = summary.locator('.row--label-right-hover')
      .filter({ hasText: CUTOFF_MESSAGE });
    await expect(rowError).toHaveCount(1);
    await expect(rowError).toContainText('Fra-dato er ikke angivet');
    await expect(rowError).toContainText(CUTOFF_MESSAGE);

    await startFieldBlinkRecording(page);
    await rowError.getByRole('button', { name: 'Svie- og smertegodtgørelse', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'EO oplysninger', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(tilAddress);
    const fraAddress = await fra.getAttribute('data-mineo-field-address');
    expect(await readFieldBlinkRecording(page)).not.toContain(fraAddress);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('bevarer skadedato-fejl og overlap sammen på to svie/smerte-rækker', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-218-review');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
    await page.getByRole('combobox', { name: 'Skadestype' }).click();
    await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
    await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
    await setDate(page.locator("input[name='skadedato']"), '01-06-2018');

    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    const previousMaximum = page.locator("input[name='tidligereSsMax']");
    if (await previousMaximum.isChecked()) await previousMaximum.uncheck();

    const rows = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]');
    const dateCells = (index: number) => rows.nth(index).locator('input[data-mineo-field-address]');
    await setDate(dateCells(0).nth(0), '31-05-2018');
    await setDate(dateCells(0).nth(1), '01-06-2018');
    await rows.nth(0).getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await setDate(dateCells(1).nth(0), '01-06-2018');
    await setDate(dateCells(1).nth(1), '02-06-2018');
    await rows.nth(1).getByRole('combobox', { name: 'Tilstand' }).click();
    await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();

    await expect(dateCells(0).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await dateCells(0).nth(0).hover();
    await expect(page.getByRole('tooltip', { name: 'Datoen kan ikke være før skadedatoen (01-06-2018)' })).toBeVisible();
    await expect(dateCells(0).nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(dateCells(1).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(dateCells(1).nth(1)).toHaveAttribute('aria-invalid', 'true');

    await page.mouse.move(0, 0);
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const summary = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(summary).toContainText('Datoen kan ikke være før skadedatoen (01-06-2018)');
    await expect(summary).toContainText('Der er overlappende svie/smerte-perioder');
    await expect(summary).not.toContainText('Fra-dato er ikke angivet');
    await page.screenshot({ path: testInfo.outputPath('svie-smerte-graense-og-overlap.png'), fullPage: false });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('viser hver ens delvise periodefejl og linker til dens egen række (BB-336)', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await openPage(page, 'Erstatningsopgørelse');
    await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Ja']").check();
    const previousMaximum = page.locator("input[name='tidligereSsMax']");
    if (await previousMaximum.isChecked()) await previousMaximum.uncheck();

    const rows = page.locator('[data-section-id="sviesmerte"] tbody tr[data-mineo-row-id]');
    for (const index of [0, 1]) {
      await rows.nth(index).getByRole('combobox', { name: 'Tilstand' }).click();
      await page.getByRole('option', { name: 'Sygemeldt', exact: true }).click();
    }

    const firstFra = rows.nth(0).locator('input[data-mineo-field-address]').nth(0);
    const secondFra = rows.nth(1).locator('input[data-mineo-field-address]').nth(0);
    const firstAddress = await firstFra.getAttribute('data-mineo-field-address');
    const secondAddress = await secondFra.getAttribute('data-mineo-field-address');
    if (firstAddress === null || secondAddress === null) throw new Error('Svie/smerte-rækken mangler feltadresse.');
    expect(firstAddress).not.toBe(secondAddress);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const summary = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    const repeatedErrors = summary.locator('.row--label-right-hover')
      .filter({ hasText: 'Fra-dato og til-dato er ikke angivet' });
    await expect(repeatedErrors).toHaveCount(2);
    await expect(repeatedErrors.nth(0)).toContainText('Svie/smerte-periode 1:');
    await expect(repeatedErrors.nth(1)).toContainText('Svie/smerte-periode 2:');
    await expect(repeatedErrors.getByRole('button', { name: 'Svie- og smertegodtgørelse', exact: true })).toHaveCount(2);
    await summary.screenshot({ path: testInfo.outputPath('to-identiske-svie-smerte-fejl.png') });

    await startFieldBlinkRecording(page);
    await repeatedErrors.nth(0).getByRole('button', { name: 'Svie- og smertegodtgørelse', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'EO oplysninger', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(firstAddress);
    expect(await readFieldBlinkRecording(page)).not.toContain(secondAddress);
    await expect.poll(() => firstFra.evaluate((input) =>
      input.closest('.MuiInputBase-root')?.classList.contains('mineo-field-attention-blink') ?? false
    )).toBe(false);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await clearFieldBlinkRecording(page);
    await repeatedErrors.nth(1).getByRole('button', { name: 'Svie- og smertegodtgørelse', exact: true }).click();
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(secondAddress);
    expect(await readFieldBlinkRecording(page)).not.toContain(firstAddress);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
