/// <reference types="vitest/globals" />
/**
 * Wiring-test: verificerer at tafFordeltPaaAarPdf.ts
 * bruger buildTafPerYearResult som sin eneste datakilde
 * og ikke genberegner TAF-krav selvstændigt.
 */

import type { TafPerYearResult } from '../../../domain/erstatningsopgoerelse/tafPerYearDerived';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/eoPdfModel';

// ─── Mocks ──────────────────────────────────────────────────────────────

const {
  buildTafPerYearResultMock,
  buildErstatningsopgoerelsePdfModelMock,
} = vi.hoisted(() => ({
  buildTafPerYearResultMock: vi.fn(),
  buildErstatningsopgoerelsePdfModelMock: vi.fn(),
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

vi.mock('../../../domain/erstatningsopgoerelse/tafPerYearDerived', () => ({
  buildTafPerYearResult: buildTafPerYearResultMock,
}));

vi.mock('../../../domain/erstatningsopgoerelse/eoPdfModel', () => ({
  buildErstatningsopgoerelsePdfModel: buildErstatningsopgoerelsePdfModelMock,
}));

// ─── Fixtures ───────────────────────────────────────────────────────────

const FAKE_MODEL = {
  brevhoved: null,
  periodeDisplay: '01-01-2024 - 31-12-2024',
  skadelidteNavn: 'Test Person',
  skadestypeLinje: 'Arbejdsulykke den 1. januar 2024',
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
      ],
      yearIncomeOre: 50000000 as MoneyOre,
      yearDeductionsOre: 10000000 as MoneyOre,
      yearTafOre: 40000000 as MoneyOre,
    },
  ],
  sumYearTafOre: 40000000 as MoneyOre,
  afrundingOre: 0 as MoneyOre,
  samletTafKravOre: 40000000 as MoneyOre,
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe('tafFordeltPaaAarPdf wiring', () => {
  beforeEach(() => {
    MockJsPDF.instances = [];
    buildErstatningsopgoerelsePdfModelMock.mockReturnValue(FAKE_MODEL);
    buildTafPerYearResultMock.mockReturnValue(FAKE_RESULT);
  });

  it('kalder buildTafPerYearResult med model og eoValues', async () => {
    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    const stamdata = {} as any;
    const eoValues = {} as any;
    generateTafFordeltPaaAarPdf(stamdata, eoValues);

    expect(buildErstatningsopgoerelsePdfModelMock).toHaveBeenCalledTimes(1);
    expect(buildErstatningsopgoerelsePdfModelMock).toHaveBeenCalledWith(stamdata, eoValues, expect.objectContaining({ dagsDatoISO: expect.any(String) }));

    expect(buildTafPerYearResultMock).toHaveBeenCalledTimes(1);
    expect(buildTafPerYearResultMock).toHaveBeenCalledWith(FAKE_MODEL, eoValues);
  });

  it('kaster ikke fejl når buildTafPerYearResult returnerer null', async () => {
    buildTafPerYearResultMock.mockReturnValue(null);

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

  it('viser 0 kr. for negativt I alt pr. år', async () => {
    buildTafPerYearResultMock.mockReturnValue({
      ...FAKE_RESULT,
      years: [
        {
          ...FAKE_RESULT.years[0],
          yearTafOre: (-5000) as MoneyOre,
        },
      ],
    });

    const { generateTafFordeltPaaAarPdf } = await import('../../../utils/pdf/tafFordeltPaaAarPdf');

    generateTafFordeltPaaAarPdf({} as any, {} as any);
    const instance = MockJsPDF.instances.at(-1);
    expect(instance).toBeDefined();
    const renderedText = (instance?.text.mock.calls ?? []).map((call) => call[0]);
    expect(renderedText).toContain(`0,00\u00A0kr.`);
  });
});
