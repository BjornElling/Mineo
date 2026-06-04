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
import { normalizeRightAlignedTextForPdf, normalizeTextForPdf } from './pdfTextUtils';
import { DEFAULT_NUMERIC_TOLERANCE } from '../../utils/numberComparison';
import { isDocxTableBridgeDocument, type DocxColumnAlignments } from '../../docx/infrastructure/docxTableBridge';

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
type PdfDistributedColumnLayoutMeta = Readonly<{
  tableWidth: number;
  fixedColumnIndices: readonly number[];
  distributedColumnIndices: readonly number[];
}>;
type PdfMeasuredDoc = jsPDF & Readonly<{
  getFont?: () => Readonly<{ fontName: string; fontStyle: string }>;
  getFontSize?: () => number;
}>;
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
const PDF_COLUMN_LAYOUT_META = Symbol('pdfColumnLayoutMeta');
const PDF_TEXT_MEASUREMENT_BUFFER_MM = 0.8;
const PDF_WIDTH_EPSILON = 1e-4;

// IMPORTANT:
// Symbol-metadataen er bevidst knyttet direkte til det returnerede styles-objekt.
// Hvis en call-site kopierer `columnStyles` via spread/Object.assign/JSON, tabes
// metadataen og den adaptive omfordeling deaktiveres lydløst. Det er et fail-closed
// valg: tabellen falder tilbage til den statiske fordelingsbredde frem for at gætte.
type PdfColumnStylesWithMeta = Record<number, PdfColumnStyle> & Readonly<{
  [PDF_COLUMN_LAYOUT_META]?: PdfDistributedColumnLayoutMeta;
}>;

const normalizePdfTableCellContent = (content: string, halign?: PdfCellAlign): string => {
  return halign === 'right' ? normalizeRightAlignedTextForPdf(content) : content;
};

const attachPdfColumnLayoutMeta = (
  styles: Record<number, PdfColumnStyle>,
  meta: PdfDistributedColumnLayoutMeta
): Record<number, PdfColumnStyle> => {
  Object.defineProperty(styles, PDF_COLUMN_LAYOUT_META, {
    value: meta,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return styles;
};

const resolvePdfColumnLayoutMeta = (
  columnStyles?: PdfTableColumnStyles
): PdfDistributedColumnLayoutMeta | null => {
  const maybeWithMeta = columnStyles as PdfColumnStylesWithMeta | undefined;
  return maybeWithMeta?.[PDF_COLUMN_LAYOUT_META] ?? null;
};

const resolvePdfColumnRedistributionTargetIndex = (
  distributedColumnIndices: readonly number[],
  nextStyles: Record<number, PdfColumnStyle>,
  requiredWidths: ReadonlyMap<number, number>,
  residualWidth: number
): number | null => {
  if (distributedColumnIndices.length === 0) return null;

  if (residualWidth >= 0) {
    return distributedColumnIndices.reduce<number | null>((selectedIndex, index) => {
      const currentWidth = Number(nextStyles[index]?.cellWidth ?? -Infinity);
      const requiredWidth = requiredWidths.get(index) ?? 0;
      const slack = currentWidth - requiredWidth;

      if (selectedIndex === null) {
        return index;
      }

      const selectedWidth = Number(nextStyles[selectedIndex]?.cellWidth ?? -Infinity);
      const selectedRequired = requiredWidths.get(selectedIndex) ?? 0;
      const selectedSlack = selectedWidth - selectedRequired;
      return slack > selectedSlack ? index : selectedIndex;
    }, null);
  }

  return distributedColumnIndices.reduce<number | null>((selectedIndex, index) => {
    const currentWidth = Number(nextStyles[index]?.cellWidth ?? 0);
    const requiredWidth = requiredWidths.get(index) ?? 0;
    const slack = currentWidth - requiredWidth;

    if (slack + residualWidth < -PDF_WIDTH_EPSILON) {
      return selectedIndex;
    }

    if (selectedIndex === null) {
      return index;
    }

    const selectedWidth = Number(nextStyles[selectedIndex]?.cellWidth ?? 0);
    const selectedRequired = requiredWidths.get(selectedIndex) ?? 0;
    const selectedSlack = selectedWidth - selectedRequired;
    return slack > selectedSlack ? index : selectedIndex;
  }, null);
};

const resolveHorizontalCellPadding = (styles?: PdfTableCellStyles): number => {
  const padding = styles?.cellPadding;
  if (typeof padding === 'number' && Number.isFinite(padding)) {
    return padding * 2;
  }

  if (Array.isArray(padding)) {
    const right = typeof padding[1] === 'number' && Number.isFinite(padding[1]) ? padding[1] : 0;
    const left = typeof padding[3] === 'number' && Number.isFinite(padding[3]) ? padding[3] : right;
    return left + right;
  }

  if (padding && typeof padding === 'object') {
    const left = typeof padding.left === 'number' && Number.isFinite(padding.left) ? padding.left : 0;
    const right = typeof padding.right === 'number' && Number.isFinite(padding.right) ? padding.right : 0;
    return left + right;
  }

  return EO_TABLE_CELL_PADDING * 2;
};

const isPdfTableCell = (value: unknown): value is PdfTableCell => {
  return typeof value === 'object' && value !== null && 'content' in value;
};

const resolvePdfCellTextContent = (cell: unknown): string => {
  if (isPdfTableCell(cell)) {
    return typeof cell.content === 'string' ? cell.content : String(cell.content ?? '');
  }

  return typeof cell === 'string' ? cell : String(cell ?? '');
};

const resolvePdfCellColSpan = (cell: unknown): number => {
  if (!isPdfTableCell(cell)) return 1;
  return typeof cell.colSpan === 'number' && Number.isInteger(cell.colSpan) && cell.colSpan > 1 ? cell.colSpan : 1;
};

const resolvePdfCellStyles = (cell: unknown): PdfTableCellStyles | undefined => {
  return isPdfTableCell(cell) ? cell.styles : undefined;
};

const canMeasurePdfText = (doc: jsPDF): doc is jsPDF & Readonly<{
  getTextWidth: (text: string) => number;
  setFont: (family: string, style: string) => void;
  setFontSize: (size: number) => void;
}> => {
  const maybeDoc = doc as Partial<jsPDF> & Readonly<Record<string, unknown>>;
  return (
    typeof maybeDoc.getTextWidth === 'function' &&
    typeof maybeDoc.setFont === 'function' &&
    typeof maybeDoc.setFontSize === 'function'
  );
};

const measurePdfTextWidthMm = (
  doc: jsPDF,
  text: string,
  options?: Readonly<{
    fontSize?: number;
    fontStyle?: 'normal' | 'bold';
    halign?: PdfCellAlign;
  }>
): number => {
  if (!canMeasurePdfText(doc)) {
    return 0;
  }

  const lines = (
    options?.halign === 'right' ? normalizeRightAlignedTextForPdf(text) : normalizeTextForPdf(text)
  ).split('\n');
  const measuredDoc = doc as PdfMeasuredDoc;
  const previousFont = measuredDoc.getFont?.();
  const previousFontSize = measuredDoc.getFontSize?.();

  doc.setFont(PDF_FONT_FAMILY, options?.fontStyle ?? 'normal');
  doc.setFontSize(options?.fontSize ?? TABLE_FONT_SIZE);

  const width = lines.reduce((maxWidth, line) => Math.max(maxWidth, doc.getTextWidth(line)), 0);

  if (previousFont) {
    doc.setFont(previousFont.fontName, previousFont.fontStyle);
  }
  if (typeof previousFontSize === 'number') {
    doc.setFontSize(previousFontSize);
  }

  return width;
};

const resolveAdaptiveDistributedColumnStyles = (
  doc: jsPDF,
  body: RowInput[],
  columnStyles: PdfTableColumnStyles | undefined,
  hasHeaderRow: boolean
): PdfTableColumnStyles | undefined => {
  const layoutMeta = resolvePdfColumnLayoutMeta(columnStyles);
  if (!layoutMeta || !columnStyles) {
    return columnStyles;
  }
  if (!canMeasurePdfText(doc)) {
    return columnStyles;
  }

  const currentWidths = new Map<number, number>();
  for (const [rawIndex, style] of Object.entries(columnStyles)) {
    const index = Number(rawIndex);
    if (!Number.isInteger(index)) continue;
    if (typeof style?.cellWidth !== 'number' || !Number.isFinite(style.cellWidth) || style.cellWidth <= 0) {
      return columnStyles;
    }
    currentWidths.set(index, style.cellWidth);
  }

  if (currentWidths.size === 0 || layoutMeta.distributedColumnIndices.length === 0) {
    return columnStyles;
  }

  const requiredWidths = new Map<number, number>();
  for (const index of currentWidths.keys()) {
    requiredWidths.set(index, 0);
  }

  for (const [rowIndex, row] of body.entries()) {
    if (!Array.isArray(row)) continue;

    let columnIndex = 0;
    const isHeaderRow = hasHeaderRow && rowIndex === 0;

    for (const cell of row) {
      const colSpan = resolvePdfCellColSpan(cell);
      // ColSpan-celler driver ikke minimumsbreddeestimatet.
      // Det er en bevidst invariant: headers i de kendte standardtabeller er 1:1
      // med kolonner, mens body-colSpan typisk bruges til totaler og må ikke tvinge
      // ekstra bredde på tværs af flere kolonner.
      if (colSpan === 1) {
        const styles = resolvePdfCellStyles(cell);
        const fontStyle = styles?.fontStyle === 'bold' || isHeaderRow ? 'bold' : 'normal';
        const fontSize = typeof styles?.fontSize === 'number' ? styles.fontSize : TABLE_FONT_SIZE;
        const halign = styles?.halign as PdfCellAlign | undefined;
        const requiredWidth =
          measurePdfTextWidthMm(doc, resolvePdfCellTextContent(cell), {
            fontSize,
            fontStyle,
            halign,
          }) +
          resolveHorizontalCellPadding(styles) +
          PDF_TEXT_MEASUREMENT_BUFFER_MM;

        const previous = requiredWidths.get(columnIndex) ?? 0;
        if (requiredWidth > previous) {
          requiredWidths.set(columnIndex, requiredWidth);
        }
      }

      columnIndex += colSpan;
    }
  }

  const deficits = layoutMeta.distributedColumnIndices
    .map((index) => {
      const current = currentWidths.get(index) ?? 0;
      const required = requiredWidths.get(index) ?? 0;
      return { index, current, required, delta: required - current };
    })
    .filter((entry) => entry.delta > PDF_WIDTH_EPSILON);

  if (deficits.length === 0) {
    return columnStyles;
  }

  const donors = layoutMeta.distributedColumnIndices
    .map((index) => {
      const current = currentWidths.get(index) ?? 0;
      const required = requiredWidths.get(index) ?? 0;
      return { index, current, required, surplus: current - required };
    })
    .filter((entry) => entry.surplus > PDF_WIDTH_EPSILON);

  const totalDeficit = deficits.reduce((sum, entry) => sum + entry.delta, 0);
  const totalSurplus = donors.reduce((sum, entry) => sum + entry.surplus, 0);
  if (totalDeficit > totalSurplus + PDF_WIDTH_EPSILON) {
    return columnStyles;
  }

  const nextStyles: Record<number, PdfColumnStyle> = {};
  for (const [rawIndex, style] of Object.entries(columnStyles)) {
    const index = Number(rawIndex);
    nextStyles[index] = {
      cellWidth: currentWidths.get(index) ?? 0,
      ...(style?.halign ? { halign: style.halign as PdfCellAlign } : {}),
    };
  }

  for (const deficit of deficits) {
    nextStyles[deficit.index] = {
      ...nextStyles[deficit.index],
      cellWidth: deficit.required,
    };
  }

  for (const donor of donors) {
    const share = totalSurplus <= PDF_WIDTH_EPSILON ? 0 : (donor.surplus / totalSurplus) * totalDeficit;
    nextStyles[donor.index] = {
      ...nextStyles[donor.index],
      cellWidth: donor.current - share,
    };
  }

  const resolvedTotalWidth = Object.values(nextStyles).reduce((sum, style) => {
    return sum + (typeof style.cellWidth === 'number' ? style.cellWidth : 0);
  }, 0);
  const residualWidth = layoutMeta.tableWidth - resolvedTotalWidth;
  if (Math.abs(residualWidth) > PDF_WIDTH_EPSILON) {
    const targetIndex = resolvePdfColumnRedistributionTargetIndex(
      layoutMeta.distributedColumnIndices,
      nextStyles,
      requiredWidths,
      residualWidth
    );
    if (targetIndex === null) {
      // `nextStyles` kasseres bevidst her og vi falder fail-closed tilbage til
      // de originale, umodificerede styles.
      return columnStyles;
    }

    const currentWidth = Number(nextStyles[targetIndex]?.cellWidth ?? 0);
    const nextWidth = currentWidth + residualWidth;
    const requiredWidth = requiredWidths.get(targetIndex) ?? 0;
    if (nextWidth + PDF_WIDTH_EPSILON < requiredWidth) {
      // `nextStyles` kasseres bevidst her og vi falder fail-closed tilbage til
      // de originale, umodificerede styles.
      return columnStyles;
    }

    nextStyles[targetIndex] = {
      ...nextStyles[targetIndex],
      cellWidth: nextWidth,
    };
  }

  return attachPdfColumnLayoutMeta(nextStyles, layoutMeta);
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

export const createPdfTableHeaderCell = (
  content: string,
  halign: PdfCellAlign = 'left'
): PdfTableCell => createPdfTableCell(content, { halign, bold: true });

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
  const epsilon = DEFAULT_NUMERIC_TOLERANCE;

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
  const styles = Object.fromEntries(
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

  return attachPdfColumnLayoutMeta(styles, {
    tableWidth,
    fixedColumnIndices: normalizedFixedColumns.map((column) => column.index),
    distributedColumnIndices: Array.from({ length: columnCount }, (_, index) => index)
      .filter((index) => !fixedColumnMap.has(index)),
  });
};

// Udleder kolonne→justering for data-rækker, som Word-broen kan anvende, så
// .docx-tabeller matcher PDF'ens justering. PDF'en udleder selv justering fra
// `columnStyles` og `didParseCell`; broen kan kun se cellernes egen halign, så
// vi samler kolonne-niveauet (og evt. hook-override) her. `dataRowColumnHalign`
// vinder over `columnStyles`, fordi PDF-hooks kører efter kolonne-styles.
const resolveDocxColumnAlignments = (
  columnStyles: PdfTableColumnStyles | undefined,
  dataRowColumnHalign: Readonly<Record<number, PdfCellAlign>> | undefined
): DocxColumnAlignments | undefined => {
  const alignments: Record<number, PdfCellAlign> = {};

  if (columnStyles) {
    for (const [rawIndex, style] of Object.entries(columnStyles)) {
      const index = Number(rawIndex);
      if (!Number.isInteger(index)) continue;
      const halign = (style as PdfColumnStyle | undefined)?.halign;
      if (halign === 'left' || halign === 'center' || halign === 'right') {
        alignments[index] = halign;
      }
    }
  }

  if (dataRowColumnHalign) {
    for (const [rawIndex, halign] of Object.entries(dataRowColumnHalign)) {
      const index = Number(rawIndex);
      if (Number.isInteger(index)) {
        alignments[index] = halign;
      }
    }
  }

  return Object.keys(alignments).length > 0 ? alignments : undefined;
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
  // Justering pr. kolonne for data-rækker, som ikke fremgår af de enkelte celler
  // (typisk en `didParseCell`-hook der højrejusterer en talkolonne). Bruges KUN
  // til at give Word samme justering som PDF — PDF'en får sin justering fra
  // `columnStyles`/`didParseCell` som hidtil. Cellens egen `halign` vinder altid.
  dataRowColumnHalign?: Readonly<Record<number, PdfCellAlign>>;
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
    dataRowColumnHalign,
  } = params;

  if (isDocxTableBridgeDocument(doc)) {
    if (body.length === 0) {
      throw new Error('renderPdfTable kaldt med tom body — tabellen skulle være undertrykt eller have en eksplicit tom-tilstandsrække i kalderen.');
    }
    doc.addDocxTableFromPdfRows(body, hasHeaderRow, resolveDocxColumnAlignments(columnStyles, dataRowColumnHalign));
    return startY;
  }

  // Fail-closed: en tom tabel-body er altid en fejl i kalderen (en sektion der skulle
  // have været undertrykt eller fået en eksplicit "Ingen ..."-række før kaldet). At
  // rendere en blank tabel i et tillidskritisk dokument ville skjule fejlen. Kast hellere,
  // så download-stien router fejlen via reportSystemIssue (jf. pdf-contract §5).
  if (body.length === 0) {
    throw new Error('renderPdfTable kaldt med tom body — tabellen skulle være undertrykt eller have en eksplicit tom-tilstandsrække i kalderen.');
  }

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
  const resolvedColumnStyles = resolveAdaptiveDistributedColumnStyles(doc, body, columnStyles, hasHeaderRow);

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
    columnStyles: resolvedColumnStyles,
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
