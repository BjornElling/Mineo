import type { ISODateString } from '../../types/branded';
import { parseISODate } from '../../types/branded';

/**
 * Kanonisk ISO→Date-konvertering for domænet (kastende variant af `parseISODate`).
 *
 * Konverterer en `ISODateString` til en UTC-dato (kun dato) uden tidszoneforskydninger.
 *
 * Trust-kritisk invariant:
 * - Denne må aldrig stille returnere en ugyldig dato for en værdi, der hævder at være en `ISODateString`.
 *   Hvor `parseISODate` returnerer `undefined` ved ugyldigt input, kaster denne i stedet,
 *   så fejlberegninger fail-closed afbrydes frem for at fortsætte med en forkert dato.
 *
 * Bevidst tynd wrapper: parse-/validerings-logikken har én sand kilde (`parseISODate`),
 * så de to varianter aldrig kan drive fra hinanden.
 */
export const isoDateToDate = (isoDate: ISODateString): Date => {
  const date = parseISODate(isoDate);
  if (!date) {
    throw new Error(`isoDateToDate expected ISODateString, got: ${String(isoDate)}`);
  }
  return date;
};

