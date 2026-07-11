// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/engines/tafPerYearDerived';
import {
  buildTafPerYearOpreguleretBuildOutcome,
  type TafPerYearOpreguleretResult,
} from '../../../domain/erstatningsopgoerelse/engines/tafPerYearOpreguleretDerived';
import { moneyOre, type MoneyOre } from '../../../domain/money/money';
import type { TafPerYearOpreguleretDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearOpreguleretDocument';
import { toISODateString } from '../../../types/branded';
import { createPdfDocumentSessionForTest } from './createPdfDocumentSession';

let pdfSession: Awaited<ReturnType<typeof createPdfDocumentSessionForTest>>;

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
    sygeferiegodtgoerelse: { perAnsaettelsesforhold: [], totalOre: moneyOre(0), perYear: [] },
    tabtArbejdsfortjenesteFoerForligOre: moneyOre(0),
    tabtArbejdsfortjenesteOre: moneyOre(0),
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
      unitAmountOre: moneyOre(200000),
      deltaPct: 0,
      amountOre: moneyOre(50000000),
    },
  ],
  deductions: [
    { label: 'Sygedagpenge', amountOre: moneyOre(12500000) },
  ],
  yearIncomeOre: moneyOre(50000000),
  yearDeductionsOre: moneyOre(12500000),
  yearTidligereModtagetTafOre: moneyOre(0),
  yearTafFoerForligOre: amountOre,
  yearTafOre: amountOre,
  ...overrides,
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

const loadGenerator = async () => {
  const mod = await import('../../../document/generators/tafFordelt/tafOpreguleretPaaAarDocument');
  return mod.generateTafOpreguleretPaaAarDocument;
};

const lastInstance = () => MockJsPDF.instances.at(-1);
const textsOf = (instance = lastInstance()) => (instance?.recorded ?? []).map((entry) => entry.text);

describe('tafOpreguleretPaaAarPdf wiring', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  let generate: Awaited<ReturnType<typeof loadGenerator>>;

  beforeAll(async () => {
    generate = await loadGenerator();
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it('kræver et præ-projiceret dokument', async () => {
    expect(() => generate(pdfSession, undefined as never)).toThrow();
  }, 15_000);

  it('renderer opreguleret TAF-dokumentets hovedindhold og metadata', async () => {
    const artifact = await generate(pdfSession, { document: FAKE_DOCUMENT });
    const recorded = lastInstance()?.recorded ?? [];
    const texts = recorded.map((e) => e.text);
    const normalized = texts.map((t) => t.replace(/\s/g, ' '));

    expect(recorded.some((e) => e.text === '2024' && e.style === 'bold')).toBe(true);
    expect(recorded.some((e) => e.text === '2025' && e.style === 'bold')).toBe(true);
    for (const heading of ['Forventet indkomst', 'Indtægter i erstatningsperioden', 'Beregnet krav', 'Opreguleret til beregningsåret']) {
      expect(recorded.some((e) => e.text === heading && e.underlined)).toBe(true);
    }
    // 500.000,00 - 125.000,00 kr. =
    expect(recorded.some((e) => e.text.includes('500.000,00 - 125.000,00') && e.text.includes('kr.') && e.text.trim().endsWith('='))).toBe(true);
    // Beregnet-krav-beløbet skal IKKE være fed (kun den efterfølgende opregulerings-linje).
    const beregnetKravBeloeb = recorded.find((e) => e.text.replace(/\s/g, ' ') === '375.000,00 kr.');
    expect(beregnetKravBeloeb?.style).toBe('normal');
    expect(texts.some((t) => t.startsWith('Opreguleret til 2026-værdi (100 % + 5,1234 %)'))).toBe(true);
    expect(texts).toContain('Samlet TAF opreguleret til 2026');
    // Opregulerings-beløbet er fed.
    const opreguleretBeloeb = recorded.find((e) => e.text.replace(/\s/g, ' ') === '394.212,75 kr.');
    expect(opreguleretBeloeb?.style).toBe('bold');
    // Beløbslinjen bruger non-breaking space før "kr."; sammenlign mellemrumsuafhængigt.
    expect(normalized).toContain('778.842,00 kr.');
    // Ingen bilag-side-titler (de starter en ny side via addPage + writeTitle)
    expect(texts).not.toContain('Sygeferiegodtgørelse');
    expect(artifact.filename).toBe('TAF opreguleret til beregningsår.pdf');
  });

  it('viser og beregner opreguleringslinjen med fire-decimalers faktor fra beregningsmotoren', () => {
    const baseTafOre = moneyOre(28776300);
    const presentation: TafPerYearResult = {
      ...FAKE_PRESENTATION,
      years: [makeYearEntry(2024, baseTafOre)],
      sumYearTafOre: baseTafOre,
      samletTafKravOre: baseTafOre,
    };
    const outcome = buildTafPerYearOpreguleretBuildOutcome(presentation, toISODateString('2026-03-01'));
    expect(outcome.kind).toBe('ok');
    if (outcome.kind !== 'ok') return;

    expect(outcome.result.years[0]?.deltaPct).toBe(8.8872);
    expect(outcome.result.years[0]?.yearTafOpreguleretOre).toBe(31333707);

    generate(pdfSession, {
      document: {
        model: FAKE_MODEL as never,
        presentation,
        opreguleret: outcome.result,
      },
    });

    const recorded = lastInstance()?.recorded ?? [];
    const normalized = recorded.map((entry) => entry.text.replace(/\s/g, ' '));
    expect(normalized).toContain('Opreguleret til 2026-værdi (100 % + 8,8872 %) =');
    expect(normalized).toContain('313.337,07 kr.');
    expect(normalized).not.toContain('Opreguleret til 2026-værdi (100 % + 8,89 %) =');
    expect(normalized).not.toContain('313.345,13 kr.');
  });

  it('viser "Ingen" når der ikke er TAF-perioder', () => {
    generate(pdfSession, {
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

  it('forlig-faktor pakker beregnet-krav-udregningen ind', () => {
    generate(pdfSession, {
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

  it('viser indtægterne i beregnet-krav-formlen som ÉN sammentalt fradragsværdi — ikke pr. post', () => {
    // To fradrag (444,28 + 236.926,00 = 237.370,28). Formlen skal vise totalen, ikke de
    // enkelte poster — ensartet med den almindelige erstatningsopgørelse.
    const yearMedFlereFradrag = makeYearEntry(2024, moneyOre(26716669), {
      segments: [
        {
          fra: toISODateString('2024-01-02'),
          til: toISODateString('2024-12-31'),
          kind: 'arbejdsdage' as const,
          quantity: 250,
          sourceLabel: 'Løn',
          unitAmountOre: moneyOre(205814),
          deltaPct: 0,
          amountOre: moneyOre(51453697),
        },
      ],
      deductions: [
        { label: 'Feriepenge', amountOre: moneyOre(44428) },
        { label: 'Sygedagpenge', amountOre: moneyOre(23692600) },
      ],
      yearIncomeOre: moneyOre(51453697),
      yearDeductionsOre: moneyOre(23737028),
    });
    generate(pdfSession, {
      document: {
        model: FAKE_MODEL as never,
        presentation: {
          ...FAKE_PRESENTATION,
          years: [yearMedFlereFradrag],
        },
        opreguleret: FAKE_OPREGULERET,
      },
    });
    const recorded = lastInstance()?.recorded ?? [];
    const beregnetKravIndex = recorded.findIndex((e) => e.text === 'Beregnet krav' && e.underlined);
    expect(beregnetKravIndex).toBeGreaterThanOrEqual(0);
    const formelLinje = recorded[beregnetKravIndex + 1]?.text ?? '';
    // Summen vises som ét fradrag; de enkelte poster optræder ikke i formlen.
    expect(formelLinje).toContain('514.536,97 - 237.370,28');
    expect(formelLinje).not.toContain('444,28');
    expect(formelLinje.split('=')[0]?.match(/ - /g)?.length ?? 0).toBe(1);
  });
});
