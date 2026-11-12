import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('Differencekrav – resterende ydelse tæt på folkepension', () => {
  test('forklarer tidligere kapitaliseringsdato og alder ved genoptagelse', async ({ page, runtimeErrors }, testInfo) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-04-2019');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), '01-07-1955');
    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-04-2022');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '401000');
    const row = page.locator('tbody tr[data-mineo-row-id]').first();
    await setVerbatimFieldValueAndSettle(row.getByRole('textbox', { name: 'Afgørelsesdato', exact: true }), '01-10-2021');
    await setVerbatimFieldValueAndSettle(row.getByRole('textbox', { name: 'Virkningsdato', exact: true }), '01-06-2019');
    await setFieldValueAndSettle(row.getByRole('textbox', { name: 'EET %', exact: true }), '60');
    await row.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();
    await setVerbatimFieldValueAndSettle(row.getByRole('textbox', { name: 'Hvis genopt. - tidl. kap.dato', exact: true }), '01-06-2019');
    await setVerbatimFieldValueAndSettle(row.getByRole('textbox', { name: 'Kap.dato', exact: true }), '01-10-2021');
    await setFieldValueAndSettle(row.getByRole('textbox', { name: 'Kap. %', exact: true }), '30');
    await page.getByRole('tab', { name: 'Kapitalisering', exact: true }).click();
    const previousDateRow = page.locator('.row--label-right-hover').filter({
      has: page.getByText('Tidligere kapitaliseringsdato', { exact: true }),
    });
    await expect(previousDateRow).toContainText('01-06-2019');
    const previousAgeRow = page.locator('.row--label-right-hover').filter({
      has: page.getByText('Alder ved tidligere kapitalisering', { exact: true }),
    });
    await expect(previousAgeRow).toContainText('63 år, 11 måneder');
    await expect(page.getByText('Alder ved kapitalisering', { exact: true })).toHaveCount(0);
    await previousDateRow.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('genoptagelse-tidligere-dato-og-alder.png') });
    expect(runtimeErrors).toEqual([]);
  });

  test('viser den nedsatte særfaktor og fjerner restfradraget på folkepensionsdatoen', async ({
    page,
    runtimeErrors,
  }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-04-2019');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), '01-07-1955');
    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '16-04-2022');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '401000');
    const row = page.locator('tbody tr[data-mineo-row-id]').first();
    await setVerbatimFieldValueAndSettle(row.getByRole('textbox', { name: 'Afgørelsesdato', exact: true }), '01-06-2019');
    await setVerbatimFieldValueAndSettle(row.getByRole('textbox', { name: 'Virkningsdato', exact: true }), '01-06-2019');
    await setFieldValueAndSettle(row.getByRole('textbox', { name: 'EET %', exact: true }), '60');
    await row.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();
    await page.getByRole('tab', { name: 'Differencekrav', exact: true }).click();

    const proformaBox = page.locator('.content-box').filter({
      has: page.getByText('Proformakapitalisering af rest-EET', { exact: true }),
    });
    await expect(proformaBox).toBeVisible();
    await expect(page.getByText(
      'Den løbende ydelse (60 %) omregnes til et kapitalbeløb. Ved 2 år eller mindre til folkepension bruges særfaktoren 1,245. Der er 2,5 mdr. til folkepensionsdatoen, så faktoren nedsættes forholdsmæssigt: 1,245 x 2,5/24 = 0,13.',
      { exact: true },
    )).toBeVisible();
    await expect(proformaBox.getByText('Kapitaliseringsfaktor (1,245 x 2,5/24)', { exact: true })).toBeVisible();
    await expect(proformaBox.getByText('25.272 kr.', { exact: true })).toBeVisible();
    const bilag = page.getByRole('checkbox', { name: 'Proformakap. af rest-EET', exact: true });
    await expect(bilag).toBeEnabled();

    await page.getByRole('tab', { name: 'EET oplysninger', exact: true }).click();
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-07-2022');
    await page.getByRole('tab', { name: 'Differencekrav', exact: true }).click();
    await expect(page.getByText('Beregnet differencekrav', { exact: true })).toBeVisible();
    await expect(proformaBox).toHaveCount(0);
    await expect(bilag).toBeDisabled();
    await expect(page.getByText('Løbende ydelser (01-06-2019 - 30-06-2022):', { exact: true })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });

  test('markerer en fremtidig delkapitalisering efter en senere fuldkapitalisering og genoptager beregningen efter rettelse', async ({
    page,
    runtimeErrors,
  }, testInfo) => {
    await login(page);
    await openPage(page, 'Stamdata');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-04-2019');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), '01-07-1955');
    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-04-2022');
    await setFieldValueAndSettle(page.locator('input[name="aslAarsloen"]'), '401000');
    const rows = page.locator('tbody tr[data-mineo-row-id]');
    const firstRow = rows.nth(0);
    await setVerbatimFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Afgørelsesdato', exact: true }), '01-06-2019');
    await setVerbatimFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Virkningsdato', exact: true }), '01-06-2019');
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'EET %', exact: true }), '60');
    await firstRow.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();
    const firstKapDato = firstRow.getByRole('textbox', { name: 'Kap.dato', exact: true });
    await setVerbatimFieldValueAndSettle(firstKapDato, '01-06-2022');
    await setFieldValueAndSettle(firstRow.getByRole('textbox', { name: 'Kap. %', exact: true }), '25');
    const secondRow = rows.nth(1);
    await setVerbatimFieldValueAndSettle(secondRow.getByRole('textbox', { name: 'Afgørelsesdato', exact: true }), '01-10-2021');
    await setVerbatimFieldValueAndSettle(secondRow.getByRole('textbox', { name: 'Virkningsdato', exact: true }), '01-10-2021');
    await setFieldValueAndSettle(secondRow.getByRole('textbox', { name: 'EET %', exact: true }), '60');
    await secondRow.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();

    await expect(firstKapDato).toHaveAttribute('aria-invalid', 'true');
    await firstKapDato.scrollIntoViewIfNeeded();
    await firstKapDato.hover();
    await expect(page.getByRole('tooltip')).toHaveText(
      'Kapitaliseringsdatoen skal være senest 01-10-2021, hvor en senere endelig afgørelse kapitaliserer hele det resterende erhvervsevnetab.',
    );
    await page.screenshot({ path: testInfo.outputPath('kapitaliseringsdato-konflikt.png') });
    await page.getByRole('tab', { name: 'Differencekrav', exact: true }).click();
    const download = page.locator('.row--label-right-hover')
      .filter({ hasText: 'Download specifikation' }).getByRole('button');
    await expect(download).toBeDisabled();
    await expect(download).toHaveAccessibleName('Fejl i indtastning');
    await expect(page.getByText('Beregnet differencekrav', { exact: true })).toHaveCount(0);

    await page.getByRole('tab', { name: 'EET oplysninger', exact: true }).click();
    await setVerbatimFieldValueAndSettle(firstKapDato, '01-06-2020');
    await expect(firstKapDato).not.toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('tab', { name: 'Differencekrav', exact: true }).click();
    await expect(download).toBeEnabled();
    await expect(page.getByText('Beregnet differencekrav', { exact: true })).toBeVisible();
    expect(runtimeErrors).toEqual([]);
  });
});
