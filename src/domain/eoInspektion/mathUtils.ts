/**
 * Delte numeriske hjælpefunktioner til EOInspektion-kolonner.
 *
 * Bruges af eoInspektionLoenColumns og eoInspektionOffentligeYdelserColumns.
 */

/**
 * Kahan-kompenseret summering af Float64Array.
 * Minimerer akkumuleret floating-point fejl.
 */
export const sumFloat64Array = (arr: Float64Array): number => {
  let sum = 0;
  let compensation = 0;
  for (let i = 0; i < arr.length; i += 1) {
    const value = arr[i];
    const y = value - compensation;
    const t = sum + y;
    compensation = (t - sum) - y;
    sum = t;
  }
  return sum;
};

/**
 * Tjekker om `actual` ligger inden for `tolerance` af `expected`.
 */
export const isWithinIntegrityTolerance = (actual: number, expected: number, tolerance: number): boolean => {
  return Math.abs(actual - expected) <= tolerance + Number.EPSILON;
};
