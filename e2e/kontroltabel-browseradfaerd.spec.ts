import { readFile } from 'node:fs/promises';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { createErstatningsopgoerelseInitialValues } from '../src/domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../src/types/branded';
import { encryptToString } from '../src/utils/encryption';
import { withSfggIngenForEmployments } from '../src/__tests__/utils/sfggTestSupport';

import {
  expect,
  login,
  openPage,
  setFieldValueAndSettle,
  setVerbatimFieldValueAndSettle,
  test,
} from './support/mineoTest';

const CRLF = String.fromCharCode(13, 10);
const iso = toISODateString;

// Tom-tilstanden siger, hvad tabellen dannes af; CSV-filen hedder efter sagen og har
// navne uden linjeskift; dagtabellen siger «SH-dag» og «Svie/smerte-dag» og har ingen
// ansættelsesforholdskolonner uden TAF.
test.describe('Kontroltabel – tom tilstand og CSV-fil', () => {
  test('forklarer tom-tilstanden og henter en CSV-fil med sagens navn', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await login(page);

    await openPage(page, 'Indstillinger');
    await page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' }).click();

    await openPage(page, 'Stamdata');
    await setFieldValueAndSettle(page.getByRole('textbox', { name: 'Journalnr.' }), 'BB-12M');

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    const panel = page.locator('[role="tabpanel"]:visible');
    await expect(panel.getByText('Kontroltabellen dannes af sagens perioder.', { exact: false })).toBeVisible();
    await expect(panel.getByText('Kan ikke oprette kontroltabel')).toHaveCount(0);

    await page.getByRole('tab', { name: 'EO oplysninger', exact: true }).click();
    await page.locator("input[name='kravPaaTabtArbejdsfortjeneste'][value='Nej']").check();
    await setVerbatimFieldValueAndSettle(page.locator("input[name='vedroererPeriodeFra']"), '01-01-2024');
    await setVerbatimFieldValueAndSettle(page.locator("input[name='vedroererPeriodeTil']"), '31-01-2024');

    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    await expect(panel.getByText('Sagens første og sidste dato')).toBeVisible();
    await expect(panel.getByText('Tabellen viser (hele måneder)')).toBeVisible();
    await expect(panel.getByText('Kontroltabellen dannes af sagens perioder.', { exact: false })).toHaveCount(0);

    const shHeader = panel.getByText('SH-dag', { exact: true });
    const ssHeader = panel.getByText(/^Svie\/smerte-\s*dag$/);
    await expect(shHeader).toBeVisible();
    await expect(ssHeader).toBeVisible();
    await expect(panel.getByText('TAF-regulering', { exact: true })).toHaveCount(0);
    // Overskriften skal kunne stå i kolonnens 120 px uden at blive skåret over.
    const overflow = await ssHeader.evaluate((element) => {
      const cell = element.closest('th, [role="columnheader"]') ?? element;
      return cell.scrollWidth - cell.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);

    await ssHeader.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('kontroltabel-12m.png'), fullPage: true });

    const downloaded = page.waitForEvent('download');
    await panel.locator('.row--label-right-hover').filter({ hasText: 'Download tabel (CSV-format)' })
      .getByRole('button').click();
    const download = await downloaded;
    expect(download.suggestedFilename()).toBe('BB-12M - Kontroltabel.csv');
    const csvPath = await download.path();
    const csv = await readFile(csvPath, 'utf-8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const [header] = csv.slice(1).split(CRLF);
    expect(header).toContain('SH-dag');
    expect(header).toContain('Svie/smerte-dag');
    expect(header).not.toContain('\n');

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

test.describe('Kontroltabel – TAF-afskæring ved midlertidigt EET', () => {
  test('viser, at TAF ophører ved midlertidigt EET for en skade før 16-06-2011, og sammentællingen stemmer', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    });
    const initial = createErstatningsopgoerelseInitialValues();
    const eoValues = withSfggIngenForEmployments({
      ...initial,
      eoNummer: '1',
      opgørelseLavetDen: iso('2024-12-31'),
      kravPaaSvieSmerteGodtgoerelse: 'Nej' as const,
      kravPaaOevrigeErstatningskrav: 'Nej' as const,
      kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
      tafArbejdsstatus: 'Uarbejdsdygtig' as const,
      beregnesUdFra: 'Angivet dagsløn' as const,
      dagsloenenUdgoer: { kind: 'number' as const, value: 1_000 },
      eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' as const },
      vedroererPeriodeFra: iso('2024-01-01'),
      vedroererPeriodeTil: iso('2024-01-31'),
      tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-01-14'), loseFeriedage: 0 }],
      midlertidigtEETAfgorelse: 'Ja' as const,
      midlertidigEETAfgoerelseDato: iso('2024-01-15'),
      midlertidigEETVirkningsdato: iso('2024-01-15'),
      verserendeKlageEet: 'Nej' as const,
    });
    const fixture = {
      ...caseFixture,
      data: {
        ...caseFixture.data,
        stamdata: { ...caseFixture.data.stamdata, journalnr: 'EET-2010-FIKTIV', skadedato: '2010-03-01' },
        erstatningsopgoerelse: eoValues,
      },
    };

    await login(page);
    await openPage(page, 'Indstillinger');
    await page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' }).click();
    await openPage(page, 'Stamdata');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hent', exact: true }).click();
    await (await chooser).setFiles({
      name: 'fiktiv-eet-2010.eo', mimeType: 'application/octet-stream',
      buffer: Buffer.from(await encryptToString(fixture)),
    });
    await expect(page.locator('input[name="journalnr"]')).toHaveValue('EET-2010-FIKTIV');

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    const panel = page.locator('[role="tabpanel"]:visible');
    const afskaering = panel.getByRole('row').filter({ hasText: 'TAF ophører: midlertidigt EET (skade før 16-06-2011)' });
    await expect(afskaering).toContainText('15-01-2024');

    const dag = panel.getByRole('row').filter({ hasText: '15-01-2024' }).filter({ hasText: 'Mandag' });
    await expect(dag).toContainText('Midlertidigt EET');

    const tafRaekke = panel.locator('.content-box').filter({ hasText: 'Sammentælling' })
      .getByRole('row').filter({ hasText: 'Arbejdsdage i TAF-periode' });
    // 2.–12. januar 2024: ni arbejdsdage (1. januar er helligdag); 15. januar og frem tæller ikke.
    await expect(tafRaekke.getByRole('cell').nth(1)).toHaveText('9');
    await expect(tafRaekke.getByRole('cell').nth(2)).toHaveText('9');
    await expect(tafRaekke.locator('svg')).toHaveCSS('color', 'rgb(16, 185, 129)');

    await afskaering.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('kontroltabel-taf-afskaering.png') });
    await dag.scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('kontroltabel-taf-afskaering-dag.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

// «Ugedag» og «Dato» bliver stående til venstre, når brugeren ruller vandret hen til løn og ydelser.
test.describe('Kontroltabel – datoen bliver stående ved vandret rul', () => {
  test('holder datokolonnen synlig, mens løn- og ydelseskolonnerne ruller', async ({
    page,
    runtimeErrors,
    runtimeSignals,
    externalRequests,
  }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    });
    await login(page);
    await openPage(page, 'Indstillinger');
    await page.getByRole('checkbox', { name: 'Vis kontrolfaner på Erstatningsopgørelse-side' }).click();
    await openPage(page, 'Stamdata');
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Hent', exact: true }).click();
    await (await chooser).setFiles({
      name: 'fiktiv-reguleringssag.eo', mimeType: 'application/octet-stream',
      buffer: Buffer.from(await encryptToString(caseFixture)),
    });
    await expect(page.locator('input[name="journalnr"]')).toHaveValue('REGULERING-FIKTIV');

    await openPage(page, 'Erstatningsopgørelse');
    await page.getByRole('button', { name: 'Kontroltabel', exact: true }).click();
    const panel = page.locator('[role="tabpanel"]:visible');
    const datoHeader = panel.locator('th[data-mineo-column-id="base:date"]');
    await expect(datoHeader).toBeVisible();
    await datoHeader.scrollIntoViewIfNeeded();

    const scrollContainer = page.locator('[data-mineo-scroll-container="true"]');
    const scrolled = await scrollContainer.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
      return element.scrollLeft;
    });
    expect(scrolled).toBeGreaterThan(0);

    const containerBox = await scrollContainer.boundingBox();
    const datoCell = panel.locator('td[data-mineo-column-id="base:date"]').first();
    const sidsteKolonne = panel.locator('th[data-mineo-column-id]').last();
    await expect.poll(async () => (await datoHeader.boundingBox())?.x).toBeGreaterThanOrEqual(containerBox!.x);
    const headerBox = await datoHeader.boundingBox();
    const cellBox = await datoCell.boundingBox();
    expect(cellBox!.x).toBeCloseTo(headerBox!.x, 0);
    await expect(sidsteKolonne).toBeInViewport();
    // Den fastholdte celle dækker de rullende celler: øverst ved datocellens midte ligger datocellen selv.
    const oeverst = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('td')?.dataset.mineoColumnId, {
      x: cellBox!.x + cellBox!.width / 2,
      y: cellBox!.y + cellBox!.height / 2,
    });
    expect(oeverst).toBe('base:date');

    await page.screenshot({ path: testInfo.outputPath('kontroltabel-vandret-rul.png') });

    expect(runtimeErrors).toEqual([]);
    expect(runtimeSignals).toEqual([]);
    expect(externalRequests).toEqual([]);
  });
});

