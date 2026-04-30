import type { DateInterval } from '../types/calculation';
import type { ISODateString } from '../types/branded';
import { createDate, dateToISO, isISODateString, parseISODate } from '../types/branded';
import { formatISOToDanish } from './dateFormatting';

export type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;
export type { DateInterval };

export const validateIsoRange = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): IsoRange | undefined => {
  if (!fra || !til) return undefined;
  if (fra > til) return undefined;
  return { fra, til };
};

export function minISO(a: ISODateString, b: ISODateString): ISODateString;
export function minISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined;
export function minISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function maxISO(a: ISODateString, b: ISODateString): ISODateString;
export function maxISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined;
export function maxISO(
  a: ISODateString | undefined,
  b: ISODateString | undefined
): ISODateString | undefined {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

export const isoYear = (isoDate: ISODateString): number => {
  return Number.parseInt(isoDate.slice(0, 4), 10);
};

export const endOfYearIso = (year: number): ISODateString => {
  const iso = dateToISO(createDate(year, 11, 31));
  if (!iso) {
    throw new Error(`Could not construct ISO end-of-year date for year: ${year}`);
  }
  return iso;
};

export function getDayBeforeIso(isoDate: ISODateString): ISODateString;
export function getDayBeforeIso(isoDate: ISODateString | undefined): ISODateString | undefined;
export function getDayBeforeIso(isoDate: ISODateString | undefined): ISODateString | undefined {
  if (!isoDate) return undefined;
  const date = parseISODate(isoDate);
  if (!date) return undefined;
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() - 1);
  return dateToISO(result);
}

export function getDayAfterIso(isoDate: ISODateString): ISODateString;
export function getDayAfterIso(isoDate: ISODateString | undefined): ISODateString | undefined;
export function getDayAfterIso(isoDate: ISODateString | undefined): ISODateString | undefined {
  if (!isoDate) return undefined;
  const date = parseISODate(isoDate);
  if (!date) return undefined;
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + 1);
  return dateToISO(result);
}

export const firstOfMonthAfterIso = (isoDate: ISODateString): ISODateString => {
  const parsed = parseISODate(isoDate);
  if (!parsed) {
    throw new Error(`Invalid ISODateString invariant in firstOfMonthAfterIso: ${isoDate}`);
  }
  const monthIndex = parsed.getUTCMonth();
  const nextMonthYear = monthIndex === 11 ? parsed.getUTCFullYear() + 1 : parsed.getUTCFullYear();
  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextMonthFirst = dateToISO(createDate(nextMonthYear, nextMonthIndex, 1));
  if (!nextMonthFirst) {
    throw new Error(`Could not construct first day of next month for ISODateString: ${isoDate}`);
  }
  return nextMonthFirst;
};

export const parseOptionalIsoDate = (value: unknown): ISODateString | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!isISODateString(trimmed)) return undefined;
  return trimmed;
};

// Kanonisk helper til ISO-datoer i domænet:
// Vi sorterer og deduplikerer bevidst, fordi de fleste kaldsteder samler datoer fra flere kilder
// i Sets eller kombinerede lister, hvor dubletter ikke har selvstændig domænebetydning.
export const sortIsoDates = (values: Iterable<ISODateString>): ISODateString[] =>
  Array.from(new Set(values)).sort((a, b) => (a < b ? -1 : 1));

/**
 * Itererer alle UTC-dage i intervallet [start, end] inklusivt.
 * Kontrakt: `start` og `end` er date-only UTC-dage, og `start <= end`.
 */
export const iterateDatesInclusive = (start: Date, end: Date, onDate: (date: Date) => void): void => {
  const current = new Date(start.getTime());
  while (current <= end) {
    onDate(current);
    current.setUTCDate(current.getUTCDate() + 1);
  }
};

export const validateISODateRange = (
  isoDate: string,
  minDate: string | undefined,
  maxDate: string | undefined
): { isValid: boolean; errorMessage: string } => {
  if (!isISODateString(isoDate)) {
    return { isValid: false, errorMessage: 'Ugyldig dato' };
  }

  const normalizedMin = isISODateString(minDate) ? minDate : undefined;
  const normalizedMax = isISODateString(maxDate) ? maxDate : undefined;

  if (normalizedMin && normalizedMax && (isoDate < normalizedMin || isoDate > normalizedMax)) {
    return {
      isValid: false,
      errorMessage: `Dato skal være mellem ${formatISOToDanish(normalizedMin)} og ${formatISOToDanish(normalizedMax)}`,
    };
  }

  if (normalizedMin && isoDate < normalizedMin) {
    return { isValid: false, errorMessage: `Dato skal være efter ${formatISOToDanish(normalizedMin)}` };
  }

  if (normalizedMax && isoDate > normalizedMax) {
    return { isValid: false, errorMessage: `Dato skal være før ${formatISOToDanish(normalizedMax)}` };
  }

  return { isValid: true, errorMessage: '' };
};
