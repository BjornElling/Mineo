// @vitest-environment jsdom
/// <reference types="vitest/globals" />

/**
 * Golden-value-net for tabel-kanal-paritet (#15 TableSpec-udredning).
 *
 * Fastfryser den resolved presentation hver STANDALONE-generator producerer — i BEGGE
 * kanaler — FØR TableSpec-refaktoreringen. Hver migreringsstage skal efterlade disse
 * snapshots byte-uændrede (migreringen kompilerer TableSpec ned til præcis de params
 * `renderDocumentTable` allerede modtager → identitet ved konstruktion).
 *
 * Dækker samlet alle tabel-kapabiliteter: ligelig fordeling, låste kolonner, auto-bredde,
 * min-bredde, tvungen centrering, summeret/formateret totalrække, total-streg (underline),
 * mutede rækker, colSpan, inline-litteral-bredder, dataRowColumnHalign og højre-inset.
 * Grow-kolonne + dynamisk/per-kolonne-inset er låst af `reguleringSection.test.ts` og
 * `pdfTableRenderer.layout.test.ts` (den rene bredde-matematik).
 *
 * PDF: jspdf + jspdf-autotable mockes; hver autoTable-kald fanges som (doc, options) og
 * oversættes til en serialiserbar presentation via `capturePresentation`. Word: rigtig
 * .docx via `renderWordDocument`, hvor `<w:tbl>`-blokkene udtrækkes.
 */

import type { DanishDateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';
import type { EetLoebendeComputation } from '../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import { computeForsoergertabCalculation } from '../../domain/forsoergertab/forsoergertabCalculation';
import { registerPdfWriterFallbackForTest } from '../utils/pdf/registerPdfWriterFallback';
import { renderWordDocument } from '../docx/generators/wordContentHarness';
import {
  capturePresentation,
  extractWordTables,
  type CaptureDoc,
  type CapturedAutoTableOptions,
  type TablePresentation,
} from './tableGoldenCapture';

import { generateKlLoenaftalerDocument } from '../../document/generators/klLoenaftaler/klLoenaftalerDocument';
import { generateKRLDocument } from '../../document/generators/krl/krlDocument';
import { generateAarsloenDocument } from '../../document/generators/aarsloen/aarsloenDocument';
import { generateSHDageDocument } from '../../document/generators/aarsloen/shDageDocument';
import { generateRenteDocument } from '../../document/generators/renteberegning/renteDocument';
import { generateRenteOversigtDocument } from '../../document/generators/renteberegning/renteOversigtDocument';
import { generateLoebendeYdelserDocument } from '../../document/generators/loebendeYdelser/loebendeYdelserDocument';
import { generateReguleringDocument } from '../../document/generators/eo/reguleringDocument';
import { generateForsoergertabDocument } from '../../document/generators/forsoergertab/forsoergertabDocument';

type CapturedCall = { doc: unknown; options: unknown };

// MockJsPDF defineres i vi.hoisted, så klassen findes når jspdf-mock-factoryen kører
// (den kører under de statiske generator-imports, FØR modul-kroppen udføres — en
// top-level `class` ville stadig ligge i temporal dead zone og factoryen ville ellers
// falde tilbage til den ægte jsPDF, der skriver til disk).
const { autoTableMock, captured, MockJsPDF } = vi.hoisted(() => {
  const capturedCalls: CapturedCall[] = [];

  class MockJsPDF {
    static instances: MockJsPDF[] = [];
    internal = { pageSize: { width: 210, height: 297 } };
    lastAutoTable?: { finalY?: number };
    private currentFontName = 'helvetica';
    private currentFontStyle = 'normal';
    private currentFontSize = 8;

    constructor() {
      MockJsPDF.instances.push(this);
    }

    setFont = vi.fn((name: string, style: string) => {
      this.currentFontName = name;
      this.currentFontStyle = style;
    });
    getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
    setFontSize = vi.fn((size: number) => {
      this.currentFontSize = size;
    });
    getFontSize = vi.fn(() => this.currentFontSize);
    setTextColor = vi.fn();
    setDisplayMode = vi.fn();
    setProperties = vi.fn();
    splitTextToSize = vi.fn((text: string) => [text]);
    // Deterministisk måling (samme mønster som aarsloenPdf.tableLayout.test): tal med
    // tusindtalsseparator er bredere pr. tegn. Kun determinisme kræves — snapshottet
    // låser hvad end denne funktion producerer.
    getTextWidth = vi.fn((text: string) => {
      if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(text)) {
        return text.length * 3.2 * (this.currentFontSize / 8);
      }
      return text.length * (this.currentFontStyle === 'bold' ? 0.95 : 0.8) * (this.currentFontSize / 8);
    });
    getNumberOfPages = vi.fn(() => 1);
    setPage = vi.fn();
    text = vi.fn();
    line = vi.fn();
    setLineWidth = vi.fn();
    setDrawColor = vi.fn();
    addPage = vi.fn();
    addImage = vi.fn();
    save = vi.fn();
  }

  return {
    captured: capturedCalls,
    MockJsPDF,
    autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
      doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
      capturedCalls.push({ doc, options });
    }),
  };
});

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({ default: autoTableMock }));

const collectPdfTables = async (run: () => void | Promise<void>): Promise<TablePresentation[]> => {
  captured.length = 0;
  MockJsPDF.instances = [];
  autoTableMock.mockClear();
  await run();
  return captured.map(({ doc, options }) =>
    capturePresentation(doc as CaptureDoc, options as CapturedAutoTableOptions)
  );
};

const collectWordTables = async (run: () => void | Promise<void>): Promise<string[]> => {
  const { documentXml } = await renderWordDocument(run);
  return extractWordTables(documentXml);
};

// Fælles fixtures ----------------------------------------------------------------

const aarsloenParams = {
  satser: { feriePct: 12.5, fritvalgPct: 2, shSoPct: 3, pensionPct: 10 },
  loenperiode: 'maaned' as const,
  tillaegAngivesSom: 'procent' as const,
  tableData: [
    {
      id: 'row-1', col0_maaned: '1', col1_maaned: '2024', col0_uge: '', col1_uge: '',
      col0_dag: undefined, col1_dag: undefined,
      col2: { kind: 'number' as const, value: 11111 }, col3: { kind: 'number' as const, value: 1111 },
      col4: { kind: 'number' as const, value: 111 }, col5: { kind: 'number' as const, value: 11 },
    },
    {
      id: 'row-2', col0_maaned: '2', col1_maaned: '2024', col0_uge: '', col1_uge: '',
      col0_dag: undefined, col1_dag: undefined,
      col2: { kind: 'number' as const, value: 12000 }, col3: undefined, col4: undefined, col5: undefined,
    },
  ],
  beregnetAarsloen: 0,
  omregningTilFuldtAar: false,
  periodeData: null,
  fuldLoenUnderFerie: false,
  retTilSjetteFerieuge: false,
  antalFeriedage: undefined,
  loenPaaHelligdage: 'Ingen' as const,
  shDageAntal: null,
  beregningsData: { metode: 'ingen', erEtAar: false } as never,
  visBrevhoved: false,
};

const loebendeComputation = {
  beregningsdato: toISODateString('2026-03-17'),
  skadedato: toISODateString('2020-01-01'),
  fodselsdato: toISODateString('1980-01-01'),
  skadesaar: 2020,
  aslAarsloenAfrundet1000: 400000,
  maxAarsloenISkadesaar: 600000,
  benyttetAarsloen: 400000,
  grundloenNiveau: '2024',
  grundloen: 320000,
  erstatningsniveauPct: 80,
  amBidragPct: 8,
  reguleringFoer2024Pct: 0,
  // Én syntetisk afgørelse med én periode, så den auto-brede ydelses-tabel (7 kolonner,
  // summeret total, total-streg) faktisk renderes — en tom `afgoerelser` giver kun tekst.
  afgoerelser: [
    {
      rowId: 'a-1',
      afgoerelsesdato: toISODateString('2021-01-01'),
      virkningsdato: toISODateString('2021-01-01'),
      kapitaliseringsdato: null,
      skaeringsDato: null,
      harOverlap: false,
      afgoerelseType: 'Midlertidig',
      eetPct: 50,
      priorKapPct: 0,
      eetPctFoerAktuelKap: 50,
      kapPctAktuel: 0,
      kapPctKumulativ: 0,
      restEetPct: 50,
      harKapitalisering: false,
      harRestSektion: false,
      tilbagevirkendeKraft: false,
      ophoerDato: toISODateString('2022-12-31'),
      ophoerAarsag: 'beregningsdato',
      grundydelseFuld: 200000,
      grundydelseRest: null,
      grundydelse2024Fuld: 210000,
      grundydelse2024Rest: null,
      perioder: [
        {
          fra: toISODateString('2021-01-01'),
          til: toISODateString('2021-12-31'),
          satsAar: 2021,
          maanederPraecis: 12,
          grundydelseAfrundet: 200000,
          reguleringPct: 2,
          maanedligYdelse: 16666,
          beregnetEet: 100000,
        },
        {
          fra: toISODateString('2022-01-01'),
          til: toISODateString('2022-06-30'),
          satsAar: 2022,
          maanederPraecis: 6,
          grundydelseAfrundet: 204000,
          reguleringPct: 3.1,
          maanedligYdelse: 17000,
          beregnetEet: 51000,
        },
      ],
      iAltBeregnetEet: 151000,
    },
  ],
} satisfies EetLoebendeComputation;

const buildForsoergertabParams = () => {
  const asAmount = (v: number) => ({ kind: 'number', value: v } as const);
  const calc = computeForsoergertabCalculation({
    skadedato: toISODateString('2020-05-01'),
    skadelidteFodselsdato: toISODateString('1980-01-01'),
    efterladteFodselsdato: toISODateString('1973-01-01'),
    beregningsdato: toISODateString('2026-03-19'),
    virkningsdato: toISODateString('2025-01-01'),
    koen: 'Kvinde',
    tilkendtForPeriodeAar: 10,
    aslAarsloen: asAmount(450000),
    ealAarsloen: asAmount(450000),
  });
  return {
    grundlaeggende: {
      beregningsdato: toISODateString('2026-03-19'),
      skadelidteFodselsdato: toISODateString('1980-01-01'),
      efterladteFodselsdato: toISODateString('1973-01-01'),
      koen: 'Kvinde' as const,
      visKoenValg: true,
      aslAarsloen: 450000,
      ealAarsloen: 450000,
      virkningsdato: toISODateString('2025-01-01'),
      tilkendtForPeriodeAar: 10,
    },
    result: calc.result,
    ealComputation: calc.ealComputation,
    aslComputation: calc.aslComputation,
    foersoergertabEalMinSats: calc.foersoergertabEalMinSats,
    foersoergertabForhoejtetTilMin: calc.foersoergertabForhoejtetTilMin,
    visBrevhoved: false,
  };
};

const renteParams = {
  amount: 1000,
  interestStartDate: '01-01-2024',
  calculationDate: '30-06-2024',
  periods: [
    {
      startDate: new Date(toISODateString('2024-01-01')),
      endDate: new Date(toISODateString('2024-03-31')),
      amount: 1000,
      referenceRatePct: 4.25,
      surchargeRatePct: 8,
      totalRatePct: 12.25,
      days: 90,
      interest: 30.21,
    },
    {
      startDate: new Date(toISODateString('2024-04-01')),
      endDate: new Date(toISODateString('2024-06-30')),
      amount: 1000,
      referenceRatePct: 4.55,
      surchargeRatePct: 8,
      totalRatePct: 12.55,
      days: 91,
      interest: 31.29,
    },
  ],
};

const reguleringParams = {
  overenskomstLabel: '',
  loenudviklingBasis: 'Statistik' as const,
  overenskomstId: undefined,
  statistikModelLabel: 'ASL-årslønsmaksimum',
  interval: { fraDato: '01-01-2020' as DanishDateString, tilDato: '31-12-2024' as DanishDateString },
  applyAlmindeligLoenPaaShDageRegel: false,
  visBrevhoved: false,
};

const shDagePerioder = [{ start: new Date(Date.UTC(2024, 0, 1)), end: new Date(Date.UTC(2024, 11, 31)) }];

// Hver generator: PDF resolved presentation OG Word-tabel-XML skal være uændret.
const cases: ReadonlyArray<Readonly<{ name: string; run: () => void }>> = [
  { name: 'klLoenaftaler (ligelig fordeling, centreret)', run: () => generateKlLoenaftalerDocument({ visBrevhoved: false }) },
  { name: 'KRL (låste kolonner, tvungen centrering)', run: () => generateKRLDocument({ visBrevhoved: false }) },
  { name: 'aarsloen (fordelt + formateret total + colSpan + underline)', run: () => generateAarsloenDocument(aarsloenParams) },
  { name: 'shDage (fordelt/låst + summeret total + mutede rækker + underline)', run: () => generateSHDageDocument(shDagePerioder, { visBrevhoved: false }) },
  { name: 'renteOversigt (låste kolonner + summeret total + underline)', run: () => generateRenteOversigtDocument(toISODateString('2024-02-01'), [{ beloeb: 1250, renterFra: toISODateString('2024-01-11'), beregnetRente: 2.25 }, { beloeb: 3400, renterFra: toISODateString('2024-01-20'), beregnetRente: 5.5 }]) },
  { name: 'rente (låst + fixed-inset + dataRowColumnHalign + total + underline)', run: () => generateRenteDocument(renteParams.amount, renteParams.interestStartDate, renteParams.calculationDate, renteParams.periods, { visBrevhoved: false, kommentarer: 'Standalone' }) },
  { name: 'loebendeYdelser (auto-bredde + summeret total + underline)', run: () => generateLoebendeYdelserDocument({ computation: loebendeComputation, visUdvidetSpecifikation: true, visBrevhoved: false }) },
  { name: 'regulering (min-bredde + tvungen centrering)', run: () => generateReguleringDocument(reguleringParams) },
  { name: 'forsoergertab (inline-litteral bredder)', run: () => generateForsoergertabDocument(buildForsoergertabParams()) },
];

describe('tabel-kanal-paritet: PDF resolved presentation (golden)', () => {
  beforeEach(async () => {
    await registerPdfWriterFallbackForTest();
  });

  for (const { name, run } of cases) {
    it(`${name} → uændret PDF-presentation`, async () => {
      const presentations = await collectPdfTables(run);
      expect(presentations.length).toBeGreaterThan(0);
      expect(presentations).toMatchSnapshot();
    }, 15000);
  }
});

describe('tabel-kanal-paritet: Word document.xml (golden)', () => {
  for (const { name, run } of cases) {
    it(`${name} → uændret Word-tabel-XML`, async () => {
      const tables = await collectWordTables(run);
      expect(tables.length).toBeGreaterThan(0);
      expect(tables).toMatchSnapshot();
    }, 15000);
  }
});
