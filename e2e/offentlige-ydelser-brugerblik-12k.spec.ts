import type { Page } from '@playwright/test';

import {
  expect,
  fillMinimalTafGrundlag,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const setDate = setVerbatimFieldValueAndSettle;

const INGEN_EET_YDELSER = 'Erhvervsevnetab-siden har ingen midlertidig afgørelse med ydelser i TAF-perioden – der fradrages intet midlertidigt EET';

const fillSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12K');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
  await page.getByRole('combobox', { name: 'Skadestype' }).click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '11-07-2025');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), '1');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '25-09-2026');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-05-2026');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '30-09-2026');
  await fillMinimalTafGrundlag(page, { fra: '01-05-2026', til: '30-09-2026' });
};

// Flade 12k (BB-357–BB-367): Offentlige ydelser.
test.describe('Erstatningsopgørelse – Offentlige ydelser (12k)', () => {
  test('togglen for midlertidigt EET får gul ring og en linje, når den intet henter (BB-358)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await page.locator("input[name='midlertidigtEETAfgorelse']").check();
    await setDate(page.locator("input[name='midlertidigEETAfgoerelseDato']"), '15-01-2026');

    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden', exact: true }).check();
    const ring = page.locator('[data-mineo-field-warning]');
    await expect(ring).toBeVisible();
    await ring.hover();
    await expect(page.getByRole('tooltip', { name: INGEN_EET_YDELSER, exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('eet-toggle-gul-ring.png') });

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const errorBox = page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
    await expect(errorBox.getByText(INGEN_EET_YDELSER, { exact: true })).toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('fanens ikoner, en weekend-række og hjælperens omvendte periode', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();

    // BB-361: «Tillæg» bærer samme forklaring som «Løn (2)»; BB-363: kommentarens placering.
    await expect(page.getByRole('img', { name: 'Opdelingen af ydelser er rent visuel – værdierne lægges sammen i beregningen' })).toBeVisible();
    await expect(page.getByRole('img', { name: /^Kommentaren trykkes i bilaget «Offentlige ydelser»/ })).toBeVisible();

    // BB-365: en feriepengerække i en weekend viser fald-tilbage-dagene og får gul ring på datoerne.
    const row = page.locator('table').filter({ hasText: 'Ydelsestype' }).first()
      .locator('tbody tr[data-mineo-row-id]').first();
    const inputs = row.locator('input[data-mineo-field-address]');
    await setDate(inputs.nth(0), '06-06-2026');
    await setDate(inputs.nth(1), '07-06-2026');
    await setFieldValueAndSettle(inputs.nth(2), '3000');
    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Feriepenge', exact: true }).click();
    await expect(row.locator('td').nth(6)).toHaveText('2');
    await expect(row.locator('td').nth(7)).toContainText('1.500,00');
    await inputs.nth(0).hover();
    await expect(page.getByRole('tooltip', {
      name: 'Perioden indeholder ingen arbejdsdage – kontrollér datoerne. Beløbet medregnes i perioden.',
      exact: true,
    })).toBeVisible();

    // BB-366: hjælperens omvendte periode markerer begge felter med tabellens tekster.
    const helperFra = page.getByRole('textbox', { name: 'Fra-dato', exact: true });
    const helperTil = page.getByRole('textbox', { name: 'Til-dato', exact: true });
    await setDate(helperFra, '30-06-2026');
    await setDate(helperTil, '01-06-2026');
    await expect(helperFra).toHaveAttribute('aria-invalid', 'true');
    await expect(helperTil).toHaveAttribute('aria-invalid', 'true');
    await expect(helperFra).toHaveAccessibleDescription(/Fra-dato skal være før til-dato \(01-06-2026\)/);
    await expect(helperTil).toHaveAccessibleDescription(/Til-dato skal være efter fra-dato \(30-06-2026\)/);
    await page.screenshot({ path: testInfo.outputPath('offentlige-ydelser-12k.png'), fullPage: true });

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('hjælperen beder om bekræftelse, før den indsætter oven i eksisterende sygedagpenge (BB-359)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();

    const table = page.locator('table').filter({ hasText: 'Ydelsestype' }).first();
    const row = table.locator('tbody tr[data-mineo-row-id]').first();
    const inputs = row.locator('input[data-mineo-field-address]');
    await setDate(inputs.nth(0), '25-05-2026');
    await setDate(inputs.nth(1), '21-06-2026');
    await setFieldValueAndSettle(inputs.nth(2), '10000');
    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Sygedagpenge', exact: true }).click();

    await setDate(page.getByRole('textbox', { name: 'Fra-dato', exact: true }), '01-06-2026');
    await setDate(page.getByRole('textbox', { name: 'Til-dato', exact: true }), '30-06-2026');
    const rowsBefore = await table.locator('tbody tr[data-mineo-row-id]').count();
    await page.getByRole('button', { name: 'Indsæt', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(
      'Der står allerede sygedagpenge for 25-05-2026 - 21-06-2026. Kontrollér, at perioden ikke bliver indtastet to gange.'
    );
    await dialog.getByRole('button', { name: 'Annuller', exact: true }).click();
    await expect(table.locator('tbody tr[data-mineo-row-id]')).toHaveCount(rowsBefore);

    await page.getByRole('button', { name: 'Indsæt', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Indsæt alligevel', exact: true }).click();
    await expect(table.locator('tbody tr[data-mineo-row-id]')).not.toHaveCount(rowsBefore);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('ved TAF «Nej» forklarer Lønindkomst og Offentlige ydelser, at de ikke indgår (BB-360)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Nej']").check();

    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await expect(page.getByText(
      'Der er ikke krav på tabt arbejdsfortjeneste – lønindkomsten indgår ikke i opgørelsen.', { exact: true }
    )).toBeVisible();
    await page.getByRole('tab', { name: 'Offentlige ydelser', exact: true }).click();
    await expect(page.getByText(
      'Der er ikke krav på tabt arbejdsfortjeneste – ydelserne indgår ikke i opgørelsen.', { exact: true }
    )).toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('EET-sidens kolonne «Virkningsdato» siger, at den er frivillig (BB-368)', async ({ page, runtimeErrors, externalRequests }) => {
    await login(page);
    await openPage(page, 'Erhvervsevnetab');
    const ikon = page.getByRole('img', { name: 'Udfyldes kun, hvis den er forskellig fra afgørelsesdatoen.', exact: true });
    await expect(ikon).toBeVisible();
    await ikon.hover();
    await expect(page.getByRole('tooltip', { name: 'Udfyldes kun, hvis den er forskellig fra afgørelsesdatoen.' })).toBeVisible();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

