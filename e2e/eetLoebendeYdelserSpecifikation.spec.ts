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
 * Løbende ydelser skal kunne EFTERREGNES af modparten. Denne spec måler de oplysninger, en tabel med
 * delperioder skylder sin læser, og som fladen manglede:
 *
 * - overlapperiodens skæringsdato og difference (BB-152) og det tavse fravær, når differencen er 0 kr.
 *   (BB-153),
 * - at et interval aldrig slutter før det begynder, og at beregningsdatoen ikke kaldes et ophør
 *   (BB-154, BB-155),
 * - at tabellens rækker kan regnes efter (BB-156) og ikke deles på grænser, der intet ændrer (BB-165),
 * - at en EET-procent uden for lovens trin advares ved SIT EGET felt frem for tre faner væk (BB-158),
 *   og at «efter beregningsdatoen» siger årsagen én gang i stedet for tre (BB-159).
 */

const SKADEDATO = '01-06-2018';
const FOEDSELSDATO = '01-01-1970';

const grundlaeggendeRow = (page: Page, label: string) =>
  page.locator('.row--label-right-hover').filter({ hasText: label });

const eetTab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true });

const afgoerelseRow = (page: Page, index: number) =>
  page.locator('tbody tr[data-mineo-row-id]').nth(index);

/** Cellerne læses positionelt: rækkens id dannes først ved indtastning og kan ikke skrives i testen. */
const fillAfgoerelse = async (
  page: Page,
  index: number,
  values: Readonly<{ afgoerelsesdato: string; virkningsdato: string; eetPct: string }>,
): Promise<void> => {
  const row = afgoerelseRow(page, index);
  await setVerbatimFieldValueAndSettle(row.locator('input').nth(0), values.afgoerelsesdato);
  await setVerbatimFieldValueAndSettle(row.locator('input').nth(1), values.virkningsdato);
  await setFieldValueAndSettle(row.locator('input').nth(2), values.eetPct);
  await row.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Midlertidig', exact: true }).click();
};

const setupSag = async (page: Page, beregningsdato: string): Promise<void> => {
  await login(page);
  await openPage(page, 'Stamdata');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), SKADEDATO);
  await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), FOEDSELSDATO);

  await openPage(page, 'Erhvervsevnetab');
  await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), beregningsdato);
  await setFieldValueAndSettle(
    grundlaeggendeRow(page, 'Skadelidtes årsløn (efter ASL)').locator('input').first(),
    '400000',
  );
};

test.describe('Løbende ydelser – specifikationen kan efterregnes', () => {
  test('navngiver overlappets skæringsdato og difference i stedet for at lade en lille linje stå uforklaret', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2020', virkningsdato: '01-01-2020', eetPct: '25' });
    await fillAfgoerelse(page, 1, { afgoerelsesdato: '01-06-2022', virkningsdato: '01-01-2022', eetPct: '30' });

    await eetTab(page, 'Løbende ydelser').click();

    // BB-152: skæringsdatoen og de 30 % - 25 % = 5 %, som overlapperioden faktisk er regnet med.
    await expect(page.getByText(
      'Frem til 01-07-2022 udbetales den tidligere afgørelse fortsat, og perioden er derfor regnet med 30 % - 25 % = 5 %.',
    )).toBeVisible();

    // BB-156: de to skridt mellem «Grundydelse pr. år» og «Ydelse/md.», uden hvilke rækken ikke går op.
    // Kolonnenavnet står ved tabellen; selve afrundingsreglen er den samme for alle tabeller og står
    // derfor én gang i den udvidede specifikation frem for over hver afgørelse.
    await expect(page.getByRole('columnheader', { name: 'Grundydelse pr. år' }).first()).toBeVisible();
    await expect(page.getByText(
      'Ydelse/md. beregnes som grundydelsen pr. år gange reguleringen, oprundet til nærmeste 12 kr. og divideret med 12.',
    )).toHaveCount(1);

    expect(runtimeErrors).toEqual([]);
  });

  test('forklarer det manglende halvår, når overlappet giver 0 kr.', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2020', virkningsdato: '01-01-2020', eetPct: '25' });
    // Samme procent som forgængeren → differencen er 0 kr., og perioden udelades af tabellen.
    await fillAfgoerelse(page, 1, { afgoerelsesdato: '01-06-2022', virkningsdato: '01-01-2022', eetPct: '25' });

    await eetTab(page, 'Løbende ydelser').click();

    // BB-153: fraværet skal læses som en oplysning, ikke som et hul i beregningen.
    await expect(page.getByText(
      'Frem til 01-07-2022 udbetales den tidligere afgørelse fortsat, og denne afgørelse giver derfor intet yderligere krav for perioden.',
    )).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('kalder beregningsdatoens afgrænsning en opgørelse, ikke et ophør', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2020', virkningsdato: '01-01-2020', eetPct: '25' });

    await eetTab(page, 'Løbende ydelser').click();

    // BB-155: ydelsen ophører ikke ved beregningsdatoen – den er kun det punkt, kravet er gjort op til.
    await expect(page.getByText('Løbende ydelse opgjort til og med').first()).toBeVisible();
    await expect(page.getByText('Løbende ydelse ophører')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('erstatter et umuligt ophørsinterval med årsagen', async ({ page, runtimeErrors }) => {
    // Beregningsdatoen ligger FØR afgørelsens virkningsdato, så ophør ville stå før begyndelsen.
    await setupSag(page, '01-01-2021');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2022', virkningsdato: '01-01-2022', eetPct: '25' });

    await eetTab(page, 'Løbende ydelser').click();

    // BB-154: én linje der siger hvorfor, frem for et interval der slutter før det begynder.
    await expect(page.getByText('Afgørelsen ligger helt efter beregningsdatoen (01-01-2021).')).toBeVisible();
    await expect(page.getByText('Afgørelsen giver ingen løbende ydelse i den valgte periode.')).toBeVisible();

    // BB-159: én linje navngiver årsagen, i stedet for tre linjer om de tre datoer.
    await expect(page.getByText('Beregningsdatoen (01-01-2021) ligger før sagens afgørelser.')).toBeVisible();
    await expect(page.getByText('Der er angivet en afgørelsesdato efter beregningsdatoen')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('advarer om en EET-procent uden for lovens trin ved cellen, hvor den tastes', async ({ page, runtimeErrors }) => {
    await login(page);
    await openPage(page, 'Stamdata');
    // Skade fra 1. juli 2024 → erhvervsevnetabet fastsættes i trin af 10 %.
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadedato"]'), '01-08-2024');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="skadelidteFodselsdato"]'), FOEDSELSDATO);

    await openPage(page, 'Erhvervsevnetab');
    await setVerbatimFieldValueAndSettle(page.locator('input[name="beregningsdato"]'), '01-07-2026');
    await setFieldValueAndSettle(
      grundlaeggendeRow(page, 'Skadelidtes årsløn (efter ASL)').locator('input').first(),
      '400000',
    );
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2025', virkningsdato: '01-01-2025', eetPct: '25' });

    // BB-158: cellen stod neutral, og advarslen fandtes kun i en boks på en anden fane. Værdien er
    // fortsat lovlig at REGNE på – den er en advarsel, ikke en rød fejl.
    // BB-173: advarslen navngiver grænsen og påstår ikke noget om beregningens lovlighed.
    const eetCell = afgoerelseRow(page, 0).locator('input').nth(2);
    await expect(eetCell).toHaveAttribute('aria-invalid', 'false');
    await eetCell.hover();
    await expect(page.getByRole('tooltip')).toContainText(
      'Erhvervsevnetab fastsættes i trin af 10 % for skader fra 1. juli 2024',
    );
    await expect(page.getByRole('tooltip')).not.toContainText('lovmæssig');

    expect(runtimeErrors).toEqual([]);
  });
});
