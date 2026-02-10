import type { OffentligeYdelserRow, AarsloenTableRow, Loenperiode } from '../../schemas/formSchemas';
import { parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import { MIN_YEAR, MAX_YEAR } from '../../config/dateRanges';
import { getAarsloenTableValidation, isAarsloenTableValueEffectivelyEmptyForValidation } from '../../utils/aarsloenTableValidation';
import {
  getOffentligeYdelserTableValidation,
  isOffentligeYdelserAmountValueValidForValidation,
  isOffentligeYdelserTableValueEffectivelyEmptyForValidation,
  buildOffentligeYdelserCellKey,
} from '../../utils/offentligeYdelserTableValidation';

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
  return Number.isFinite(year) && year >= MIN_YEAR && year <= MAX_YEAR;
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
  if (year < MIN_YEAR || year > MAX_YEAR) return false;
  return parseWeekString(trimmed) !== null;
};

const isValidDateValue = (value: string | undefined): boolean => {
  if (isAarsloenTableValueEffectivelyEmptyForValidation(value)) return true;
  return parseDanishDate((value ?? '').trim()) !== null;
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
    } else {
      if (!isValidDateValue(row.col0_dag)) errors[`${row.id}:col0_dag`] = true;
      if (!isValidDateValue(row.col1_dag)) errors[`${row.id}:col1_dag`] = true;
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

export const getOffentligeYdelserErrorRowIdSet = (rows: readonly OffentligeYdelserRow[]): ReadonlySet<string> => {
  const cellErrors = buildOffentligeYdelserCellErrors(rows);
  const validation = getOffentligeYdelserTableValidation({ rows, cellErrorsByCellKey: cellErrors });
  return new Set(validation.summary.rowIssues.filter((issue) => issue.level === 'error').map((issue) => issue.rowId));
};
