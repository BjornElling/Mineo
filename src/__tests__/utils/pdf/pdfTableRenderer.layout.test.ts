/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../pdf/infrastructure/pdfConfig';

type AutoTableOptions = {
  startY?: number;
  columnStyles?: Record<number, { cellWidth: number }>;
};

const { autoTableMock } = vi.hoisted(() => ({
  autoTableMock: vi.fn((doc: Record<string, unknown>, options: AutoTableOptions) => {
    doc.lastAutoTable = { finalY: (options.startY ?? 0) + 10 };
  }),
}));

vi.mock('jspdf-autotable', () => ({
  default: autoTableMock,
}));

class MockJsPDF {
  internal = { pageSize: { width: 210, height: 297 } };
  lastAutoTable?: { finalY?: number };
  private currentFontStyle = 'normal';
  private currentFontSize = 8;

  text = vi.fn();
  addPage = vi.fn();
  line = vi.fn();
  setLineWidth = vi.fn();
  setDrawColor = vi.fn();

  setFont = vi.fn((_name: string, style: string) => {
    this.currentFontStyle = style;
  });

  setFontSize = vi.fn((size: number) => {
    this.currentFontSize = size;
  });

  getFont = vi.fn(() => ({
    fontName: 'helvetica',
    fontStyle: this.currentFontStyle,
  }));

  getFontSize = vi.fn(() => this.currentFontSize);

  getTextWidth = vi.fn((text: string) => {
    const factor = this.currentFontStyle === 'bold' ? 2.3 : 2.1;
    return text.length * factor * (this.currentFontSize / 8);
  });
}

describe('renderPdfTable adaptive column widths', () => {
  beforeEach(() => {
    autoTableMock.mockClear();
  });

  it('omfordeler distribuerede kolonner når et beløb ellers ville blive ombrudt', async () => {
    const { createPdfDistributedColumnStyles, createPdfTableCell, createPdfTableHeaderCell, renderPdfTable } =
      await import('../../../pdf/shared/pdfTableRenderer');

    const doc = new MockJsPDF();
    const initialWidth = PDF_CONTENT_WIDTH_MM / 4;

    renderPdfTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createPdfTableHeaderCell('Periode'),
          createPdfTableHeaderCell('Grundlag'),
          createPdfTableHeaderCell('Beløb'),
          createPdfTableHeaderCell('Notat'),
        ],
        [
          createPdfTableCell('Jan'),
          createPdfTableCell('Kort'),
          createPdfTableCell('1.234.567,89 kr. tillæg', { halign: 'right' }),
          createPdfTableCell('Ok'),
        ],
      ],
      columnStyles: createPdfDistributedColumnStyles(4),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;
    const totalWidth = Object.values(styles).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(styles[2]?.cellWidth).toBeGreaterThan(initialWidth);
    expect(styles[0]?.cellWidth).toBeLessThan(initialWidth);
    expect(styles[3]?.cellWidth).toBeLessThan(initialWidth);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('lader bredderne være uændrede når omfordeling ikke kan ske uden nye ombrydninger', async () => {
    const { createPdfDistributedColumnStyles, createPdfTableCell, createPdfTableHeaderCell, renderPdfTable } =
      await import('../../../pdf/shared/pdfTableRenderer');

    const doc = new MockJsPDF();
    const initialWidth = PDF_CONTENT_WIDTH_MM / 4;

    renderPdfTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createPdfTableHeaderCell('Kolonne A med lang tekst'),
          createPdfTableHeaderCell('Kolonne B med lang tekst'),
          createPdfTableHeaderCell('Kolonne C med lang tekst'),
          createPdfTableHeaderCell('Kolonne D med lang tekst'),
        ],
        [
          createPdfTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createPdfTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createPdfTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createPdfTableCell('1.234.567,89 kr.', { halign: 'right' }),
        ],
      ],
      columnStyles: createPdfDistributedColumnStyles(4),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;
    const totalWidth = Object.values(styles).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(styles[0]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[1]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[2]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[3]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('bevarer eksplicit låste kolonner mens frie kolonner omfordeles', async () => {
    const { createPdfDistributedColumnStyles, createPdfTableCell, createPdfTableHeaderCell, renderPdfTable } =
      await import('../../../pdf/shared/pdfTableRenderer');

    const doc = new MockJsPDF();
    const initialDistributedWidth = (PDF_CONTENT_WIDTH_MM - 25) / 3;

    renderPdfTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createPdfTableHeaderCell('Periode'),
          createPdfTableHeaderCell('Grundlag'),
          createPdfTableHeaderCell('Beløb'),
          createPdfTableHeaderCell('SH'),
        ],
        [
          createPdfTableCell('Jan'),
          createPdfTableCell('Kort'),
          createPdfTableCell('1.234.567,89 kr. tillæg', { halign: 'right' }),
          createPdfTableCell('x', { halign: 'center' }),
        ],
      ],
      columnStyles: createPdfDistributedColumnStyles(4, {
        fixedColumns: {
          3: 25,
        },
      }),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;
    const totalWidth = Object.values(styles).reduce((sum, style) => sum + style.cellWidth, 0);

    expect(styles[3]?.cellWidth).toBe(25);
    expect(styles[2]?.cellWidth).toBeGreaterThan(initialDistributedWidth);
    expect(styles[0]?.cellWidth).toBeLessThan(initialDistributedWidth);
    expect(styles[1]?.cellWidth).toBeLessThan(initialDistributedWidth);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('fejler fail-closed når body er tom i stedet for at rendere en blank tabel', async () => {
    const { renderPdfTable } = await import('../../../pdf/shared/pdfTableRenderer');

    const doc = new MockJsPDF();

    expect(() =>
      renderPdfTable({
        doc: doc as never,
        startY: 40,
        body: [],
      })
    ).toThrow(/tom body/i);
    expect(autoTableMock).not.toHaveBeenCalled();
  });
});
