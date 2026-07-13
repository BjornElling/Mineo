import type jsPDF from 'jspdf';
import type { CellDef, RowInput } from 'jspdf-autotable';
import {
  PDF_CONTENT_WIDTH_MM,
  PDF_MUTED_TEXT_COLOR,
  TABLE_STYLES,
} from '../../document/layout/pdfConfig';
import { resolveDocumentSectionEndY } from '../../document/layout/documentLayoutHelpers';
import {
  createDocumentDistributedColumnStyles,
  createDocumentFixedColumnStyles,
  createDocumentGrowColumnStyles,
  createDocumentTableCell,
  renderDocumentTable,
} from './pdfDocumentTableRenderer';
import type {
  CellSpec,
  ColumnRightInset,
  ColumnSpec,
  TableSpec,
} from '../../document/layout/tableSpec';
import { assertValidTableSpec, resolveColumnRightInsetMm } from '../../document/layout/tableSpec';
import type { PdfCellAlign } from '../../document/layout/resolveColumnWidths';

type LegacyTableParams = Parameters<typeof renderDocumentTable>[0];
type ColumnStyleMap = Record<
  number,
  { cellWidth?: number | 'auto'; minCellWidth?: number; halign?: PdfCellAlign }
>;

const resolveCellAlign = (
  cell: CellSpec,
  column: ColumnSpec | undefined,
): PdfCellAlign | undefined => cell.align ?? column?.align;

const buildCell = (
  cell: CellSpec,
  column: ColumnSpec | undefined,
  isHeaderRow: boolean,
  inheritColumnAlign: boolean,
): CellDef => {
  const built = createDocumentTableCell(cell.text, {
    halign: inheritColumnAlign ? resolveCellAlign(cell, column) : cell.align,
    valign: cell.valign,
    bold: cell.bold || isHeaderRow,
    fontSize: cell.fontSize,
  });
  const withTotalPadding = cell.separatorAbove
    ? { ...built, styles: { ...built.styles, cellPadding: TABLE_STYLES.cellPadding } }
    : built;
  return cell.colSpan && cell.colSpan > 1
    ? { ...withTotalPadding, colSpan: cell.colSpan }
    : withTotalPadding;
};

const buildColumnStyles = (
  columns: readonly ColumnSpec[],
  tableWidth: number,
): LegacyTableParams['columnStyles'] => {
  const kinds = columns.map((column) => column.width.kind);

  if (kinds.every((kind) => kind === 'auto')) return undefined;

  if (kinds.every((kind) => kind === 'min')) {
    const styles: ColumnStyleMap = {};
    columns.forEach((column, index) => {
      if (column.width.kind === 'min') {
        styles[index] = { minCellWidth: column.width.mm };
      }
    });
    return styles as LegacyTableParams['columnStyles'];
  }

  if (kinds.every((kind) => kind === 'fixed')) {
    const firstWidth = columns[0]?.width;
    const uniform = firstWidth?.kind === 'fixed' && columns.every(
      (column) => column.width.kind === 'fixed' && column.width.mm === firstWidth.mm,
    );
    if (uniform && firstWidth?.kind === 'fixed') {
      return createDocumentFixedColumnStyles(columns.length, firstWidth.mm);
    }
    const styles: ColumnStyleMap = {};
    columns.forEach((column, index) => {
      if (column.width.kind === 'fixed') {
        styles[index] = { cellWidth: column.width.mm };
      }
    });
    return styles as LegacyTableParams['columnStyles'];
  }

  const growIndex = columns.findIndex((column) => column.width.kind === 'grow');
  if (growIndex >= 0) {
    return createDocumentGrowColumnStyles(columns.length, growIndex, { tableWidth });
  }

  const fixedColumns: Record<number, number> = {};
  columns.forEach((column, index) => {
    if (column.width.kind === 'fixed') fixedColumns[index] = column.width.mm;
  });
  return createDocumentDistributedColumnStyles(columns.length, {
    tableWidth,
    ...(Object.keys(fixedColumns).length > 0 ? { fixedColumns } : {}),
  });
};

export const compileTableSpecToPdfParams = (
  doc: jsPDF,
  startY: number,
  spec: TableSpec,
): LegacyTableParams => {
  assertValidTableSpec(spec);
  const tableWidth = spec.tableWidth ?? PDF_CONTENT_WIDTH_MM;
  const body: RowInput[] = [];
  const underlinedCellPositions: Array<{ rowIndex: number; columnIndex: number }> = [];
  const transparentRowIndices: number[] = [];
  const mutedRowIndices = new Set<number>();
  const totalRowIndices = new Set<number>();

  spec.rows.forEach((row, rowIndex) => {
    const isHeaderRow = row.kind === 'header' || (spec.hasHeaderRow && rowIndex === 0);
    let logicalColumnIndex = 0;
    body.push(row.cells.map((cell) => {
      if (cell.separatorAbove) {
        underlinedCellPositions.push({ rowIndex, columnIndex: logicalColumnIndex });
      }
      const built = buildCell(
        cell,
        spec.columns[logicalColumnIndex],
        isHeaderRow,
        row.kind !== 'total',
      );
      logicalColumnIndex += cell.colSpan ?? 1;
      return built;
    }));
    if (row.kind === 'total') totalRowIndices.add(rowIndex);
    if (row.tone === 'muted') mutedRowIndices.add(rowIndex);
    if (row.transparent) transparentRowIndices.push(rowIndex);
  });

  const insetColumns = spec.columns
    .map((column, index) => ({ index, rightInset: column.rightInset }))
    .filter((entry): entry is { index: number; rightInset: ColumnRightInset } =>
      entry.rightInset !== undefined
    );
  const needsHook = mutedRowIndices.size > 0
    || totalRowIndices.size > 0
    || insetColumns.length > 0;
  const didParseCell: LegacyTableParams['didParseCell'] | undefined = needsHook
    ? (data, resolvedColumnWidths) => {
        const rowIndex = data.row.index;
        const columnIndex = data.column.index;

        if (mutedRowIndices.has(rowIndex)) {
          data.cell.styles.textColor = PDF_MUTED_TEXT_COLOR;
        }
        if (totalRowIndices.has(rowIndex)) {
          data.cell.styles.fillColor = false;
          data.cell.styles.lineWidth = 0;
        }

        const isHeaderRow = spec.hasHeaderRow && rowIndex === 0;
        if (!isHeaderRow && !totalRowIndices.has(rowIndex)) {
          const inset = insetColumns.find((entry) => entry.index === columnIndex);
          if (inset) {
            data.cell.styles.halign = 'right';
            const right = resolveColumnRightInsetMm(
              resolvedColumnWidths.get(columnIndex),
              inset.rightInset,
            );
            data.cell.styles.cellPadding = {
              top: TABLE_STYLES.cellPadding,
              bottom: TABLE_STYLES.cellPadding,
              left: TABLE_STYLES.cellPadding,
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
    ...(spec.estimatedRowHeight !== undefined
      ? { estimatedRowHeight: spec.estimatedRowHeight }
      : {}),
    ...(didParseCell ? { didParseCell } : {}),
  };
};

export const renderPdfTableSpec = (
  doc: jsPDF,
  startY: number,
  spec: TableSpec,
): Readonly<{ endY: number }> => {
  const finalY = renderDocumentTable(compileTableSpecToPdfParams(doc, startY, spec));
  return { endY: resolveDocumentSectionEndY(finalY, startY) };
};
