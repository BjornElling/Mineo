// @vitest-environment jsdom
/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../document/layout/pdfConfig';

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

describe('renderDocumentTable adaptive column widths', () => {
  beforeEach(() => {
    autoTableMock.mockClear();
  });

  it('omfordeler distribuerede kolonner når et beløb ellers ville blive ombrudt', async () => {
    const { createDocumentDistributedColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();
    const initialWidth = PDF_CONTENT_WIDTH_MM / 4;

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('Periode'),
          createDocumentTableHeaderCell('Grundlag'),
          createDocumentTableHeaderCell('Beløb'),
          createDocumentTableHeaderCell('Notat'),
        ],
        [
          createDocumentTableCell('Jan'),
          createDocumentTableCell('Kort'),
          createDocumentTableCell('1.234.567,89 kr. tillæg', { halign: 'right' }),
          createDocumentTableCell('Ok'),
        ],
      ],
      columnStyles: createDocumentDistributedColumnStyles(4),
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
    const { createDocumentDistributedColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();
    const initialWidth = PDF_CONTENT_WIDTH_MM / 4;

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('Kolonne A med lang tekst'),
          createDocumentTableHeaderCell('Kolonne B med lang tekst'),
          createDocumentTableHeaderCell('Kolonne C med lang tekst'),
          createDocumentTableHeaderCell('Kolonne D med lang tekst'),
        ],
        [
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
        ],
      ],
      columnStyles: createDocumentDistributedColumnStyles(4),
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
    const { createDocumentDistributedColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();
    const initialDistributedWidth = (PDF_CONTENT_WIDTH_MM - 25) / 3;

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('Periode'),
          createDocumentTableHeaderCell('Grundlag'),
          createDocumentTableHeaderCell('Beløb'),
          createDocumentTableHeaderCell('SH'),
        ],
        [
          createDocumentTableCell('Jan'),
          createDocumentTableCell('Kort'),
          createDocumentTableCell('1.234.567,89 kr. tillæg', { halign: 'right' }),
          createDocumentTableCell('x', { halign: 'center' }),
        ],
      ],
      columnStyles: createDocumentDistributedColumnStyles(4, {
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

  it('lader colSpan-celler IKKE drive minimumsbredden (bevidst invariant)', async () => {
    // En total-/colSpan-celle med meget lang tekst må ikke tvinge ekstra bredde
    // på tværs af flere kolonner. Med kun smalle 1:1-celler i øvrigt skal de
    // distribuerede bredder forblive den statiske ligelige fordeling.
    const { createDocumentDistributedColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();
    const initialWidth = PDF_CONTENT_WIDTH_MM / 4;

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('A'),
          createDocumentTableHeaderCell('B'),
          createDocumentTableHeaderCell('C'),
          createDocumentTableHeaderCell('D'),
        ],
        [
          createDocumentTableCell('x'),
          createDocumentTableCell('x'),
          createDocumentTableCell('x'),
          createDocumentTableCell('x'),
        ],
        // Lang colSpan-celle der ville sprænge en kolonne, hvis colSpan drev bredden.
        [
          {
            content: 'En meget lang totaltekst der spænder over alle fire kolonner og ellers ville kræve enorm bredde',
            colSpan: 4,
            styles: { halign: 'right' as const },
          },
        ],
      ],
      columnStyles: createDocumentDistributedColumnStyles(4),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;

    // Ingen 1:1-celle er bred nok til at skabe deficit → bredderne forbliver uændrede,
    // hvilket beviser at colSpan-cellen ikke drev minimumsbredden.
    expect(styles[0]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[1]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[2]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[3]?.cellWidth).toBeCloseTo(initialWidth, 6);
  });

  it('bevarer fuld tabelbredde efter residual-omfordeling af distribuerede kolonner', async () => {
    // Når deficit/donor-passet efterlader et lille residual (fx pga. afrunding),
    // skal residual-grenen lægge resten på en distribueret kolonne, så summen
    // præcist rammer tabelbredden igen – ingen kolonne ender under sit krav.
    const { createDocumentDistributedColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('Periode'),
          createDocumentTableHeaderCell('Grundlag'),
          createDocumentTableHeaderCell('Beløb'),
          createDocumentTableHeaderCell('Notat'),
        ],
        [
          createDocumentTableCell('Jan'),
          createDocumentTableCell('Kort'),
          createDocumentTableCell('9.999.999,99 kr. ekstra tillæg her', { halign: 'right' }),
          createDocumentTableCell('Ok'),
        ],
      ],
      columnStyles: createDocumentDistributedColumnStyles(4),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;
    const totalWidth = Object.values(styles).reduce((sum, style) => sum + style.cellWidth, 0);

    // Invariant: summen af alle kolonnebredder = tabelbredden (residual fuldt fordelt).
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
    // Hver kolonne har en positiv bredde (ingen kolonne tvunget under nul/krav).
    for (const style of Object.values(styles)) {
      expect(style.cellWidth).toBeGreaterThan(0);
    }
  });

  it('falder fail-closed tilbage til de originale styles når omfordeling ikke kan dække deficit', async () => {
    // Alle distribuerede kolonner kræver mere end deres ligelige andel (totalt
    // deficit > total surplus). Da er der ingen donor at trække fra, og funktionen
    // skal returnere de uændrede styles frem for at gætte en ny fordeling.
    const { createDocumentDistributedColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();
    const initialWidth = PDF_CONTENT_WIDTH_MM / 4;

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('Lang overskrift A der fylder hele kolonnen helt ud'),
          createDocumentTableHeaderCell('Lang overskrift B der fylder hele kolonnen helt ud'),
          createDocumentTableHeaderCell('Lang overskrift C der fylder hele kolonnen helt ud'),
          createDocumentTableHeaderCell('Lang overskrift D der fylder hele kolonnen helt ud'),
        ],
        [
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
          createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' }),
        ],
      ],
      columnStyles: createDocumentDistributedColumnStyles(4),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;

    expect(styles[0]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[1]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[2]?.cellWidth).toBeCloseTo(initialWidth, 6);
    expect(styles[3]?.cellWidth).toBeCloseTo(initialWidth, 6);
  });

  it('grow-kolonne: øvrige kolonner holdes på deres min-bredde, grow-kolonnen får resten', async () => {
    const { createDocumentGrowColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('Fra-dato', 'center'),
          createDocumentTableHeaderCell('Til-dato', 'center'),
          createDocumentTableHeaderCell('Indeksberegning', 'center'),
          createDocumentTableHeaderCell('Indeks', 'center'),
          createDocumentTableHeaderCell('Lønudvikling', 'center'),
        ],
        [
          createDocumentTableCell('01-01-2024', { halign: 'center' }),
          createDocumentTableCell('31-12-2024', { halign: 'center' }),
          createDocumentTableCell(
            '(41.593,87 x (100,00 % + 12,50 % + 1,00 % + 0,90 %)) / (38.000,00 x (100,00 % + 8,00 %))',
            { halign: 'center' }
          ),
          createDocumentTableCell('108,00', { halign: 'right' }),
          createDocumentTableCell('+ 8,00 %', { halign: 'right' }),
        ],
      ],
      columnStyles: createDocumentGrowColumnStyles(5, 2),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;
    const totalWidth = Object.values(styles).reduce((sum, style) => sum + style.cellWidth, 0);

    // Indeksberegning (grow-kolonnen) er bredest – bredere end alle øvrige kolonner.
    expect(styles[2]?.cellWidth).toBeGreaterThan(styles[0]?.cellWidth);
    expect(styles[2]?.cellWidth).toBeGreaterThan(styles[1]?.cellWidth);
    expect(styles[2]?.cellWidth).toBeGreaterThan(styles[3]?.cellWidth);
    expect(styles[2]?.cellWidth).toBeGreaterThan(styles[4]?.cellWidth);
    // Ingen kolonne under nul, og hele tabelbredden er brugt.
    for (const style of Object.values(styles)) {
      expect(style.cellWidth).toBeGreaterThan(0);
    }
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('grow-kolonne: kort indhold → overskuddet fordeles ligeligt mellem alle kolonner', async () => {
    const { createDocumentGrowColumnStyles, createDocumentTableCell, createDocumentTableHeaderCell, renderDocumentTable } =
      await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();

    renderDocumentTable({
      doc: doc as never,
      startY: 40,
      body: [
        [
          createDocumentTableHeaderCell('A', 'center'),
          createDocumentTableHeaderCell('B', 'center'),
          createDocumentTableHeaderCell('C', 'center'),
          createDocumentTableHeaderCell('D', 'center'),
          createDocumentTableHeaderCell('E', 'center'),
        ],
        [
          createDocumentTableCell('x', { halign: 'center' }),
          createDocumentTableCell('x', { halign: 'center' }),
          createDocumentTableCell('100,00', { halign: 'center' }),
          createDocumentTableCell('x', { halign: 'center' }),
          createDocumentTableCell('x', { halign: 'center' }),
        ],
      ],
      columnStyles: createDocumentGrowColumnStyles(5, 2),
    });

    const call = autoTableMock.mock.calls[0]?.[1];
    const styles = call?.columnStyles as Record<number, { cellWidth: number }>;
    const widths = Object.values(styles).map((style) => style.cellWidth);
    const totalWidth = widths.reduce((sum, width) => sum + width, 0);

    // Alt indhold er kort; overskuddet fordeles ligeligt, så differencen mellem
    // bredeste og smalleste kolonne kun skyldes de smalle indholds-min-bredder –
    // ingen kolonne sluger hele overskuddet.
    const min = Math.min(...widths);
    const max = Math.max(...widths);
    expect(max - min).toBeLessThan(PDF_CONTENT_WIDTH_MM / 5);
    expect(totalWidth).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('resolveColumnRightInsetMm: skalerer med bredden og klemmes mellem min og max', async () => {
    const { resolveColumnRightInsetMm } = await import('../../../document/layout/tableSpec');
    const dynamicInset = { kind: 'dynamic', maxMm: 8 } as const;

    // Bred kolonne → fuldt (maks) inset.
    expect(resolveColumnRightInsetMm(60, dynamicInset)).toBe(8);
    // Smal kolonne → reduceret inset (bredde × 0,2).
    expect(resolveColumnRightInsetMm(20, dynamicInset)).toBeCloseTo(4, 6);
    // Meget smal kolonne → gulvet (min).
    expect(resolveColumnRightInsetMm(8, dynamicInset)).toBe(2);
    // Ukendt bredde → falder tilbage til maks.
    expect(resolveColumnRightInsetMm(undefined, dynamicInset)).toBe(8);
    // Monotont ikke-aftagende i bredden.
    expect(resolveColumnRightInsetMm(15, dynamicInset)).toBeLessThan(
      resolveColumnRightInsetMm(25, dynamicInset),
    );
  });

  it('fejler fail-closed når body er tom i stedet for at rendere en blank tabel', async () => {
    const { renderDocumentTable } = await import('../../../pdf/infrastructure/pdfDocumentTableRenderer');

    const doc = new MockJsPDF();

    expect(() =>
      renderDocumentTable({
        doc: doc as never,
        startY: 40,
        body: [],
      })
    ).toThrow(/tom body/i);
    expect(autoTableMock).not.toHaveBeenCalled();
  });
});
