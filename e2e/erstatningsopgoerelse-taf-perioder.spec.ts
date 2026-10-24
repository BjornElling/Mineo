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
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12E');
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
};

const vaelgBeregnesUdFra = async (page: Page, valg: 'Angivet månedsløn' | 'Angivet dagsløn'): Promise<void> => {
  await page.getByRole('combobox', { name: 'Beregnes ud fra', exact: true }).click();
  await page.getByRole('option', { name: valg, exact: true }).click();
};

const tafSection = (page: Page) => page.locator('[data-section-id="taf"]');
const tabelRaekke = (page: Page, tabel: number, raekke: number) =>
  tafSection(page).locator('table').nth(tabel).locator('tbody tr[data-mineo-row-id]').nth(raekke)
    .locator('input[data-mineo-field-address]');
const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });
const hentKnap = (page: Page) =>
  page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' }).getByRole('button');

// Flade 12e (BB-247–BB-257): TAF-periodens tabeller. Løse feriedage skjules i måneder, afledte kolonner
// beskriver deres ramme i info-tooltips, og rækkereglerne når cellen.
test.describe('Erstatningsopgørelse – TAF-perioden', () => {
  test('skjuler løse feriedage i måneder og viser dem i arbejdsdage', async ({ page, runtimeErrors, externalRequests }, testInfo) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet dagsløn');

    await expect(tafSection(page).getByText('TAF-arbejdsdage', { exact: true })).toBeVisible();
    await expect(tafSection(page).getByRole('img', { name: 'Kun TAF-arbejdsdage i EO-perioden fremgår' })).toBeVisible();
    await tafSection(page).getByRole('img', { name: 'Kun TAF-arbejdsdage i EO-perioden fremgår' }).hover();
    await expect(page.getByRole('tooltip', { name: 'Kun TAF-arbejdsdage i EO-perioden fremgår' })).toBeVisible();
    await expect(tafSection(page).getByText('Løse ferie-/feriefridage')).toBeVisible();
    await expect(tafSection(page).getByText('Feriedage', { exact: true })).toBeVisible();
    const ferieInfo = tafSection(page).getByRole('img', {
      name: 'Tallet gælder hele ferierækken, når ingen gyldig TAF-periode er angivet',
    });
    await expect(ferieInfo).toBeVisible();
    await ferieInfo.hover();
    const ferieTooltip = page.getByRole('tooltip', {
      name: 'Tallet gælder hele ferierækken, når ingen gyldig TAF-periode er angivet',
    });
    await expect(ferieTooltip).toBeVisible();
    await expect(ferieTooltip).toHaveCSS('opacity', '1');

    const ferierække = tafSection(page).locator('table').nth(1).locator('tbody tr[data-mineo-row-id]').first();
    await setDate(ferierække.locator('input[data-mineo-field-address]').nth(0), '01-02-2024');
    await setDate(ferierække.locator('input[data-mineo-field-address]').nth(1), '15-02-2024');
    await expect(ferierække.getByText('11', { exact: true })).toBeVisible();
    await ferieInfo.hover();
    await expect(ferieTooltip).toHaveCSS('opacity', '1');
    await ferieTooltip.screenshot({ path: testInfo.outputPath('ferietal-tooltip-uden-taf-periode.png') });
    await page.screenshot({ path: testInfo.outputPath('ferietal-uden-taf-periode.png'), fullPage: false });

    await setDate(tabelRaekke(page, 0, 0).nth(0), '01-01-2024');
    await setDate(tabelRaekke(page, 0, 0).nth(1), '31-01-2024');
    await expect(tafSection(page).getByRole('img', { name: 'Kun dage i TAF-perioden fremgår' })).toBeVisible();
    await expect(ferierække.getByText('0', { exact: true })).toBeVisible();
    await setFieldValueAndSettle(tabelRaekke(page, 0, 0).nth(2), '999');
    await expect(tabelRaekke(page, 0, 0).nth(2)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 0, 0).nth(2)).toHaveAccessibleDescription(
      /Løse ferie-\/feriefridage overstiger mulige arbejdsdage i perioden \(maksimalt 22\)/
    );

    // I måneder fradrages løse feriedage ikke: kolonnen forsvinder, og den røde celle spærrer ikke længere.
    await vaelgBeregnesUdFra(page, 'Angivet månedsløn');
    await expect(tafSection(page).getByText('TAF-måneder', { exact: true })).toBeVisible();
    await expect(tafSection(page).getByRole('img', { name: 'Kun TAF-måneder i EO-perioden fremgår' })).toBeVisible();
    await expect(tafSection(page).getByText('Løse ferie-/feriefridage')).toHaveCount(0);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).not.toContainText('Løse ferie-/feriefridage');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('farver overlap og en ferie uden for sit vindue', async ({ page, runtimeErrors, externalRequests }) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet dagsløn');

    await setDate(tabelRaekke(page, 0, 0).nth(0), '01-01-2024');
    await setDate(tabelRaekke(page, 0, 0).nth(1), '30-06-2024');
    await setDate(tabelRaekke(page, 0, 1).nth(0), '01-06-2024');
    await setDate(tabelRaekke(page, 0, 1).nth(1), '31-12-2024');
    await expect(tabelRaekke(page, 0, 0).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 0, 0).nth(0)).toHaveAccessibleDescription(
      /Perioden overlapper perioden 01-06-2024 - 31-12-2024/
    );

    await setDate(tabelRaekke(page, 1, 0).nth(0), '01-07-2017');
    await setDate(tabelRaekke(page, 1, 0).nth(1), '14-07-2017');
    await expect(tabelRaekke(page, 1, 0).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 1, 0).nth(0)).toHaveAccessibleDescription(
      /Ferien ligger før skadedatoen \(01-06-2018\)/
    );

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Der er overlappende TAF-perioder');
    await expect(errorBox(page).getByText('Der er overlappende TAF-perioder', { exact: true })).toHaveCount(1);
    await expect(errorBox(page)).toContainText(
      'Ferieperioden 01-07-2017 - 14-07-2017: Ferien ligger før skadedatoen (01-06-2018)'
    );

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('bevarer systemgrænsefejl og overlap på ferieperioder uden for den dynamiske ramme', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet dagsløn');

    // 2099 ligger langt efter den dynamiske systemramme (31. december næste år), også ved årsskifte.
    const systemrammeFejl = `Dato skal være mellem 01-01-2005 og 31-12-${new Date().getFullYear() + 1}`;
    // En gyldig TAF-række får kontroloversigten til også at gengive ferieperiodernes fejl.
    const tafPeriode = tabelRaekke(page, 0, 0);
    await setDate(tafPeriode.nth(0), '01-01-2024');
    await setDate(tafPeriode.nth(1), '31-12-2024');

    const ferieRaekke1 = tabelRaekke(page, 1, 0);
    const ferieRaekke2 = tabelRaekke(page, 1, 1);
    await setDate(ferieRaekke1.nth(0), '01-01-2099');
    await setDate(ferieRaekke1.nth(1), '30-06-2099');
    await setDate(ferieRaekke2.nth(0), '01-04-2099');
    await setDate(ferieRaekke2.nth(1), '31-12-2099');

    for (const cell of [ferieRaekke1.nth(0), ferieRaekke1.nth(1), ferieRaekke2.nth(0), ferieRaekke2.nth(1)]) {
      await expect(cell).toHaveAttribute('aria-invalid', 'true');
      await expect(cell).toHaveAccessibleDescription(systemrammeFejl);
    }

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText(
      `Ferieperioden 01-01-2099 - 30-06-2099: ${systemrammeFejl}; Der er overlappende ferieperioder`
    );
    await expect(errorBox(page)).toContainText(
      `Ferieperioden 01-04-2099 - 31-12-2099: ${systemrammeFejl}; Der er overlappende ferieperioder`
    );
    await expect(errorBox(page)).toContainText('Der er overlappende ferieperioder');
    await expect(hentKnap(page)).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath('ferie-systemgraense-og-overlap.png'), fullPage: false });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('viser overlap sammen med en dato før skadedatoen', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await vaelgBeregnesUdFra(page, 'Angivet dagsløn');

    await setDate(tabelRaekke(page, 0, 0).nth(0), '31-05-2018');
    await setDate(tabelRaekke(page, 0, 0).nth(1), '02-06-2018');
    await setDate(tabelRaekke(page, 0, 1).nth(0), '01-06-2018');
    await setDate(tabelRaekke(page, 0, 1).nth(1), '03-06-2018');

    await expect(tabelRaekke(page, 0, 0).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await tabelRaekke(page, 0, 0).nth(0).hover();
    await expect(page.getByRole('tooltip', { name: 'Datoen kan ikke være før skadedatoen (01-06-2018)' })).toBeVisible();
    await expect(tabelRaekke(page, 0, 0).nth(1)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 0, 1).nth(0)).toHaveAttribute('aria-invalid', 'true');
    await expect(tabelRaekke(page, 0, 1).nth(1)).toHaveAttribute('aria-invalid', 'true');

    await page.mouse.move(0, 0);
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText(
      'TAF-perioden 31-05-2018 - 02-06-2018: Datoen kan ikke være før skadedatoen (01-06-2018); Der er overlappende TAF-perioder'
    );
    await expect(errorBox(page)).toContainText('Der er overlappende TAF-perioder');
    await expect(errorBox(page)).not.toContainText('Fra-dato er ikke angivet');
    await page.screenshot({ path: testInfo.outputPath('taf-graense-og-overlap.png'), fullPage: false });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
