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
} from './pdfConfig';
import { getJsPdfPageSize } from './jsPdfGeometry';
import { normalizeRightAlignedTextForDocument, normalizeTextForDocument } from './pdfTextUtils';
import { guardDocumentDateText } from './documentDateGuard';
import { DEFAULT_NUMERIC_TOLERANCE } from '../../utils/numberComparison';
import { isDocumentTableBridgeDocument, type DocumentTableColumnAlignments, type DocumentTableBridgeDocument } from './documentTableBridge';
import {
  attachPdfColumnLayoutMeta,
  resolveColumnWidths,
  type ColumnTextMeasurer,
  type PdfCellAlign,
  type PdfColumnStyle,
  type PdfColumnStyleMap,
} from './resolveColumnWidths';

export const TABLE_FONT_SIZE = 8;
// Generisk celle-padding for alle Mineo-tabeller (= TABLE_STYLES.cellPadding).
// Modul-lokal: ingen ekstern importør, så ikke eksporteret.
const TABLE_CELL_PADDING = TABLE_STYLES.cellPadding;

type PdfAutoTableDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

type PdfTableColumnStyles = NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'];
type PdfTableCell = CellDef;
type PdfCellVAlign = 'top' | 'middle' | 'bottom';
type PdfTableCellStyles = Partial<Styles>;
type PdfTableCellPosition = Readonly<{ rowIndex: number; columnIndex: number }>;
type PdfDistributedColumnInput = number | Readonly<{ cellWidth: number; halign?: PdfCellAlign }>;
type PdfMeasuredDoc = jsPDF & Readonly<{
  getFont?: () => Readonly<{ fontName: string; fontStyle: string }>;
  getFontSize?: () => number;
}>;
type PdfSummedTotalRow = Readonly<{
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
  return halign === 'right' ? normalizeRightAlignedTextForDocument(content) : content;
};

// Kanal-neutralt dato-værn for alt tabelindhold: renderDocumentTable er det fælles
// indgangspunkt for både PDF og Word, så her fanges enhver rå ISO-dato, der ved en
// fejl er sendt uformateret med i en celle — uanset hvordan cellen er bygget. Se
// documentDateGuard.ts. Bevarer celle-objektets styles/colSpan og rører kun content.
const guardRowInputDates = (body: RowInput[]): RowInput[] =>
  body.map((row) => {
    if (!Array.isArray(row)) return row;
    return (row as unknown[]).map((cell) => {
      if (typeof cell === 'string') return guardDocumentDateText(cell);
      if (isPdfTableCell(cell) && typeof cell.content === 'string') {
        const guarded = guardDocumentDateText(cell.content);
        return guarded === cell.content ? cell : { ...cell, content: guarded };
      }
      return cell;
    }) as RowInput;
  });

const isPdfTableCell = (value: unknown): value is PdfTableCell => {
  return typeof value === 'object' && value !== null && 'content' in value;
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
    options?.halign === 'right' ? normalizeRightAlignedTextForDocument(text) : normalizeTextForDocument(text)
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

// Bygger en `ColumnTextMeasurer` oven på jsPDF-doc'et til den rene `resolveColumnWidths`.
// Returnerer `null`, når teksten ikke kan måles (Word-kanalen eller en degraderet jsPDF)
// — da falder bredde-fordelingen fail-closed tilbage til de statiske bredder.
const createPdfTextMeasurer = (doc: jsPDF): ColumnTextMeasurer | null => {
  if (!canMeasurePdfText(doc)) return null;
  return (text, options) =>
    measurePdfTextWidthMm(doc, text, {
      fontSize: options.fontSize,
      fontStyle: options.fontStyle,
      halign: options.halign,
    });
};

export const createDocumentTableCell = (
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

export const cellLeft = (content: string): PdfTableCell => createDocumentTableCell(content, { halign: 'left' });
export const cellRight = (content: string): PdfTableCell => createDocumentTableCell(content, { halign: 'right' });
export const cellCenter = (content: string): PdfTableCell => createDocumentTableCell(content, { halign: 'center' });

export const createDocumentTableHeaderCell = (
  content: string,
  halign: PdfCellAlign = 'left'
): PdfTableCell => createDocumentTableCell(content, { halign, bold: true });

export const resolveDocumentTotalValueMinWidthMm = (
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
      row.push(createDocumentTableCell(label, { halign: labelAlign, bold: true }));
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
          cellPadding: TABLE_CELL_PADDING,
        },
      });
      index += valueCellColSpan - 1;
      continue;
    }

    row.push(createDocumentTableCell(''));
  }

  return {
    row,
    valueCellColumnIndex,
    valueCellColSpan,
    formattedValue: normalizedFormattedValue,
    estimatedValueMinWidthMm: resolveDocumentTotalValueMinWidthMm(normalizedFormattedValue),
  };
};

export const createDocumentTableFormattedTotalRow = (
  label: string,
  formattedValue: string,
  options: PdfTotalRowOptions
): PdfSummedTotalRow => {
  return buildPdfTotalRow(label, formattedValue, options);
};

export const createDocumentTableSummedTotalRow = (
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

export const createDocumentFixedColumnStyles = (
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

export const createDocumentDistributedColumnStyles = (
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

// Kolonnebredder til en tabel med én "grow-kolonne": grow-kolonnen fylder så meget
// plads, dens indhold kan få, mens de øvrige kolonner kun garanteres deres
// indholdsbestemte min-bredde. Er der plads til overs, fordeles overskuddet ligeligt
// mellem alle kolonner (jf. resolveGrowColumnStyles, som gør det ved render-tid, hvor
// indholdet kan måles). De statiske bredder her er kun en fallback, når teksten ikke
// kan måles (fx en degraderet jsPDF eller Word-kanalen, der ignorerer mm-bredder):
// grow-kolonnen får `growFraction` af bredden, resten deles ligeligt.
export const createDocumentGrowColumnStyles = (
  columnCount: number,
  growColumnIndex: number,
  options?: Readonly<{
    tableWidth?: number;
    growFraction?: number;
  }>
): Record<number, PdfColumnStyle> => {
  if (!Number.isInteger(columnCount) || columnCount <= 1) {
    throw new Error(`Ugyldigt kolonneantal for PDF-grow-tabel: ${String(columnCount)}.`);
  }
  if (!Number.isInteger(growColumnIndex) || growColumnIndex < 0 || growColumnIndex >= columnCount) {
    throw new Error(`Ugyldigt grow-kolonneindex for PDF-tabel: ${String(growColumnIndex)}.`);
  }

  const tableWidth = options?.tableWidth ?? PDF_CONTENT_WIDTH_MM;
  if (!Number.isFinite(tableWidth) || tableWidth <= 0) {
    throw new Error(`Ugyldig tabelbredde for PDF-grow-tabel: ${String(tableWidth)}.`);
  }

  const growFraction = options?.growFraction ?? 0.4;
  if (!Number.isFinite(growFraction) || growFraction <= 0 || growFraction >= 1) {
    throw new Error(`Ugyldig grow-fraktion for PDF-tabel: ${String(growFraction)}.`);
  }

  const growBaseline = tableWidth * growFraction;
  const otherBaseline = (tableWidth - growBaseline) / (columnCount - 1);
  const styles = Object.fromEntries(
    Array.from({ length: columnCount }, (_, index) => [
      index,
      { cellWidth: index === growColumnIndex ? growBaseline : otherBaseline },
    ])
  ) as Record<number, PdfColumnStyle>;

  return attachPdfColumnLayoutMeta(styles, {
    tableWidth,
    fixedColumnIndices: [],
    distributedColumnIndices: Array.from({ length: columnCount }, (_, index) => index),
    growColumnIndex,
  });
};

// Dynamisk højre-indrykning for højrejusterede tal-kolonner. Insettet skaleres med
// kolonnens faktiske bredde, så en smal kolonne (fx når en nabo-grow-kolonne har taget
// det meste af pladsen) ikke spilder plads på et stort, fast inset — og et højt inset
// ikke presser talværdien til ombrydning. Ved brede kolonner rammes `maxInset`, så det
// hidtidige, luftige udseende bevares. Falder tilbage til `maxInset`, når bredden ikke
// kendes (Word-kanalen sætter ingen mm-bredder, og en degraderet jsPDF kan ikke måle).
export const resolveDynamicRightAlignedInset = (
  columnWidth: number | undefined,
  maxInset: number,
  options?: Readonly<{ minInset?: number; widthFraction?: number }>
): number => {
  const minInset = options?.minInset ?? 2;
  const widthFraction = options?.widthFraction ?? 0.2;
  if (typeof columnWidth !== 'number' || !Number.isFinite(columnWidth) || columnWidth <= 0) {
    return maxInset;
  }
  return Math.max(minInset, Math.min(maxInset, columnWidth * widthFraction));
};

// Udleder kolonne→justering for data-rækker, som Word-broen kan anvende, så
// .docx-tabeller matcher PDF'ens justering. PDF'en udleder selv justering fra
// `columnStyles` og `didParseCell`; broen kan kun se cellernes egen halign, så
// vi samler kolonne-niveauet (og evt. hook-override) her. `dataRowColumnHalign`
// vinder over `columnStyles`, fordi PDF-hooks kører efter kolonne-styles.
const resolveDocumentTableColumnAlignments = (
  columnStyles: PdfTableColumnStyles | undefined,
  dataRowColumnHalign: Readonly<Record<number, PdfCellAlign>> | undefined
): DocumentTableColumnAlignments | undefined => {
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

export const renderDocumentTable = (params: Readonly<{
  // Honest union: `writer.getDoc()` leverer enten en rå jsPDF (PDF-kanal) eller en
  // `DocumentTableBridgeDocument` (Word-kanal). `isDocumentTableBridgeDocument`-guarden
  // nedenfor narrower til jsPDF før al jsPDF-only brug (jf. F2-lukning i pdfWriter.ts).
  doc: jsPDF | DocumentTableBridgeDocument;
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
  // `resolvedColumnWidths` er de endeligt fordelte kolonnebredder i mm (index→bredde),
  // så hook'en kan skalere fx en højre-indrykning efter kolonnens faktiske bredde.
  didParseCell?: (data: CellHookData, resolvedColumnWidths: ReadonlyMap<number, number>) => void;
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
    body: rawBody,
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

  // Sidste forsvarslinje mod rå ISO-datoer i tabelindhold (begge kanaler).
  const body = guardRowInputDates(rawBody);

  if (isDocumentTableBridgeDocument(doc)) {
    if (body.length === 0) {
      throw new Error('renderDocumentTable kaldt med tom body — tabellen skulle være undertrykt eller have en eksplicit tom-tilstandsrække i kalderen.');
    }
    doc.addBridgeTableFromRows(body, hasHeaderRow, resolveDocumentTableColumnAlignments(columnStyles, dataRowColumnHalign));
    return startY;
  }

  // Fail-closed: en tom tabel-body er altid en fejl i kalderen (en sektion der skulle
  // have været undertrykt eller fået en eksplicit "Ingen ..."-række før kaldet). At
  // rendere en blank tabel i et tillidskritisk dokument ville skjule fejlen. Kast hellere,
  // så download-stien router fejlen via reportSystemIssue (jf. document-output-contract A5).
  if (body.length === 0) {
    throw new Error('renderDocumentTable kaldt med tom body — tabellen skulle være undertrykt eller have en eksplicit tom-tilstandsrække i kalderen.');
  }

  const transparentSet = new Set(transparentRowIndices);
  const underlinedCellSet = new Set(
    underlinedCellPositions.map(({ rowIndex, columnIndex }) => `${rowIndex}:${columnIndex}`)
  );
  const pageHeight = getJsPdfPageSize(doc).height;
  const contentBottom = pageHeight - MARGINS.bottom;
  const remainingHeight = contentBottom - startY;
  const rowsToKeepTogether = Math.min(body.length, 2);
  const requiredHeight = estimatedRowHeight * rowsToKeepTogether;
  const resolvedStartY = remainingHeight < requiredHeight ? MARGINS.top : startY;
  const resolvedColumnStyles = resolveColumnWidths(
    createPdfTextMeasurer(doc),
    body,
    columnStyles as PdfColumnStyleMap | undefined,
    hasHeaderRow
  ) as PdfTableColumnStyles;

  // De endeligt fordelte kolonnebredder (i mm) gøres tilgængelige for kalderens
  // didParseCell-hook, så fx en højre-indrykning kan skaleres efter den bredde, en
  // kolonne faktisk får i dokumentet. Kun numeriske bredder tages med (autos springes
  // over — der er ingen kendt mm-bredde at skalere efter).
  const resolvedColumnWidths = new Map<number, number>();
  for (const [rawIndex, style] of Object.entries(resolvedColumnStyles ?? {})) {
    const cellWidth = (style as PdfColumnStyle | undefined)?.cellWidth;
    if (typeof cellWidth === 'number' && Number.isFinite(cellWidth)) {
      resolvedColumnWidths.set(Number(rawIndex), cellWidth);
    }
  }

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
      cellPadding: TABLE_CELL_PADDING,
      textColor: COLORS.text,
    },
    columnStyles: resolvedColumnStyles,
    didParseCell: (data: CellHookData) => {
      const resolvedHalign = data.cell.styles.halign;
      if (resolvedHalign === 'right' && Array.isArray(data.cell.text)) {
        data.cell.text = data.cell.text.map((line) => normalizeRightAlignedTextForDocument(line));
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
        didParseCell(data, resolvedColumnWidths);
      }
    },
    didDrawCell: (data) => {
      if (underlinedCellSet.has(`${data.row.index}:${data.column.index}`)) {
        const availableWidth = Math.max(0, data.cell.width - (TABLE_CELL_PADDING * 2));
        const lineWidth = Math.min(PDF_TABLE_TOTAL_VALUE_LINE_WIDTH_MM, availableWidth);
        const lineEnd = data.cell.x + data.cell.width - TABLE_CELL_PADDING;
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
