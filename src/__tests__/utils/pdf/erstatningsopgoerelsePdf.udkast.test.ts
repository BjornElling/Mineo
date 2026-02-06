/// <reference types="vitest/globals" />
import type { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const mockInstances: MockJsPDF[] = [];

class MockJsPDF {
  static lastInstance: MockJsPDF | null = null;
  static splitTextToSizeImpl: ((text: string) => string[]) | null = null;
  static getTextWidthImpl: ((text: string) => number) | null = null;
  internal = { pageSize: { width: 210, height: 297 } };
  text = vi.fn();
  private currentFontName: string = 'helvetica';
  private currentFontStyle: string = 'normal';
  setFont = vi.fn((fontName: string, fontStyle: string) => {
    this.currentFontName = fontName;
    this.currentFontStyle = fontStyle;
  });
  getFont = vi.fn(() => ({ fontName: this.currentFontName, fontStyle: this.currentFontStyle }));
  setFontSize = vi.fn();
  setTextColor = vi.fn();
  setDisplayMode = vi.fn();
  setProperties = vi.fn();
  splitTextToSize = vi.fn((text: string) => {
    if (MockJsPDF.splitTextToSizeImpl) {
      return MockJsPDF.splitTextToSizeImpl(text);
    }
    return [text];
  });
  getTextWidth = vi.fn((text: string) => {
    if (MockJsPDF.getTextWidthImpl) {
      return MockJsPDF.getTextWidthImpl(text);
    }
    return text.length;
  });
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  addPage = vi.fn();
  save = vi.fn();

  constructor() {
    MockJsPDF.lastInstance = this;
    mockInstances.push(this);
  }
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));

describe('erstatningsopgoerelsePdf udkaststempel', () => {
  let baseStamdata: typeof STAMDATA_INITIAL_VALUES;
  let baseEo: ReturnType<typeof createErstatningsopgoerelseInitialValues>;
  let generateErstatningsopgoerelsePdf: typeof import('../../../utils/pdf/erstatningsopgoerelsePdf').generateErstatningsopgoerelsePdf;
  let resolveUdkastStempelValue: typeof import('../../../utils/pdf/erstatningsopgoerelsePdf').resolveUdkastStempelValue;

  const selected = {
    opgoerelse: true,
    loenindkomst: false,
    offentligeYdelser: false,
    shDage: false,
    regulering: false,
    okSatser: false,
    sygeferiegodtgoerelse: false,
  };

  beforeAll(async () => {
    const { STAMDATA_INITIAL_VALUES } = await import('../../../domain/stamdata/stamdataInitialValues');
    const { createErstatningsopgoerelseInitialValues } = await import('../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues');
    const pdfModule = await import('../../../utils/pdf/erstatningsopgoerelsePdf');

    baseStamdata = structuredClone(STAMDATA_INITIAL_VALUES);
    baseEo = createErstatningsopgoerelseInitialValues();
    generateErstatningsopgoerelsePdf = pdfModule.generateErstatningsopgoerelsePdf;
    resolveUdkastStempelValue = pdfModule.resolveUdkastStempelValue;
  });

  beforeEach(() => {
    MockJsPDF.splitTextToSizeImpl = null;
    MockJsPDF.getTextWidthImpl = null;
  });

  const hasUdkastCall = (instance: MockJsPDF | null): boolean => {
    if (!instance) return false;
    return instance.text.mock.calls.some((call) => {
      const [text, , , options] = call;
      return text === 'UDKAST' && options && options.angle === -45;
    });
  };

  it('adds draft watermark when visUdkastStempel=true', () => {
    generateErstatningsopgoerelsePdf(baseStamdata, baseEo, selected, { visUdkastStempel: true });
    expect(hasUdkastCall(MockJsPDF.lastInstance)).toBe(true);
  });

  it('does not add draft watermark when visUdkastStempel=false', () => {
    generateErstatningsopgoerelsePdf(baseStamdata, baseEo, selected, { visUdkastStempel: false });
    expect(hasUdkastCall(MockJsPDF.lastInstance)).toBe(false);
  });

  it('resolverer manglende indsaetUdkastStempel som false', () => {
    expect(resolveUdkastStempelValue(undefined)).toBe(false);
  });

  it('throws for unsupported selected PDF elements', () => {
    const selectedWithUnsupported = {
      ...selected,
      loenindkomst: true,
    };

    expect(() => generateErstatningsopgoerelsePdf(baseStamdata, baseEo, selectedWithUnsupported, { visUdkastStempel: false }))
      .toThrow(/Valgte PDF-elementer er ikke underst.*ttet endnu/);
  });

  it('adds page when wrapped text exceeds page height', () => {
    const eoWithLongComment = {
      ...baseEo,
      saerligeKommentarer: 'LANG-TEKST',
    };

    MockJsPDF.splitTextToSizeImpl = (text) => {
      if (text.includes('LANG-TEKST')) {
        return Array.from({ length: 120 }, (_, idx) => `linje-${idx + 1}`);
      }
      return [text];
    };

    generateErstatningsopgoerelsePdf(baseStamdata, eoWithLongComment, selected, { visUdkastStempel: false });
    expect(MockJsPDF.lastInstance?.addPage).toHaveBeenCalled();
  });
  it('creates multiple new pages for very long wrapped text', () => {
    const eoWithVeryLongComment = {
      ...baseEo,
      saerligeKommentarer: 'MEGET-LANG-TEKST',
    };

    MockJsPDF.splitTextToSizeImpl = (text) => {
      if (text.includes('MEGET-LANG-TEKST')) {
        return Array.from({ length: 260 }, (_, idx) => `linje-${idx + 1}`);
      }
      return [text];
    };

    generateErstatningsopgoerelsePdf(baseStamdata, eoWithVeryLongComment, selected, { visUdkastStempel: false });
    expect((MockJsPDF.lastInstance?.addPage.mock.calls.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('moves right column to separate line when width overflows', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    MockJsPDF.splitTextToSizeImpl = (text) => {
      if (text.includes('kr.')) {
        return ['kr-linje-1', 'kr-linje-2'];
      }
      return [text];
    };
    MockJsPDF.getTextWidthImpl = (text) => {
      if (text.includes('kr.')) return 1000;
      return text.length;
    };

    generateErstatningsopgoerelsePdf(baseStamdata, baseEo, selected, { visUdkastStempel: false });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^PDF-layout:/)
    );

    const instance = MockJsPDF.lastInstance;
    const textCalls = instance?.text.mock.calls ?? [];
    const amountCalls = textCalls.filter((call) => {
      const [, , , options] = call;
      return Boolean(options && options.align === 'right');
    });
    expect(amountCalls.length).toBeGreaterThan(0);

    const firstRightCallIndex = textCalls.findIndex((call) => {
      const [, , , options] = call;
      return Boolean(options && options.align === 'right');
    });
    expect(firstRightCallIndex).toBeGreaterThan(-1);
    const hasLeftBeforeRight = textCalls.slice(0, firstRightCallIndex).some((call) => {
      const [, , , options] = call;
      return !options || !options.align;
    });
    expect(hasLeftBeforeRight).toBe(true);

    const hasConsecutiveRightLines = textCalls.some((call, index) => {
      const next = textCalls[index + 1];
      if (!next) return false;
      const [, , y1, o1] = call;
      const [, , y2, o2] = next;
      return Boolean(o1 && o1.align === 'right' && o2 && o2.align === 'right' && (y2 as number) > (y1 as number));
    });
    expect(hasConsecutiveRightLines).toBe(true);

    const splitCalls = instance?.splitTextToSize.mock.calls ?? [];
    const hasRightTextSplit = splitCalls.some((call) => {
      const [text] = call;
      return typeof text === 'string' && text.includes('kr.');
    });
    expect(hasRightTextSplit).toBe(true);
    warnSpy.mockRestore();
  });

  it('adds page before signature block when needed', () => {
    const eoWithLongSignaturIntro = {
      ...baseEo,
      erstatningsopgoerelseAfsluttesMed: 'Underskrift-linje' as const,
      saerligeKommentarer: 'SIGNATUR-NAER-BUND',
    };

    MockJsPDF.splitTextToSizeImpl = (text) => {
      if (text.includes('SIGNATUR-NAER-BUND')) {
        return Array.from({ length: 75 }, (_, idx) => `linje-${idx + 1}`);
      }
      return [text];
    };

    generateErstatningsopgoerelsePdf(baseStamdata, eoWithLongSignaturIntro, selected, { visUdkastStempel: false });
    expect(MockJsPDF.lastInstance?.addPage).toHaveBeenCalled();
    expect(MockJsPDF.lastInstance?.text).toHaveBeenCalledWith(
      '____ / ____ - ____________',
      expect.any(Number),
      expect.any(Number)
    );
  });
});


