import type { ISODateString } from '../../types/branded';
import { createDate, isISODateString } from '../../types/branded';

export const parseIsoDateOrUndefined = (value: string | undefined): ISODateString | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return isISODateString(trimmed) ? trimmed : undefined;
};

/**
 * Converts an `ISODateString` to a UTC date-only `Date` without timezone shifts.
 *
 * Trust-critical invariant:
 * - This must never silently return an invalid date for a value that claims to be an `ISODateString`.
 */
export const isoDateToDate = (isoDate: ISODateString): Date => {
  // Runtime guard to prevent silent miscalculations if invalid data reaches here.
  if (!isISODateString(isoDate)) {
    throw new Error(`isoDateToDate expected ISODateString, got: ${String(isoDate)}`);
  }

  const [yearStr, monthStr, dayStr] = isoDate.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  const date = createDate(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`isoDateToDate produced invalid Date for: ${isoDate}`);
  }

  return date;
};

