import type { StandardLoenTableRow, Loenperiode, TillaegAngivesSom } from '../../schemas/formSchemas';
import type {
  StandardLoenTableColumnKey,
  StandardLoenTableFirstErrorCell,
  StandardLoenTableValidationSummary,
  TableError,
} from '../../types/table';
import { isAmountValueStrict } from '../../utils/tableValidationCommon';

export type StandardLoenTableCellErrorMap = Readonly<Record<string, true>>;

export type StandardLoenTableValidationResult = Readonly<{
  summary: StandardLoenTableValidationSummary;
  errors: TableError[];
}>;

// Validation-scoped emptiness: en eksplicit 0 tæller som udfyldt input, så brugeren
// ikke får status om "manglende beløb", når 0 reelt er den indtastede værdi.
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

/** Periodens start-/slut-kolonnenøgler for den valgte lønperiode (kanonisk kilde: PERIOD_KEYS). */
export const getStandardLoenPeriodKeys = (
  loenperiode: Loenperiode
): readonly [StandardLoenTableColumnKey, StandardLoenTableColumnKey] => PERIOD_KEYS[loenperiode];

// Beløbsfelterne (col2-col5) er altid redigerbare; tillægsbeløbskolonnerne tæller kun med i
// Beløb-tilstand (hvor de er redigerbare i stedet for beregnede).
const BASE_AMOUNT_KEYS: readonly StandardLoenTableColumnKey[] = ['col2', 'col3', 'col4', 'col5'];
const BELOEB_AMOUNT_KEYS: readonly StandardLoenTableColumnKey[] = ['fpFvShSoBeloeb', 'pensionBeloeb'];

const getAmountKeys = (mode: TillaegAngivesSom): readonly StandardLoenTableColumnKey[] =>
  mode === 'beloeb' ? [...BASE_AMOUNT_KEYS, ...BELOEB_AMOUNT_KEYS] : BASE_AMOUNT_KEYS;

const hasAnyAmountInput = (row: StandardLoenTableRow, mode: TillaegAngivesSom): boolean =>
  getAmountKeys(mode).some((key) => !isStandardLoenTableValueEffectivelyEmptyForValidation(row[key]));

const getColumnOrder = (loenperiode: Loenperiode, mode: TillaegAngivesSom): readonly StandardLoenTableColumnKey[] => {
  const [startKey, endKey] = PERIOD_KEYS[loenperiode];
  return [startKey, endKey, ...getAmountKeys(mode)];
};

const isStandardLoenTableColumnKey = (value: string): value is StandardLoenTableColumnKey => (
  value === 'col0_maaned'
  || value === 'col1_maaned'
  || value === 'col0_uge'
  || value === 'col1_uge'
  || value === 'col0_dag'
  || value === 'col1_dag'
  || value === 'col2'
  || value === 'col3'
  || value === 'col4'
  || value === 'col5'
  || value === 'fpFvShSoBeloeb'
  || value === 'pensionBeloeb'
);

const resolveColumnKeyFromCellKeyPart = (
  value: string,
  loenperiode: Loenperiode
): StandardLoenTableColumnKey | null => {
  if (isStandardLoenTableColumnKey(value)) return value;
  const numeric = Number.parseInt(value, 10);
  if (!Number.isInteger(numeric) || String(numeric) !== value) return null;
  if (numeric === 0 || numeric === 1) return PERIOD_KEYS[loenperiode][numeric];
  if (numeric === 2) return 'col2';
  if (numeric === 3) return 'col3';
  if (numeric === 4) return 'col4';
  if (numeric === 5) return 'col5';
  if (numeric === 6) return 'fpFvShSoBeloeb';
  if (numeric === 7) return 'pensionBeloeb';
  return null;
};

const collectCellErrorsByRow = (
  cellErrorsByCellKey: StandardLoenTableCellErrorMap,
  loenperiode: Loenperiode
): Map<string, Set<StandardLoenTableColumnKey>> => {
  const byRow = new Map<string, Set<StandardLoenTableColumnKey>>();

  for (const cellKey of Object.keys(cellErrorsByCellKey)) {
    const separatorIdx = cellKey.indexOf(':');
    if (separatorIdx < 0) continue;
    const rowId = cellKey.slice(0, separatorIdx);
    const colKeyRaw = cellKey.slice(separatorIdx + 1);
    const colKey = resolveColumnKeyFromCellKeyPart(colKeyRaw, loenperiode);
    if (!colKey) continue;
    const set = byRow.get(rowId);
    if (set) {
      set.add(colKey);
    } else {
      byRow.set(rowId, new Set([colKey]));
    }
  }

  return byRow;
};

export const getStandardLoenTableValidation = ({
  rows,
  loenperiode,
  cellErrorsByCellKey = {},
  tillaegAngivesSom = 'procent',
  emptyCompletePeriodLevel = 'warning',
}: Readonly<{
  rows: readonly StandardLoenTableRow[];
  loenperiode: Loenperiode;
  cellErrorsByCellKey?: StandardLoenTableCellErrorMap;
  tillaegAngivesSom?: TillaegAngivesSom;
  /** Årslønsberegning blokerer, mens EO bevarer sin særskilte ikke-blokerende warning-semantik. */
  emptyCompletePeriodLevel?: 'warning' | 'error';
}>): StandardLoenTableValidationResult => {
  const rowIssues: StandardLoenTableValidationSummary['rowIssues'] = [];
  const errors: TableError[] = [];
  const cellErrorsByRow = collectCellErrorsByRow(cellErrorsByCellKey, loenperiode);

  let hasErrors = false;
  let hasWarnings = false;
  let firstErrorCell: StandardLoenTableFirstErrorCell | undefined;

  const [periodStartKey, periodEndKey] = PERIOD_KEYS[loenperiode];
  const relevantKeys = new Set<StandardLoenTableColumnKey>([periodStartKey, periodEndKey, ...getAmountKeys(tillaegAngivesSom)]);
  const columnOrder = getColumnOrder(loenperiode, tillaegAngivesSom);

  for (const row of rows) {
    const startFilled = !isStandardLoenTableValueEffectivelyEmptyForValidation(row[periodStartKey]);
    const endFilled = !isStandardLoenTableValueEffectivelyEmptyForValidation(row[periodEndKey]);
    const periodComplete = startFilled && endFilled;

    const otherFilled = hasAnyAmountInput(row, tillaegAngivesSom);
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

    const hasMissingAmountError =
      emptyCompletePeriodLevel === 'error' && periodComplete && !otherFilled && !hasInputError;
    if (hasMissingAmountError) {
      // En komplet periode er en aktiv lønrække. Uden mindst ét beløb ville helårsomregningen ellers
      // acceptere en tom indkomstperiode og fremstille et ufuldstændigt grundlag som beregningsklart.
      errors.push({ kind: 'cell', issue: 'missing_amount', rowId: row.id, colKey: BASE_AMOUNT_KEYS[0] });
    }

    const rowHasError = hasInputError || hasMissingPeriodError || hasMissingAmountError;
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
          if (colKey === BASE_AMOUNT_KEYS[0] && hasMissingAmountError) {
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
