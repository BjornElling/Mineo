/// <reference types="vitest/globals" />

import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import type { TafPerYearOpreguleretResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { TafPerYearOpreguleretPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretPdfDocument';
import { toISODateString } from '../../../types/branded';

type Style = 'normal' | 'bold';

interface RecordedText {
  text: string;
  style: Style;
  underlined: boolean;
}

class MockJsPDF {
  static instances: MockJsPDF[] = [];
  internal = { pageSize: { width: 210, height: 297 } };
  // Rå hændelseslog: hver text()/line() i kaldsrækkefølge. Bruges til at udlede
  // hvilke tekster der blev understreget (writeUnderlinedSubheader kalder text()
  // umiddelbart efterfulgt af line()).
  private events: Array<{ kind: 'text'; value: string; style: Style } | { kind: 'line' }> = [];
  private currentFontStyle: Style = 'normal';
  constructor() {
    MockJsPDF.instances.push(this);
  }
  setFont = vi.fn((_name: string, style: string) => {
    this.currentFontStyle = (style === 'bold' ? 'bold' : 'normal');
  });
  getFont = vi.fn(() => ({ fontName: 'helvetica', fontStyle: this.currentFontStyle }));
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((t: string) => [t]);
  getTextWidth = vi.fn((t: string) => t.length);
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn(() => { this.events.push({ kind: 'line' }); });
  setLineWidth = vi.fn();
  addPage = vi.fn();
  save = vi.fn();
  text = vi.fn((value: string) => {
    this.events.push({ kind: 'text', value, style: this.currentFontStyle });
  });

  get recorded(): RecordedText[] {
    return this.events.flatMap((event, index) => {
      if (event.kind !== 'text') return [];
      const next = this.events[index + 1];
      return [{ text: event.value, style: event.style, underlined: next?.kind === 'line' }];
    });
  }
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

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

const makeYearEntry = (
  year: number,
  amountOre: MoneyOre,
  overrides: Partial<TafPerYearResult['years'][number]> = {}
): TafPerYearResult['years'][number] => ({
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
  deductions: [
    { label: 'Sygedagpenge', amountOre: 12500000 as MoneyOre },
  ],
  yearIncomeOre: 50000000 as MoneyOre,
  yearDeductionsOre: 12500000 as MoneyOre,
  yearTafFoerForligOre: amountOre,
  yearTafOre: amountOre,
  ...overrides,
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
    { year: 2024, yearTafOre: 37500000 as MoneyOre, deltaPct: 5, yearTafOpreguleretOre: 39375000 as MoneyOre },
    { year: 2025, yearTafOre: 37500000 as MoneyOre, deltaPct: 2.5, yearTafOpreguleretOre: 38437500 as MoneyOre },
  ],
  sumOpreguleretOre: 77812500 as MoneyOre,
};

const FAKE_DOCUMENT: TafPerYearOpreguleretPdfDocument = {
  model: FAKE_MODEL as never,
  presentation: FAKE_PRESENTATION,
  opreguleret: FAKE_OPREGULERET,
};

const loadGenerator = async () => {
  const mod = await import('../../../pdf/domains/tafFordelt/tafOpreguleretPaaAarPdf');
  return mod.generateTafOpreguleretPaaAarPdf;
};

const lastInstance = () => MockJsPDF.instances.at(-1);
const textsOf = (instance = lastInstance()) => (instance?.recorded ?? []).map((entry) => entry.text);

describe('tafOpreguleretPaaAarPdf wiring', () => {
  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('kræver et præ-projiceret dokument', async () => {
    const generate = await loadGenerator();
    expect(() => generate(undefined as never)).toThrow();
  });

  it('viser årstal som fed underoverskrift', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    const recorded = lastInstance()?.recorded ?? [];
    expect(recorded.some((e) => e.text === '2024' && e.style === 'bold')).toBe(true);
    expect(recorded.some((e) => e.text === '2025' && e.style === 'bold')).toBe(true);
  });

  it('viser per-år underafsnit som understregede underoverskrifter', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    const recorded = lastInstance()?.recorded ?? [];
    for (const heading of ['Forventet indkomst', 'Indtægter i erstatningsperioden', 'Beregnet krav', 'Opreguleret til beregningsåret']) {
      expect(recorded.some((e) => e.text === heading && e.underlined)).toBe(true);
    }
  });

  it('viser fuld udregningslinje under "Beregnet krav" pr. år', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    const recorded = lastInstance()?.recorded ?? [];
    // 500.000,00 - 125.000,00 kr. =
    expect(recorded.some((e) => e.text.includes('500.000,00 - 125.000,00') && e.text.includes('kr.') && e.text.trim().endsWith('='))).toBe(true);
    // Beregnet-krav-beløbet skal IKKE være fed (kun den efterfølgende opregulerings-linje).
    const beregnetKravBeloeb = recorded.find((e) => e.text.replace(/\s/g, ' ') === '375.000,00 kr.');
    expect(beregnetKravBeloeb?.style).toBe('normal');
  });

  it('viser opregulerings-linje med beregningsåret (beløb i fed)', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    const recorded = lastInstance()?.recorded ?? [];
    const texts = recorded.map((e) => e.text);
    expect(texts.some((t) => t.startsWith('Opreguleret til 2026'))).toBe(true);
    expect(texts).toContain('Samlet TAF opreguleret til 2026');
    // Opregulerings-beløbet er fed.
    const opreguleretBeloeb = recorded.find((e) => e.text.replace(/\s/g, ' ') === '393.750,00 kr.');
    expect(opreguleretBeloeb?.style).toBe('bold');
  });

  it('viser samlet opreguleret beløb', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    // Beløbslinjen bruger non-breaking space før "kr."; sammenlign mellemrumsuafhængigt.
    const normalized = textsOf().map((t) => t.replace(/\s/g, ' '));
    expect(normalized).toContain('778.125,00 kr.');
  });

  it('viser "Ingen" når der ikke er TAF-perioder', async () => {
    const generate = await loadGenerator();
    generate({
      document: {
        model: {
          ...FAKE_MODEL,
          tabtArbejdsfortjeneste: {
            ...FAKE_MODEL.tabtArbejdsfortjeneste,
            statusLinjer: [],
            harTafPerioder: false,
            tafPerioderLinjer: [],
          },
        } as never,
        presentation: null,
        opreguleret: null,
      },
    });
    const texts = textsOf();
    expect(texts).not.toContain('Status');
    expect(texts).toContain('TAF opreguleret til beregningsåret');
    expect(texts.filter((t) => t === 'Ingen')).toHaveLength(2);
  });

  it('udelader bilag når selectedElements ikke gives', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    // Ingen bilag-side-titler (de starter en ny side via addPage + writeTitle)
    expect(textsOf()).not.toContain('Sygeferiegodtgørelse');
  });

  it('gemmer PDF med korrekt filnavn', async () => {
    const generate = await loadGenerator();
    generate({ document: FAKE_DOCUMENT });
    expect(lastInstance()?.save).toHaveBeenCalledWith('TAF opreguleret til beregningsår.pdf');
  });

  it('forlig-faktor pakker beregnet-krav-udregningen ind', async () => {
    const generate = await loadGenerator();
    generate({
      document: {
        model: {
          ...FAKE_MODEL,
          forlig: { erIndgaaet: true, label: '50%', dato: toISODateString('2024-04-01'), factor: 0.5 },
        } as never,
        presentation: FAKE_PRESENTATION,
        opreguleret: FAKE_OPREGULERET,
      },
    });
    const texts = textsOf();
    expect(texts.some((t) => t.startsWith('50% x ('))).toBe(true);
  });
});
