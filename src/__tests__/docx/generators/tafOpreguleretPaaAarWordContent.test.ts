// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { TafPerYearOpreguleretResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import { moneyOre, type MoneyOre } from '../../../domain/money/money';
import type { TafPerYearOpreguleretDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import { generateTafOpreguleretPaaAarDocument } from '../../../document/generators/tafFordelt/tafOpreguleretPaaAarDocument';
import { toISODateString } from '../../../types/branded';
import { renderWordDocument, xmlToPlainText } from './wordContentHarness';

// Word-indholdstest for TAF opreguleret til beregningsåret: kører den RIGTIGE
// generator gennem Word-backenden med et præ-projiceret dokument (mineret fra
// wiring-testen) og verificerer, at opregulerings-indholdet når .docx'en.
const FAKE_MODEL = {
  brevhoved: null,
  titel: 'TAF opreguleret til beregningsår',
  periodeDisplay: '01-01-2024 - 31-12-2025',
  skadelidteNavn: 'Test Person',
  skadestypeLinje: 'Arbejdsulykke den 1. januar 2024',
  forlig: { erIndgaaet: false, label: null, dato: null, factor: null },
  tafRanges: [],
  tabtArbejdsfortjeneste: {
    beregnes: true,
    skjul: false,
    statusLinjer: ['Status: aktiv'],
    eetLinjer: [],
    differencekravLinje: null,
    ferieFravaerLinje: null,
    harTafPerioder: true,
    tafPerioderLinjer: ['01-01-2024 - 31-12-2025'],
    tafBeregningsenhed: 'Arbejdsdage',
    skalKomprimereIndkomstBeregning: false,
    indkomstSkadestidspunkt: null,
    loenudvikling: null,
    offentligeYdelserUdvikling: null,
    tafIndtaegter: null,
    tidligereModtagetTaf: { status: 'not_calculable', reason: 'x' },
    sygeferiegodtgoerelse: { perAnsaettelsesforhold: [], totalOre: moneyOre(0), perYear: [] },
    tabtArbejdsfortjenesteFoerForligOre: moneyOre(0),
    tabtArbejdsfortjenesteOre: moneyOre(0),
  },
};

const makeYearEntry = (year: number, amountOre: MoneyOre): TafPerYearResult['years'][number] => ({
  year,
  segments: [
    {
      fra: toISODateString(`${year}-01-02`),
      til: toISODateString(`${year}-12-31`),
      kind: 'arbejdsdage',
      quantity: 250,
      sourceLabel: 'Løn',
      unitAmountOre: moneyOre(200000),
      deltaPct: 0,
      amountOre: moneyOre(50000000),
    },
  ],
  deductions: [{ label: 'Sygedagpenge', amountOre: moneyOre(12500000) }],
  yearIncomeOre: moneyOre(50000000),
  yearDeductionsOre: moneyOre(12500000),
  yearTidligereModtagetTafOre: moneyOre(0),
  yearTafFoerForligOre: amountOre,
  yearTafOre: amountOre,
});

const FAKE_PRESENTATION: TafPerYearResult = {
  years: [makeYearEntry(2024, moneyOre(37500000)), makeYearEntry(2025, moneyOre(37500000))],
  sumYearTafOre: moneyOre(75000000),
  afrundingOre: moneyOre(0),
  samletTafKravOre: moneyOre(75000000),
};

const FAKE_OPREGULERET: TafPerYearOpreguleretResult = {
  beregningsAar: 2026,
  years: [
    { year: 2024, yearTafOre: moneyOre(37500000), deltaPct: 5.1234, yearTafOpreguleretOre: moneyOre(39421275) },
    { year: 2025, yearTafOre: moneyOre(37500000), deltaPct: 2.5678, yearTafOpreguleretOre: moneyOre(38462925) },
  ],
  sumOpreguleretOre: moneyOre(77884200),
};

const FAKE_DOCUMENT: TafPerYearOpreguleretDocument = {
  model: FAKE_MODEL as never,
  presentation: FAKE_PRESENTATION,
  opreguleret: FAKE_OPREGULERET,
};

describe('tafOpreguleretPaaAar → Word-indhold', () => {
  it('skriver opregulerings-indhold og samlet total til .docx', async () => {
    const { filename, documentXml } = await renderWordDocument(() => {
      generateTafOpreguleretPaaAarDocument({ document: FAKE_DOCUMENT });
    });

    const text = xmlToPlainText(documentXml);
    expect(filename).toMatch(/\.docx$/);
    expect(text).toContain('2024');
    expect(text).toContain('2025');
    expect(text).toContain('Opreguleret til beregningsåret');
    expect(text).toContain('Opreguleret til 2026-værdi (100 % + 5,1234 %)');
    expect(text).toContain('Samlet TAF opreguleret til 2026');
  });
});
