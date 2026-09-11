import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

test.describe('MinProcesrente – browserbaseret namespace-isolation', () => {
  test('bevarer hver variants input ved navigation på samme origin', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await page.goto('/minprocesrente.html');

    const standaloneBeregningsdato = page.locator('input[name="beregningsdato"]');
    const standaloneRow = page.locator('tbody tr[data-mineo-row-id]').first();
    await setVerbatimFieldValueAndSettle(standaloneBeregningsdato, '19-08-2026');
    await setFieldValueAndSettle(
      standaloneRow.getByRole('textbox', { name: 'Beløb' }),
      '100000',
    );
    await setVerbatimFieldValueAndSettle(
      standaloneRow.getByRole('textbox', { name: 'Forfaldsdato' }),
      '01-01-2020',
    );
    await expect(standaloneRow.getByRole('cell').nth(5)).toHaveText(
      /^\d{1,3}(?:\.\d{3})*,\d{2} kr\.$/,
    );

    // Navigeringen er den samme, en bruger foretager ved at følge en søsterside. Den synlige
    // advarsel accepteres, så testen ikke laver en skjult state- eller storage-genvej.
    const leaveStandaloneDialog = page.waitForEvent('dialog');
    const enterMineo = page.goto('/');
    const standaloneDialog = await leaveStandaloneDialog;
    expect(standaloneDialog.type()).toBe('beforeunload');
    await standaloneDialog.accept();
    await enterMineo;

    await login(page);
    await openPage(page, 'Renteberegning');

    const mineoBeregningsdato = page.locator('input[name="beregningsdato"]');
    const mineoRow = page.locator('tbody tr[data-mineo-row-id]').first();
    // Mineos runtime må ikke læse den værdi, standalone netop lagrede.
    await expect(mineoBeregningsdato).toHaveValue('');
    await expect(mineoRow.getByRole('textbox', { name: 'Beløb' })).toHaveValue('');
    await expect(mineoRow.getByRole('textbox', { name: 'Forfaldsdato' })).toHaveValue('');

    await setVerbatimFieldValueAndSettle(mineoBeregningsdato, '20-08-2026');
    await setFieldValueAndSettle(
      mineoRow.getByRole('textbox', { name: 'Beløb' }),
      '200000',
    );
    await setVerbatimFieldValueAndSettle(
      mineoRow.getByRole('textbox', { name: 'Forfaldsdato' }),
      '02-02-2021',
    );
    await expect(mineoRow.getByRole('cell').nth(5)).toHaveText(
      /^\d{1,3}(?:\.\d{3})*,\d{2} kr\.$/,
    );

    const returnToStandaloneDialog = page.waitForEvent('dialog');
    const returnToStandalone = page.goto('/minprocesrente.html');
    const mineoDialog = await returnToStandaloneDialog;
    expect(mineoDialog.type()).toBe('beforeunload');
    await mineoDialog.accept();
    await returnToStandalone;

    // Standalone skal rehydrere sit eget input – ikke Mineos særskilte værdier.
    await expect(page.locator('input[name="beregningsdato"]')).toHaveValue('19-08-2026');
    const restoredStandaloneRow = page.locator('tbody tr[data-mineo-row-id]').first();
    await expect(restoredStandaloneRow.getByRole('textbox', { name: 'Beløb' })).toHaveValue('100.000,00');
    await expect(restoredStandaloneRow.getByRole('textbox', { name: 'Forfaldsdato' })).toHaveValue('01-01-2020');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
