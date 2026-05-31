import type { ISODateString } from '../../../types/branded';
import { dateToISO, isISODateString, parseISODate } from '../../../types/branded';
import type { IsoRange } from '../../../utils/isoDateHelpers';

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
