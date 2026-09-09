import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';
import type { Page } from '@playwright/test';

/**
 * Forlig om ansvarsgrad på Erhvervsevnetab.
 *
 * Felterne er flyttet fra Differencekrav-fanen til «EET oplysninger» under «Erstatningsansvarsloven»
 * (udviklerens beslutning 2026-09-09), fordi forliget nu reducerer BEGGE de krav, siden opgør. Specen
 * måler den grænse, der betyder penge:
 *
 *  - «EET efter EAL» reducerer sit EGET krav: forlig x EAL-krav.
 *  - «Differencekrav» reducerer sit EGET beløb EFTER alle fire ASL-fradrag.
 *
 * De to grundlag er forskellige med vilje, og et differencekrav, der reducerede det rene EAL-krav,
 * ville være markant for lavt. Specen tjekker derfor både ordlyden og at de to tal ikke er ens.
 */

const SKADEDATO = '01-06-2018';
const FOEDSELSDATO = '01-01-1970';

const row = (page: Page, label: string) =>
  page.locator('.row--label-right-hover').filter({ hasText: label });

const eetTab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true });

const afgoerelseRow = (page: Page, index: number) =>
  page.locator('tbody tr[data-mineo-row-id]').nth(index);

const setupSag = async (page: Page): Promise<void> => {
  await login(page);
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), SKADEDATO);
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), FOEDSELSDATO);

  await openPage(page, 'Erhvervsevnetab');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-06-2022');
  await setFieldValueAndSettle(
    row(page, 'Skadelidtes årsløn (efter ASL)').locator('input').first(),
    '400000',
  );

  // Én endelig afgørelse, kapitaliseret fuldt ud: den giver et kapitalbeløb som fradrag 2, så
  // differencekravets grundlag er beviseligt mindre end EAL-kravet.
  const afgoerelse = afgoerelseRow(page, 0);
  const cell = (label: string) => afgoerelse.getByRole('textbox', { name: label, exact: true });
  await setVerbatimFieldValueAndSettle(cell('Afgørelsesdato'), '01-06-2020');
  await setVerbatimFieldValueAndSettle(cell('Virkningsdato'), '01-01-2020');
  await setFieldValueAndSettle(cell('EET %'), '25');
  await afgoerelse.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Endelig', exact: true }).click();
  await setVerbatimFieldValueAndSettle(cell('Kap.dato'), '01-06-2020');
  await setFieldValueAndSettle(cell('Kap. %'), '25');
};

const kronerFra = (text: string): number => {
  // Sidste kronebeløb i rækken er værdien; labelen kan selv indeholde beløb (regnestykket).
  const matches = text.match(/(-?\s?[\d.]+(?:,\d+)?)\s*kr\./g) ?? [];
  const last = matches.at(-1) ?? '';
  // Cifrene plukkes ud, så beløbets NBSP-separator og enhed ikke skal strippes tegn for tegn.
  const cifre = last.match(/[0-9.,]+/)?.[0] ?? '';
  return Number(cifre.replace(/[.]/g, '').replace(/[,]/, '.'));
};

test.describe('Forlig om ansvarsgrad – to faner, to grundlag', () => {
  test('står under «Erstatningsansvarsloven» på EET oplysninger og ikke længere på Differencekrav', async ({ page, runtimeErrors }) => {
    await setupSag(page);

    // Felterne bor i EAL-sektionen, hvor de hører til – ikke i «Valgmuligheder» på fane 5.
    const ealSection = page.locator('[data-section-id="eet-oplysninger-eal"]');
    await expect(ealSection.locator('input[name="forligAnsvarsgradProcent"]')).toBeVisible();
    await expect(ealSection.locator('input[name="forligAnsvarsgradBroek"]')).toBeVisible();
    await expect(ealSection.locator('input[name="forligDato"]')).toBeVisible();

    await eetTab(page, 'Differencekrav').click();
    await expect(page.locator('input[name="forligAnsvarsgradProcent"]')).toHaveCount(0);
    await expect(page.locator('input[name="forligDato"]')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('viser hele forligsprocenten uden påhængte decimaler', async ({ page, runtimeErrors }) => {
    await setupSag(page);
    const procent = page.locator('input[name="forligAnsvarsgradProcent"]');

    // BB-200: feltet stod som «50,00» og læstes som en præcisionsangivelse, brugeren ikke gav.
    await setFieldValueAndSettle(procent, '50');
    await expect(procent).toHaveValue('50');
    // Decimaler kan fortsat indtastes – 12,5 % er et virkeligt forlig.
    await setFieldValueAndSettle(procent, '12,5');
    await expect(procent).toHaveValue('12,5');

    // Grænseteksten følger samme form.
    await setFieldValueAndSettle(procent, '150');
    await expect(procent).toHaveAttribute('aria-invalid', 'true');
    await procent.focus();
    await procent.hover();
    // Beskeden findes i to kanaler: feltets skjulte status-element (til skærmlæsere) og tooltippets
    // linje. Tooltip-linjen er den, brugeren ser, og derfor den, testen måler.
    await expect(
      page.locator('.mineo-tooltip-line', { hasText: 'Procent skal være mellem 1 og 100' }).first(),
    ).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('reducerer EAL-kravet på fane 4 og differencekravet på fane 5 af hvert sit grundlag', async ({ page, runtimeErrors }) => {
    await setupSag(page);
    await setFieldValueAndSettle(page.locator('input[name="forligAnsvarsgradProcent"]'), '50');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="forligDato"]'), '01-05-2022');

    // ── Fane 4: forligsgraden af EAL-kravet ────────────────────────────────────
    await eetTab(page, 'EET efter EAL').click();
    await expect(
      page.getByText('Der er den 1. maj 2022 indgået forlig i sagen på betaling af 50 %.'),
    ).toBeVisible();

    const ealBundlinje = row(page, ' x (').last();
    await expect(ealBundlinje).toContainText('50 % x (');
    const ealEfterForlig = kronerFra(await ealBundlinje.innerText());
    expect(ealEfterForlig).toBeGreaterThan(0);

    // ── Fane 5: forligsgraden af beløbet EFTER ASL-fradragene ──────────────────
    await eetTab(page, 'Differencekrav').click();
    await expect(
      page.getByText('Der er den 1. maj 2022 indgået forlig i sagen på betaling af 50 %.'),
    ).toBeVisible();

    const differencekravRow = row(page, 'Beregnet differencekrav');
    await expect(differencekravRow).toContainText('Beregnet differencekrav (50 % af');
    const differencekrav = kronerFra(await differencekravRow.innerText());

    // Selve pointen: fane 5's tal er IKKE forligsgraden af EAL-kravet. Kapitalbeløbet og de løbende
    // ydelser er trukket fra først, så beløbet er mindre.
    expect(differencekrav).toBeLessThan(ealEfterForlig);

    // Og EAL-kravet står ureduceret i differencekravets egen specifikation, fordi det ER grundlaget.
    const ealKravRow = row(page, 'Det svarer til et beregnet erhvervsevnetab på:');
    expect(kronerFra(await ealKravRow.innerText())).toBe(ealEfterForlig * 2);

    expect(runtimeErrors).toEqual([]);
  });

  test('blokerer begge forligs-consumere ved et ugyldigt forlig', async ({ page, runtimeErrors }) => {
    await setupSag(page);
    // Både procent og brøk udfyldt er tvetydigt – og feltets egen besked skal stå i boksen.
    await setFieldValueAndSettle(page.locator('input[name="forligAnsvarsgradProcent"]'), '50');
    await setFieldValueAndSettle(page.locator('input[name="forligAnsvarsgradBroek"]'), '1/3');

    for (const fane of ['EET efter EAL', 'Differencekrav'] as const) {
      await eetTab(page, fane).click();
      const issueRow = row(page, 'Forlig om ansvarsgrad');
      await expect(issueRow.first()).toBeVisible();
      // BB-196: den konkrete regel, ikke «indeholder en ugyldig værdi».
      await expect(issueRow.first()).toContainText('Kan ikke udfylde både procent og brøk');
      // Henvisningen fører til den sektion, felterne nu står i.
      await expect(issueRow.first()).toContainText('Erstatningsansvarsloven');
    }

    // De to øvrige faner læser intet forlig og skal ikke blokeres af det.
    await eetTab(page, 'Kapitalisering').click();
    await expect(page.getByText('Forlig om ansvarsgrad')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });
});
