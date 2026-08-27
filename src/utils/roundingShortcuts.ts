/**
 * Navngivne rounding-shortcuts til finansielle beregninger.
 *
 * Alle shortcuts bruger `roundByMethod` som kanonisk fundament og garanterer
 * deterministisk, symmetrisk adfærd (halfAwayFromZero) samt -0-normalisering.
 *
 * Brug disse i stedet for at kalde `roundByMethod` direkte, når et fast
 * decimalantal er domæne-semantisk (fx monetære beløb, procenter, renter).
 */

import { roundByMethod } from './rounding';

export const round0 = (v: number): number => roundByMethod(v, 0, 'halfAwayFromZero');
export const round2 = (v: number): number => roundByMethod(v, 2, 'halfAwayFromZero');
export const round3 = (v: number): number => roundByMethod(v, 3, 'halfAwayFromZero');
export const round4 = (v: number): number => roundByMethod(v, 4, 'halfAwayFromZero');
export const roundNearest1000 = (v: number): number => roundByMethod(v / 1000, 0, 'halfAwayFromZero') * 1000;
export const ceil0 = (v: number): number => roundByMethod(v, 0, 'ceil');

/**
 * Summerer præcis de værdier, brugeren ser: hvert led afrundes før additionen.
 *
 * Totalen afrundes igen for at normalisere binary64-støj fra additionen, så den kan
 * formateres og efterregnes som den viste række-sum.
 */
export const sumRoundedValues = (
  values: Iterable<number>,
  roundValue: (value: number) => number,
): number => {
  let total = 0;
  for (const value of values) total += roundValue(value);
  return roundValue(total);
};

/**
 * Runder op til nærmeste hele multiple af 12.
 *
 * Bruges ved beregning af EET- og forsørgertab-ydelser, hvor årsydelsen
 * altid skal være delelig med 12 (så månedlig ydelse er et heltal).
 *
 * Semantik: ceil(v / 12) × 12. Garantier:
 * - -0-normalisering via roundByMethod (undgår -0 ved v = 0 eller v negativ nær 0)
 * - Konsistent med øvrige shortcuts – ingen direkte Math.ceil
 */
export const ceilNearest12 = (v: number): number => roundByMethod(v / 12, 0, 'ceil') * 12;
