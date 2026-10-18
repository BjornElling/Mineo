import { readFile } from 'node:fs/promises';

import caseFixture from './fixtures/manuel-regulering-med-tillaeg.json' with { type: 'json' };
import { createDefaultLoenindkomstAnsaettelsesforhold, createErstatningsopgoerelseInitialValues } from '../src/domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { AmountValue } from '../src/schemas/amountExpressionSchema';
import { toISODateString } from '../src/types/branded';
import { encryptToString } from '../src/utils/encryption';
import { withSfggIngenForEmployments } from '../src/__tests__/utils/sfggTestSupport';
import { expect, login, openPage, test } from './support/mineoTest';

const amount = (value: number): AmountValue => ({ kind: 'number', value });
const iso = toISODateString;

test('TAF-grafen viser betalt ferie og to ansættelser med samme navn i PDF', async ({
  page, runtimeErrors, runtimeSignals, externalRequests,
}, testInfo) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'showOpenFilePicker', { configurable: true, value: undefined });
    Object.defineProperty(window, 'showSaveFilePicker', { configurable: true, value: undefined });
  });
  const initial = createErstatningsopgoerelseInitialValues();
  const eoValues = withSfggIngenForEmployments({
    ...initial,
    eoNummer: '1',
    opgørelseLavetDen: iso('2024-12-31'),
    svieSmerteHelbredsstatus: 'Sygemeldt' as const,
    tafArbejdsstatus: 'Uarbejdsdygtig' as const,
    beregnesUdFra: 'Angivet dagsløn' as const,
    dagsloenenUdgoer: amount(1_000),
    kravPaaTabtArbejdsfortjeneste: 'Ja' as const,
    vedroererPeriodeFra: iso('2024-01-01'),
    vedroererPeriodeTil: iso('2024-03-31'),
    tafPerioder: [{ id: 'taf-1', fra: iso('2024-01-01'), til: iso('2024-03-31'), loseFeriedage: 0 }],
    ferieperioder: [{ id: 'ferie-1', fra: iso('2024-02-01'), til: iso('2024-02-29') }],
    eoAngivetLoenLoenudvikling: { ...initial.eoAngivetLoenLoenudvikling, loenudviklingBeregningsgrundlag: 'Ingen' as const },
    loenindkomstAnsaettelsesforhold: [1_000, 2_000].map((value, index) => ({
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      id: `af-${index + 1}`,
      navnPaaArbejdssted: 'Fælles arbejdssted',
      loenudviklingBeregningsgrundlag: 'Ingen' as const,
      tillaegAngivesSom: 'beloeb' as const,
      feriePct: 0, fritvalgPct: 0, shSoPct: 0, storeBededagPct: 0, pensionPct: 0,
      beregnStoreBededagstillaeg: false,
      indtaegtsoplysningerTableData: [{
        id: `loen-${index + 1}`, col0_maaned: '02', col1_maaned: '2024',
        col0_uge: '', col1_uge: '', col0_dag: undefined, col1_dag: undefined,
        col2: amount(value), col3: undefined, col4: undefined, col5: undefined,
      }],
    })),
    offentligeYdelserRows: [
      { id: 'dagpenge-1', fraDato: iso('2024-02-01'), tilDato: iso('2024-02-29'), ydelsestype: 'dagpenge', ydelse: amount(2_000), tillaeg: undefined },
      { id: 'eet-1', fraDato: iso('2024-02-01'), tilDato: iso('2024-02-29'), ydelsestype: 'midlertidigt_eet', ydelse: amount(3_000), tillaeg: undefined },
    ],
  });
  const fixture = {
    ...caseFixture,
    data: {
      ...caseFixture.data,
      stamdata: { ...caseFixture.data.stamdata, journalnr: 'GRAF-FERIE-FIKTIV', skadedato: '2024-01-01' },
      erstatningsopgoerelse: eoValues,
    },
  };
  await login(page);
  await openPage(page, 'Stamdata');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Hent', exact: true }).click();
  await (await chooser).setFiles({
    name: 'fiktiv-graf-ferie.eo', mimeType: 'application/octet-stream',
    buffer: Buffer.from(await encryptToString(fixture)),
  });
  await expect(page.locator('input[name="journalnr"]')).toHaveValue('GRAF-FERIE-FIKTIV');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await openPage(page, 'Erstatningsopgørelse');
  await page.getByRole('tab', { name: 'Beregning', exact: true }).click();
  const graf = page.locator('.row--label-right-hover').filter({ hasText: 'Visuel graf over indtægtsniveau' });
  const button = graf.getByRole('button');
  await expect(button).toBeEnabled();
  await graf.scrollIntoViewIfNeeded();
  const screenshotPath = testInfo.outputPath('graf-ferie-desktop.png');
  await page.screenshot({ path: screenshotPath });
  await testInfo.attach('graf-ferie-desktop', { path: screenshotPath, contentType: 'image/png' });
  const downloadPromise = page.waitForEvent('download');
  await button.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = testInfo.outputPath('taf-graf-ferie-og-samme-navn.pdf');
  await download.saveAs(pdfPath);
  const bytes = await readFile(pdfPath);
  expect(bytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  await testInfo.attach('taf-graf-ferie-og-samme-navn', { path: pdfPath, contentType: 'application/pdf' });
  expect(runtimeErrors).toEqual([]);
  expect(runtimeSignals).toEqual([]);
  expect(externalRequests).toEqual([]);
});
