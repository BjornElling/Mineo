/**
 * `TableSpec` — deklarativ, kanal-neutral tabel-model (#15 TableSpec-udredning).
 *
 * En generator beskriver en tabel som data (kolonner + rækker + celler) uden render-
 * viden, og `renderTableSpec` kompilerer den ned til præcis de params `renderDocumentTable`
 * allerede modtager. Dermed defineres kolonne-justering ÉT sted (`ColumnSpec.align`),
 * og begge kanaler (PDF + Word) læser samme felt — men outputtet er byte-identisk med
 * den tidligere håndbyggede kaldeform (bevist af tabel-kanal-paritet-golden-nettet).
 *
 * Værditypen har ingen `jsPDF`-reference og kan derfor overtages uændret som `Table`-
 * node af det kommende dokument-IR (#24).
 */

import type { CellDef, RowInput } from 'jspdf-autotable';
import type jsPDF from 'jspdf';
import { PDF_CONTENT_WIDTH_MM, PDF_MUTED_TEXT_COLOR, TABLE_STYLES } from './pdfConfig';
import { resolveDocumentSectionEndY } from './documentLayoutHelpers';
import type { DocumentTableBridgeDocument } from './documentTableBridge';
import {
  createDocumentDistributedColumnStyles,
  createDocumentFixedColumnStyles,
  createDocumentGrowColumnStyles,
  createDocumentTableCell,
  createDocumentTableFormattedTotalRow,
  createDocumentTableSummedTotalRow,
  renderDocumentTable,
  resolveDynamicRightAlignedInset,
} from './documentTableRenderer';
import type { PdfCellAlign } from './resolveColumnWidths';

// ── Kolonne-intention ────────────────────────────────────────────────────────

export type ColumnWidth =
  | { readonly kind: 'flex' }                       // deler den ledige bredde ligeligt (adaptiv)
  | { readonly kind: 'grow' }                       // den ene kolonne, der får al overskydende plads
  | { readonly kind: 'fixed'; readonly mm: number } // fast bredde i mm
  | { readonly kind: 'min'; readonly mm: number }   // min-bredde (autotable vokser efter behov; ingen adaptiv meta)
  | { readonly kind: 'auto' };                      // autotable bestemmer bredden (ingen columnStyles)

// PDF-only visuel højre-indrykning for højrejusterede tal-kolonner (ikke justering).
export type ColumnRightInset =
  | { readonly kind: 'fixed'; readonly mm: number }
  | { readonly kind: 'dynamic'; readonly maxMm: number; readonly minMm?: number; readonly widthFraction?: number };

export type ColumnSpec = Readonly<{
  width: ColumnWidth;
  // Kanonisk justering for data-celler i kolonnen — den eneste sandhedskilde, begge
  // kanaler læser. Celle-niveau `CellSpec.align` kan override (fx centreret header
  // over højrejusteret talkolonne).
  align?: PdfCellAlign;
  rightInset?: ColumnRightInset;
}>;

// ── Celler og rækker ─────────────────────────────────────────────────────────

export type CellSpec = Readonly<{
  text: string;
  align?: PdfCellAlign;
  valign?: 'top' | 'middle' | 'bottom';
  bold?: boolean;
  colSpan?: number;
  fontSize?: number;
}>;

export type CellRowSpec = Readonly<{
  cells: readonly CellSpec[];
  kind?: 'header' | 'data';
  tone?: 'muted';        // hele rækken dæmpes (PDF-only textColor)
  transparent?: boolean; // hele rækken uden stribe-baggrund
}>;

// Total-række: beholder den gennemtestede placeringslogik (`buildPdfTotalRow`) som en
// førsteklasses primitiv frem for at gen-udlede celle-geometri/cellePadding. Bygges via
// `buildSummedTotalRowSpec`/`buildFormattedTotalRowSpec`.
export type TotalRowSpec = Readonly<{
  readonly __total: true;
  row: RowInput;
  valueColumnIndex: number;
  // Når true: rydder stribe-baggrunden (fillColor:false) og fjerner cellekant
  // (lineWidth:0) på hele total-rækken. Kun de call-sites, der gjorde det eksplicit
  // (årsløn, SH-dage), sætter dette; andre lader stribningen stå (parities-afhængigt),
  // så outputtet forbliver byte-identisk med den tidligere kaldeform.
  clearFill?: boolean;
}>;

export type RowSpec = CellRowSpec | TotalRowSpec;

export type TableSpec = Readonly<{
  columns: readonly ColumnSpec[];
  rows: readonly RowSpec[];
  hasHeaderRow: boolean;
  tableWidth?: number;
  estimatedRowHeight?: number;
}>;

const isTotalRow = (row: RowSpec): row is TotalRowSpec => '__total' in row && row.__total === true;

// ── Total-række-helpers (returnerer RowSpec) ─────────────────────────────────

type SummedTotalOptions = Parameters<typeof createDocumentTableSummedTotalRow>[2];
type FormattedTotalOptions = Parameters<typeof createDocumentTableFormattedTotalRow>[2];

export type TotalRowStyle = Readonly<{ clearFill?: boolean }>;

export const buildSummedTotalRowSpec = (
  label: string,
  values: ReadonlyArray<number>,
  options: SummedTotalOptions,
  rowStyle?: TotalRowStyle
): TotalRowSpec | null => {
  const total = createDocumentTableSummedTotalRow(label, values, options);
  if (!total) return null;
  return { __total: true, row: total.row, valueColumnIndex: total.valueCellColumnIndex, clearFill: rowStyle?.clearFill };
};

export const buildFormattedTotalRowSpec = (
  label: string,
  formattedValue: string,
  options: FormattedTotalOptions,
  rowStyle?: TotalRowStyle
): TotalRowSpec => {
  const total = createDocumentTableFormattedTotalRow(label, formattedValue, options);
  return { __total: true, row: total.row, valueColumnIndex: total.valueCellColumnIndex, clearFill: rowStyle?.clearFill };
};

// ── Compiler ─────────────────────────────────────────────────────────────────

type LegacyTableParams = Parameters<typeof renderDocumentTable>[0];
type ColumnStyleMap = Record<number, { cellWidth?: number | 'auto'; minCellWidth?: number; halign?: PdfCellAlign }>;

const TABLE_CELL_PADDING = TABLE_STYLES.cellPadding;

const resolveCellAlign = (cell: CellSpec, column: ColumnSpec | undefined): PdfCellAlign | undefined =>
  cell.align ?? column?.align;

const buildCell = (cell: CellSpec, column: ColumnSpec | undefined, isHeaderRow: boolean): CellDef => {
  const built = createDocumentTableCell(cell.text, {
    halign: resolveCellAlign(cell, column),
    valign: cell.valign,
    bold: cell.bold || isHeaderRow,
    fontSize: cell.fontSize,
  });
  return cell.colSpan && cell.colSpan > 1 ? { ...built, colSpan: cell.colSpan } : built;
};

// Bygger columnStyles ud fra kolonne-intentionerne. Justering lægges på cellerne (ikke
// på columnStyles), så både PDF og Word læser samme kilde; kun bredde-intentionen bor her.
const buildColumnStyles = (
  columns: readonly ColumnSpec[],
  tableWidth: number
): LegacyTableParams['columnStyles'] => {
  const kinds = columns.map((column) => column.width.kind);

  if (kinds.every((kind) => kind === 'auto')) {
    return undefined;
  }

  // Ren min-bredde (fx standalone regulering): manuel map uden adaptiv meta.
  if (kinds.every((kind) => kind === 'min')) {
    const styles: ColumnStyleMap = {};
    columns.forEach((column, index) => {
      if (column.width.kind === 'min') styles[index] = { minCellWidth: column.width.mm };
    });
    return styles as LegacyTableParams['columnStyles'];
  }

  // Rene faste bredder (fx KRL, forsørgertab): manuel map uden adaptiv meta.
  if (kinds.every((kind) => kind === 'fixed')) {
    const uniform = columns.every(
      (column) => column.width.kind === 'fixed' && column.width.mm === (columns[0].width as { mm: number }).mm
    );
    if (uniform) {
      return createDocumentFixedColumnStyles(columns.length, (columns[0].width as { mm: number }).mm);
    }
    const styles: ColumnStyleMap = {};
    columns.forEach((column, index) => {
      if (column.width.kind === 'fixed') styles[index] = { cellWidth: column.width.mm };
    });
    return styles as LegacyTableParams['columnStyles'];
  }

  const growIndex = columns.findIndex((column) => column.width.kind === 'grow');
  if (growIndex >= 0) {
    return createDocumentGrowColumnStyles(columns.length, growIndex, { tableWidth });
  }

  // Flex (+ eventuelle faste kolonner) → distribueret med adaptiv omfordeling.
  const fixedColumns: Record<number, number> = {};
  columns.forEach((column, index) => {
    if (column.width.kind === 'fixed') fixedColumns[index] = column.width.mm;
  });
  return createDocumentDistributedColumnStyles(columns.length, {
    tableWidth,
    ...(Object.keys(fixedColumns).length > 0 ? { fixedColumns } : {}),
  });
};

export const compileTableSpecToLegacyParams = (
  doc: jsPDF | DocumentTableBridgeDocument,
  startY: number,
  spec: TableSpec
): LegacyTableParams => {
  const tableWidth = spec.tableWidth ?? PDF_CONTENT_WIDTH_MM;

  const body: RowInput[] = [];
  const underlinedCellPositions: Array<{ rowIndex: number; columnIndex: number }> = [];
  const transparentRowIndices: number[] = [];
  const mutedRowIndices = new Set<number>();
  const totalRowIndices = new Set<number>();
  const clearFillRowIndices = new Set<number>();

  spec.rows.forEach((row, rowIndex) => {
    if (isTotalRow(row)) {
      body.push(row.row);
      underlinedCellPositions.push({ rowIndex, columnIndex: row.valueColumnIndex });
      totalRowIndices.add(rowIndex);
      if (row.clearFill) clearFillRowIndices.add(rowIndex);
      return;
    }

    const isHeaderRow = row.kind === 'header' || (spec.hasHeaderRow && rowIndex === 0);
    body.push(row.cells.map((cell, cellIndex) => buildCell(cell, spec.columns[cellIndex], isHeaderRow)));
    if (row.tone === 'muted') mutedRowIndices.add(rowIndex);
    if (row.transparent) transparentRowIndices.push(rowIndex);
  });

  const insetColumns = spec.columns
    .map((column, index) => ({ index, rightInset: column.rightInset }))
    .filter((entry): entry is { index: number; rightInset: ColumnRightInset } => entry.rightInset !== undefined);

  const needsHook = mutedRowIndices.size > 0 || clearFillRowIndices.size > 0 || insetColumns.length > 0;

  const didParseCell: LegacyTableParams['didParseCell'] | undefined = needsHook
    ? (data, resolvedColumnWidths) => {
        const rowIndex = data.row.index;
        const columnIndex = data.column.index;

        if (mutedRowIndices.has(rowIndex)) {
          data.cell.styles.textColor = PDF_MUTED_TEXT_COLOR;
        }

        if (clearFillRowIndices.has(rowIndex)) {
          data.cell.styles.fillColor = false;
          data.cell.styles.lineWidth = 0;
        }

        const isHeaderRow = spec.hasHeaderRow && rowIndex === 0;
        if (!isHeaderRow && !totalRowIndices.has(rowIndex)) {
          const inset = insetColumns.find((entry) => entry.index === columnIndex);
          if (inset) {
            data.cell.styles.halign = 'right';
            const right =
              inset.rightInset.kind === 'fixed'
                ? inset.rightInset.mm
                : resolveDynamicRightAlignedInset(resolvedColumnWidths.get(columnIndex), inset.rightInset.maxMm, {
                    minInset: inset.rightInset.minMm,
                    widthFraction: inset.rightInset.widthFraction,
                  });
            data.cell.styles.cellPadding = {
              top: TABLE_CELL_PADDING,
              bottom: TABLE_CELL_PADDING,
              left: TABLE_CELL_PADDING,
              right,
            };
          }
        }
      }
    : undefined;

  return {
    doc,
    startY,
    body,
    columnStyles: buildColumnStyles(spec.columns, tableWidth),
    tableWidth,
    hasHeaderRow: spec.hasHeaderRow,
    ...(transparentRowIndices.length > 0 ? { transparentRowIndices } : {}),
    ...(underlinedCellPositions.length > 0 ? { underlinedCellPositions } : {}),
    ...(spec.estimatedRowHeight !== undefined ? { estimatedRowHeight: spec.estimatedRowHeight } : {}),
    ...(didParseCell ? { didParseCell } : {}),
  };
};

/**
 * Renderer en `TableSpec` og returnerer sektionens afslutnings-Y (`resolveDocumentSectionEndY`
 * absorberet), så call-sites kollapser `writer.setY(resolveDocumentSectionEndY(finalY, startY))`
 * til `writer.setY(renderTableSpec(...).endY)`.
 */
export const renderTableSpec = (
  doc: jsPDF | DocumentTableBridgeDocument,
  startY: number,
  spec: TableSpec
): Readonly<{ endY: number }> => {
  const finalY = renderDocumentTable(compileTableSpecToLegacyParams(doc, startY, spec));
  return { endY: resolveDocumentSectionEndY(finalY, startY) };
};
