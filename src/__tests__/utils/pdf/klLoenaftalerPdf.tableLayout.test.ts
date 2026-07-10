// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../document/layout/pdfConfig';
import { registerPdfWriterFallbackForTest } from './registerPdfWriterFallback';

type PdfTableCell = Readonly<{
  content?: string;
  styles?: Readonly<{ halign?: string }>;
}>;

type AutoTableOptions = Readonly<{
  startY?: number;
  body?: PdfTableCell[][];
  tableWidth?: number;
  columnStyles?: Record<number, { cellWidth: number; halign?: string }>;
}>;

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: AutoTableOptions) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  }),
}));

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
  getTextWidth = vi.fn((text: string) => text.length * (this.currentFontStyle === 'bold' ? 0.95 : 0.8));
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

vi.mock('jspdf', () => ({ default: MockJsPDF }));
vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

describe('KL-lønaftaler PDF-layout', () => {
  let generateKlLoenaftalerDocument: typeof import('../../../document/generators/klLoenaftaler/klLoenaftalerDocument')['generateKlLoenaftalerDocument'];

  beforeAll(async () => {
    ({ generateKlLoenaftalerDocument } = await import('../../../document/generators/klLoenaftaler/klLoenaftalerDocument'));
  });

  beforeEach(async () => {
    await registerPdfWriterFallbackForTest();
    MockJsPDF.instances = [];
    autoTableMock.mockClear();
  });

  it('fordeler tabellen over fuld bredde med to centrerede kolonner', () => {
    generateKlLoenaftalerDocument({ visBrevhoved: false });

    const firstCall = autoTableMock.mock.calls[0]?.[1] as AutoTableOptions | undefined;
    const body = firstCall?.body;
    const columnStyles = firstCall?.columnStyles;
    const totalWidth = Object.values(columnStyles ?? {}).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(firstCall?.tableWidth).toBe(PDF_CONTENT_WIDTH_MM);
    expect(Object.keys(columnStyles ?? {})).toHaveLength(2);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
    expect(columnStyles?.[0]?.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 2, 6);
    expect(columnStyles?.[1]?.cellWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM / 2, 6);
    // Centrering udtrykkes nu på cellerne (TableSpec's ColumnSpec.align → celle-halign),
    // ikke længere via columnStyles.defaultHalign — begge kanaler læser samme kilde.
    expect(body?.[0]?.[0]?.styles?.halign).toBe('center');
    expect(body?.[0]?.[1]?.styles?.halign).toBe('center');
    expect(body?.[1]?.[0]?.styles?.halign).toBe('center');
    expect(body?.[1]?.[1]?.styles?.halign).toBe('center');
  });
});
