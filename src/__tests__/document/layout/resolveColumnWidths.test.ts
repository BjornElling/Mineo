/// <reference types="vitest/globals" />

import { PDF_CONTENT_WIDTH_MM } from '../../../document/layout/pdfConfig';
import {
  resolveColumnWidths,
  type ColumnTextMeasurer,
  type PdfColumnStyleMap,
} from '../../../document/layout/resolveColumnWidths';
import {
  createDocumentDistributedColumnStyles,
  createDocumentGrowColumnStyles,
  createDocumentTableCell,
  createDocumentTableHeaderCell,
} from '../../../document/layout/documentTableRenderer';

// Ren måle-funktion, der spejler MockJsPDF.getTextWidth i pdfTableRenderer.layout-testen
// (bold bredere pr. tegn, skaleret med fontstørrelse). Determinisme er det eneste krav.
const measure: ColumnTextMeasurer = (text, { fontSize, fontStyle }) =>
  text.length * (fontStyle === 'bold' ? 2.3 : 2.1) * (fontSize / 8);

const widths = (styles: PdfColumnStyleMap | undefined): number[] =>
  Object.keys(styles ?? {})
    .map((key) => Number(key))
    .sort((a, b) => a - b)
    .map((index) => Number(styles?.[index]?.cellWidth));

const totalWidth = (styles: PdfColumnStyleMap | undefined): number =>
  widths(styles).reduce((sum, width) => sum + width, 0);

describe('resolveColumnWidths', () => {
  it('omfordeler distribuerede kolonner, så et bredt beløb ikke ombrydes', () => {
    const initial = PDF_CONTENT_WIDTH_MM / 4;
    const body = [
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
    ];

    const resolved = resolveColumnWidths(measure, body, createDocumentDistributedColumnStyles(4), true);

    expect(Number(resolved?.[2]?.cellWidth)).toBeGreaterThan(initial);
    expect(Number(resolved?.[0]?.cellWidth)).toBeLessThan(initial);
    expect(totalWidth(resolved)).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('bevarer bredder uændret når ingen kolonne har deficit', () => {
    const body = [
      [createDocumentTableHeaderCell('A'), createDocumentTableHeaderCell('B')],
      [createDocumentTableCell('x'), createDocumentTableCell('y')],
    ];
    const resolved = resolveColumnWidths(measure, body, createDocumentDistributedColumnStyles(2), true);
    expect(widths(resolved)).toEqual([PDF_CONTENT_WIDTH_MM / 2, PDF_CONTENT_WIDTH_MM / 2]);
  });

  it('bevarer eksplicit låste kolonner mens frie kolonner omfordeles', () => {
    const initialFree = (PDF_CONTENT_WIDTH_MM - 25) / 3;
    const body = [
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
    ];
    const resolved = resolveColumnWidths(
      measure,
      body,
      createDocumentDistributedColumnStyles(4, { fixedColumns: { 3: 25 } }),
      true
    );
    expect(Number(resolved?.[3]?.cellWidth)).toBe(25);
    expect(Number(resolved?.[2]?.cellWidth)).toBeGreaterThan(initialFree);
    expect(totalWidth(resolved)).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('lader colSpan-celler IKKE drive minimumsbredden', () => {
    const initial = PDF_CONTENT_WIDTH_MM / 4;
    const body = [
      [
        createDocumentTableHeaderCell('A'),
        createDocumentTableHeaderCell('B'),
        createDocumentTableHeaderCell('C'),
        createDocumentTableHeaderCell('D'),
      ],
      [createDocumentTableCell('x'), createDocumentTableCell('x'), createDocumentTableCell('x'), createDocumentTableCell('x')],
      [
        {
          content: 'En meget lang totaltekst der spænder over alle fire kolonner og ellers ville kræve enorm bredde',
          colSpan: 4,
          styles: { halign: 'right' as const },
        },
      ],
    ];
    const resolved = resolveColumnWidths(measure, body, createDocumentDistributedColumnStyles(4), true);
    for (const width of widths(resolved)) {
      expect(width).toBeCloseTo(initial, 6);
    }
  });

  it('falder fail-closed tilbage til de originale styles når deficit > surplus', () => {
    const initial = PDF_CONTENT_WIDTH_MM / 4;
    const body = [
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
    ];
    const resolved = resolveColumnWidths(measure, body, createDocumentDistributedColumnStyles(4), true);
    for (const width of widths(resolved)) {
      expect(width).toBeCloseTo(initial, 6);
    }
  });

  it('grow-kolonne: øvrige kolonner holdes på min-bredde, grow-kolonnen får resten', () => {
    const body = [
      [
        createDocumentTableHeaderCell('Fra', 'center'),
        createDocumentTableHeaderCell('Til', 'center'),
        createDocumentTableHeaderCell('Indeksberegning', 'center'),
        createDocumentTableHeaderCell('Indeks', 'center'),
        createDocumentTableHeaderCell('Lønudvikling', 'center'),
      ],
      [
        createDocumentTableCell('01-01-2024', { halign: 'center' }),
        createDocumentTableCell('31-12-2024', { halign: 'center' }),
        createDocumentTableCell(
          '(41.593,87 x (100,00 % + 12,50 %)) / (38.000,00 x (100,00 % + 8,00 %))',
          { halign: 'center' }
        ),
        createDocumentTableCell('108,00', { halign: 'right' }),
        createDocumentTableCell('+ 8,00 %', { halign: 'right' }),
      ],
    ];
    const resolved = resolveColumnWidths(measure, body, createDocumentGrowColumnStyles(5, 2), true);
    const resolvedWidths = widths(resolved);
    expect(resolvedWidths[2]).toBeGreaterThan(Math.max(resolvedWidths[0], resolvedWidths[1], resolvedWidths[3], resolvedWidths[4]));
    expect(totalWidth(resolved)).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
    for (const width of resolvedWidths) expect(width).toBeGreaterThan(0);
  });

  it('grow-kolonne: kort indhold → overskuddet fordeles ligeligt', () => {
    const body = [
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
    ];
    const resolved = resolveColumnWidths(measure, body, createDocumentGrowColumnStyles(5, 2), true);
    const resolvedWidths = widths(resolved);
    expect(Math.max(...resolvedWidths) - Math.min(...resolvedWidths)).toBeLessThan(PDF_CONTENT_WIDTH_MM / 5);
    expect(totalWidth(resolved)).toBeCloseTo(PDF_CONTENT_WIDTH_MM, 6);
  });

  it('måling = null (Word / degraderet jsPDF) → statisk fordeling uændret', () => {
    const body = [
      [createDocumentTableHeaderCell('Periode'), createDocumentTableHeaderCell('Beløb')],
      [createDocumentTableCell('Jan'), createDocumentTableCell('1.234.567,89 kr.', { halign: 'right' })],
    ];
    const distributed = createDocumentDistributedColumnStyles(2);
    const resolved = resolveColumnWidths(null, body, distributed, true);
    // Uændret: samme reference returneres når der ikke kan måles.
    expect(resolved).toBe(distributed);
    expect(widths(resolved)).toEqual([PDF_CONTENT_WIDTH_MM / 2, PDF_CONTENT_WIDTH_MM / 2]);
  });

  it('returnerer input uændret når columnStyles mangler layout-metadata', () => {
    const plain: PdfColumnStyleMap = { 0: { cellWidth: 50 }, 1: { cellWidth: 50 } };
    const body = [[createDocumentTableCell('a'), createDocumentTableCell('b')]];
    expect(resolveColumnWidths(measure, body, plain, false)).toBe(plain);
  });
});
