import type { AarsloenTableRow, Loenperiode } from '../../schemas/formSchemas';
import { createDate, parseDanishDate, parseWeekString } from '../../utils/dateUtils';
import type { DateInterval } from '../../utils/isoDateHelpers';

const toUtcDay = (date: Date): Date => {
  return createDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
};

export const parseAarsloenRowInterval = (row: AarsloenTableRow, loenperiode: Loenperiode): DateInterval | null => {
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

  const fraDato = row.col0_dag?.trim() ?? '';
  const tilDato = row.col1_dag?.trim() ?? '';
  if (fraDato === '' || tilDato === '') return null;

  const fra = parseDanishDate(fraDato);
  const til = parseDanishDate(tilDato);
  if (!fra || !til) return null;
  if (fra > til) return null;
  return { start: toUtcDay(fra), end: toUtcDay(til) };
};
