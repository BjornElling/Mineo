import autoTable, { type CellDef, type CellHookData, type RowInput, type Styles } from 'jspdf-autotable';
import type jsPDF from 'jspdf';
import {
  COLORS,
  MARGINS,
  PDF_CONTENT_WIDTH_MM,
  PDF_FONT_FAMILY,
  PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_MM,
  PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_PT,
  TABLE_STYLES,
} from '../infrastructure/pdfConfig';
import { createJsPdfAdapter } from '../infrastructure/jsPdfAdapter';
import { normalizeRightAlignedTextForPdf } from './pdfTextUtils';

export const TABLE_FONT_SIZE = 8;
export const EO_TABLE_CELL_PADDING = TABLE_STYLES.cellPadding;

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
type PdfTableCellPosition = Readonly<{ rowIndex: number; columnIndex: number }>;
type PdfColumnStyle = Readonly<{ cellWidth: number | 'auto'; halign?: PdfCellAlign }>;
type PdfDistributedColumnInput = number | Readonly<{ cellWidth: number; halign?: PdfCellAlign }>;
export type PdfSummedTotalRow = Readonly<{
  row: RowInput;
  valueCellColumnIndex: number;
  valueCellColSpan: number;
  formattedValue: string;
  estimatedValueMinWidthMm: number;
}>;
type PdfTotalRowOptions = Readonly<{
  columnCount: number;
  valueColumnIndex: number;
  labelColumnIndex?: number;
  labelAlign?: PdfCellAlign;
  valueAlign?: PdfCellAlign;
  valueColSpan?: number;
  /**
   * Styrer om total-cellens outputværdi ender på ` kr.` (NBSP + "kr.").
   *
   * Kontrakt: `normalizePdfTotalFormattedValue` trimmer altid et eksisterende
   * `kr.`-suffix væk og påtrykker derefter suffix hvis og kun hvis dette flag
   * er `true`. Det gør flaget idempotent i forhold til formatter-valg:
   * - `formatMoneyOreWithKrTrimmed` + `valueHasKrSuffix: false` → suffix trimmes, ikke genpåført.
   * - `formatMoneyOreWithKrTrimmed` + `valueHasKrSuffix: true`  → suffix trimmes, derefter genpåført.
   * - `formatCurrencyFromOreTrimmed` + `valueHasKrSuffix: true` → suffix tilføjes.
   *
   * Undgå derfor at "låse" call-sites til en specifik formatter ud fra antagelsen om,
   * at den allerede indeholder `kr.` — flaget alene bestemmer slut-outputtet.
   */
  valueHasKrSuffix?: boolean;
  preserveValueColumn?: boolean;
}>;

const PDF_TOTAL_VALUE_CHAR_WIDTH_MM = 2.2;
const PDF_TOTAL_VALUE_WIDTH_PADDING_MM = 6;
const NBSP = '\u00A0';

const normalizePdfTableCellContent = (content: string, halign?: PdfCellAlign): string => {
  return halign === 'right' ? normalizeRightAlignedTextForPdf(content) : content;
};

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
  return { content: normalizePdfTableCellContent(content, options?.halign), styles };
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

export const resolvePdfTotalValueMinWidthMm = (
  formattedValue: string,
  options?: Readonly<{
    charWidthMm?: number;
    paddingMm?: number;
    minWidthMm?: number;
  }>
): number => {
  const charWidthMm = options?.charWidthMm ?? PDF_TOTAL_VALUE_CHAR_WIDTH_MM;
  const paddingMm = options?.paddingMm ?? PDF_TOTAL_VALUE_WIDTH_PADDING_MM;
  const minWidthMm = options?.minWidthMm ?? 0;
  const normalizedValue = formattedValue.trim();
  const estimatedWidth = (normalizedValue.length * charWidthMm) + paddingMm;
  return Math.max(minWidthMm, estimatedWidth);
};

// Trimmer altid eksisterende `kr.`-suffix fra input og påtrykker derefter suffix
// hvis og kun hvis `valueHasKrSuffix` er true. Se JSDoc på PdfTotalRowOptions.valueHasKrSuffix.
const normalizePdfTotalFormattedValue = (
  formattedValue: string,
  valueHasKrSuffix: boolean,
  valueAlign: PdfCellAlign
): string => {
  const trimmed = formattedValue.trim();
  const withoutKrSuffix = trimmed.replace(/(?:\u00A0|\s)*kr\.$/i, '').trimEnd();
  const withSuffix = valueHasKrSuffix ? `${withoutKrSuffix}${NBSP}kr.` : withoutKrSuffix;
  return normalizePdfTableCellContent(withSuffix, valueAlign);
};

const buildPdfTotalRow = (
  label: string,
  formattedValue: string,
  options: PdfTotalRowOptions
): PdfSummedTotalRow => {
  const {
    columnCount,
    valueColumnIndex,
    labelColumnIndex = 0,
    labelAlign = 'left',
    valueAlign = 'right',
    valueColSpan = 1,
    valueHasKrSuffix = false,
    preserveValueColumn = false,
  } = options;

  if (!Number.isInteger(columnCount) || columnCount <= 1) {
    throw new Error(`Ugyldigt kolonneantal for PDF-sammentællingslinje: ${String(columnCount)}.`);
  }
  if (!Number.isInteger(labelColumnIndex) || labelColumnIndex < 0 || labelColumnIndex >= columnCount) {
    throw new Error(`Ugyldigt label-kolonneindex for PDF-sammentællingslinje: ${String(labelColumnIndex)}.`);
  }
  if (!Number.isInteger(valueColumnIndex) || valueColumnIndex < 0 || valueColumnIndex >= columnCount) {
    throw new Error(`Ugyldigt værdi-kolonneindex for PDF-sammentællingslinje: ${String(valueColumnIndex)}.`);
  }
  if (!Number.isInteger(valueColSpan) || valueColSpan <= 0) {
    throw new Error(`Ugyldigt værdi-colSpan for PDF-sammentællingslinje: ${String(valueColSpan)}.`);
  }

  const valueColumnEndExclusive = valueColumnIndex + valueColSpan;
  if (valueColumnEndExclusive > columnCount) {
    throw new Error(
      `Værdi-cellen i PDF-sammentællingslinjen rækker ud over tabellens kolonner (${valueColumnEndExclusive} > ${columnCount}).`
    );
  }
  if (labelColumnIndex >= valueColumnIndex) {
    throw new Error('PDF-sammentællingslinjen kræver, at label-kolonnen ligger til venstre for værdi-kolonnen.');
  }
  const normalizedFormattedValue = normalizePdfTotalFormattedValue(formattedValue, valueHasKrSuffix, valueAlign);
  const row: PdfTableCell[] = [];
  const valueCellColumnIndex = preserveValueColumn ? valueColumnIndex : Math.min(labelColumnIndex + 1, valueColumnIndex);
  const valueCellColSpan = valueColumnEndExclusive - valueCellColumnIndex;

  for (let index = 0; index < columnCount; index += 1) {
    if (index === labelColumnIndex) {
      row.push(createPdfTableCell(label, { halign: labelAlign, bold: true }));
      continue;
    }

    if (index === valueCellColumnIndex) {
      row.push({
        content: normalizedFormattedValue,
        colSpan: valueCellColSpan,
        styles: {
          halign: valueAlign,
          fontStyle: 'bold',
          // ColSpan-celler kan ellers arve højre-padding fra startkolonnen i spændet.
          // Det kan rykke totalbeløbet ind, når startkolonnen har custom inset.
          cellPadding: EO_TABLE_CELL_PADDING,
        },
      });
      index += valueCellColSpan - 1;
      continue;
    }

    row.push(createPdfTableCell(''));
  }

  return {
    row,
    valueCellColumnIndex,
    valueCellColSpan,
    formattedValue: normalizedFormattedValue,
    estimatedValueMinWidthMm: resolvePdfTotalValueMinWidthMm(normalizedFormattedValue),
  };
};

export const createPdfTableFormattedTotalRow = (
  label: string,
  formattedValue: string,
  options: PdfTotalRowOptions
): PdfSummedTotalRow => {
  return buildPdfTotalRow(label, formattedValue, options);
};

export const createPdfTableSummedTotalRow = (
  label: string,
  values: ReadonlyArray<number>,
  options: Readonly<{
    columnCount: number;
    valueColumnIndex: number;
    formatValue: (total: number) => string;
    labelColumnIndex?: number;
    labelAlign?: PdfCellAlign;
    valueAlign?: PdfCellAlign;
    valueColSpan?: number;
    valueHasKrSuffix?: boolean;
    preserveValueColumn?: boolean;
  }>
) : PdfSummedTotalRow | null => {
  // En sammentællingslinje giver kun mening når der summeres mindst to rækker.
  // Callsites skal derfor håndtere `null` som "ingen totalrække".
  if (values.length <= 1) return null;

  const total = values.reduce((sum, value) => sum + value, 0);
  return buildPdfTotalRow(label, options.formatValue(total), options);
};

export const createPdfFixedColumnStyles = (
  columnCount: number,
  cellWidth: number | 'auto',
  halign?: PdfCellAlign
): Record<number, PdfColumnStyle> => {
  return Object.fromEntries(
    Array.from({ length: columnCount }, (_, index) => [
      index,
      halign ? { cellWidth, halign } : { cellWidth },
    ])
  ) as Record<number, PdfColumnStyle>;
};

export const createPdfDistributedColumnStyles = (
  columnCount: number,
  options?: Readonly<{
    fixedColumns?: Readonly<Record<number, PdfDistributedColumnInput>>;
    tableWidth?: number;
    defaultHalign?: PdfCellAlign;
  }>
): Record<number, PdfColumnStyle> => {
  if (!Number.isInteger(columnCount) || columnCount <= 0) {
    throw new Error(`Ugyldigt kolonneantal for PDF-tabel: ${String(columnCount)}.`);
  }

  const tableWidth = options?.tableWidth ?? PDF_CONTENT_WIDTH_MM;
  if (!Number.isFinite(tableWidth) || tableWidth <= 0) {
    throw new Error(`Ugyldig tabelbredde for PDF-tabel: ${String(tableWidth)}.`);
  }

  const defaultHalign = options?.defaultHalign;
  const fixedColumns = options?.fixedColumns ?? {};
  const normalizedFixedColumns = Object.entries(fixedColumns).map(([rawIndex, rawValue]) => {
    const index = Number(rawIndex);
    if (!Number.isInteger(index) || index < 0 || index >= columnCount) {
      throw new Error(`Ugyldigt kolonneindex for PDF-tabel: ${rawIndex}.`);
    }

    const resolved = typeof rawValue === 'number' ? { cellWidth: rawValue } : rawValue;
    if (!Number.isFinite(resolved.cellWidth) || resolved.cellWidth <= 0) {
      throw new Error(`Ugyldig manuel kolonnebredde for PDF-tabel ved kolonne ${rawIndex}.`);
    }

    return {
      index,
      cellWidth: resolved.cellWidth,
      halign: resolved.halign ?? defaultHalign,
    };
  });

  const fixedWidthTotal = normalizedFixedColumns.reduce((sum, column) => sum + column.cellWidth, 0);
  const remainingColumnCount = columnCount - normalizedFixedColumns.length;
  const remainingWidth = tableWidth - fixedWidthTotal;
  const epsilon = 1e-6;

  if (remainingColumnCount === 0) {
    if (Math.abs(remainingWidth) > epsilon) {
      throw new Error(
        `Manuelle PDF-kolonnebredder skal udfylde hele tabelbredden (${tableWidth}) når alle kolonner er låst.`
      );
    }
  } else if (remainingWidth <= epsilon) {
    throw new Error(
      `Manuelle PDF-kolonnebredder (${fixedWidthTotal}) overstiger eller udfylder hele tabelbredden (${tableWidth}).`
    );
  }

  const autoWidth = remainingColumnCount > 0 ? remainingWidth / remainingColumnCount : 0;
  const fixedColumnMap = new Map(normalizedFixedColumns.map((column) => [column.index, column]));

  return Object.fromEntries(
    Array.from({ length: columnCount }, (_, index) => {
      const fixedColumn = fixedColumnMap.get(index);
      if (fixedColumn) {
        return [
          index,
          fixedColumn.halign
            ? { cellWidth: fixedColumn.cellWidth, halign: fixedColumn.halign }
            : { cellWidth: fixedColumn.cellWidth },
        ];
      }

      return [
        index,
        defaultHalign
          ? { cellWidth: autoWidth, halign: defaultHalign }
          : { cellWidth: autoWidth },
      ];
    })
  ) as Record<number, PdfColumnStyle>;
};

export const renderPdfTable = (params: Readonly<{
  doc: jsPDF;
  startY: number;
  body: RowInput[];
  columnStyles?: PdfTableColumnStyles;
  tableWidth?: number;
  hasHeaderRow?: boolean;
  transparentRowIndices?: readonly number[];
  // Bruges til total- eller kontrolceller, fx:
  // [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }]
  underlinedCellPositions?: readonly PdfTableCellPosition[];
  estimatedRowHeight?: number;
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
    underlinedCellPositions = [],
    estimatedRowHeight = 8,
    didParseCell,
    didDrawCell,
  } = params;

  const transparentSet = new Set(transparentRowIndices);
  const underlinedCellSet = new Set(
    underlinedCellPositions.map(({ rowIndex, columnIndex }) => `${rowIndex}:${columnIndex}`)
  );
  const pageHeight = createJsPdfAdapter(doc).getPageHeight();
  const contentBottom = pageHeight - MARGINS.bottom;
  const remainingHeight = contentBottom - startY;
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
      fontSize: TABLE_FONT_SIZE,
      cellPadding: EO_TABLE_CELL_PADDING,
      textColor: COLORS.text,
    },
    columnStyles,
    didParseCell: (data: CellHookData) => {
      const resolvedHalign = data.cell.styles.halign;
      if (resolvedHalign === 'right' && Array.isArray(data.cell.text)) {
        data.cell.text = data.cell.text.map((line) => normalizeRightAlignedTextForPdf(line));
      }

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
    didDrawCell: (data) => {
      if (underlinedCellSet.has(`${data.row.index}:${data.column.index}`)) {
        const availableWidth = Math.max(0, data.cell.width - (EO_TABLE_CELL_PADDING * 2));
        const lineWidth = Math.min(PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_MM, availableWidth);
        const lineEnd = data.cell.x + data.cell.width - EO_TABLE_CELL_PADDING;
        const lineStart = lineEnd - lineWidth;
        doc.setLineWidth(PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_PT);
        doc.setDrawColor(...COLORS.black);
        doc.line(lineStart, data.cell.y, lineEnd, data.cell.y);
      }

      if (didDrawCell) {
        didDrawCell(data);
      }
    },
  });

  return ((doc as PdfAutoTableDoc).lastAutoTable?.finalY ?? startY);
};
