import type { Page } from '@playwright/test';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { countFilledFields } from '../src/utils/dataCollection';
import { encryptToString } from '../src/utils/encryption';

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

const AF_ID = 'bb12j-af';

/**
 * Brugerblikkets grundsag for 12j: skade 01-03-2023, opgørelse nr. 1, TAF marts–december 2023, beregningsperiode
 * marts 2022 – februar 2023 med 12 månedsrækker à 30.000 kr. og sygeferiegodtgørelse efter ferieloven med
 * referenceperiode februar 2023. Lønrækkerne slutter i februar 2023, så seksmånedersadvarslen står.
 */
const buildFixture = () => {
  const eo = caseFixture.data.erstatningsopgoerelse;
  const ansaettelse = eo.loenindkomstAnsaettelsesforhold[0]!;
  const maaneder = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2].map((maaned, index) => ({
    id: `bb12j-loen-${index}`,
    col0_maaned: String(maaned),
    col1_maaned: index < 10 ? '2022' : '2023',
    col0_uge: '',
    col1_uge: '',
    col2: { kind: 'number', value: 30000 },
  }));
  return {
    ...caseFixture,
    data: {
      stamdata: { ...caseFixture.data.stamdata, journalnr: 'BB-12J', skadedato: '2023-03-01' },
      erstatningsopgoerelse: {
        ...eo,
        eoNummer: '1',
        'opgørelseLavetDen': '2024-02-01',
        vedroererPeriodeFra: '2023-03-01',
        vedroererPeriodeTil: '2023-12-31',
        tafPerioder: [{ id: 'bb12j-taf', fra: '2023-03-01', til: '2023-12-31' }, { id: 'bb12j-taf-tom' }],
        beregnesUdFra: 'Beregningsperiode',
        tafBeregningsperiodeFra: '2022-03-01',
        tafBeregningsperiodeTil: '2023-02-28',
        offentligeYdelserRows: [],
        loenindkomstAnsaettelsesforhold: [{
          ...ansaettelse,
          id: AF_ID,
          navnPaaArbejdssted: 'Firma A',
          harOverenskomst: false,
          feriePct: 12.5,
          pensionPct: 8,
          fritvalgPct: undefined,
          loenudviklingBeregningsgrundlag: 'Ingen',
          indtaegtsoplysningerTableData: maaneder,
          loenudviklingManuelTableData: [],
        }],
        sfggAnsaettelsesforhold: [{
          ansaettelsesforholdId: AF_ID,
          sfggBeregningskilde: 'Ferieloven',
          sfggReferenceperiodeFra: '2023-02-01',
          sfggReferenceperiodeTil: '2023-02-28',
          sfggManuelFoerstEfterSygeloen: 'Nej',
        }],
      },
    },
  };
};

const buildBoundarySummaryFixture = () => {
  const fixture = buildFixture();
  const eo = fixture.data.erstatningsopgoerelse;
  const firstEmployment = eo.loenindkomstAnsaettelsesforhold[0]!;
  const secondEmploymentId = `${AF_ID}-2`;
  const secondEmployment = {
    ...firstEmployment,
    id: secondEmploymentId,
    navnPaaArbejdssted: 'Firma B',
    indtaegtsoplysningerTableData: firstEmployment.indtaegtsoplysningerTableData.map((row, index) => ({
      ...row,
      id: `bb12j-loen-b-${index}`,
    })),
  };
  const firstSfgg = eo.sfggAnsaettelsesforhold[0]!;
  const withBoundaryPair = (row: typeof firstSfgg, ansaettelsesforholdId: string) => ({
    ...row,
    ansaettelsesforholdId,
    sfggReferenceperiodeFra: '2023-03-01',
    sfggReferenceperiodeTil: '2023-03-28',
  });
  const data = {
    ...fixture.data,
    erstatningsopgoerelse: {
      ...eo,
      loenindkomstAnsaettelsesforhold: [firstEmployment, secondEmployment],
      sfggAnsaettelsesforhold: [
        withBoundaryPair(firstSfgg, AF_ID),
        withBoundaryPair(firstSfgg, secondEmploymentId),
      ],
    },
  };

  return {
    ...fixture,
    _metadata: { ...fixture._metadata, fieldCount: countFilledFields(data) },
    data,
  };
};

const hentGrundsag = async (page: Page, fixture = buildFixture()): Promise<void> => {
  // Uden File System Access-API'et bruger «Hent» den almindelige filvælger, som Playwright kan fylde.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });
  await login(page);
  await openPage(page, 'Stamdata');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent', exact: true }).click();
  await (await chooser).setFiles({
    name: 'fiktiv-bb12j.eo',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from(await encryptToString(fixture)),
  });
  await expect(page.locator('input[name="journalnr"]')).toHaveValue('BB-12J');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPage(page, 'Erstatningsopgørelse');
  await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
};

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

const referenceFra = (page: Page) => page.locator(`input[name="${AF_ID}:sfggReferenceperiodeFra"]`);
const fravaersdage = (page: Page) => page.locator(`input[name="${AF_ID}:sfggReferenceperiodeFravaersdageUdenLoen"]`);

// Flade 12j (BB-319–BB-331): sygeferiegodtgørelsen. Basisbanen er nok – intet her afhænger af motor eller viewport.
test.describe('Erstatningsopgørelse – sygeferiegodtgørelse', () => {
  test('en referenceperiode efter skadedato kan bruges før et senere TAF-forløb (BB-319)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    const grundsag = buildFixture();
    const eo = grundsag.data.erstatningsopgoerelse;
    const employment = eo.loenindkomstAnsaettelsesforhold[0]!;
    const fixture = {
      ...grundsag,
      data: {
        ...grundsag.data,
        erstatningsopgoerelse: {
          ...eo,
          eoNummer: '2',
          'opgørelseLavetDen': '2024-07-01',
          vedroererPeriodeFra: '2024-01-01',
          vedroererPeriodeTil: '2024-06-30',
          tafPerioder: [{ id: 'bb12j-taf-2', fra: '2024-01-01', til: '2024-06-30' }, { id: 'bb12j-taf-tom-2' }],
          loenindkomstAnsaettelsesforhold: [{
            ...employment,
            indtaegtsoplysningerTableData: [
              ...employment.indtaegtsoplysningerTableData,
              {
                id: 'bb12j-loen-arbejde-efter-skade',
                col0_maaned: '12',
                col1_maaned: '2023',
                col0_uge: '',
                col1_uge: '',
                col2: { kind: 'number' as const, value: 30000 },
              },
            ],
          }],
          sfggAnsaettelsesforhold: [{
            ...eo.sfggAnsaettelsesforhold[0]!,
            sfggReferenceperiodeFra: '2023-12-01',
            sfggReferenceperiodeTil: '2023-12-28',
          }],
        },
      },
    };

    await hentGrundsag(page, fixture);
    await expect(referenceFra(page)).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator(`input[name="${AF_ID}:sfggReferenceperiodeTil"]`)).toHaveAttribute('aria-invalid', 'false');
    await expect(page.getByText('Der er ingen løn i referenceperioden', { exact: false })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(page.getByText('Der er ingen løn i referenceperioden', { exact: false })).toHaveCount(0);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en referenceperiode i TAF-perioden giver rød ring og én linje, hvis link blinker datoen (BB-322)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await hentGrundsag(page);
    // BB-329: enheden står ved feltet.
    const fravaersLabel = page.getByText('Evt. ferie- og fraværsdage uden løn (kalenderdage)', { exact: true });
    await expect(fravaersLabel).toBeVisible();
    await fravaersLabel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('sfgg-afsnit.png') });

    // Fundets periode 01-03-2023 – 28-03-2023: begge datoer ligger i TAF-perioden og får hver sin røde ring.
    await setVerbatimFieldValueAndSettle(page.locator(`input[name="${AF_ID}:sfggReferenceperiodeTil"]`), '28-03-2023');
    await setVerbatimFieldValueAndSettle(referenceFra(page), '01-03-2023');
    await expect(referenceFra(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator(`input[name="${AF_ID}:sfggReferenceperiodeTil"]`)).toHaveAttribute('aria-invalid', 'true');
    await expect(referenceFra(page)).toHaveAccessibleDescription(/Datoen skal ligge før første TAF-periode \(01-03-2023\)/);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    // Én linje, selv om begge datoer er røde – før stod samme tekst to gange.
    const linje = errorBox(page).locator('.row--label-right-hover').filter({ hasText: 'Datoen skal ligge før første TAF-periode' });
    await expect(linje).toHaveCount(1);
    await errorBox(page).screenshot({ path: testInfo.outputPath('fejl-og-advarsler.png') });

    await startFieldBlinkRecording(page);
    await linje.getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    const adresse = await referenceFra(page).getAttribute('data-mineo-field-address');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(adresse);
    expect((await readFieldBlinkRecording(page)).every((blink) => blink === adresse)).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('TAF-grænsefejl navngiver Til og foldes kun inden for samme ansættelsesforhold (BB-345)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await hentGrundsag(page, buildBoundarySummaryFixture());

    const fraFoerste = referenceFra(page);
    const tilFoerste = page.locator(`input[name="${AF_ID}:sfggReferenceperiodeTil"]`);
    const fraAndet = page.locator(`input[name="${AF_ID}-2:sfggReferenceperiodeFra"]`);
    const tilAndet = page.locator(`input[name="${AF_ID}-2:sfggReferenceperiodeTil"]`);
    for (const field of [fraFoerste, tilFoerste, fraAndet, tilAndet]) {
      await expect(field).toHaveAttribute('aria-invalid', 'true');
    }

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const graensefejl = () => errorBox(page).locator('.row--label-right-hover')
      .filter({ hasText: 'Datoen skal ligge før første TAF-periode (01-03-2023)' });
    // Begge kort har samme Fra+Til-grænsefejl. De må foldes inden for hvert kort, men ikke på tværs af dem.
    await expect(graensefejl()).toHaveCount(2);
    await expect(graensefejl().nth(0)).toContainText('Referenceperiode, fra:');
    await expect(graensefejl().nth(1)).toContainText('Referenceperiode, fra:');

    // Ret kun Firma A's Fra-dato. Firma A har nu alene en ugyldig Til-dato, mens Firma B stadig har begge.
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await setVerbatimFieldValueAndSettle(fraFoerste, '01-02-2023');
    await expect(fraFoerste).toHaveAttribute('aria-invalid', 'false');
    await expect(tilFoerste).toHaveAttribute('aria-invalid', 'true');
    await expect(fraAndet).toHaveAttribute('aria-invalid', 'true');
    await expect(tilAndet).toHaveAttribute('aria-invalid', 'true');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(graensefejl()).toHaveCount(2);
    await expect(graensefejl().filter({ hasText: 'Referenceperiode, til:' })).toHaveCount(1);
    await expect(graensefejl().filter({ hasText: 'Referenceperiode, fra:' })).toHaveCount(1);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('ens systemgrænsefejl vises med link til hvert sit referencedatofelt', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    const grundsag = buildFixture();
    const eo = grundsag.data.erstatningsopgoerelse;
    const fixture = {
      ...grundsag,
      data: {
        ...grundsag.data,
        erstatningsopgoerelse: {
          ...eo,
          sfggAnsaettelsesforhold: [{
            ...eo.sfggAnsaettelsesforhold[0]!,
            sfggReferenceperiodeFra: '2030-01-01',
            sfggReferenceperiodeTil: '2030-02-01',
          }],
        },
      },
    };
    await hentGrundsag(page, fixture);

    const fra = referenceFra(page);
    const til = page.locator(`input[name="${AF_ID}:sfggReferenceperiodeTil"]`);
    await expect(fra).toHaveAttribute('aria-invalid', 'true');
    await expect(til).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();

    const fejlbeskeder = errorBox(page).locator('.row--label-right-hover')
      .filter({ hasText: 'Dato skal være mellem 01-01-2005 og 31-12-2027' });
    await expect(fejlbeskeder).toHaveCount(2);
    await startFieldBlinkRecording(page);
    await fejlbeskeder.nth(0).getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    const fraAdresse = await fra.getAttribute('data-mineo-field-address');
    const tilAdresse = await til.getAttribute('data-mineo-field-address');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(fraAdresse);
    expect(await readFieldBlinkRecording(page)).not.toContain(tilAdresse);
    await expect.poll(() => fra.evaluate((input) =>
      input.closest('.MuiInputBase-root')?.classList.contains('mineo-field-attention-blink') ?? false
    )).toBe(false);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await clearFieldBlinkRecording(page);
    await fejlbeskeder.nth(1).getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(tilAdresse);
    expect(await readFieldBlinkRecording(page)).not.toContain(fraAdresse);
    expect((await readFieldBlinkRecording(page)).every((address) => address === tilAdresse)).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('fraværsdagene bærer loftet selv, og en periode uden løn spærrer (BB-319, BB-323)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }) => {
    await hentGrundsag(page);

    await setFieldValueAndSettle(fravaersdage(page), '28');
    await expect(fravaersdage(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(fravaersdage(page)).toHaveAccessibleDescription(
      /Højst 27 fraværsdage – referenceperioden har 28 kalenderdage/
    );
    await setFieldValueAndSettle(fravaersdage(page), '27');
    await expect(fravaersdage(page)).toHaveAttribute('aria-invalid', 'false');
    await setFieldValueAndSettle(fravaersdage(page), '0');

    await setVerbatimFieldValueAndSettle(referenceFra(page), '01-01-2021');
    await setVerbatimFieldValueAndSettle(page.locator(`input[name="${AF_ID}:sfggReferenceperiodeTil"]`), '28-01-2021');
    await expect(referenceFra(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(referenceFra(page)).toHaveAccessibleDescription(
      /Der er ingen løn i referenceperioden \(01-01-2021 – 28-01-2021\)/
    );
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Der er ingen løn i referenceperioden (01-01-2021 – 28-01-2021)');
    await expect(page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' }).getByRole('button'))
      .toBeDisabled();

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('seksmånedersadvarslen siger hvad og hvorfor, og linket blinker «Opsagt fra stillingen» (BB-325)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await hentGrundsag(page);
    const tekst = "Der er ikke registreret løn fra Firma A efter 28-02-2023. Er skadelidte opsagt, angives det under 'Opsagt fra stillingen' – retten til sygeferiegodtgørelse ophører da.";
    const kortTekst = page.getByText(tekst, { exact: true });
    await expect(kortTekst).toBeVisible();
    await kortTekst.locator('xpath=..').screenshot({ path: testInfo.outputPath('seksmaaneder-kort.png') });

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const linje = errorBox(page).locator('.row--label-right-hover').filter({ hasText: 'Der er ikke registreret løn fra Firma A' });
    await expect(linje).toHaveCount(1);
    await startFieldBlinkRecording(page);
    await linje.getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => (await readFieldBlinkRecording(page)).some((blink) => blink.includes('ansaettelsesforholdOphoert')))
      .toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
