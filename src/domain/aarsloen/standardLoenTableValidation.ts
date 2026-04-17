import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import type {
  StandardLoenTableColumnKey,
  StandardLoenTableFirstErrorCell,
  StandardLoenTableValidationSummary,
  TableError,
} from '../../types/table';
import { DATE_ORDER_ERROR_MESSAGE } from '../../utils/dateOrderValidation';
import { hasAarsloenPeriodOrderError } from '../erstatningsopgoerelse/helpers/aarsloenRowInterval';
import { isAmountValueStrict } from '../../utils/tableValidationCommon';

export type StandardLoenTableCellErrorMap = Readonly<Record<string, true>>;

export type StandardLoenTableValidationResult = Readonly<{
  summary: StandardLoenTableValidationSummary;
  errors: TableError[];
}>;

// Validation-scoped emptiness: en eksplicit 0 tæller som udfyldt input, så brugeren
// ikke får advarsel om "manglende beløb", når 0 reelt er den indtastede værdi.
export const isStandardLoenTableValueEffectivelyEmptyForValidation = (value: unknown): boolean => {
  if (value === undefined || value === null) return true;
  if (isAmountValueStrict(value)) {
    if (!Number.isFinite(value.value)) return true;
    return value.kind === 'expression' && value.expression.trim() === '';
  }
  if (typeof value === 'number') return !Number.isFinite(value);
  if (typeof value !== 'string') return false;
  return value.trim() === '';
};

const PERIOD_KEYS: Record<Loenperiode, readonly [StandardLoenTableColumnKey, StandardLoenTableColumnKey]> = {
  maaned: ['col0_maaned', 'col1_maaned'],
  uge: ['col0_uge', 'col1_uge'],
  dag: ['col0_dag', 'col1_dag'],
};

export const buildStandardLoenPeriodOrderCellErrorMessages = (
  rows: readonly StandardLoenTableRow[],
  loenperiode: Loenperiode
): Readonly<Record<string, string>> => {
  // Månedstabellen bruger måned + år som selvstændige felter og har derfor
  // ingen "fra/til"-rækkefølge, som kan give denne fejltype.
  if (loenperiode === 'maaned') return {};

  const [periodStartKey, periodEndKey] = PERIOD_KEYS[loenperiode];
  const messages: Record<string, string> = {};

  for (const row of rows) {
    if (!hasAarsloenPeriodOrderError(row, loenperiode)) continue;
    messages[`${row.id}:${periodStartKey}`] = DATE_ORDER_ERROR_MESSAGE;
    messages[`${row.id}:${periodEndKey}`] = DATE_ORDER_ERROR_MESSAGE;
  }

  return messages;
};

const OTHER_KEYS: readonly StandardLoenTableColumnKey[] = ['col2', 'col3', 'col4', 'col5'];

const hasAnyAmountInput = (row: StandardLoenTableRow): boolean => {
  return OTHER_KEYS.some((key) => !isStandardLoenTableValueEffectivelyEmptyForValidation(row[key]));
};

const getColumnOrder = (loenperiode: Loenperiode): readonly StandardLoenTableColumnKey[] => {
  const [startKey, endKey] = PERIOD_KEYS[loenperiode];
  return [startKey, endKey, ...OTHER_KEYS];
};

const isStandardLoenTableColumnKey = (value: string): value is StandardLoenTableColumnKey => {
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

const collectCellErrorsByRow = (cellErrorsByCellKey: StandardLoenTableCellErrorMap): Map<string, Set<StandardLoenTableColumnKey>> => {
  const byRow = new Map<string, Set<StandardLoenTableColumnKey>>();

  for (const cellKey of Object.keys(cellErrorsByCellKey)) {
    const separatorIdx = cellKey.indexOf(':');
    if (separatorIdx < 0) continue;
    const rowId = cellKey.slice(0, separatorIdx);
    const colKeyRaw = cellKey.slice(separatorIdx + 1);
    if (!isStandardLoenTableColumnKey(colKeyRaw)) continue;
    const set = byRow.get(rowId);
    if (set) {
      set.add(colKeyRaw);
    } else {
      byRow.set(rowId, new Set([colKeyRaw]));
    }
  }

  return byRow;
};

export const getStandardLoenTableValidation = ({
  rows,
  loenperiode,
  cellErrorsByCellKey = {},
}: Readonly<{
  rows: readonly StandardLoenTableRow[];
  loenperiode: Loenperiode;
  cellErrorsByCellKey?: StandardLoenTableCellErrorMap;
}>): StandardLoenTableValidationResult => {
  const rowIssues: StandardLoenTableValidationSummary['rowIssues'] = [];
  const errors: TableError[] = [];
  const cellErrorsByRow = collectCellErrorsByRow(cellErrorsByCellKey);

  let hasErrors = false;
  let hasWarnings = false;
  let firstErrorCell: StandardLoenTableFirstErrorCell | undefined;

  const [periodStartKey, periodEndKey] = PERIOD_KEYS[loenperiode];
  const relevantKeys = new Set<StandardLoenTableColumnKey>([periodStartKey, periodEndKey, ...OTHER_KEYS]);
  const columnOrder = getColumnOrder(loenperiode);

  for (const row of rows) {
    const startFilled = !isStandardLoenTableValueEffectivelyEmptyForValidation(row[periodStartKey]);
    const endFilled = !isStandardLoenTableValueEffectivelyEmptyForValidation(row[periodEndKey]);
    const periodComplete = startFilled && endFilled;

    const otherFilled = hasAnyAmountInput(row);
    const hasAnyFilled = startFilled || endFilled || otherFilled;

    const rowErrorKeys = cellErrorsByRow.get(row.id) ?? new Set<StandardLoenTableColumnKey>();
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
