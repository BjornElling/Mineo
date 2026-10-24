import { readFile } from 'node:fs/promises';

import type { Locator, Page } from '@playwright/test';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { encryptToString } from '../src/utils/encryption';
import { extractPdfText } from '../src/__tests__/utils/pdf/pdfTextExtractor';

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

const setDate = setVerbatimFieldValueAndSettle;

const fillSag = async (page: Page): Promise<void> => {
  await openPage(page, 'Stamdata');
  await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12H');
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

/** Indtægtstabellens række nr. `index` (0-baseret) – også en tom indtastningsrække. */
const loenRaekke = (page: Page, index: number): Locator =>
  page.locator('table').filter({ hasText: 'ATP og anden' }).first()
    .locator('tbody tr[data-mineo-row-id]').nth(index);

const tastRaekke = async (page: Page, index: number, maaned: string, aar: string, loen: string): Promise<void> => {
  await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(0), maaned);
  await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(1), aar);
  await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(2), loen);
};

const errorBox = (page: Page) => page.locator('.content-box').filter({ hasText: 'Fejl og advarsler' });

// Flade 12h (BB-289–BB-299): indtægtstabellens rækker. Basisbanen er nok – intet her afhænger af motor eller
// viewport.
test.describe('Erstatningsopgørelse – indtægtsoplysninger', () => {
  test('sortering giver ikke et ekstra Ctrl+Z-trin og bliver stående (BB-337)', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
    await setFieldValueAndSettle(page.locator('input[name$=":feriePct"]'), '12,5');

    await setFieldValueAndSettle(loenRaekke(page, 0).locator('input[data-mineo-field-address]').nth(0), '6');
    await setFieldValueAndSettle(loenRaekke(page, 0).locator('input[data-mineo-field-address]').nth(1), '2017');
    await setFieldValueAndSettle(loenRaekke(page, 1).locator('input[data-mineo-field-address]').nth(0), '5');
    await setFieldValueAndSettle(loenRaekke(page, 1).locator('input[data-mineo-field-address]').nth(1), '2017');

    const redigeretRaekkeId = await loenRaekke(page, 0).getAttribute('data-mineo-row-id');
    if (redigeretRaekkeId === null) throw new Error('Lønrækken mangler et stabilt rækkes-id.');
    const redigeretLoen = page.locator(`tr[data-mineo-row-id="${redigeretRaekkeId}"]`)
      .locator('input[data-mineo-field-address]').nth(2);
    await setFieldValueAndSettle(redigeretLoen, '100');
    await expect(redigeretLoen).toHaveValue(/100/);

    const indtaegtsTabel = page.locator('table').filter({ hasText: 'ATP og anden' }).first();
    await indtaegtsTabel.getByRole('columnheader', { name: 'Måned', exact: true }).click();
    await expect(loenRaekke(page, 0).locator('input[data-mineo-field-address]').nth(0)).toHaveValue('5');
    await expect(loenRaekke(page, 1).locator('input[data-mineo-field-address]').nth(0)).toHaveValue('6');

    await page.keyboard.press('Control+z');
    await expect(redigeretLoen).toHaveValue('');
    await expect(loenRaekke(page, 0).locator('input[data-mineo-field-address]').nth(0)).toHaveValue('5');
    await expect(loenRaekke(page, 1).locator('input[data-mineo-field-address]').nth(0)).toHaveValue('6');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
  test('viser kun den navngivne fejl, når lønnen samlet er negativ (BB-333)', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    // Afgræns til den måned, hvor rækken ligger, så testen kun måler den negative kilde og ikke også BB-260's
    // uafhængige advarsel om de øvrige elleve måneder uden indkomst.
    await setDate(page.locator("input[name='tafBeregningsperiodeFra']"), '01-07-2017');
    await setDate(page.locator("input[name='tafBeregningsperiodeTil']"), '31-07-2017');
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
    await setFieldValueAndSettle(page.locator('input[name$=":feriePct"]'), '12,5');
    await tastRaekke(page, 0, '7', '2017', '-2000');

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText(/Lønnen fra .* er samlet negativ i beregningsperioden/);
    await expect(errorBox(page)).not.toContainText('Ingen indkomst i beregningsperioden');
    await errorBox(page).screenshot({ path: testInfo.outputPath('negativ-indkomst-fejl.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('en identisk række får gul ring, og en rød række får sin egen linje, hvis link blinker cellen', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
    await setFieldValueAndSettle(page.locator('input[name$=":feriePct"]'), '12,5');

    await tastRaekke(page, 0, '6', '2017', '30000');
    await tastRaekke(page, 1, '7', '2017', '30000');
    await tastRaekke(page, 2, '6', '2017', '30000');
    await tastRaekke(page, 3, '13', '2017', '30000');

    // BB-289: den gentagne række er gul, ikke rød, og tooltippen beder om et blik.
    const dublettensLoen = loenRaekke(page, 2).locator('input[data-mineo-field-address]').nth(2);
    await expect(dublettensLoen).toHaveAttribute('aria-invalid', 'false');
    await expect(dublettensLoen).toHaveAccessibleDescription(/identisk med en tidligere række/);
    await page.locator('table').filter({ hasText: 'ATP og anden' }).first().screenshot({ path: testInfo.outputPath('indtaegtstabel.png') });

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await expect(errorBox(page)).toContainText('Lønrækken 06-2017 er identisk med en tidligere række');
    // BB-291: rækken navngives, cellens egen tekst står i linjen, og der er ingen «ikke angivet» om en rød værdi.
    const roedLinje = page.locator('.row--label-right-hover').filter({ hasText: 'Række 4: Måned –' });
    await expect(roedLinje).toBeVisible();
    await expect(errorBox(page)).not.toContainText('Måned er ikke angivet');
    await errorBox(page).screenshot({ path: testInfo.outputPath('fejl-og-advarsler.png') });

    await startFieldBlinkRecording(page);
    await roedLinje.getByRole('button').first().click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    const maanedsCelle = loenRaekke(page, 3).locator('input[data-mineo-field-address]').nth(0);
    const maanedsAdresse = await maanedsCelle.getAttribute('data-mineo-field-address');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(maanedsAdresse);
    // Kun cellen blinker – ikke hele kortet.
    expect((await readFieldBlinkRecording(page)).every((adresse) => adresse === maanedsAdresse)).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('to identiske lønrækker uden beløb får hver sin advarselslinje (BB-291)', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);
    await fillSag(page);
    await page.getByRole('tab', { name: 'Lønindkomst', exact: true }).click();
    await page.getByRole('button', { name: 'Tilføj nyt ansættelsesforhold', exact: true }).last().click();
    await setFieldValueAndSettle(page.locator('input[name$=":feriePct"]'), '12,5');

    for (const index of [0, 1]) {
      await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(0), '6');
      await setFieldValueAndSettle(loenRaekke(page, index).locator('input[data-mineo-field-address]').nth(1), '2017');
    }

    const firstAmountCell = loenRaekke(page, 0).locator('input[data-mineo-field-address]').nth(2);
    const secondAmountCell = loenRaekke(page, 1).locator('input[data-mineo-field-address]').nth(2);
    const firstAddress = await firstAmountCell.getAttribute('data-mineo-field-address');
    const secondAddress = await secondAmountCell.getAttribute('data-mineo-field-address');
    if (firstAddress === null || secondAddress === null) throw new Error('Lønrækken mangler feltadresse.');
    expect(firstAddress).not.toBe(secondAddress);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    const summary = errorBox(page);
    const identicalWarnings = summary.locator('.row--label-right-hover')
      .filter({ hasText: 'Lønrækken 06-2017 er udfyldt uden beløb' });
    await expect(identicalWarnings).toHaveCount(2);
    await expect(identicalWarnings.getByRole('button', { name: 'Lønindkomst', exact: true })).toHaveCount(2);
    await summary.screenshot({ path: testInfo.outputPath('ens-loenraekker-uden-beloeb.png') });

    await startFieldBlinkRecording(page);
    await identicalWarnings.nth(0).getByRole('button', { name: 'Lønindkomst', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(firstAddress);
    expect(await readFieldBlinkRecording(page)).not.toContain(secondAddress);
    expect((await readFieldBlinkRecording(page)).every((address) => address === firstAddress)).toBe(true);
    // Afslut blinket før faneskiftet, så browserens genvisning ikke tælles som blink fra det næste link.
    await expect.poll(() => firstAmountCell.evaluate((input) =>
      input.closest('.MuiInputBase-root')?.classList.contains('mineo-field-attention-blink') ?? false
    )).toBe(false);

    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
    await clearFieldBlinkRecording(page);
    await identicalWarnings.nth(1).getByRole('button', { name: 'Lønindkomst', exact: true }).click();
    await expect(page.getByRole('tab', { name: 'Lønindkomst', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => readFieldBlinkRecording(page)).toContain(secondAddress);
    expect(await readFieldBlinkRecording(page)).not.toContain(firstAddress);
    expect((await readFieldBlinkRecording(page)).every((address) => address === secondAddress)).toBe(true);

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });

  test('bilaget forklarer under tabellen de lønsedler og ydelser, som en periode skærer igennem (BB-293)', async ({
    page,
    runtimeErrors,
    externalRequests,
  }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
      Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
    });
    await login(page);
    await openPage(page, 'Stamdata');
    // Beregningsperioden 01-07-2024 – 30-06-2025 skærer lønsedlen for juni–juli 2025 over; erstatningsperioden fra
    // 25-05-2026 skærer lønsedlen og dagpengene for maj–juni 2026 over.
    const eo = caseFixture.data.erstatningsopgoerelse;
    const ansaettelse = eo.loenindkomstAnsaettelsesforhold[0]!;
    const datoRaekke = (id: string, fra: string, til: string, loen: number) => ({
      id, col0_maaned: '', col1_maaned: '', col0_uge: '', col1_uge: '', col0_dag: fra, col1_dag: til,
      col2: { kind: 'number', value: loen },
    });
    const fixture = {
      ...caseFixture,
      data: {
        ...caseFixture.data,
        erstatningsopgoerelse: {
          ...eo,
          eoNummer: '1',
          loenindkomstAnsaettelsesforhold: [{
            ...ansaettelse,
            loenperiode: 'dag',
            loenudviklingBeregningsgrundlag: 'Ingen',
            indtaegtsoplysningerTableData: [
              datoRaekke('bb293-1', '2024-07-01', '2025-05-31', 400000),
              datoRaekke('bb293-2', '2025-06-01', '2025-07-31', 72000),
              datoRaekke('bb293-3', '2026-05-01', '2026-05-31', 31000),
            ],
          }],
          offentligeYdelserRows: [
            ...eo.offentligeYdelserRows,
            { id: 'bb293-y', fraDato: '2026-05-11', tilDato: '2026-06-09', ydelse: { kind: 'number', value: 15000 }, ydelsestype: 'dagpenge' },
          ],
        },
      },
    };
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hent', exact: true }).click();
    await (await chooser).setFiles({
      name: 'fiktiv-bb293.eo', mimeType: 'application/octet-stream',
      buffer: Buffer.from(await encryptToString(fixture)),
    });
    await expect(page.locator('input[name="journalnr"]')).toHaveValue('REGULERING-FIKTIV');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('tab', { name: 'Beregning', exact: true }).click();

    const button = page.locator('.row--label-right-hover').filter({ hasText: 'Hent opgørelse' }).getByRole('button');
    await expect(button).toBeEnabled();
    const download = page.waitForEvent('download');
    await button.click();
    const path = await (await download).path();
    if (path === null) throw new Error('Opgørelsen mangler.');
    const pdf = await readFile(path);
    await testInfo.attach('bb293.pdf', { body: pdf, contentType: 'application/pdf' });
    const text = (await extractPdfText(new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }))).replace(/\s+/g, ' ');
    expect(text).toContain('01-06-2025 - 31-07-2025: 30 af 61 kalenderdage i beregningsperioden');
    expect(text).toContain('01-05-2026 - 31-05-2026: 7 af 31 kalenderdage i erstatningsperioden');
    expect(text).toContain('11-05-2026 - 09-06-2026: 16 af 30 kalenderdage i erstatningsperioden');

    expect(runtimeErrors).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});
