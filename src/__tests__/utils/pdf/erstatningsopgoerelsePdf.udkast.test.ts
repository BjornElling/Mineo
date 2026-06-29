// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import { FONT_SIZES, PDF_BASE_LINE_HEIGHT_MM } from '../../../document/layout/pdfConfig';
import { toISODateString } from '../../../types/branded';
import { registerPdfWriterFallbackForTest } from './registerPdfWriterFallback';

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
const { logWarningMock } = vi.hoisted(() => ({
  logWarningMock: vi.fn(),
}));
vi.mock('../../../utils/logger', () => ({
  logWarning: logWarningMock,
  logError: vi.fn(),
}));

describe('erstatningsopgoerelsePdf udkaststempel', () => {
  beforeEach(async () => {
    await registerPdfWriterFallbackForTest();
  });

  let generateErstatningsopgoerelseDocument: typeof import('../../../document/generators/eo/erstatningsopgoerelseDocument').generateErstatningsopgoerelseDocument;

  const selected = {
    opgoerelse: true,
    loenindkomst: false,
    offentligeYdelser: false,
    shDage: false,
    regulering: false,
    okSatser: false,
    sygeferiegodtgoerelse: false,
    midlertidigEet: false,
  };

  beforeEach(() => {
    MockJsPDF.splitTextToSizeImpl = null;
    MockJsPDF.getTextWidthImpl = null;
    mockInstances.length = 0;
    MockJsPDF.lastInstance = null;
    logWarningMock.mockClear();
  });

  beforeAll(async () => {
    ({ generateErstatningsopgoerelseDocument } = await import('../../../document/generators/eo/erstatningsopgoerelseDocument'));
  }, 20000);

  const createBaseStamdata = (): StamdataValues => structuredClone(STAMDATA_INITIAL_VALUES);

  const createBaseEo = () => {
    const values = createErstatningsopgoerelseInitialValues();
    values.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    values.kravPaaTabtArbejdsfortjeneste = 'Nej';
    return values;
  };

  const buildProjectedDocument = (stamdata: StamdataValues, eo: ErstatningsopgoerelseValues): EoModel => {
    const snapshot = computeEoSnapshot({
      revision: 'pdf-udkast-test',
      stamdataValues: stamdata,
      eoValues: eo,
    });
    const projection = eoSnapshotToEoDocument(snapshot);
    if (projection.kind === 'blocked') {
      throw new Error(projection.message);
    }
    return projection.document;
  };

  const hasUdkastCall = (instance: MockJsPDF | null): boolean => {
    if (!instance) return false;
    return instance.text.mock.calls.some((call) => {
      const [text, , , options] = call;
      return text === 'UDKAST' && options && options.angle === -45;
    });
  };

  it('adds draft watermark when visUdkastStempel=true', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
    generateErstatningsopgoerelseDocument(baseStamdata, baseEo, selected, {
      visUdkastStempel: true,
      document: buildProjectedDocument(baseStamdata, baseEo),
    });
    expect(hasUdkastCall(MockJsPDF.lastInstance)).toBe(true);
    const lastSaveCall = MockJsPDF.lastInstance?.save.mock.calls.at(-1);
    expect(lastSaveCall?.[0]).toMatch(/ \(udkast\)\.pdf$/);
  });

  it('prepender journalnr i filnavn når journalnr er udfyldt', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
    const stamdataWithJournal = {
      ...baseStamdata,
      journalnr: '1234',
    };
    generateErstatningsopgoerelseDocument(stamdataWithJournal, baseEo, selected, {
      visUdkastStempel: true,
      document: buildProjectedDocument(stamdataWithJournal, baseEo),
    });
    const lastSaveCall = MockJsPDF.lastInstance?.save.mock.calls.at(-1);
    expect(lastSaveCall?.[0]).toMatch(/^1234 - .* \(udkast\)\.pdf$/);
  });

  it('does not add draft watermark when visUdkastStempel=false', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
    generateErstatningsopgoerelseDocument(baseStamdata, baseEo, selected, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, baseEo),
    });
    expect(hasUdkastCall(MockJsPDF.lastInstance)).toBe(false);
    const lastSaveCall = MockJsPDF.lastInstance?.save.mock.calls.at(-1);
    const fileName = String(lastSaveCall?.[0] ?? '');
    expect(fileName.endsWith('.pdf')).toBe(true);
    expect(fileName.includes(' (udkast).pdf')).toBe(false);
  });

  it('skriver erstatningsperiode direkte under hovedtitlen uden ekstra titelafstand', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
    baseEo.eoNummer = '1';
    baseEo.vedroererPeriodeFra = toISODateString('2025-04-03');
    baseEo.vedroererPeriodeTil = toISODateString('2026-02-22');
    baseStamdata.skadelidte = 'Kim Thinggaard Plehn Larsen';
    baseStamdata.skadestype = 'Arbejdsulykke';
    baseStamdata.skadedato = toISODateString('2025-04-03');

    generateErstatningsopgoerelseDocument(baseStamdata, baseEo, selected, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, baseEo),
    });

    const textCalls = MockJsPDF.lastInstance?.text.mock.calls ?? [];
    const titleCall = textCalls.find((call) => call[0] === 'Erstatningsopgørelse 1');
    const periodCall = textCalls.find((call) => call[0] === '03-04-2025 - 22-02-2026');

    expect(titleCall).toBeDefined();
    expect(periodCall).toBeDefined();
    expect((periodCall?.[2] as number) - (titleCall?.[2] as number)).toBeCloseTo(
      PDF_BASE_LINE_HEIGHT_MM * (FONT_SIZES.title / FONT_SIZES.normal),
      6
    );
  });

  it('tillader sygeferiegodtgørelse som valgt PDF-element', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
    const selectedWithUnsupported = {
      ...selected,
      sygeferiegodtgoerelse: true,
    };

    expect(() => generateErstatningsopgoerelseDocument(baseStamdata, baseEo, selectedWithUnsupported, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, baseEo),
    }))
      .not.toThrow();
  });

  it('adds page when wrapped text exceeds page height', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
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

    generateErstatningsopgoerelseDocument(baseStamdata, eoWithLongComment, selected, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, eoWithLongComment),
    });
    expect(MockJsPDF.lastInstance?.addPage).toHaveBeenCalled();
  });
  it('creates multiple new pages for very long wrapped text', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
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

    generateErstatningsopgoerelseDocument(baseStamdata, eoWithVeryLongComment, selected, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, eoWithVeryLongComment),
    });
    expect((MockJsPDF.lastInstance?.addPage.mock.calls.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('moves right column to separate line when width overflows', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
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

    generateErstatningsopgoerelseDocument(baseStamdata, baseEo, selected, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, baseEo),
    });

    expect(logWarningMock).toHaveBeenCalledWith(
      'PDF-layout fallback aktiveret',
      expect.objectContaining({ context: 'pdf.erstatningsopgoerelse.layout' })
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
  });

  it('adds page before signature block when needed', () => {
    const baseStamdata = createBaseStamdata();
    const baseEo = createBaseEo();
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

    generateErstatningsopgoerelseDocument(baseStamdata, eoWithLongSignaturIntro, selected, {
      visUdkastStempel: false,
      document: buildProjectedDocument(baseStamdata, eoWithLongSignaturIntro),
    });
    expect(MockJsPDF.lastInstance?.addPage).toHaveBeenCalled();
    expect(MockJsPDF.lastInstance?.text).toHaveBeenCalledWith(
      '____ / ____ - ____________',
      expect.any(Number),
      expect.any(Number)
    );
  });
});
