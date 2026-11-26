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
 * delperioder skylder sin læser:
 *
 * - overlapperiodens skæringsdato og difference og det tavse fravær, når differencen er 0 kr.,
 * - at et interval aldrig slutter før det begynder, og at beregningsdatoen ikke kaldes et ophør,
 * - at tabellens rækker kan regnes efter og ikke deles på grænser, der intet ændrer,
 * - at en EET-procent uden for lovens trin advares ved SIT EGET felt frem for tre faner væk,
 *   og at «efter beregningsdatoen» siger årsagen én gang i stedet for tre.
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
  values: Readonly<{
    afgoerelsesdato: string; virkningsdato: string; eetPct: string;
    type?: 'Midlertidig' | 'Delvist endelig' | 'Endelig';
    kapDato?: string; kapPct?: string;
  }>,
): Promise<void> => {
  const row = afgoerelseRow(page, index);
  await setVerbatimFieldValueAndSettle(row.locator('input').nth(0), values.afgoerelsesdato);
  await setVerbatimFieldValueAndSettle(row.locator('input').nth(1), values.virkningsdato);
  await setFieldValueAndSettle(row.locator('input').nth(2), values.eetPct);
  await row.getByRole('combobox').first().click();
  await page.getByRole('option', { name: values.type ?? 'Midlertidig', exact: true }).click();
  if (values.kapDato) await setVerbatimFieldValueAndSettle(row.locator('td').nth(4).locator('input'), values.kapDato);
  if (values.kapPct) await setFieldValueAndSettle(row.locator('td').nth(5).locator('input'), values.kapPct);
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
  test('ophør og overlapforklaring følger kapitaliseringens eksakte dato', async ({ page, runtimeErrors }, testInfo) => {
    await setupSag(page, '01-06-2022');
    await fillAfgoerelse(page, 0, {
      afgoerelsesdato: '01-12-2018', virkningsdato: '01-01-2019', eetPct: '30',
      type: 'Delvist endelig', kapDato: '01-01-2019', kapPct: '15',
    });
    await fillAfgoerelse(page, 1, {
      afgoerelsesdato: '01-06-2020', virkningsdato: '01-07-2019', eetPct: '50',
      type: 'Endelig', kapDato: '01-06-2020', kapPct: '25',
    });
    await eetTab(page, 'Løbende ydelser').click();
    const first = page.locator('.content-box').filter({ has: page.locator('.section-header').filter({ hasText: 'Afgørelse 1. december 2018' }) });
    await expect(first.locator('.row--label-right-hover').filter({ hasText: 'Løbende ydelse ophører' })).toContainText('31-05-2020');
    await expect(first.locator('.row--label-right-hover').filter({ hasText: 'Årsag' })).toContainText('Kapitalisering');
    await expect(first.getByRole('row').filter({ hasText: '01-01-2020' })).toContainText('31-05-2020');
    await expect(first.getByText('66.827 kr.', { exact: true })).toBeVisible();
    const second = page.locator('.content-box').filter({ has: page.locator('.section-header').filter({ hasText: 'Afgørelse 1. juni 2020' }) });
    await expect(second).toContainText('01-06-2020 – 30-06-2020');
    await expect(second).toContainText('Efter kapitalisering på i alt 40 % er den løbende EET 10 %.');
    await expect(second.getByText('123.028 kr.', { exact: true })).toBeVisible();
    await first.getByText('Løbende ydelse ophører', { exact: true }).evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: testInfo.outputPath('kapitalisering-ophoer.png') });
    await second.getByText(/^01-07-2019 – 31-05-2020:/).evaluate((element) => element.scrollIntoView({ block: 'center' }));
    await page.screenshot({ path: testInfo.outputPath('kapitalisering-perioder.png') });
    const downloadPromise = page.waitForEvent('download');
    await grundlaeggendeRow(page, 'Download specifikation').getByRole('button').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    await download.saveAs(testInfo.outputPath('kapitalisering-perioder.pdf'));
    expect(runtimeErrors).toEqual([]);
  });

  test('navngiver overlappets skæringsdato og difference i stedet for at lade en lille linje stå uforklaret', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2020', virkningsdato: '01-01-2020', eetPct: '25' });
    await fillAfgoerelse(page, 1, { afgoerelsesdato: '01-06-2022', virkningsdato: '01-01-2022', eetPct: '30' });

    await eetTab(page, 'Løbende ydelser').click();

    // Skæringsdatoen og de 30 % - 25 % = 5 %, som overlapperioden faktisk er regnet med.
    await expect(page.getByText(
      '01-01-2022 – 30-06-2022: Den løbende EET er 30 %. Tidligere afgørelser dækker 25 %. Denne afgørelse giver derfor 5 % yderligere.',
    )).toBeVisible();

    // Kolonnenavnet står ved tabellen. «Ydelse/md.» har bevidst ingen afrundingsnote.
    await expect(page.getByRole('columnheader', { name: 'Grundydelse pr. år' }).first()).toBeVisible();
    await expect(page.getByText(/Ydelse\/md\. beregnes som grundydelsen/)).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('forklarer det manglende halvår, når overlappet giver 0 kr.', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2020', virkningsdato: '01-01-2020', eetPct: '25' });
    // Samme procent som forgængeren → differencen er 0 kr., og perioden udelades af tabellen.
    await fillAfgoerelse(page, 1, { afgoerelsesdato: '01-06-2022', virkningsdato: '01-01-2022', eetPct: '25' });

    await eetTab(page, 'Løbende ydelser').click();

    // Fraværet skal læses som en oplysning, ikke som et hul i beregningen.
    await expect(page.getByText(
      '01-01-2022 – 30-06-2022: Den løbende EET er 25 %. Tidligere afgørelser dækker 25 %. Denne afgørelse giver derfor intet yderligere krav for perioden.',
    )).toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('kalder beregningsdatoens afgrænsning en opgørelse, ikke et ophør', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2020', virkningsdato: '01-01-2020', eetPct: '25' });

    await eetTab(page, 'Løbende ydelser').click();

    // Ydelsen ophører ikke ved beregningsdatoen – den er kun det punkt, kravet er gjort op til.
    await expect(page.getByText('Løbende ydelse opgjort til og med').first()).toBeVisible();
    await expect(page.getByText('Løbende ydelse ophører')).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
  });

  test('erstatter et umuligt ophørsinterval med årsagen', async ({ page, runtimeErrors }) => {
    // Beregningsdatoen ligger FØR afgørelsens virkningsdato, så ophør ville stå før begyndelsen.
    await setupSag(page, '01-01-2021');
    await fillAfgoerelse(page, 0, { afgoerelsesdato: '01-06-2022', virkningsdato: '01-01-2022', eetPct: '25' });

    await eetTab(page, 'Løbende ydelser').click();

    // Én linje der siger hvorfor, frem for et interval der slutter før det begynder.
    // Årsagen er virkningsdatoen – afgørelsen selv kan være truffet før beregningsdatoen.
    await expect(page.getByText('Virkningsdatoen (01-01-2022) ligger efter beregningsdatoen (01-01-2021).')).toBeVisible();
    await expect(page.getByText('Afgørelsen giver ingen løbende ydelse i den valgte periode.')).toBeVisible();

    // Én linje navngiver årsagen, i stedet for tre linjer om de tre datoer.
    await expect(page.getByText('En eller flere datoer i ASL-afgørelserne ligger efter beregningsdatoen (01-01-2021).')).toBeVisible();
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

    // Advarslen står ved cellen selv, ikke kun i en boks på en anden fane. Værdien er
    // lovlig at REGNE på – den er en advarsel, ikke en rød fejl.
    // Advarslen navngiver grænsen og påstår ikke noget om beregningens lovlighed.
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
