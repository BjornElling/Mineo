// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { toISODateString } from '../../../types/branded';
import { createPdfDocumentSessionForTest } from './createPdfDocumentSession';

let pdfSession: Awaited<ReturnType<typeof createPdfDocumentSessionForTest>>;

// Wiring-test for forsørgertab-PDF'en: verificerer at de betingede sektioner (EAL/ASL)
// kun bygges når den tilhørende delberegning er sat, så et manglende delgrundlag
// ikke fremtvinger en tom side eller en sektion uden indhold i et tillidskritisk dokument.
// Samme test dækker sidebruddene: kun ÉN ydelsesdel hører på samme side som de grundlæggende
// oplysninger, mens to dele får hver sin side.
class MockJsPDF {
  static instances: MockJsPDF[] = [];
  internal = { pageSize: { width: 210, height: 297 } };
  text = vi.fn();
  private currentFontName = 'helvetica';
  private currentFontStyle = 'normal';
  constructor() {
    MockJsPDF.instances.push(this);
  }
  setFont = vi.fn((name: string, style: string) => {
    this.currentFontName = name;
    this.currentFontStyle = style;
  });
  getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((t: string) => [t]);
  getTextWidth = vi.fn((t: string) => t.length);
  getFontSize = vi.fn(() => 8);
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  setDrawColor = vi.fn();
  addImage = vi.fn();
  addPage = vi.fn();
  save = vi.fn();
  lastAutoTable?: { finalY?: number };
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

// Tabelplugin'et mockes: testen måler sidebrud og sektionsvalg, ikke tabellayout, og den ægte
// autotable kræver et fuldt jsPDF-dokument. Kanalens tabelpræsentation er dækket af
// tableChannelParity-golden'en.
vi.mock('jspdf-autotable', () => ({
  default: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  }),
}));

const BASE_GRUNDLAEGGENDE = {
  beregningsdato: toISODateString('2026-03-17'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  skadedato: toISODateString('2020-05-01'),
  skadestype: 'Arbejdsulykke' as const,
  efterladteFodselsdato: undefined,
  koen: undefined,
  visKoenValg: false,
  aslAarsloen: undefined,
  ealAarsloen: undefined,
  virkningsdato: undefined,
  tilkendtForPeriodeAar: undefined,
};

const FULD_GRUNDLAEGGENDE = {
  ...BASE_GRUNDLAEGGENDE,
  beregningsdato: toISODateString('2026-03-19'),
  efterladteFodselsdato: toISODateString('1973-01-01'),
  aslAarsloen: 450000,
  ealAarsloen: 450000,
  virkningsdato: toISODateString('2025-01-01'),
  tilkendtForPeriodeAar: 10,
};

// Delberegningerne kommer fra den RIGTIGE domæneberegning, så sidebruddene måles på det
// indhold, generatoren faktisk får – ikke på et hånd-cast objekt.
const buildCalculation = async () => {
  const { computeForsoergertabCalculation } = await import(
    '../../../domain/forsoergertab/forsoergertabCalculation'
  );
  return computeForsoergertabCalculation({
    ealBlocked: false,
    aslBlocked: false,
    skadedato: toISODateString('2020-05-01'),
    skadestype: 'Arbejdsulykke',
    skadelidteFodselsdato: toISODateString('1980-01-01'),
    efterladteFodselsdato: toISODateString('1973-01-01'),
    beregningsdato: toISODateString('2026-03-19'),
    virkningsdato: toISODateString('2025-01-01'),
    koen: undefined,
    tilkendtForPeriodeAar: 10,
    aslAarsloen: { kind: 'number', value: 450000 },
    ealAarsloen: { kind: 'number', value: 450000 },
  });
};

// Generatoren importeres dynamisk inde i testene, så jspdf-mocken (med MockJsPDF)
// er fuldt initialiseret før modulgrafen indlæses. Eksplicit timeout, fordi den
// første dynamiske import af modulgrafen kan være tung under parallel kørsel.
const importGenerator = () => import('../../../document/generators/forsoergertab/forsoergertabDocument');

const renderedTextOf = (instance: MockJsPDF | undefined): unknown[] =>
  (instance?.text.mock.calls ?? []).map((call) => call[0]);

describe('forsoergertabPdf wiring', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
  });

  it(
    'bygger hverken EAL- eller ASL-side når begge delberegninger er null',
    async () => {
      const { generateForsoergertabDocument } = await importGenerator();

      await generateForsoergertabDocument(pdfSession, {
        grundlaeggende: BASE_GRUNDLAEGGENDE,
        result: null,
        ealComputation: null,
        aslComputation: null,
        foersoergertabEalMinSatsOre: null,
        foersoergertabForhoejtetTilMin: false,
        visBrevhoved: false,
      });

      const instance = MockJsPDF.instances.at(-1);
      const text = renderedTextOf(instance);

      expect(text).toContain('Forsørgertab');
      expect(text).not.toContain('EAL-krav');
      expect(text).not.toContain('ASL-ydelser');
      // Ingen ekstra sider når begge delberegninger mangler.
      expect(instance?.addPage).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'samler hele specifikationen på én side når kun EAL-delen er beregnet',
    async () => {
      const { generateForsoergertabDocument } = await importGenerator();
      const calc = await buildCalculation();

      await generateForsoergertabDocument(pdfSession, {
        grundlaeggende: FULD_GRUNDLAEGGENDE,
        result: null,
        ealComputation: calc.ealComputation,
        aslComputation: null,
        foersoergertabEalMinSatsOre: calc.foersoergertabEalMinSatsOre,
        foersoergertabForhoejtetTilMin: calc.foersoergertabForhoejtetTilMin,
        visBrevhoved: false,
      });

      const instance = MockJsPDF.instances.at(-1);
      expect(renderedTextOf(instance)).toContain('EAL-krav');
      expect(instance?.addPage).not.toHaveBeenCalled();
    },
    20000
  );

  it(
    'giver EAL- og ASL-delen hver sin side når begge er beregnet',
    async () => {
      const { generateForsoergertabDocument } = await importGenerator();
      const calc = await buildCalculation();

      await generateForsoergertabDocument(pdfSession, {
        grundlaeggende: FULD_GRUNDLAEGGENDE,
        result: calc.result,
        ealComputation: calc.ealComputation,
        aslComputation: calc.aslComputation,
        foersoergertabEalMinSatsOre: calc.foersoergertabEalMinSatsOre,
        foersoergertabForhoejtetTilMin: calc.foersoergertabForhoejtetTilMin,
        visBrevhoved: false,
      });

      const instance = MockJsPDF.instances.at(-1);
      const text = renderedTextOf(instance);
      expect(text).toContain('EAL-krav');
      expect(text).toContain('ASL-ydelser');
      expect(instance?.addPage).toHaveBeenCalledTimes(2);
    },
    20000
  );

  it(
    'gemmer en PDF med korrekt filendelse',
    async () => {
      const { generateForsoergertabDocument } = await importGenerator();

      const artifact = await generateForsoergertabDocument(pdfSession, {
        grundlaeggende: BASE_GRUNDLAEGGENDE,
        result: null,
        ealComputation: null,
        aslComputation: null,
        foersoergertabEalMinSatsOre: null,
        foersoergertabForhoejtetTilMin: false,
        visBrevhoved: false,
      });

      expect(artifact.filename).toMatch(/\.pdf$/);
    },
    20000
  );
});
