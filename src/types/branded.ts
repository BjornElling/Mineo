import { createDate } from '../utils/datePrimitives';

/**
 * Branded types til runtime-validerede værdier
 *
 * ═══════════════════════════════════════════════════════════════════════
 * VIGTIGT: Dette er den AUTORITATIVE kilde for alle dato-operationer i MINEO
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Regler:
 * - AL dato-parsing skal ske via funktioner i denne fil
 * - dateUtils.ts indeholder kun low-level helpers (addDays, createDate, osv.)
 * - Ingen domain-kode må parse datoer direkte med new Date() eller Date.parse()
 * - Brug ALTID ISODateString og DanishDateString branded types
 *
 * DATO-ONLY KONTRAKT (normativ):
 * - Alle Date-objekter repræsenterer kalenderdage uden tid.
 * - Date-objekter SKAL behandles som UTC-dage (brug getUTC* / setUTC*).
 * - Mindste enhed er dage; timer/minutter/sekunder er uden for domænet.
 *
 * Branded types sikrer at værdier er validerede før brug i domæne-laget.
 * En ISODateString er ikke bare en string - det er en VALIDERET ISO-dato.
 *
 * @see dateUtils.ts - Low-level dato-helpers (ikke parsing/branding)
 */

/**
 * ISO-formateret datostring (åååå-mm-dd)
 *
 * Må ALDRIG konstrueres direkte - brug kun via validation utilities.
 *
 * @example
 * const date: ISODateString = validateISODate("2024-12-15"); // ✓
 * const date: ISODateString = "2024-12-15"; // ✗ Compilation error
 */
export type ISODateString = string & { readonly __brand: 'ISODateString' };

/**
 * Dansk-formateret datostring (dd-mm-åååå)
 *
 * Må ALDRIG konstrueres direkte - brug kun via validation utilities.
 *
 * @example
 * const date: DanishDateString = toDanishDateString("15-12-2024"); // ✓
 * const date: DanishDateString = "15-12-2024"; // ✗ Compilation error
 */
export type DanishDateString = string & { readonly __brand: 'DanishDateString' };

/**
 * Type guard: Tjekker om string er valid ISO-dato
 */
export function isISODateString(value: unknown): value is ISODateString {
  if (typeof value !== 'string') return false;

  // Format: åååå-mm-dd
  const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoRegex.test(value)) return false;

  // Manuel validering for at undgå timezone-problemer
  const parts = value.split('-');
  if (parts.length !== 3) return false;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Valider at datoen er gyldig (fx 31. februar)
  const date = createDate(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Konverterer ukendt input til ISODateString (defensivt)
 *
 * Accepterer:
 * - ISO-format: "2024-12-15"
 * - Dansk format: "15-12-2024"
 */
export function coerceToISODateString(value: unknown): ISODateString | undefined {
  if (typeof value !== 'string') return undefined;
  if (isISODateString(value)) return value;
  return danishToISO(value);
}

/**
 * Konverterer ukendt input til DanishDateString (defensivt)
 *
 * Accepterer:
 * - Dansk format: "15-12-2024"
 * - ISO-format: "2024-12-15" (konverteres)
 */
export function coerceToDanishDateString(value: unknown): DanishDateString | undefined {
  if (typeof value !== 'string') return undefined;
  if (isDanishDateString(value)) return value;
  const iso = coerceToISODateString(value);
  return iso ? isoToDanish(iso) : undefined;
}

/**
 * Type guard: Tjekker om string er valid dansk dato
 */
export function isDanishDateString(value: unknown): value is DanishDateString {
  if (typeof value !== 'string') return false;

  // Format: dd-mm-åååå
  const danishRegex = /^\d{2}-\d{2}-\d{4}$/;
  if (!danishRegex.test(value)) return false;

  // Manuel validering for at undgå timezone-problemer
  const parts = value.split('-');
  if (parts.length !== 3) return false;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);

  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Valider at datoen er gyldig (fx 31. februar)
  const date = createDate(year, month - 1, day);
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Konverterer valideret string til ISODateString
 *
 * @throws Error hvis value ikke er valid ISO-dato
 */
export function toISODateString(value: string): ISODateString {
  if (!isISODateString(value)) {
    throw new Error(`Invalid ISO date string: ${value}`);
  }
  return value;
}

/**
 * Konverterer valideret string til DanishDateString
 *
 * @throws Error hvis value ikke er valid dansk dato
 */
export function toDanishDateString(value: string): DanishDateString {
  if (!isDanishDateString(value)) {
    throw new Error(`Invalid Danish date string: ${value}`);
  }
  return value;
}

/**
 * Konverterer dansk dato (dd-mm-åååå) til ISO-format (åååå-mm-dd)
 *
 * @param danishDate - Dato i format dd-mm-åååå
 * @returns ISO-formateret dato eller undefined hvis invalid
 */
export function danishToISO(danishDate: string | undefined): ISODateString | undefined {
  if (!danishDate || typeof danishDate !== 'string') return undefined;

  // Format: dd-mm-åååå
  const parts = danishDate.trim().split('-');
  if (parts.length !== 3) return undefined;

  const [day, month, year] = parts;
  if (!day || !month || !year) return undefined;

  // Valider numeriske værdier
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);
  const yearNum = parseInt(year, 10);

  if (isNaN(dayNum) || isNaN(monthNum) || isNaN(yearNum)) return undefined;
  if (dayNum < 1 || dayNum > 31) return undefined;
  if (monthNum < 1 || monthNum > 12) return undefined;
  if (yearNum < 1000 || yearNum > 9999) return undefined;

  // Konstruer ISO-string
  const isoString = `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

  // Valider at det er en reel dato
  if (!isISODateString(isoString)) return undefined;

  return isoString;
}

/**
 * Konverterer ISO-dato (åååå-mm-dd) til dansk format (dd-mm-åååå)
 *
 * @param isoDate - Dato i ISO-format
 * @returns Dansk formateret dato eller undefined hvis invalid
 */
export function isoToDanish(isoDate: ISODateString | undefined): DanishDateString | undefined {
  if (!isoDate) return undefined;
  if (!isISODateString(isoDate)) return undefined;

  const [year, month, day] = isoDate.split('-');
  const danishDate = `${day}-${month}-${year}`;

  return isDanishDateString(danishDate) ? danishDate : undefined;
}

/**
 * Parser ISO-string til Date-objekt (kun til beregninger)
 *
 * @param isoDate - ISO-formateret dato
 * @returns Date-objekt eller undefined hvis invalid
 */
export function parseISODate(isoDate: ISODateString | undefined): Date | undefined {
  if (!isoDate) return undefined;
  if (!isISODateString(isoDate)) return undefined;

  const [year, month, day] = isoDate.split('-').map(Number);
  const date = createDate(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date;
}

/**
 * Konverterer Date-objekt til ISODateString
 *
 * @param date - Date-objekt
 * @returns ISO-formateret dato eller undefined hvis invalid
 */
export function dateToISO(date: Date | undefined): ISODateString | undefined {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return undefined;
  }

  // Manuel formatering (undgå timezone-problemer med toISOString)
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const isoString = `${year}-${month}-${day}`;

  return isISODateString(isoString) ? isoString : undefined;
}

/**
 * Trækker én dag fra en ISO-dato
 *
 * Bruges til at konvertere "skal være < dato" til "skal være <= (dato - 1 dag)"
 * Eksempel: Ménafgørelse er 2025-03-15, til-dato skal være < 2025-03-15,
 * dvs. til-dato skal være <= 2025-03-14
 *
 * @param isoDate - ISO-formateret dato
 * @returns ISO-dato for dagen før, eller undefined hvis invalid
 */
export function subtractOneDay(isoDate: ISODateString | undefined): ISODateString | undefined {
  if (!isoDate) return undefined;

  const date = parseISODate(isoDate);
  if (!date) return undefined;

  // Træk én dag fra
  const newDate = new Date(date.getTime());
  newDate.setUTCDate(newDate.getUTCDate() - 1);

  return dateToISO(newDate);
}
