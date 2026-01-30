/**
 * Rounding utilities med deterministisk, symmetrisk adfærd.
 *
 * Disse funktioner undgår JavaScript's Math.round bias på negative halvdele
 * og garanterer at -0 aldrig returneres.
 */

import { assertNever } from './assertNever';

/**
 * Rounding-metoder understøttet af systemet.
 *
 * - 'halfAwayFromZero': Symmetrisk runding (standard for finansielle beregninger)
 * - 'floor': Rund altid ned (mod -∞)
 * - 'ceil': Rund altid op (mod +∞)
 * - 'none': Ingen runding (men normaliserer stadig -0)
 */
export type RoundingMethod = 'halfAwayFromZero' | 'floor' | 'ceil' | 'none';

/**
 * Normaliserer et tal for at eliminere -0.
 */
const normalizeZero = (value: number): number => {
  return Object.is(value, -0) ? 0 : value;
};

/**
 * Runder et tal til et antal decimaler med "half away from zero" semantik.
 *
 * Garantier:
 * - Symmetrisk runding: -0.005 → -0.01, 0.005 → 0.01
 * - Returnerer aldrig -0
 * - Returnerer aldrig NaN eller Infinity (fail-closed → 0)
 *
 * @param value - Tallet der skal rundes
 * @param decimals - Antal decimaler (default: 2)
 * @returns Det rundede tal, normaliseret
 */
const roundHalfAwayFromZero = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const abs = Math.abs(value);
  const roundedAbs = Math.round(abs * factor) / factor;
  const signed = Math.sign(value) * roundedAbs;
  return normalizeZero(signed);
};

/**
 * Runder et tal ned (mod -∞) til et antal decimaler.
 */
const roundFloor = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const result = Math.floor(value * factor) / factor;
  return normalizeZero(result);
};

/**
 * Runder et tal op (mod +∞) til et antal decimaler.
 */
const roundCeil = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const result = Math.ceil(value * factor) / factor;
  return normalizeZero(result);
};

/**
 * Central rounding-funktion der håndterer alle understøttede metoder.
 *
 * Dette er den eneste offentlige rounding-funktion - brug denne i stedet
 * for at kalde de individuelle metoder direkte.
 *
 * Garantier:
 * - Returnerer aldrig -0
 * - Returnerer aldrig NaN eller Infinity (fail-closed → 0)
 * - Exhaustive switch med compile-time check
 *
 * @param value - Tallet der skal rundes
 * @param decimals - Antal decimaler
 * @param method - Rounding-metode
 * @returns Det rundede tal, normaliseret
 */
export const roundByMethod = (value: number, decimals: number, method: RoundingMethod): number => {
  // Fail-closed: ugyldige input giver 0
  if (!Number.isFinite(value)) {
    return 0;
  }

  switch (method) {
    case 'halfAwayFromZero':
      return roundHalfAwayFromZero(value, decimals);
    case 'floor':
      return roundFloor(value, decimals);
    case 'ceil':
      return roundCeil(value, decimals);
    case 'none':
      return normalizeZero(value);
    default:
      return assertNever(method);
  }
};
