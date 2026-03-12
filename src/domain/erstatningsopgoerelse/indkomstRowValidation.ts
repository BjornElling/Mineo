import type { OffentligeYdelserRow, AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode } from '../../schemas/formSchemas';
import { dateToISO } from '../../types/branded';
import { parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import { MIN_YEAR, CURRENT_YEAR } from '../../config/dateRanges';
import { getAarsloenTableValidation, isAarsloenTableValueEffectivelyEmptyForValidation } from '../../utils/aarsloenTableValidation';
import type { AarsloenTableColumnKey } from '../../types/table';
import {
  getOffentligeYdelserTableValidation,
  isOffentligeYdelserAmountValueValidForValidation,
  isOffentligeYdelserTableValueEffectivelyEmptyForValidation,
  buildOffentligeYdelserCellKey,
} from '../../utils/offentligeYdelserTableValidation';
import { amountValueToNumber } from '../../utils/expressionAmount';
import { parseAarsloenRowInterval } from './aarsloenRowInterval';
import { buildLoenArbejdsdageSet } from './periodiseringsMotor';
import { computeTafBeregningsenhed, TAF_BEREGNES_SOM } from './tafBeregningsenhed';
import { formatDanishDate } from '../../utils/dateUtils';

const AARSLOEN_AMOUNT_COLUMN_KEYS = ['col2', 'col3', 'col4', 'col5'] as const satisfies ReadonlyArray<AarsloenTableColumnKey>;

export type AarsloenZeroArbejdsdageValidationInput = Pick<
  ErstatningsopgoerelseValues,
  | 'beregnesUdFra'
  | 'periodeTilBeregningFra'
  | 'periodeTilBeregningTil'
  | 'loenindkomstAnsaettelsesforhold'
  | 'ferieperioder'
  | 'fravaerPerioder'
>;

export const buildLoenindkomstZeroArbejdsdageMessage = (fra: Date, til: Date): string => {
  return `Perioden (${formatDanishDate(fra)} - ${formatDanishDate(til)}) indeholder løn, men ingen arbejdsdage.`;
};

type AarsloenZeroArbejdsdageIssue = Readonly<{
  rowId: string;
  colKeys: readonly AarsloenTableColumnKey[];
  message: string;
}>;

const isValidMonthValue = (value: string | undefined): boolean => {
  if (isAarsloenTableValueEffectivelyEmptyForValidation(value)) return true;
  const parsed = Number.parseInt((value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1 && parsed <= 12;
};

const isValidYearValue = (value: string | undefined): boolean => {
  if (isAarsloenTableValueEffectivelyEmptyForValidation(value)) return true;
  const trimmed = (value ?? '').trim();
  if (!/^\d{4}$/.test(trimmed)) return false;
  const year = Number.parseInt(trimmed, 10);
  return Number.isFinite(year) && year >= MIN_YEAR && year <= CURRENT_YEAR;
};

const isValidWeekValue = (value: string | undefined): boolean => {
  if (isAarsloenTableValueEffectivelyEmptyForValidation(value)) return true;
  const trimmed = (value ?? '').trim();
  const parts = trimmed.split('/');
  if (parts.length !== 2) return false;
  const week = Number.parseInt(parts[0] ?? '', 10);
  const year = Number.parseInt(parts[1] ?? '', 10);
  if (!Number.isFinite(week) || !Number.isFinite(year)) return false;
  if (week < 1 || week > 53) return false;
  if (year < MIN_YEAR || year > CURRENT_YEAR) return false;
  return parseWeekString(trimmed) !== null;
};

const isValidDateValue = (value: string | undefined): boolean => {
  if (isAarsloenTableValueEffectivelyEmptyForValidation(value)) return true;
  return parseDanishDate((value ?? '').trim()) !== null;
};

const hasPeriodOrderError = (row: AarsloenTableRow, loenperiode: Loenperiode): boolean => {
  if (loenperiode === 'uge') {
    const fra = parseWeekString((row.col0_uge ?? '').trim());
    const til = parseWeekString((row.col1_uge ?? '').trim());
    if (!fra || !til) return false;
    return fra.start > til.end;
  }

  if (loenperiode === 'dag') {
    const fra = parseDanishDate((row.col0_dag ?? '').trim());
    const til = parseDanishDate((row.col1_dag ?? '').trim());
    if (!fra || !til) return false;
    return fra > til;
  }

  return false;
};

export const buildAarsloenCellErrors = (rows: readonly AarsloenTableRow[], loenperiode: Loenperiode): Record<string, true> => {
  const errors: Record<string, true> = {};
  for (const row of rows) {
    if (loenperiode === 'maaned') {
      if (!isValidMonthValue(row.col0_maaned)) errors[`${row.id}:col0_maaned`] = true;
      if (!isValidYearValue(row.col1_maaned)) errors[`${row.id}:col1_maaned`] = true;
    } else if (loenperiode === 'uge') {
      if (!isValidWeekValue(row.col0_uge)) errors[`${row.id}:col0_uge`] = true;
      if (!isValidWeekValue(row.col1_uge)) errors[`${row.id}:col1_uge`] = true;
      if (hasPeriodOrderError(row, loenperiode)) {
        errors[`${row.id}:col0_uge`] = true;
        errors[`${row.id}:col1_uge`] = true;
      }
    } else {
      if (!isValidDateValue(row.col0_dag)) errors[`${row.id}:col0_dag`] = true;
      if (!isValidDateValue(row.col1_dag)) errors[`${row.id}:col1_dag`] = true;
      if (hasPeriodOrderError(row, loenperiode)) {
        errors[`${row.id}:col0_dag`] = true;
        errors[`${row.id}:col1_dag`] = true;
      }
    }
  }
  return errors;
};

const isValidOffentligDatoValue = (value: string | undefined): boolean => {
  if (isOffentligeYdelserTableValueEffectivelyEmptyForValidation(value)) return true;
  return parseDanishDate((value ?? '').trim()) !== null;
};

export const buildOffentligeYdelserCellErrors = (rows: readonly OffentligeYdelserRow[]): Record<string, true> => {
  const errors: Record<string, true> = {};
  for (const row of rows) {
    if (!isValidOffentligDatoValue(row.fraDato)) errors[buildOffentligeYdelserCellKey(row.id, 'fraDato')] = true;
    if (!isValidOffentligDatoValue(row.tilDato)) errors[buildOffentligeYdelserCellKey(row.id, 'tilDato')] = true;
    if (row.ydelse !== undefined && !isOffentligeYdelserAmountValueValidForValidation(row.ydelse)) {
      errors[buildOffentligeYdelserCellKey(row.id, 'ydelse')] = true;
    }
    if (row.tillaeg !== undefined && !isOffentligeYdelserAmountValueValidForValidation(row.tillaeg)) {
      errors[buildOffentligeYdelserCellKey(row.id, 'tillaeg')] = true;
    }
  }
  return errors;
};

export const getAarsloenErrorRowIdSet = (rows: readonly AarsloenTableRow[], loenperiode: Loenperiode): ReadonlySet<string> => {
  const cellErrors = buildAarsloenCellErrors(rows, loenperiode);
  const validation = getAarsloenTableValidation({ rows, loenperiode, cellErrorsByCellKey: cellErrors });
  return new Set(validation.summary.rowIssues.filter((issue) => issue.level === 'error').map((issue) => issue.rowId));
};

const hasPositiveAmountInput = (row: AarsloenTableRow): boolean => {
  return AARSLOEN_AMOUNT_COLUMN_KEYS.some((colKey) => {
    // Zero beløb giver ikke denne fejl. Reglen gælder kun rækker med faktisk positiv lønindtastning.
    const value = amountValueToNumber(row[colKey]);
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  });
};

const getFilledAmountColumnKeys = (row: AarsloenTableRow): readonly AarsloenTableColumnKey[] => {
  return AARSLOEN_AMOUNT_COLUMN_KEYS.filter((colKey) => !isAarsloenTableValueEffectivelyEmptyForValidation(row[colKey]));
};

export const buildAarsloenZeroArbejdsdageIssues = (
  values: AarsloenZeroArbejdsdageValidationInput,
  employmentId: string
): ReadonlyArray<AarsloenZeroArbejdsdageIssue> => {
  if (computeTafBeregningsenhed(values) !== TAF_BEREGNES_SOM.ARBEJDSDAGE) return [];

  const employment = (values.loenindkomstAnsaettelsesforhold ?? []).find((af) => af.id === employmentId);
  if (!employment) return [];

  const ferieOgFravaersperioder = [...(values.ferieperioder ?? []), ...(values.fravaerPerioder ?? [])];
  const issues: AarsloenZeroArbejdsdageIssue[] = [];

  for (const row of employment.indtaegtsoplysningerTableData ?? []) {
    if (!hasPositiveAmountInput(row)) continue;

    const interval = parseAarsloenRowInterval(row, employment.loenperiode);
    if (!interval) continue;

    const fra = dateToISO(interval.start);
    const til = dateToISO(interval.end);
    if (!fra || !til) continue;

    const arbejdsdageSet = buildLoenArbejdsdageSet({ fra, til }, ferieOgFravaersperioder);
    if (arbejdsdageSet.size > 0) continue;

    const colKeys = getFilledAmountColumnKeys(row);
    if (colKeys.length === 0) continue;

    issues.push({
      rowId: row.id,
      colKeys,
      message: buildLoenindkomstZeroArbejdsdageMessage(interval.start, interval.end),
    });
  }

  return issues;
};

export const buildAarsloenZeroArbejdsdageCellErrorMessages = (
  values: AarsloenZeroArbejdsdageValidationInput,
  employmentId: string
): Readonly<Record<string, string>> => {
  const messages: Record<string, string> = {};
  for (const issue of buildAarsloenZeroArbejdsdageIssues(values, employmentId)) {
    for (const colKey of issue.colKeys) {
      messages[`${issue.rowId}:${colKey}`] = issue.message;
    }
  }
  return messages;
};

export const getOffentligeYdelserErrorRowIdSet = (rows: readonly OffentligeYdelserRow[]): ReadonlySet<string> => {
  const cellErrors = buildOffentligeYdelserCellErrors(rows);
  const validation = getOffentligeYdelserTableValidation({ rows, cellErrorsByCellKey: cellErrors });
  return new Set(validation.summary.rowIssues.filter((issue) => issue.level === 'error').map((issue) => issue.rowId));
};
