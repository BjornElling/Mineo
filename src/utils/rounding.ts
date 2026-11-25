/**
 * Rounding utilities med deterministisk, symmetrisk adfærd.
 *
 * Disse funktioner undgår JavaScript's Math.round bias på negative halvdele
 * og garanterer at -0 aldrig returneres.
 */

import { assertNever } from './assertNever.ts';
import { normalizeZero } from './amountInputUtils.ts';

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
/**
 * Fjerner binær regnestøj fra det skalerede tal, før det afrundes.
 *
 * Et produkt, der i decimaler går præcis op, kan som kommatal ligge lige ved siden af: 64.500 × (1 − 18/100)
 * bliver 52.890,00000000001 og 100.050 × 0,29 bliver 29.014,499999999996. Uden rensning rundede `ceil` det
 * første op til 52.891 (varigt mén 1 kr. for højt) og «half away from zero» det andet ned til 29.014. Det
 * tidligere tillæg af `Number.EPSILON` virkede kun under 1 (værdiklasse-gennemgangen 2026-11-24, fund A,
 * godkendt af udvikleren 2026-11-25).
 *
 * 15 betydende cifre er det, et kommatal altid kan bære præcist. Den rensede værdi bruges kun, når den ligger
 * under en milliontedel af afrundingsenheden fra den rå: så fjernes kun støj, aldrig en reel brøkdel, og et
 * meget stort tal med 16 cifre (fx 7.036.874.417.766.399 øre) beholder sit sidste ciffer.
 */
const BINARY_NOISE_TOLERANCE = 1e-6;
const withoutBinaryNoise = (scaled: number): number => {
  const cleaned = Number(scaled.toPrecision(15));
  return Math.abs(cleaned - scaled) < BINARY_NOISE_TOLERANCE ? cleaned : scaled;
};

const roundHalfAwayFromZero = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const abs = Math.abs(value);
  const roundedAbs = Math.round(withoutBinaryNoise(abs * factor)) / factor;
  const signed = Math.sign(value) * roundedAbs;
  return normalizeZero(signed);
};

/**
 * Runder et tal ned (mod -∞) til et antal decimaler.
 */
const roundFloor = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const result = Math.floor(withoutBinaryNoise(value * factor)) / factor;
  return normalizeZero(result);
};

/**
 * Runder et tal op (mod +∞) til et antal decimaler.
 */
const roundCeil = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  const result = Math.ceil(withoutBinaryNoise(value * factor)) / factor;
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

export const formatRoundedCanonical = (
  value: number,
  decimals: number,
  method: RoundingMethod = 'halfAwayFromZero'
): string => {
  const safeDecimals = Number.isFinite(decimals) ? Math.max(0, Math.trunc(decimals)) : 0;
  return roundByMethod(value, safeDecimals, method).toFixed(safeDecimals);
};
