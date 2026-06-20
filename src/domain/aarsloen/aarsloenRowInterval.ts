import type { StandardLoenTableRow, Loenperiode } from '../../schemas/formSchemas';
import { createDate, parseWeekString } from '../../utils/dateUtils';
import type { DateInterval } from '../../utils/isoDateHelpers';
import { coerceToISODateString, parseISODate } from '../../types/branded';

const toUtcDay = (date: Date): Date => {
  return createDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const parseAarsloenRowInterval = (row: StandardLoenTableRow, loenperiode: Loenperiode): DateInterval | null => {
  if (loenperiode === 'maaned') {
    const monthRaw = row.col0_maaned?.trim() ?? '';
    const yearRaw = row.col1_maaned?.trim() ?? '';
    if (monthRaw === '' || yearRaw === '') return null;

    const month = Number.parseInt(monthRaw, 10);
    const year = Number.parseInt(yearRaw, 10);
    if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
    if (month < 1 || month > 12) return null;
    if (year < 1900 || year > 2100) return null;

    const start = createDate(year, month - 1, 1);
    const end = createDate(year, month, 0);
    return { start, end };
  }

  if (loenperiode === 'uge') {
    const fraUge = row.col0_uge?.trim() ?? '';
    const tilUge = row.col1_uge?.trim() ?? '';
    if (fraUge === '' || tilUge === '') return null;

    const fra = parseWeekString(fraUge);
    const til = parseWeekString(tilUge);
    if (!fra || !til) return null;
    if (fra.start > til.end) return null;
    return { start: toUtcDay(fra.start), end: toUtcDay(til.end) };
  }

  const fraDato = coerceToISODateString(row.col0_dag);
  const tilDato = coerceToISODateString(row.col1_dag);
  if (!fraDato || !tilDato) return null;

  const fra = parseISODate(fraDato);
  const til = parseISODate(tilDato);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { start: toUtcDay(fra), end: toUtcDay(til) };
};

export const hasAarsloenPeriodOrderError = (row: StandardLoenTableRow, loenperiode: Loenperiode): boolean => {
  if (loenperiode === 'uge') {
    const fraUge = row.col0_uge?.trim() ?? '';
    const tilUge = row.col1_uge?.trim() ?? '';
    if (fraUge === '' || tilUge === '') return false;

    const fra = parseWeekString(fraUge);
    const til = parseWeekString(tilUge);
    if (!fra || !til) return false;
    return fra.start > til.end;
  }

  if (loenperiode === 'dag') {
    const fraDato = coerceToISODateString(row.col0_dag);
    const tilDato = coerceToISODateString(row.col1_dag);
    if (!fraDato || !tilDato) return false;

    const fra = parseISODate(fraDato);
    const til = parseISODate(tilDato);
    if (!fra || !til) return false;
    return fra > til;
  }

  return false;
};
