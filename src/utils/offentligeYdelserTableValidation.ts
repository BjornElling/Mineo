import type { OffentligeYdelserRow } from '../schemas/formSchemas';
import type {
  OffentligeYdelserTableCellErrorMap,
  OffentligeYdelserTableColumnKey,
  OffentligeYdelserTableFirstErrorCell,
  OffentligeYdelserTableValidationSummary,
} from '../types/common';
import { isAmountValueStrict, isEffectivelyEmptyNumber, isZeroOnlyString } from './tableValidationCommon';

export type OffentligeYdelserTableValidationResult = Readonly<{
  summary: OffentligeYdelserTableValidationSummary;
}>;

export const isOffentligeYdelserAmountValueValidForValidation = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (!isAmountValueStrict(value)) return false;
  if (isEffectivelyEmptyNumber(value.value)) return false;
  if (value.kind === 'expression') {
    return value.expression.trim() !== '';
  }
  return true;
};

export const isOffentligeYdelserTableValueEffectivelyEmptyForValidation = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return true;
    return isZeroOnlyString(trimmed);
  }
  if (typeof value === 'number') return isEffectivelyEmptyNumber(value);
  if (isAmountValueStrict(value)) {
    if (value.kind === 'number') return isEffectivelyEmptyNumber(value.value);
    if (isEffectivelyEmptyNumber(value.value)) return true;
    if (value.expression.trim() === '') return true;
    return isZeroOnlyString(value.expression);
  }
  return false;
};

export const buildOffentligeYdelserCellKey = (rowId: string, colKey: OffentligeYdelserTableColumnKey): string => {
  if (import.meta.env.DEV && rowId.includes(':')) {
    throw new Error('Offentlige ydelser: rowId må ikke indeholde ":" (bruges som separator i cell keys).');
  }
  return `${rowId}:${colKey}`;
};

export type OffentligeYdelserRowFilledState = Readonly<{
  fraDatoFilled: boolean;
  tilDatoFilled: boolean;
  ydelsestypeSelected: boolean;
  ydelseFilled: boolean;
  tillaegFilled: boolean;
  hasAnyAmount: boolean;
  hasAnyFilled: boolean;
  periodComplete: boolean;
}>;

export const getOffentligeYdelserRowFilledState = (row: OffentligeYdelserRow): OffentligeYdelserRowFilledState => {
  const fraDatoFilled = !isOffentligeYdelserTableValueEffectivelyEmptyForValidation(row.fraDato);
  const tilDatoFilled = !isOffentligeYdelserTableValueEffectivelyEmptyForValidation(row.tilDato);
  const periodComplete = fraDatoFilled && tilDatoFilled;

  const ydelsestypeSelected = !isOffentligeYdelserTableValueEffectivelyEmptyForValidation(row.ydelsestype);
  const ydelseFilled = !isOffentligeYdelserTableValueEffectivelyEmptyForValidation(row.ydelse);
  const tillaegFilled = !isOffentligeYdelserTableValueEffectivelyEmptyForValidation(row.tillaeg);
  const hasAnyAmount = ydelseFilled || tillaegFilled;

  const hasAnyFilled = fraDatoFilled || tilDatoFilled || ydelsestypeSelected || hasAnyAmount;

  return {
    fraDatoFilled,
    tilDatoFilled,
    ydelsestypeSelected,
    ydelseFilled,
    tillaegFilled,
    hasAnyAmount,
    hasAnyFilled,
    periodComplete,
  };
};

const COLUMN_ORDER: readonly OffentligeYdelserTableColumnKey[] = [
  'fraDato',
  'tilDato',
  'ydelse',
  'tillaeg',
  'ydelsestype',
];

const isOffentligeYdelserColumnKey = (value: string): value is OffentligeYdelserTableColumnKey => {
  return value === 'fraDato' || value === 'tilDato' || value === 'ydelse' || value === 'tillaeg' || value === 'ydelsestype';
};

export const parseOffentligeYdelserCellKey = (
  cellKey: string
): Readonly<{ rowId: string; colKey: OffentligeYdelserTableColumnKey }> | null => {
  const separatorIdx = cellKey.indexOf(':');
  if (separatorIdx < 0) {
    if (import.meta.env.DEV) {
      throw new Error(`Offentlige ydelser: Ugyldigt cellKey format "${cellKey}".`);
    }
    return null;
  }
  const rowId = cellKey.slice(0, separatorIdx);
  const colKeyRaw = cellKey.slice(separatorIdx + 1);
  if (!isOffentligeYdelserColumnKey(colKeyRaw)) {
    if (import.meta.env.DEV) {
      throw new Error(`Offentlige ydelser: Ugyldigt colKey i cellKey "${cellKey}".`);
    }
    return null;
  }
  return { rowId, colKey: colKeyRaw };
};

const collectCellErrorsByRow = (cellErrorsByCellKey: OffentligeYdelserTableCellErrorMap): Map<string, Set<OffentligeYdelserTableColumnKey>> => {
  const byRow = new Map<string, Set<OffentligeYdelserTableColumnKey>>();

  for (const cellKey of Object.keys(cellErrorsByCellKey)) {
    const parsed = parseOffentligeYdelserCellKey(cellKey);
    if (!parsed) continue;
    const { rowId, colKey: colKeyRaw } = parsed;
    const set = byRow.get(rowId);
    if (set) {
      set.add(colKeyRaw);
    } else {
      byRow.set(rowId, new Set([colKeyRaw]));
    }
  }

  return byRow;
};

export const getOffentligeYdelserTableValidation = ({
  rows,
  cellErrorsByCellKey = {},
}: Readonly<{
  rows: readonly OffentligeYdelserRow[];
  cellErrorsByCellKey?: OffentligeYdelserTableCellErrorMap;
}>): OffentligeYdelserTableValidationResult => {
  const rowIssues: OffentligeYdelserTableValidationSummary['rowIssues'] = [];

  let hasErrors = false;
  let hasWarnings = false;
  let firstErrorCell: OffentligeYdelserTableFirstErrorCell | undefined;

  const cellErrorsByRow = collectCellErrorsByRow(cellErrorsByCellKey);

  for (const row of rows) {
    const {
      fraDatoFilled,
      tilDatoFilled,
      ydelsestypeSelected,
      hasAnyAmount,
      hasAnyFilled,
      periodComplete,
    } = getOffentligeYdelserRowFilledState(row);

    const rowErrorKeys = cellErrorsByRow.get(row.id) ?? new Set<OffentligeYdelserTableColumnKey>();
    const hasInputError = rowErrorKeys.size > 0;
    const hasMissingRequired = hasAnyFilled && (!periodComplete || !ydelsestypeSelected);

    const rowHasError = hasInputError || hasMissingRequired;
    const rowHasWarning = !rowHasError && periodComplete && ydelsestypeSelected && !hasAnyAmount;

    if (rowHasError) {
      hasErrors = true;
      rowIssues.push({ rowId: row.id, level: 'error', reason: hasInputError ? 'input' : 'missing' });
      if (!firstErrorCell) {
        for (const colKey of COLUMN_ORDER) {
          if (rowErrorKeys.has(colKey)) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'input' };
            break;
          }
          if (colKey === 'fraDato' && hasAnyFilled && !fraDatoFilled) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'missing' };
            break;
          }
          if (colKey === 'tilDato' && hasAnyFilled && !tilDatoFilled) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'missing' };
            break;
          }
          if (colKey === 'ydelsestype' && hasAnyFilled && !ydelsestypeSelected) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'missing' };
            break;
          }
        }
      }
      continue;
    }

    if (rowHasWarning) {
      hasWarnings = true;
      rowIssues.push({ rowId: row.id, level: 'warning', reason: 'missing' });
    }
  }

  return {
    summary: {
      rowIssues,
      hasErrors,
      hasWarnings,
      firstErrorCell,
    },
  };
};
