/**
 * Result type til eksplicit fejlhåndtering
 *
 * Inspireret af Rust's Result<T, E> type.
 * Tvinger udvikleren til at håndtere både success- og failure-tilfælde eksplicit.
 *
 * Hvorfor IKKE unwrap()?
 * - unwrap() ville returnere T | null, hvilket tillader tavse fejl
 * - Alle steder skal i stedet bruge isErr() (eller tjekke result.success) og håndtere fejl eksplicit
 * - Dette sikrer at fejl ALDRIG ignoreres
 *
 * Eksempel:
 * ```typescript
 * const result = safeCompute(() => beregnAarsloen(data), 'AarsloenBeregning');
 *
 * if (isErr(result)) {
 *   console.error('Fejl:', result.error);
 * } else {
 *   console.log('Resultat:', result.value);
 * }
 * ```
 */

/**
 * Result-type – kan være enten success eller failure
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Pakker en værdi i et success-resultat
 *
 * @param {T} value - Værdi at wrappe
 * @returns {Result<T>} Success-resultat
 */
export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

/**
 * Pakker en fejl i et failure-resultat
 *
 * @param {E} error - Fejl at wrappe
 * @returns {Result<never, E>} Failure-resultat
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Typeguard: Tjekker, om resultatet er failure
 *
 * @param {Result<T>} result - Result at tjekke
 * @returns {boolean} Sand, hvis resultatet er failure
 */
export function isErr<T, E = Error>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}
