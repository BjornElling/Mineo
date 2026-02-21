import autoTable, { type CellDef, type CellHookData, type RowInput, type Styles } from 'jspdf-autotable';
import type jsPDF from 'jspdf';
import { COLORS, MARGINS, PDF_CONTENT_WIDTH_MM, PDF_FONT_FAMILY, TABLE_STYLES } from './pdfConfig';

export const EO_TABLE_FONT_SIZE = 8;
export const EO_TABLE_CELL_PADDING = 1.5;

type PdfAutoTableDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

type PdfTableColumnStyles = NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'];
type PdfTableCell = CellDef;
type PdfCellAlign = 'left' | 'center' | 'right';
type PdfCellVAlign = 'top' | 'middle' | 'bottom';
type PdfTableCellStyles = Partial<Styles>;

export const createPdfTableCell = (
  content: string,
  options?: Readonly<{
    halign?: PdfCellAlign;
    valign?: PdfCellVAlign;
    bold?: boolean;
    transparent?: boolean;
    fontSize?: number;
  }>
): PdfTableCell => {
  const styles: PdfTableCellStyles = {};
  if (options?.halign) styles.halign = options.halign;
  if (options?.valign) styles.valign = options.valign;
  if (options?.bold) styles.fontStyle = 'bold';
  if (options?.transparent) styles.fillColor = false;
  if (typeof options?.fontSize === 'number') styles.fontSize = options.fontSize;
  return { content, styles };
};

export const cellLeft = (content: string): PdfTableCell => createPdfTableCell(content, { halign: 'left' });
export const cellRight = (content: string): PdfTableCell => createPdfTableCell(content, { halign: 'right' });
export const cellCenter = (content: string): PdfTableCell => createPdfTableCell(content, { halign: 'center' });
export const cellRightBold = (content: string): PdfTableCell =>
  createPdfTableCell(content, { halign: 'right', bold: true });

export const createPdfTableHeaderCell = (
  content: string,
  halign: PdfCellAlign = 'left'
): PdfTableCell => createPdfTableCell(content, { halign, bold: true });

export const createPdfTableTransparentRow = (columnCount: number): RowInput => {
  return Array.from({ length: columnCount }, () => createPdfTableCell('', { transparent: true }));
};

export const createPdfFixedColumnStyles = (
  columnCount: number,
  cellWidth: number | 'auto',
  halign?: PdfCellAlign
): Record<number, Readonly<{ cellWidth: number | 'auto'; halign?: PdfCellAlign }>> => {
  return Object.fromEntries(
    Array.from({ length: columnCount }, (_, index) => [
      index,
      halign ? { cellWidth, halign } : { cellWidth },
    ])
  ) as Record<number, Readonly<{ cellWidth: number | 'auto'; halign?: PdfCellAlign }>>;
};

export const renderEoStylePdfTable = (params: Readonly<{
  doc: jsPDF;
  startY: number;
  body: RowInput[];
  columnStyles?: PdfTableColumnStyles;
  tableWidth?: number;
  hasHeaderRow?: boolean;
  transparentRowIndices?: readonly number[];
  didParseCell?: (data: CellHookData) => void;
  didDrawCell?: NonNullable<Parameters<typeof autoTable>[1]>['didDrawCell'];
}>): number => {
  const {
    doc,
    startY,
    body,
    columnStyles,
    tableWidth = PDF_CONTENT_WIDTH_MM,
    hasHeaderRow = true,
    transparentRowIndices = [],
    didParseCell,
    didDrawCell,
  } = params;

  const transparentSet = new Set(transparentRowIndices);
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentBottom = pageHeight - MARGINS.bottom;
  const remainingHeight = contentBottom - startY;
  const estimatedRowHeight = 8;
  const rowsToKeepTogether = Math.min(body.length, 2);
  const requiredHeight = estimatedRowHeight * rowsToKeepTogether;
  const resolvedStartY = remainingHeight < requiredHeight ? MARGINS.top : startY;

  if (resolvedStartY === MARGINS.top && remainingHeight < requiredHeight) {
    doc.addPage();
  }

  autoTable(doc, {
    startY: resolvedStartY,
    head: [],
    body,
    margin: { left: MARGINS.left, right: MARGINS.right },
    pageBreak: 'auto',
    rowPageBreak: 'auto',
    tableWidth,
    styles: {
      font: PDF_FONT_FAMILY,
      fontSize: EO_TABLE_FONT_SIZE,
      cellPadding: EO_TABLE_CELL_PADDING,
      textColor: COLORS.text,
    },
    columnStyles,
    didParseCell: (data: CellHookData) => {
      if (hasHeaderRow && data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        data.cell.styles.valign = 'bottom';
        data.cell.styles.overflow = 'linebreak';
      } else if (transparentSet.has(data.row.index)) {
        data.cell.styles.fillColor = false;
      } else {
        const stripingIndex = hasHeaderRow ? data.row.index : data.row.index + 1;
        data.cell.styles.fillColor =
          stripingIndex % 2 === 0 ? TABLE_STYLES.alternateRowBackgroundColor : false;
      }

      if (didParseCell) {
        didParseCell(data);
      }
    },
    didDrawCell,
  });

  return ((doc as PdfAutoTableDoc).lastAutoTable?.finalY ?? startY);
};
