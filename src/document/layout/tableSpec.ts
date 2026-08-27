/**
 * Kanalneutral tabelmodel.
 *
 * Modellen beskriver kun tabelindhold og semantiske layoutintentioner. Oversættelsen
 * til jsPDF/autotable og OOXML ejes af hver sin kanalrenderer.
 */

import { sumRoundedValues } from '../../utils/roundingShortcuts';

export type DocumentCellAlign = 'left' | 'center' | 'right';
export const DOCUMENT_TABLE_FONT_SIZE_PT = 8;

export type ColumnWidth =
  | Readonly<{ kind: 'flex' }>
  | Readonly<{ kind: 'grow' }>
  | Readonly<{ kind: 'fixed'; mm: number }>
  | Readonly<{ kind: 'min'; mm: number }>
  | Readonly<{ kind: 'auto' }>;

export type ColumnRightInset =
  | Readonly<{ kind: 'fixed'; mm: number }>
  | Readonly<{
      kind: 'dynamic';
      maxMm: number;
      minMm?: number;
      widthFraction?: number;
    }>;

export const resolveColumnRightInsetMm = (
  columnWidthMm: number | undefined,
  inset: ColumnRightInset,
): number => {
  if (inset.kind === 'fixed') return inset.mm;
  const minInset = inset.minMm ?? 2;
  const widthFraction = inset.widthFraction ?? 0.2;
  if (
    typeof columnWidthMm !== 'number'
    || !Number.isFinite(columnWidthMm)
    || columnWidthMm <= 0
  ) {
    return inset.maxMm;
  }
  return Math.max(minInset, Math.min(inset.maxMm, columnWidthMm * widthFraction));
};

export type ColumnSpec = Readonly<{
  width: ColumnWidth;
  align?: DocumentCellAlign;
  rightInset?: ColumnRightInset;
}>;

export type CellSpec = Readonly<{
  text: string;
  align?: DocumentCellAlign;
  valign?: 'top' | 'middle' | 'bottom';
  bold?: boolean;
  colSpan?: number;
  fontSize?: number;
  /** Semantisk totalmarkering over cellens værdi. */
  separatorAbove?: boolean;
}>;

export type CellRowSpec = Readonly<{
  cells: readonly CellSpec[];
  kind?: 'header' | 'data' | 'total';
  tone?: 'muted';
  transparent?: boolean;
}>;

export type RowSpec = CellRowSpec;

export type TableSpec = Readonly<{
  columns: readonly ColumnSpec[];
  rows: readonly RowSpec[];
  hasHeaderRow: boolean;
  /** Fysisk breddeintention; begge kanaler skalerer den til deres indholdsområde. */
  tableWidth?: number;
  estimatedRowHeight?: number;
}>;

const assertPositiveFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} skal være et positivt, endeligt tal.`);
  }
};

export const assertValidTableSpec = (spec: TableSpec): void => {
  if (spec.columns.length === 0) {
    throw new Error('Dokumenttabel kaldt uden kolonner.');
  }
  if (spec.rows.length === 0) {
    throw new Error('Dokumenttabel kaldt med tomme rækker.');
  }
  if (spec.tableWidth !== undefined) {
    assertPositiveFinite(spec.tableWidth, 'Dokumenttabellens bredde');
  }

  spec.columns.forEach((column, columnIndex) => {
    if (column.width.kind === 'fixed' || column.width.kind === 'min') {
      assertPositiveFinite(column.width.mm, `Bredden på dokumenttabellens kolonne ${columnIndex + 1}`);
    }
    if (column.rightInset?.kind === 'fixed') {
      assertPositiveFinite(column.rightInset.mm, `Højre indrykning i dokumenttabellens kolonne ${columnIndex + 1}`);
    }
    if (column.rightInset?.kind === 'dynamic') {
      assertPositiveFinite(column.rightInset.maxMm, `Maksimal højre indrykning i dokumenttabellens kolonne ${columnIndex + 1}`);
      if (column.rightInset.minMm !== undefined) {
        assertPositiveFinite(column.rightInset.minMm, `Minimal højre indrykning i dokumenttabellens kolonne ${columnIndex + 1}`);
        if (column.rightInset.minMm > column.rightInset.maxMm) {
          throw new Error(`Minimal højre indrykning overstiger maksimum i dokumenttabellens kolonne ${columnIndex + 1}.`);
        }
      }
      if (column.rightInset.widthFraction !== undefined) {
        assertPositiveFinite(column.rightInset.widthFraction, `Indrykningsfraktionen i dokumenttabellens kolonne ${columnIndex + 1}`);
      }
    }
  });

  spec.rows.forEach((row, rowIndex) => {
    if (row.cells.length === 0) {
      throw new Error(`Dokumenttabellens række ${rowIndex + 1} har ingen celler.`);
    }
    const occupiedColumns = row.cells.reduce((count, cell) => {
      const colSpan = cell.colSpan ?? 1;
      if (!Number.isInteger(colSpan) || colSpan <= 0) {
        throw new Error(`Dokumenttabellens række ${rowIndex + 1} har et ugyldigt colSpan.`);
      }
      if (cell.fontSize !== undefined) {
        assertPositiveFinite(cell.fontSize, `Skriftstørrelsen i dokumenttabellens række ${rowIndex + 1}`);
      }
      return count + colSpan;
    }, 0);
    if (occupiedColumns !== spec.columns.length) {
      throw new Error(
        `Dokumenttabellens række ${rowIndex + 1} fylder ${occupiedColumns} kolonner, men tabellen har ${spec.columns.length}.`,
      );
    }
  });
};

type TotalRowOptions = Readonly<{
  columnCount: number;
  valueColumnIndex: number;
  labelColumnIndex?: number;
  labelAlign?: DocumentCellAlign;
  valueAlign?: DocumentCellAlign;
  valueColSpan?: number;
  /** Afgør alene, om slutværdien har NBSP + `kr.`. */
  valueHasKrSuffix?: boolean;
  preserveValueColumn?: boolean;
}>;

type SummedTotalOptions = TotalRowOptions & Readonly<{
  formatValue: (total: number) => string;
  /** Samme afrunding som data-cellens synlige værdi. */
  roundDisplayedValue: (value: number) => number;
}>;

const NBSP = '\u00A0';

const normalizeTotalValue = (
  formattedValue: string,
  valueHasKrSuffix: boolean,
): string => {
  const trimmed = formattedValue.trim();
  const withoutKrSuffix = trimmed.replace(/(?:\u00A0|\s)*kr\.$/i, '').trimEnd();
  return valueHasKrSuffix ? `${withoutKrSuffix}${NBSP}kr.` : withoutKrSuffix;
};

const assertTotalOptions = (options: TotalRowOptions): void => {
  const {
    columnCount,
    valueColumnIndex,
    labelColumnIndex = 0,
    valueColSpan = 1,
  } = options;

  if (!Number.isInteger(columnCount) || columnCount <= 1) {
    throw new Error(`Ugyldigt kolonneantal for sammentællingslinje: ${String(columnCount)}.`);
  }
  if (!Number.isInteger(labelColumnIndex) || labelColumnIndex < 0 || labelColumnIndex >= columnCount) {
    throw new Error(`Ugyldigt label-kolonneindex for sammentællingslinje: ${String(labelColumnIndex)}.`);
  }
  if (!Number.isInteger(valueColumnIndex) || valueColumnIndex < 0 || valueColumnIndex >= columnCount) {
    throw new Error(`Ugyldigt værdi-kolonneindex for sammentællingslinje: ${String(valueColumnIndex)}.`);
  }
  if (!Number.isInteger(valueColSpan) || valueColSpan <= 0) {
    throw new Error(`Ugyldigt værdi-colSpan for sammentællingslinje: ${String(valueColSpan)}.`);
  }
  if (valueColumnIndex + valueColSpan > columnCount) {
    throw new Error('Værdi-cellen i sammentællingslinjen rækker ud over tabellens kolonner.');
  }
  if (labelColumnIndex >= valueColumnIndex) {
    throw new Error('Sammentællingslinjen kræver, at label-kolonnen ligger til venstre for værdi-kolonnen.');
  }
};

export const buildFormattedTotalRowSpec = (
  label: string,
  formattedValue: string,
  options: TotalRowOptions,
): RowSpec => {
  assertTotalOptions(options);
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
  const valueColumnEndExclusive = valueColumnIndex + valueColSpan;
  const valueCellColumnIndex = preserveValueColumn
    ? valueColumnIndex
    : Math.min(labelColumnIndex + 1, valueColumnIndex);
  const valueCellColSpan = valueColumnEndExclusive - valueCellColumnIndex;
  const cells: CellSpec[] = [];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    if (columnIndex === labelColumnIndex) {
      cells.push({ text: label, align: labelAlign, bold: true });
      continue;
    }
    if (columnIndex === valueCellColumnIndex) {
      cells.push({
        text: normalizeTotalValue(formattedValue, valueHasKrSuffix),
        align: valueAlign,
        bold: true,
        colSpan: valueCellColSpan,
        separatorAbove: true,
      });
      columnIndex += valueCellColSpan - 1;
      continue;
    }
    cells.push({ text: '' });
  }

  return { kind: 'total', cells };
};

export const buildSummedTotalRowSpec = (
  label: string,
  values: readonly number[],
  options: SummedTotalOptions,
): RowSpec | null => {
  if (values.length <= 1) return null;
  const total = sumRoundedValues(values, options.roundDisplayedValue);
  return buildFormattedTotalRowSpec(label, options.formatValue(total), options);
};
