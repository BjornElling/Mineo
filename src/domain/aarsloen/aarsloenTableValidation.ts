import type { AarsloenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type {
  AarsloenTableColumnKey,
  AarsloenTableFirstErrorCell,
  AarsloenTableValidationSummary,
  TableError,
} from '../../types/table';
import { isAmountValueStrict } from '../../utils/tableValidationCommon';

export type AarsloenTableCellErrorMap = Readonly<Record<string, true>>;

export type AarsloenTableValidationResult = Readonly<{
  summary: AarsloenTableValidationSummary;
  errors: TableError[];
}>;

export const isAarsloenTableValueEffectivelyEmptyForValidation = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (typeof value === 'number') return !Number.isFinite(value);
  if (isAmountValueStrict(value)) {
    if (!Number.isFinite(value.value)) return true;
    if (value.kind === 'number') return false;
    if (value.expression.trim() === '') return true;
    return false;
  }
  return false;
};

const PERIOD_KEYS: Record<Loenperiode, readonly [AarsloenTableColumnKey, AarsloenTableColumnKey]> = {
  maaned: ['col0_maaned', 'col1_maaned'],
  uge: ['col0_uge', 'col1_uge'],
  dag: ['col0_dag', 'col1_dag'],
};

const OTHER_KEYS: readonly AarsloenTableColumnKey[] = ['col2', 'col3', 'col4', 'col5'];

const hasAnyAmountInput = (row: AarsloenTableRow): boolean => {
  return OTHER_KEYS.some((key) => row[key] !== undefined && row[key] !== null);
};

const getColumnOrder = (loenperiode: Loenperiode): readonly AarsloenTableColumnKey[] => {
  const [startKey, endKey] = PERIOD_KEYS[loenperiode];
  return [startKey, endKey, ...OTHER_KEYS];
};

const isAarsloenTableColumnKey = (value: string): value is AarsloenTableColumnKey => {
  return (
    value === 'col0_maaned' ||
    value === 'col1_maaned' ||
    value === 'col0_uge' ||
    value === 'col1_uge' ||
    value === 'col0_dag' ||
    value === 'col1_dag' ||
    value === 'col2' ||
    value === 'col3' ||
    value === 'col4' ||
    value === 'col5'
  );
};

const collectCellErrorsByRow = (cellErrorsByCellKey: AarsloenTableCellErrorMap): Map<string, Set<AarsloenTableColumnKey>> => {
  const byRow = new Map<string, Set<AarsloenTableColumnKey>>();

  for (const cellKey of Object.keys(cellErrorsByCellKey)) {
    const separatorIdx = cellKey.indexOf(':');
    if (separatorIdx < 0) continue;
    const rowId = cellKey.slice(0, separatorIdx);
    const colKeyRaw = cellKey.slice(separatorIdx + 1);
    if (!isAarsloenTableColumnKey(colKeyRaw)) continue;
    const set = byRow.get(rowId);
    if (set) {
      set.add(colKeyRaw);
    } else {
      byRow.set(rowId, new Set([colKeyRaw]));
    }
  }

  return byRow;
};

export const getAarsloenTableValidation = ({
  rows,
  loenperiode,
  cellErrorsByCellKey = {},
}: Readonly<{
  rows: readonly AarsloenTableRow[];
  loenperiode: Loenperiode;
  cellErrorsByCellKey?: AarsloenTableCellErrorMap;
}>): AarsloenTableValidationResult => {
  const rowIssues: AarsloenTableValidationSummary['rowIssues'] = [];
  const errors: TableError[] = [];
  const cellErrorsByRow = collectCellErrorsByRow(cellErrorsByCellKey);

  let hasErrors = false;
  let hasWarnings = false;
  let firstErrorCell: AarsloenTableFirstErrorCell | undefined;

  const [periodStartKey, periodEndKey] = PERIOD_KEYS[loenperiode];
  const relevantKeys = new Set<AarsloenTableColumnKey>([periodStartKey, periodEndKey, ...OTHER_KEYS]);
  const columnOrder = getColumnOrder(loenperiode);

  for (const row of rows) {
    const startFilled = !isAarsloenTableValueEffectivelyEmptyForValidation(row[periodStartKey]);
    const endFilled = !isAarsloenTableValueEffectivelyEmptyForValidation(row[periodEndKey]);
    const periodComplete = startFilled && endFilled;

    const otherFilled = hasAnyAmountInput(row);
    const hasAnyFilled = startFilled || endFilled || otherFilled;

    const rowErrorKeys = cellErrorsByRow.get(row.id) ?? new Set<AarsloenTableColumnKey>();
    const hasInputError = Array.from(rowErrorKeys).some((colKey) => relevantKeys.has(colKey));

    for (const colKey of rowErrorKeys) {
      if (!relevantKeys.has(colKey)) continue;
      errors.push({ kind: 'cell', issue: 'invalid', rowId: row.id, colKey });
    }

    const hasMissingPeriodError = hasAnyFilled && !periodComplete;
    if (hasMissingPeriodError) {
      if (!startFilled) {
        errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: periodStartKey });
      }
      if (!endFilled) {
        errors.push({ kind: 'cell', issue: 'partial_period', rowId: row.id, colKey: periodEndKey });
      }
    }

    const rowHasError = hasInputError || hasMissingPeriodError;
    const rowHasWarning = !rowHasError && periodComplete && !otherFilled;

    if (rowHasError) {
      rowIssues.push({ rowId: row.id, level: 'error' });
      hasErrors = true;
      if (!firstErrorCell) {
        for (const colKey of columnOrder) {
          if (rowErrorKeys.has(colKey)) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'input' };
            break;
          }
          if (colKey === periodStartKey && hasAnyFilled && !startFilled) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'missing' };
            break;
          }
          if (colKey === periodEndKey && hasAnyFilled && !endFilled) {
            firstErrorCell = { rowId: row.id, colKey, reason: 'missing' };
            break;
          }
        }
      }
      continue;
    }

    if (rowHasWarning) {
      rowIssues.push({ rowId: row.id, level: 'warning' });
      hasWarnings = true;
    }
  }

  return {
    summary: {
      rowIssues,
      hasErrors,
      hasWarnings,
      firstErrorCell,
    },
    errors,
  };
};
