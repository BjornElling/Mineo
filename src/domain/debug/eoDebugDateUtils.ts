/**
 * Dato-utilities til EODebug
 *
 * VIGTIGT: Alle dato-sammenligninger skal gå gennem disse funktioner
 * for at sikre konsistent håndtering af ISO-datoer.
 */

import type { ISODateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';
import { collectIsoDatesInclusive } from '../../utils/isoDateHelpers';
import type { DateRange, OverlapResult } from '../eoRowEvaluation/eoRowTypes';

/**
 * Parser en ukendt værdi til ISODateString, eller undefined hvis ugyldig.
 * Data fra persistence-laget er allerede i ISO-format.
 */
export function tryParseIso(value: unknown): ISODateString | undefined {
  if (!value || typeof value !== 'string' || value.trim() === '') return undefined;
  try {
    return toISODateString(value);
  } catch {
    return undefined;
  }
}

/**
 * Sammenligner to ISO-datoer
 *
 * @param a - Første dato
 * @param b - Anden dato
 * @returns -1 hvis a < b, 0 hvis a === b, 1 hvis a > b
 */
export function compareIso(a: ISODateString, b: ISODateString): -1 | 0 | 1 {
  // Invariant: ISODateString er altid "YYYY-MM-DD" (date-only, UTC).
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Tjekker om to dato-intervaller overlapper
 *
 * VIGTIGT: Perioder er inklusiv–inklusiv.
 * Hvis a.end === b.start betragtes det som overlap (touching).
 *
 * @param a - Første interval
 * @param b - Andet interval
 * @returns true hvis intervallerne overlapper
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return getOverlap(a, b).overlaps;
}

/**
 * Beregner detaljeret overlap mellem to dato-intervaller
 *
 * VIGTIGT: Perioder er inklusiv–inklusiv.
 *
 * Overlap-typer:
 * - 'touching': a.end === b.start eller b.end === a.start
 * - 'partial': delvist overlap
 * - 'contained': a er helt inden i b
 * - 'contains': a indeholder hele b
 *
 * @param a - Første interval
 * @param b - Andet interval
 * @returns Detaljeret overlap-information
 */
export function getOverlap(a: DateRange, b: DateRange): OverlapResult {
  const aStart = a.start;
  const aEnd = a.end;
  const bStart = b.start;
  const bEnd = b.end;

  // Ingen overlap hvis intervallerne er helt adskilt
  if (aEnd < bStart || bEnd < aStart) {
    return { overlaps: false };
  }

  // Touching: præcis samme grænse
  if (aEnd === bStart || bEnd === aStart) {
    const start = aEnd === bStart ? aEnd : bEnd;
    return {
      overlaps: true,
      start,
      end: start,
      kind: 'touching',
    };
  }

  // Find overlap-interval
  const overlapStart = compareIso(aStart, bStart) >= 0 ? aStart : bStart;
  const overlapEnd = compareIso(aEnd, bEnd) <= 0 ? aEnd : bEnd;

  // Bestem overlap-type
  let kind: 'partial' | 'contained' | 'contains';

  // Tjek for identiske intervaller først
  if (aStart === bStart && aEnd === bEnd) {
    // Identiske intervaller - vælg 'contains' arbitrært
    kind = 'contains';
  } else if (aStart >= bStart && aEnd <= bEnd) {
    // a er helt inden i b
    kind = 'contained';
  } else if (bStart >= aStart && bEnd <= aEnd) {
    // a indeholder hele b
    kind = 'contains';
  } else {
    // Delvist overlap
    kind = 'partial';
  }

  return {
    overlaps: true,
    start: overlapStart,
    end: overlapEnd,
    kind,
  };
}

/**
 * Genererer array af ISO-datoer fra start til slut (begge inklusiv)
 *
 * VIGTIGT: Både start og end er inkluderet i output.
 * Dette matcher det inklusiv–inklusiv princip i hele EO-domænet.
 *
 * @param start - Start-dato (inklusiv)
 * @param end - Slut-dato (inklusiv)
 * @returns Array af ISO-datoer
 */
export function getIsoRange(
  start: ISODateString,
  end: ISODateString
): ISODateString[] {
  // Delegér til den kanoniske dag-materialiserer (date-contract §"Kanonisk dag-iteration").
  // Bevarer inklusiv–inklusiv-semantikken og tomt array når start > end.
  return collectIsoDatesInclusive(start, end);
}

/**
 * Tjekker om en dato ligger inden for et interval (inklusiv–inklusiv)
 *
 * @param date - Dato at tjekke
 * @param range - Interval
 * @returns true hvis dato ligger i intervallet
 */
export function isDateInRange(date: ISODateString, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/**
 * Finder den mindste dato i et array
 *
 * @param dates - Array af datoer
 * @returns Mindste dato, eller undefined hvis arrayet er tomt
 */
export function minDate(dates: ISODateString[]): ISODateString | undefined {
  if (dates.length === 0) return undefined;
  return dates.reduce((min, date) => (compareIso(date, min) < 0 ? date : min));
}

/**
 * Finder den største dato i et array
 *
 * @param dates - Array af datoer
 * @returns Største dato, eller undefined hvis arrayet er tomt
 */
export function maxDate(dates: ISODateString[]): ISODateString | undefined {
  if (dates.length === 0) return undefined;
  return dates.reduce((max, date) => (compareIso(date, max) > 0 ? date : max));
}
