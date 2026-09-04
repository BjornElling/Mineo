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
 * EET efter EAL opgør kravet efter erstatningsansvarsloven, og skærmen er ordret dens dokument.
 * Denne spec måler de fire forhold, fladen manglede:
 *
 * - rækken kaldte procenten «Endeligt erhvervsevnetab», selv når den kom fra en afgørelse, brugeren
 *   havde markeret Midlertidig – og EAL kender slet ikke et midlertidigt erhvervsevnetab (BB-177),
 * - en senere midlertidig afgørelse fortrænger en tidligere endelig, hvilket er den ønskede
 *   udvælgelse, men fanen var helt tavs om, at der VAR to afgørelser at vælge imellem, mens de to
 *   nabofaner advarede i samme sag (BB-178),
 * - specifikationen manglede skadedatoen, som både aldersreduktionen og opreguleringen hviler på,
 *   mens fødselsdatoen stod der (BB-182),
 * - årslønsmaksimum-advarslen havde en gul ring, når EAL-feltet var TOMT, men ikke når feltet selv
 *   stod på maks. årslønnen efter ASL – den halve regel lå kun som en linje i en boks (BB-183),
 * - en afgørelsesrække med tom EET %-celle sendte brugeren til det VALGFRIE EAL-felt, hvor de tre
 *   andre faner peger på afgørelsen; udfyldte han feltet, regnede fanen, men han havde sat en
 *   EAL-afvigelse han ikke mente, og de tre andre faner stod fortsat blokeret (BB-181).
 */

const SKADEDATO = '01-06-2018';
const FOEDSELSDATO = '01-01-1970';
/** Skadesårets ASL-maksimum for 2018 – den værdi, EAL-årslønnen netop ikke må udfyldes med. */
const ASL_MAKS_2018 = '527000';

const grundlaeggendeRow = (page: Page, label: string) =>
  page.locator('.row--label-right-hover').filter({ hasText: label });

const eetTab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true });

const afgoerelseRow = (page: Page, index: number) =>
  page.locator('tbody tr[data-mineo-row-id]').nth(index);

/**
 * Cellerne adresseres ved deres accessible name og ikke positionelt: rækken har otte kolonner,
 * hvoraf «Hvis genopt. - tidl. kap.dato» ligger mellem dem, så et indeks forskyder sig lydløst,
 * hvis tabellen ændrer kolonneorden. Rækkens eget id dannes først ved indtastning og kan derfor
 * ikke skrives i testen.
 */
const fillAfgoerelse = async (
  page: Page,
  index: number,
  values: Readonly<{
    afgoerelsesdato: string;
    virkningsdato: string;
    eetPct: string;
    type: 'Endelig' | 'Midlertidig' | 'Delvist endelig';
    kapDato?: string;
    kapPct?: string;
  }>,
): Promise<void> => {
  const row = afgoerelseRow(page, index);
  const cell = (label: string) => row.getByRole('textbox', { name: label, exact: true });

  await setVerbatimFieldValueAndSettle(cell('Afgørelsesdato'), values.afgoerelsesdato);
  await setVerbatimFieldValueAndSettle(cell('Virkningsdato'), values.virkningsdato);
  await setFieldValueAndSettle(cell('EET %'), values.eetPct);
  await row.getByRole('combobox').first().click();
  await page.getByRole('option', { name: values.type, exact: true }).click();
  if (values.kapDato !== undefined) {
    await setVerbatimFieldValueAndSettle(cell('Kap.dato'), values.kapDato);
  }
  if (values.kapPct !== undefined) {
    await setFieldValueAndSettle(cell('Kap. %'), values.kapPct);
  }
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

test.describe('EET efter EAL – specifikationens påstande og forudsætninger', () => {
  test('kalder procenten «Erhvervsevnetab» og trykker sagens skadedato', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    // En MIDLERTIDIG afgørelse er netop det tilfælde, hvor ordet «Endeligt» var en påstand uden
    // dækning: EAL fastsætter procenten selvstændigt og kender ingen midlertidighed.
    await fillAfgoerelse(page, 0, {
      afgoerelsesdato: '01-01-2020',
      virkningsdato: '01-01-2020',
      eetPct: '30',
      type: 'Midlertidig',
    });

    await eetTab(page, 'EET efter EAL').click();

    // BB-177: adjektivet er væk – rækken navngiver den procent, fanen faktisk regner med.
    await expect(page.getByText('Endeligt erhvervsevnetab')).toHaveCount(0);
    const eetRow = page.locator('.row--label-right-hover').filter({
      has: page.getByText('Erhvervsevnetab', { exact: true }),
    });
    await expect(eetRow.first()).toContainText('30 %');

    // BB-182: skadedatoen bærer aldersreduktionen sammen med fødselsdatoen og skal kunne læses op
    // mod den – derfor samme korte form som fødselsdato-rækken.
    const skadedatoRow = page.locator('.row--label-right-hover').filter({
      has: page.getByText('Skadedato', { exact: true }),
    });
    await expect(skadedatoRow.first()).toContainText(SKADEDATO);
    await expect(
      page.locator('.row--label-right-hover').filter({ hasText: 'Fødselsdato' }).first(),
    ).toContainText(FOEDSELSDATO);

    expect(runtimeErrors).toEqual([]);
  });

  test('advarer om en midlertidig afgørelse efter en endelig, uden at ændre hvilken procent der bruges', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    // Den endelige afgørelse er på 50 % og kapitaliseres kun delvist (25 %). En senere afgørelse på
    // 30 % er derfor en gyldig sag: EET-procenten skal blot ikke ligge under den akkumulerede
    // kapitaliseringsprocent, og med 25 % gør den ikke det.
    await fillAfgoerelse(page, 0, {
      afgoerelsesdato: '01-01-2020',
      virkningsdato: '01-01-2020',
      eetPct: '50',
      type: 'Endelig',
      kapDato: '01-01-2020',
      kapPct: '25',
    });

    await eetTab(page, 'EET efter EAL').click();
    // Med kun den endelige afgørelse er der intet at advare om.
    await expect(page.getByText('midlertidig afgørelse efter en endelig')).toHaveCount(0);

    await eetTab(page, 'EET oplysninger').click();
    await fillAfgoerelse(page, 1, {
      afgoerelsesdato: '01-01-2022',
      virkningsdato: '01-01-2022',
      eetPct: '30',
      type: 'Midlertidig',
    });

    await eetTab(page, 'EET efter EAL').click();

    // BB-178: den midlertidige afgørelse bærer FORTSAT procenten – det er den ønskede adfærd, fordi
    // EAL lægger den seneste ASL-procent til grund uanset type. Det nye er, at fanen siger det.
    await expect(
      page.getByText('Der er angivet en midlertidig afgørelse efter en endelig afgørelse.'),
    ).toBeVisible();
    const eetRow = page.locator('.row--label-right-hover').filter({
      has: page.getByText('Erhvervsevnetab', { exact: true }),
    });
    await expect(eetRow.first()).toContainText('30 %');

    expect(runtimeErrors).toEqual([]);
  });

  test('giver EAL-årslønsfeltet en gul ring, når det selv står på maks. årslønnen efter ASL', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    const ealAarsloen = page.getByRole('textbox', {
      name: 'Skadelidtes årsløn efter EAL (hvis forskellig fra ASL)',
      exact: true,
    });

    // Den gule feltstatus læses gennem `aria-describedby`, som peger på feltets skjulte
    // status-element – samme repræsentation, en skærmlæser får, og den MUI-tooltip, der bærer
    // teksten ved hover.
    const warningText = async () => {
      const describedBy = await ealAarsloen.getAttribute('aria-describedby');
      if (describedBy === null) return null;
      const status = page.locator(`#${describedBy.split(' ').filter((id) => id.endsWith('-status'))[0]}`);
      return (await status.count()) === 0 ? null : (await status.innerText()).trim();
    };

    // BB-183: præcis den værdi, advarslen beder brugeren om IKKE at bruge. Feltet stod neutralt før.
    await setFieldValueAndSettle(ealAarsloen, ASL_MAKS_2018);
    await expect
      .poll(warningText)
      .toBe('Skadelidtes årsløn efter EAL skal udfyldes med den fulde årsløn – ikke maks. årslønnen efter ASL');

    // En anden årsløn end maksimum er ikke en advarsel.
    await setFieldValueAndSettle(ealAarsloen, '600000');
    await expect.poll(warningText).toBeNull();

    expect(runtimeErrors).toEqual([]);
  });

  test('sender en afgørelse uden EET % til afgørelsestabellen og ikke til det valgfrie EAL-felt', async ({ page, runtimeErrors }) => {
    await setupSag(page, '01-07-2026');
    // En fuldt udfyldt afgørelse, hvor KUN procentcellen er tom. Rækken oprettes ved datoerne, så
    // manglen er en halvfærdig indtastning – ikke et valg om lovsæt.
    const row = afgoerelseRow(page, 0);
    await setVerbatimFieldValueAndSettle(
      row.getByRole('textbox', { name: 'Afgørelsesdato', exact: true }),
      '01-01-2020',
    );
    await setVerbatimFieldValueAndSettle(
      row.getByRole('textbox', { name: 'Virkningsdato', exact: true }),
      '01-01-2020',
    );
    await row.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Endelig', exact: true }).click();

    await eetTab(page, 'EET efter EAL').click();

    // BB-181: ordret de tre andre faners besked, så samme mangel ikke får to beskrivelser.
    const issueRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Der er en afgørelse uden EET %',
    });
    await expect(issueRow).toHaveCount(1);
    // Linket peger på ASL-sektionen – ikke på «Erstatningsansvarsloven», hvor det valgfrie felt står.
    await expect(issueRow).toContainText('Arbejdsskadesikringsloven');
    await expect(page.getByText('Erhvervsevnetabsprocenten mangler')).toHaveCount(0);

    // Klikket skal føre til afgørelsestabellens EET %-celle, så rettelsen kan foretages hvor manglen er.
    await issueRow.getByRole('button', { name: 'Arbejdsskadesikringsloven' }).click();
    await expect(page.getByRole('tab', { name: 'EET oplysninger', exact: true }))
      .toHaveAttribute('aria-selected', 'true');
    await expect(afgoerelseRow(page, 0).getByRole('textbox', { name: 'EET %', exact: true }))
      .toBeVisible();

    expect(runtimeErrors).toEqual([]);
  });

  test('nævner begge veje, når hverken en EAL-procent eller en afgørelse findes', async ({ page, runtimeErrors }) => {
    // Den anden tilstand: ingen afgørelsesrækker. Her er der ikke en halvfærdig indtastning at pege
    // på, og sagen kan være omfattet af erstatningsansvarsloven ALENE – derfor nævnes begge veje.
    await setupSag(page, '01-07-2026');
    await eetTab(page, 'EET efter EAL').click();

    const issueRow = page.locator('.row--label-right-hover').filter({
      hasText: 'Erhvervsevnetabsprocenten mangler: angiv EET % efter EAL, eller udfyld EET % på en afgørelse',
    });
    await expect(issueRow).toHaveCount(1);
    await expect(issueRow).toContainText('Erstatningsansvarsloven');

    expect(runtimeErrors).toEqual([]);
  });
});
