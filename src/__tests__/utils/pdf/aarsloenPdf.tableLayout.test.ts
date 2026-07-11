// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../document/layout/pdfConfig';
import { createPdfDocumentSessionForTest } from './createPdfDocumentSession';

let pdfSession: Awaited<ReturnType<typeof createPdfDocumentSessionForTest>>;

const AARSLOEN_PDF_ATP_HEADER = 'ATP mv.\nu. tillæg';
const AARSLOEN_PDF_IKKE_PENS_HEADER = 'Ikke-pens.\ngiv. løn';

type AutoTableOptions = {
  startY?: number;
  body?: Array<Array<{ content?: string; colSpan?: number }>>;
  columnStyles?: Record<number, { cellWidth: number }>;
};

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: AutoTableOptions) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  }),
}));

class MockJsPDF {
  static instances: MockJsPDF[] = [];
  internal = { pageSize: { width: 210, height: 297 } };
  lastAutoTable?: { finalY?: number };
  text = vi.fn();
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
  getTextWidth = vi.fn((text: string) => {
    if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(text)) {
      return text.length * 3.2 * (this.currentFontSize / 8);
    }

    return text.length * (this.currentFontStyle === 'bold' ? 0.95 : 0.8) * (this.currentFontSize / 8);
  });
  getNumberOfPages = vi.fn(() => 1);
  setPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  setDrawColor = vi.fn();
  addPage = vi.fn();
  addImage = vi.fn();
  save = vi.fn();
}

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

describe('aarsloenPdf', () => {
  beforeEach(async () => {
    pdfSession = await createPdfDocumentSessionForTest();
  });

  let generateAarsloenDocument: typeof import('../../../document/generators/aarsloen/aarsloenDocument')['generateAarsloenDocument'];

  beforeAll(async () => {
    ({ generateAarsloenDocument } = await import('../../../document/generators/aarsloen/aarsloenDocument'));
  });

  beforeEach(() => {
    MockJsPDF.instances = [];
    autoTableMock.mockClear();
  });

  it('fordeler indtægtsoplysningstabellen over fuld bredde uden ekstra skjult kolonne', () => {
    generateAarsloenDocument(pdfSession, {
      satser: {
        feriePct: 12.5,
        fritvalgPct: 2,
        shSoPct: 3,
        pensionPct: 10,
      },
      loenperiode: 'maaned',
      tillaegAngivesSom: 'procent',
      tableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 11111 },
          col3: { kind: 'number', value: 1111 },
          col4: { kind: 'number', value: 111 },
          col5: { kind: 'number', value: 11 },
        },
        {
          id: 'row-2',
          col0_maaned: '2',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 12000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
      beregnetAarsloen: 0,
      omregningTilFuldtAar: false,
      periodeData: null,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Ingen',
      shDageAntal: null,
      beregningsData: { metode: 'ingen', erEtAar: false } as never,
    });

    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const body = firstCall?.body as Array<Array<{ content?: string; colSpan?: number }>>;
    const headerColumnCount = body[0]?.length;
    const totalRow = body.at(-1);
    const columnStyles = firstCall?.columnStyles as Record<number, { cellWidth: number }>;
    const firstColumnStyle = columnStyles[0];
    const lastColumnStyle = columnStyles[8];
    const totalWidth = Object.values(columnStyles).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(headerColumnCount).toBe(9);
    expect(body[0]?.[5]?.content).toBe(AARSLOEN_PDF_ATP_HEADER);
    expect(Object.keys(columnStyles)).toHaveLength(9);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
    expect(firstColumnStyle.cellWidth).toBeGreaterThan(0);
    expect(lastColumnStyle.cellWidth).toBeGreaterThan(0);
    expect(totalRow).toHaveLength(2);
    expect(totalRow?.[1]?.content).not.toContain('kr.');
    expect(totalRow?.[1]?.colSpan).toBe(8);
  }, 15000);

  it('bevarer manuel headerombrydning ved store beløb uden at miste fuld tabelbredde', () => {
    generateAarsloenDocument(pdfSession, {
      satser: {
        feriePct: 12.5,
        fritvalgPct: 2,
        shSoPct: 3,
        pensionPct: 10,
      },
      loenperiode: 'maaned',
      tillaegAngivesSom: 'procent',
      tableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 11111 },
          col3: { kind: 'number', value: 1111 },
          col4: { kind: 'number', value: 1234567.89 },
          col5: { kind: 'number', value: 11 },
        },
        {
          id: 'row-2',
          col0_maaned: '2',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 12000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        },
      ],
      beregnetAarsloen: 0,
      omregningTilFuldtAar: false,
      periodeData: null,
      fuldLoenUnderFerie: false,
      retTilSjetteFerieuge: false,
      antalFeriedage: undefined,
      loenPaaHelligdage: 'Ingen',
      shDageAntal: null,
      beregningsData: { metode: 'ingen', erEtAar: false } as never,
    });

    const firstCall = autoTableMock.mock.calls[0]?.[1];
    const body = firstCall?.body as Array<Array<{ content?: string }>>;
    const columnStyles = firstCall?.columnStyles as Record<number, { cellWidth: number }>;
    const totalWidth = Object.values(columnStyles).reduce((sum, style) => sum + style.cellWidth, 0);
    const hasRenderedLargeAmount = body.some((row) => row.some((cell) => cell.content === '1.234.567,89'));

    expect(body[0]?.[4]?.content).toBe(AARSLOEN_PDF_IKKE_PENS_HEADER);
    expect(hasRenderedLargeAmount).toBe(true);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
    expect(Object.keys(columnStyles)).toHaveLength(9);
  }, 15000);
});
