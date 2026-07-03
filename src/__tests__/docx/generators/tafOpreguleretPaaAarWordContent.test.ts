// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { TafPerYearOpreguleretResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
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
    sygeferiegodtgoerelse: { perAnsaettelsesforhold: [], totalOre: 0, perYear: [] },
    tabtArbejdsfortjenesteFoerForligOre: 0,
    tabtArbejdsfortjenesteOre: 0,
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
      unitAmountOre: 200000 as MoneyOre,
      deltaPct: 0,
      amountOre: 50000000 as MoneyOre,
    },
  ],
  deductions: [{ label: 'Sygedagpenge', amountOre: 12500000 as MoneyOre }],
  yearIncomeOre: 50000000 as MoneyOre,
  yearDeductionsOre: 12500000 as MoneyOre,
  yearTidligereModtagetTafOre: 0 as MoneyOre,
  yearTafFoerForligOre: amountOre,
  yearTafOre: amountOre,
});

const FAKE_PRESENTATION: TafPerYearResult = {
  years: [makeYearEntry(2024, 37500000 as MoneyOre), makeYearEntry(2025, 37500000 as MoneyOre)],
  sumYearTafOre: 75000000 as MoneyOre,
  afrundingOre: 0 as MoneyOre,
  samletTafKravOre: 75000000 as MoneyOre,
};

const FAKE_OPREGULERET: TafPerYearOpreguleretResult = {
  beregningsAar: 2026,
  years: [
    { year: 2024, yearTafOre: 37500000 as MoneyOre, deltaPct: 5.1234, yearTafOpreguleretOre: 39421275 as MoneyOre },
    { year: 2025, yearTafOre: 37500000 as MoneyOre, deltaPct: 2.5678, yearTafOpreguleretOre: 38462925 as MoneyOre },
  ],
  sumOpreguleretOre: 77884200 as MoneyOre,
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
