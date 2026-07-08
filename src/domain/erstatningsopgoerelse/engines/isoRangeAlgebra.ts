import type { ISODateString } from '../../../types/branded';
import { dateToISO, isISODateString, parseISODate } from '../../../types/branded';
import type { IsoRange } from '../../../utils/isoDateHelpers';
import { getDayBeforeIso, iterateDatesInclusive } from '../../../utils/isoDateHelpers';
import { addDays } from '../../../utils/dateUtils';
import { isoDateToDate } from '../../dates/isoDate';

// Kanonisk hjem for IsoRange-algebra: merge, subtraktion, split, clip og range/date-set-konvertering.
// Alle periodiserings-konsumenter (TAF, SFGG, svie/smerte, ferie) trækker herfra frem for at
// reimplementere range-operationer lokalt.

// IsoDateRange er den ISO-baserede periode-form; identisk med den kanoniske IsoRange
// i isoDateHelpers. Bevarer det velbrugte navn (8 importører) som alias for ét sandt struktur-grundlag.
export type IsoDateRange = IsoRange;

type MergeableDateRange = Readonly<{
  fra: Date;
  til: Date;
}>;

const addDaysIso = (isoDate: ISODateString, days: number): ISODateString => {
  const date = parseISODate(isoDate);
  if (!date) {
    throw new Error(`Kunne ikke parse ISO-dato: ${isoDate}`);
  }
  const nextDate = new Date(date.getTime());
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  const nextIso = dateToISO(nextDate);
  if (!nextIso) {
    throw new Error(`Kunne ikke formatere ISO-dato efter dagforskydning: ${isoDate}`);
  }
  return nextIso;
};

export const mergeIsoDateRanges = <TRange extends IsoRange>(
  ranges: readonly TRange[],
  options?: Readonly<{ mergeAdjacent?: boolean }>
): IsoDateRange[] => {
  if (ranges.length === 0) return [];

  const mergeAdjacent = options?.mergeAdjacent ?? true;
  const sorted = [...ranges].sort((a, b) => {
    if (a.fra === b.fra) return a.til.localeCompare(b.til);
    return a.fra.localeCompare(b.fra);
  });

  const merged: IsoDateRange[] = [];
  let current: IsoDateRange = { fra: sorted[0].fra, til: sorted[0].til };

  for (let i = 1; i < sorted.length; i += 1) {
    const next = sorted[i];
    const currentBoundary = mergeAdjacent ? addDaysIso(current.til, 1) : current.til;
    if (next.fra <= currentBoundary) {
      current = {
        fra: current.fra,
        til: next.til > current.til ? next.til : current.til,
      };
      continue;
    }
    merged.push(current);
    current = { fra: next.fra, til: next.til };
  }

  merged.push(current);
  return merged;
};

export const mergeDateRanges = <TRange extends MergeableDateRange>(
  ranges: readonly TRange[],
  options?: Readonly<{ mergeAdjacent?: boolean }>
): Array<{ fra: Date; til: Date }> => {
  if (ranges.length === 0) return [];

  const isoRanges: IsoDateRange[] = [];
  for (const range of ranges) {
    const fraIso = dateToISO(range.fra);
    const tilIso = dateToISO(range.til);
    if (!fraIso || !tilIso || !isISODateString(fraIso) || !isISODateString(tilIso)) {
      throw new Error('Ugyldigt datointerval i mergeDateRanges');
    }
    isoRanges.push({ fra: fraIso, til: tilIso });
  }

  const mergedIso = mergeIsoDateRanges(isoRanges, options);
  return mergedIso.map((range) => {
    const fraDate = parseISODate(range.fra);
    const tilDate = parseISODate(range.til);
    if (!fraDate || !tilDate) {
      throw new Error('Kunne ikke parse sammenlagt datointerval');
    }
    return { fra: fraDate, til: tilDate };
  });
};

/** Alle inkluderede ISO-datoer på tværs af `ranges` som et sæt. */
export const buildDateSetFromRanges = (ranges: readonly IsoRange[]): Set<ISODateString> => {
  const result = new Set<ISODateString>();
  for (const range of ranges) {
    const start = parseISODate(range.fra);
    const end = parseISODate(range.til);
    if (!start || !end || start > end) continue;
    iterateDatesInclusive(start, end, (date) => {
      const iso = dateToISO(date);
      if (iso) result.add(iso);
    });
  }
  return result;
};

/** Samler sorterede, sammenhængende ISO-datoer til sammenhængende ranges. */
export const buildRangesFromSortedDates = (sortedDates: readonly ISODateString[]): IsoRange[] => {
  if (sortedDates.length === 0) return [];
  const result: IsoRange[] = [];
  let currentFra = sortedDates[0];
  let previous = sortedDates[0];

  for (let index = 1; index < sortedDates.length; index += 1) {
    const iso = sortedDates[index];
    const previousDate = parseISODate(previous);
    if (!previousDate) continue;
    const nextDate = addDays(previousDate, 1);
    const expectedIso = dateToISO(nextDate);
    if (!expectedIso || iso !== expectedIso) {
      result.push({ fra: currentFra, til: previous });
      currentFra = iso;
    }
    previous = iso;
  }

  result.push({ fra: currentFra, til: previous });
  return result;
};

/** En range der dækker præcis én dag. */
export const buildSingleDateRange = (iso: ISODateString): IsoRange => ({ fra: iso, til: iso });

/** Klipper alle ranges så de ikke overskrider `maxInclusive` (null = ingen begrænsning). */
export const clipRangesToInclusiveUpperBound = (
  ranges: readonly IsoRange[],
  maxInclusive: ISODateString | null
): IsoRange[] => {
  if (!maxInclusive) return [...ranges];
  return ranges
    .filter((range) => range.fra <= maxInclusive)
    .map((range) => ({
      fra: range.fra,
      til: range.til <= maxInclusive ? range.til : maxInclusive,
    }))
    .filter((range) => range.fra <= range.til);
};

/** Trækker `excludedRanges` fra `baseRanges` og returnerer de tilbageværende segmenter. */
export const subtractIsoDateRanges = (
  baseRanges: readonly IsoRange[],
  excludedRanges: readonly IsoRange[]
): IsoRange[] => {
  if (baseRanges.length === 0) return [];
  if (excludedRanges.length === 0) return [...baseRanges];

  const result: IsoRange[] = [];
  const sortedExcluded = [...excludedRanges].sort((a, b) => {
    if (a.fra === b.fra) return a.til.localeCompare(b.til);
    return a.fra.localeCompare(b.fra);
  });

  for (const base of baseRanges) {
    let cursor = base.fra;
    let exhausted = false;

    for (const excluded of sortedExcluded) {
      if (excluded.til < cursor) continue;
      if (excluded.fra > base.til) break;

      if (excluded.fra > cursor) {
        const til = getDayBeforeIso(excluded.fra);
        if (til && cursor <= til) {
          result.push({ fra: cursor, til });
        }
      }

      const nextCursor = addDays(isoDateToDate(excluded.til), 1);
      const nextCursorIso = dateToISO(nextCursor);
      if (!nextCursorIso || nextCursorIso > base.til) {
        exhausted = true;
        break;
      }
      cursor = nextCursorIso;
    }

    if (!exhausted && cursor <= base.til) {
      result.push({ fra: cursor, til: base.til });
    }
  }

  return result;
};

/** Splitter ranges ved hver `boundaryStart` (start på et nyt segment), uden at fjerne dage. */
export const splitRangesAtBoundaryStarts = (
  ranges: readonly IsoRange[],
  boundaryStarts: readonly ISODateString[]
): IsoRange[] => {
  if (ranges.length === 0) return [];
  if (boundaryStarts.length === 0) return [...ranges];

  const uniqueStarts = Array.from(new Set(boundaryStarts)).sort();
  const result: IsoRange[] = [];

  for (const range of ranges) {
    const starts = uniqueStarts.filter((start) => start > range.fra && start <= range.til);
    if (starts.length === 0) {
      result.push(range);
      continue;
    }

    let currentFra = range.fra;
    for (const start of starts) {
      const til = getDayBeforeIso(start);
      if (til && currentFra <= til) {
        result.push({ fra: currentFra, til });
      }
      currentFra = start;
    }
    if (currentFra <= range.til) {
      result.push({ fra: currentFra, til: range.til });
    }
  }

  return result;
};
