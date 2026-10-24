import type { Page } from '@playwright/test';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { encryptToString } from '../src/utils/encryption';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
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

const hentGrundsag = async (page: Page): Promise<void> => {
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
    buffer: Buffer.from(await encryptToString(buildFixture())),
  });
  await expect(page.locator('input[name="journalnr"]')).toHaveValue('BB-12J');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPage(page, 'Erstatningsopgørelse');
  await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
};

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

/** Feltadresserne på de elementer, der begynder at blinke – målt gennem `animationstart`, som brugeren ser det. */
const startBlinkRecording = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const blinks: string[] = [];
    (window as unknown as { __mineoBlinks: string[] }).__mineoBlinks = blinks;
    document.addEventListener('animationstart', (event) => {
      if (event.animationName !== 'mineoFieldAttentionBlink' || !(event.target instanceof HTMLElement)) return;
      const inner = event.target.matches('input')
        ? event.target
        : event.target.querySelector<HTMLElement>('input[data-mineo-field-address]');
      blinks.push((inner ?? event.target).getAttribute('data-mineo-field-address') ?? event.target.className);
    }, true);
  });
};

const recordedBlinks = (page: Page): Promise<string[]> =>
  page.evaluate(() => (window as unknown as { __mineoBlinks: string[] }).__mineoBlinks);

const referenceFra = (page: Page) => page.locator(`input[name="${AF_ID}:sfggReferenceperiodeFra"]`);
const fravaersdage = (page: Page) => page.locator(`input[name="${AF_ID}:sfggReferenceperiodeFravaersdageUdenLoen"]`);

// Flade 12j (BB-319–BB-331): sygeferiegodtgørelsen. Basisbanen er nok – intet her afhænger af motor eller viewport.
test.describe('Erstatningsopgørelse – sygeferiegodtgørelse', () => {
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

    await startBlinkRecording(page);
    await linje.getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    const adresse = await referenceFra(page).getAttribute('data-mineo-field-address');
    await expect.poll(() => recordedBlinks(page)).toContain(adresse);
    expect((await recordedBlinks(page)).every((blink) => blink === adresse)).toBe(true);

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
    await startBlinkRecording(page);
    await linje.getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(async () => (await recordedBlinks(page)).some((blink) => blink.includes('ansaettelsesforholdOphoert')))
      .toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
