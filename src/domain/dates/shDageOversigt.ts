import type { ISODateString } from '../../types/branded';
import { dateToISO, parseISODate } from '../../types/branded';
import { mergeDateRanges, mergeIsoDateRanges } from '../erstatningsopgoerelse/engines/periodMerging';
import { beregnHelligdageMedNavn } from './shDageBeregning';

export type NavngivetHelligdagIRange = Readonly<{
  date: Date;
  navn: string;
  erHverdag: boolean;
}>;

type DateRange = Readonly<{
  start: Date;
  end: Date;
}>;

type IsoRange = Readonly<{
  fra: ISODateString;
  til: ISODateString;
}>;

const isWeekdayUtc = (date: Date): boolean => {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5;
};

const findNamedHolidaysBetweenDates = (start: Date, end: Date): NavngivetHelligdagIRange[] => {
  if (start > end) {
    return [];
  }

  const rows: NavngivetHelligdagIRange[] = [];
  for (let year = start.getUTCFullYear(); year <= end.getUTCFullYear(); year += 1) {
    for (const { date, navn } of beregnHelligdageMedNavn(year)) {
      if (date < start || date > end) {
        continue;
      }

      rows.push({
        date,
        navn,
        erHverdag: isWeekdayUtc(date),
      });
    }
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return rows;
};

export const findNamedHolidaysInDateRanges = (
  ranges: readonly DateRange[]
): NavngivetHelligdagIRange[] => {
  const mergedRanges = mergeDateRanges(
    ranges.map((range) => ({ fra: range.start, til: range.end })),
    { mergeAdjacent: true }
  );
  if (mergedRanges.length === 0) {
    return [];
  }

  const rows: NavngivetHelligdagIRange[] = [];
  const seen = new Set<ISODateString>();

  for (const range of mergedRanges) {
    const rangeRows = findNamedHolidaysBetweenDates(range.fra, range.til);
    for (const row of rangeRows) {
      const iso = dateToISO(row.date);
      if (!iso || seen.has(iso)) {
        continue;
      }
      seen.add(iso);
      rows.push(row);
    }
  }

  return rows;
};

export const findNamedHolidaysInIsoRanges = (
  ranges: readonly IsoRange[]
): NavngivetHelligdagIRange[] => {
  const mergedRanges = mergeIsoDateRanges(ranges, { mergeAdjacent: true });
  if (mergedRanges.length === 0) {
    return [];
  }

  const rows: NavngivetHelligdagIRange[] = [];
  const seen = new Set<ISODateString>();

  for (const range of mergedRanges) {
    const start = parseISODate(range.fra);
    const end = parseISODate(range.til);
    if (!start || !end || start > end) {
      continue;
    }

    const rangeRows = findNamedHolidaysBetweenDates(start, end);
    for (const row of rangeRows) {
      const iso = dateToISO(row.date);
      if (!iso || seen.has(iso)) {
        continue;
      }
      seen.add(iso);
      rows.push(row);
    }
  }

  return rows;
};
