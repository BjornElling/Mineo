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

const fillSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12G');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Skadelidtes navn' }), 'Fiktiv skadelidt');
  const skadestype = page.getByRole('combobox', { name: 'Skadestype' });
  await skadestype.click();
  await page.getByRole('option', { name: 'Arbejdsulykke', exact: true }).click();
  await setDate(page.locator("input[name='skadelidteFodselsdato']"), '01-01-1980');
  await setDate(page.locator("input[name='skadedato']"), '01-06-2018');

  await openPage(page, 'Erstatningsopgørelse');
  await setFieldValueAndSettle(page.locator("input[name='eoNummer']"), '1');
  await setDate(page.locator("input[name='opgørelseLavetDen']"), '01-02-2025');
  await page.locator("input[name='kravPaaSvieSmerteGodtgoerelse'][value='Nej']").check();
  await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Ja']").check();
  await page.locator("input[name='kravPaaOevrigeErstatningskrav'][value='Nej']").check();
  await setDate(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
  await setDate(page.locator("input[name='vedroererPeriodeTil']"), '31-12-2024');
  const tafRaekke = page.locator('[data-section-id="taf"] table').first()
    .locator('tbody tr[data-mineo-row-id]').first().locator('input[data-mineo-field-address]');
  await setDate(tafRaekke.nth(0), '01-01-2024');
  await setDate(tafRaekke.nth(1), '31-12-2024');
  await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
  await page.getByRole('option', { name: 'Beregningsperiode', exact: true }).click();
  await setDate(page.locator("input[name='tafBeregningsperiodeFra']"), '01-06-2017');
  await setDate(page.locator("input[name='tafBeregningsperiodeTil']"), '31-05-2018');
};

const tilfoejAnsaettelsesforhold = async (page: Page): Promise<void> => {
  // Tilføj sker uden bekræftelsesdialog (BB-288).
  await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
};

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

// Flade 12g (BB-274–BB-288): ansættelsesforholdets ramme, lønforhold og satser. Basisbanen er nok – intet her
// afhænger af motor eller viewport.
test.describe('Erstatningsopgørelse – ansættelsesforholdets ramme og satser', () => {
  test('tilføj ruller det nye kort frem, og linjerne navngiver kortet, når der er flere', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();

    await tilfoejAnsaettelsesforhold(page);
    await tilfoejAnsaettelsesforhold(page);
    const andetKort = page.locator('.content-box').filter({ hasText: 'Ansættelsesforhold 2' }).first();
    await expect(andetKort).toBeInViewport();

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    // Samme mangel på to kort giver to linjer – linket hedder kortets nummer (BB-278).
    await expect(errorBox(page).getByRole('button', { name: 'Ansættelsesforhold 1', exact: true }).first()).toBeVisible();
    await expect(errorBox(page).getByRole('button', { name: 'Ansættelsesforhold 2', exact: true }).first()).toBeVisible();
    await errorBox(page).screenshot({ path: testInfo.outputPath('fejl-og-advarsler-to-kort.png') });

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en rød sats på kortet får navn og link, og sammendraget beholder TAF-perioden', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await tilfoejAnsaettelsesforhold(page);

    const pension = page.locator('input[name$=":pensionPct"]');
    await setFieldValueAndSettle(pension, '150');
    await expect(pension).toHaveAttribute('aria-invalid', 'true');

    // Et tomt feriefelt er ikke rødt – brugeren har ikke skrevet noget (BB-274).
    await expect(page.locator('input[name$=":feriePct"]')).toHaveAttribute('aria-invalid', 'false');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Arbejdsgivers pensionsbidrag: Procent skal være mellem 0,00 og 100,00');
    // Beregningen er spærret, men TAF-perioden findes – sammendraget må ikke sige «Ingen perioder angivet» (BB-277).
    const tafSammendrag = page.locator('.row--label-right-hover').filter({
      has: page.getByText('TAF-periode', { exact: true }),
    });
    await expect(tafSammendrag).toContainText('01-01-2024 - 31-12-2024');
    await expect(tafSammendrag).not.toContainText('Ingen perioder angivet');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('særlig fra-dato har dags dato som loft, og «Fuld løn under ferie» skjules ved angivet løn', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await tilfoejAnsaettelsesforhold(page);

    const saerligDato = page.locator('input[name$=":saerligFraDatoRegulering"]');
    await setDate(saerligDato, '31-12-2026');
    await expect(saerligDato).toHaveAttribute('aria-invalid', 'true');
    await expect(saerligDato).toHaveAccessibleDescription(/Datoen er efter dags dato/);

    await expect(page.getByText('Fuld løn under ferie:', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
    await page.getByRole('option', { name: 'Angivet månedsløn', exact: true }).click();
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await expect(page.getByText('Fuld løn under ferie:', { exact: true })).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
