/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../pdf/infrastructure/pdfConfig';

const AARSLOEN_PDF_ATP_HEADER = 'ATP mv.\nu. tillæg';

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: { startY?: number }) => {
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
  splitTextToSize = vi.fn((text: string) => [text]);
  getTextWidth = vi.fn((text: string) => text.length);
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
  beforeEach(() => {
    MockJsPDF.instances = [];
    autoTableMock.mockClear();
  });

  it('fordeler indtægtsoplysningstabellen over fuld bredde uden ekstra skjult kolonne', async () => {
    const { generateAarsloenPdf } = await import('../../../pdf/domains/aarsloen/aarsloenPdf');

    generateAarsloenPdf({
      satser: {
        feriePct: 12.5,
        fritvalgPct: 2,
        shSoPct: 3,
        pensionPct: 10,
      },
      loenperiode: 'maaned',
      tableData: [
        {
          id: 'row-1',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: '',
          col1_dag: '',
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
          col0_dag: '',
          col1_dag: '',
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

    expect(headerColumnCount).toBe(9);
    expect(body[0]?.[5]?.content).toBe(AARSLOEN_PDF_ATP_HEADER);
    expect(Object.keys(columnStyles)).toHaveLength(9);
    expect(firstColumnStyle.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 9, 6);
    expect(lastColumnStyle.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 9, 6);
    expect(totalRow).toHaveLength(2);
    expect(totalRow?.[1]?.content).not.toContain('kr.');
    expect(totalRow?.[1]?.colSpan).toBe(8);
  });
});
