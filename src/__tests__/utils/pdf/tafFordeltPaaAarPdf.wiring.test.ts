/// <reference types="vitest/globals" />
/**
 * Wiring-test: verificerer at tafFordeltPaaAarPdf.ts
 * bruger EO-snapshot som eneste entry til model + årsfordeling
 * og ikke genberegner TAF-krav selvstændigt i PDF-laget.
 */

import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/tafPerYearDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/eoPdfModel';
import type { EoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';

// ─── Mocks ──────────────────────────────────────────────────────────────

const {
  computeEoSnapshotMock,
  eoSnapshotToTafPerYearPdfDocumentMock,
} = vi.hoisted(() => ({
  computeEoSnapshotMock: vi.fn(),
  eoSnapshotToTafPerYearPdfDocumentMock: vi.fn(),
}));

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
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  addPage = vi.fn();
  save = vi.fn();
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

vi.mock('../../../domain/erstatningsopgoerelse/eoSnapshot', () => ({
  computeEoSnapshot: computeEoSnapshotMock,
}));

vi.mock('../../../domain/erstatningsopgoerelse/eoSnapshotToTafPerYearPdfDocument', () => ({
  eoSnapshotToTafPerYearPdfDocument: eoSnapshotToTafPerYearPdfDocumentMock,
}));

// ─── Fixtures ───────────────────────────────────────────────────────────

const FAKE_MODEL = {
  brevhoved: null,
  periodeDisplay: '01-01-2024 - 31-12-2024',
  skadelidteNavn: 'Test Person',
  skadestypeLinje: 'Arbejdsulykke den 1. januar 2024',
  forlig: { erIndgaaet: false, label: null, dato: null, factor: null },
  tabtArbejdsfortjeneste: {
    statusLinjer: ['Status: aktiv'],
    eetLinjer: [],
    differencekravLinje: null,
    harTafPerioder: true,
    tafPerioderLinjer: ['01-01-2024 - 31-12-2024'],
  },
};

const FAKE_RESULT: TafPerYearResult = {
  years: [
    {
      year: 2024,
      segments: [
        {
          fra: '2024-01-02' as any,
          til: '2024-12-31' as any,
          kind: 'arbejdsdage',
          quantity: 250,
          unitAmountOre: 200000 as MoneyOre,
          deltaPct: 0,
          amountOre: 50000000 as MoneyOre,
        },
      ],
      deductions: [
        { label: 'Sygedagpenge', amountOre: 10000000 as MoneyOre },
        { label: 'Allerede betalt TAF', amountOre: 2500000 as MoneyOre },
      ],
      yearIncomeOre: 50000000 as MoneyOre,
      yearDeductionsOre: 12500000 as MoneyOre,
      yearTafFoerForligOre: 37500000 as MoneyOre,
      yearTafOre: 37500000 as MoneyOre,
    },
  ],
  sumYearTafOre: 37500000 as MoneyOre,
  afrundingOre: 0 as MoneyOre,
  samletTafKravOre: 37500000 as MoneyOre,
};

const FAKE_SNAPSHOT = {
  revision: 'rev-1',
  status: 'ok',
  invariants: [],
  data: {
    engines: {
      tafPerYear: FAKE_RESULT,
    },
  },
} as unknown as EoSnapshot;

const FAKE_DOCUMENT = {
  model: FAKE_MODEL,
  presentation: FAKE_RESULT,
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe('tafFordeltPaaAarPdf wiring', () => {
  beforeEach(() => {
    MockJsPDF.instances = [];
    computeEoSnapshotMock.mockReset();
    eoSnapshotToTafPerYearPdfDocumentMock.mockReset();
    computeEoSnapshotMock.mockReturnValue(FAKE_SNAPSHOT);
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({
      kind: 'ok',
      document: FAKE_DOCUMENT,
    });
  });

  it('kalder snapshot-entry og TAF-per-år-projektion med inputtet', async () => {
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    const stamdata = {} as any;
    const eoValues = {} as any;
    generateTafFordeltPaaAarPdf(stamdata, eoValues);

    expect(computeEoSnapshotMock).toHaveBeenCalledTimes(1);
    expect(computeEoSnapshotMock).toHaveBeenCalledWith(expect.objectContaining({
      stamdataValues: stamdata,
      eoValues,
      dagsDatoISO: expect.any(String),
    }));

    expect(eoSnapshotToTafPerYearPdfDocumentMock).toHaveBeenCalledTimes(1);
    expect(eoSnapshotToTafPerYearPdfDocumentMock).toHaveBeenCalledWith(FAKE_SNAPSHOT);
  });

  it('genbruger givet dokument og genberegner ikke i PDF-generatoren', async () => {
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any, { document: FAKE_DOCUMENT });

    expect(computeEoSnapshotMock).not.toHaveBeenCalled();
    expect(eoSnapshotToTafPerYearPdfDocumentMock).not.toHaveBeenCalled();
  });

  it('kaster ikke fejl når snapshot-projektionen returnerer null-presentation', async () => {
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({
      kind: 'ok',
      document: {
        model: FAKE_MODEL,
        presentation: null,
      },
    });

    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    expect(() => generateTafFordeltPaaAarPdf({} as any, {} as any)).not.toThrow();
  });

  it('gemmer PDF med korrekt filnavn', async () => {
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    const doc = generateTafFordeltPaaAarPdf({} as any, {} as any);
    const instance = MockJsPDF.instances.at(-1);
    expect(doc).toBeInstanceOf(MockJsPDF);
    expect(instance).toBeDefined();
    expect(instance?.save).toHaveBeenCalledTimes(1);
    expect(instance?.save).toHaveBeenCalledWith('Tabt arbejdsfortjeneste fordelt på år.pdf');
  });

  it('gemmer PDF med udkast-suffix når visUdkastStempel=true', async () => {
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any, { visUdkastStempel: true });
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeDefined();
    expect(instance?.save).toHaveBeenCalledWith('Tabt arbejdsfortjeneste fordelt på år (udkast).pdf');
  });

  it('prepender journalnr i filnavn når journalnr er udfyldt', async () => {
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({
      kind: 'ok',
      document: {
        model: {
          ...FAKE_MODEL,
          brevhoved: { journalnr: '1234' },
        },
        presentation: FAKE_RESULT,
      },
    });
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any, { visUdkastStempel: true });
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeDefined();
    expect(instance?.save).toHaveBeenCalledWith('1234 - Tabt arbejdsfortjeneste fordelt på år (udkast).pdf');
  });

  it('viser negativt beløb for negativt I alt pr. år', async () => {
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({
      kind: 'ok',
      document: {
        model: FAKE_MODEL,
        presentation: {
          ...FAKE_RESULT,
          years: [
            {
              ...FAKE_RESULT.years[0],
              yearTafOre: (-5000) as MoneyOre,
            },
          ],
        },
      },
    });

    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any);
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeDefined();
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain(`-50,00\u00A0kr.`);
  });

  it('renderer "Allerede betalt TAF" som fradragslinje', async () => {
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any);
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeDefined();

    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('Allerede betalt TAF');
    expect(renderedText).toContain(`- 25.000,00\u00A0kr.`);
  });

  it('viser forlig-sektion og forlig-reference i "I alt"-linjen når forlig er indgået', async () => {
    eoSnapshotToTafPerYearPdfDocumentMock.mockReturnValue({
      kind: 'ok',
      document: {
        model: {
          ...FAKE_MODEL,
          forlig: { erIndgaaet: true, label: '50%', dato: '2024-04-01', factor: 0.5 },
        },
        presentation: {
          ...FAKE_RESULT,
          years: [
            {
              ...FAKE_RESULT.years[0],
              yearTafFoerForligOre: 37500000 as MoneyOre,
              yearTafOre: 18750000 as MoneyOre,
            },
          ],
        },
      },
    });

    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any);
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeDefined();

    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain('Forlig');
    expect(renderedText.some((text) => String(text).includes('indgået forlig i sagen på betaling af 50%.'))).toBe(true);
    expect(renderedText.some((text) => String(text).includes('I alt (50% af'))).toBe(true);
    expect(renderedText).toContain(`187.500,00\u00A0kr.`);
  });
});
