import type { ISODateString } from '../../types/branded';
import { createDate, isISODateString } from '../../types/branded';

/**
 * Kanonisk ISO→Date-konvertering for domænet.
 *
 * Konverterer en `ISODateString` til en UTC-dato (kun dato) uden tidszoneforskydninger.
 *
 * Trust-kritisk invariant:
 * - Denne må aldrig stille returnere en ugyldig dato for en værdi, der hævder at være en `ISODateString`.
 */
export const isoDateToDate = (isoDate: ISODateString): Date => {
  // Runtime-guard der forhindrer stille fejlberegninger, hvis ugyldige data når hertil.
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

