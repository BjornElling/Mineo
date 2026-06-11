/**
 * Result type til eksplicit fejlhåndtering
 *
 * Inspireret af Rust's Result<T, E> type.
 * Tvinger udviklere til at håndtere både success og failure cases eksplicit.
 *
 * Hvorfor IKKE unwrap()?
 * - unwrap() ville returnere T | null, hvilket tillader silent failures
 * - Alle steder skal i stedet bruge isErr() (eller tjekke result.success) og håndtere fejl eksplicit
 * - Dette sikrer at fejl ALDRIG ignoreres
 *
 * Eksempel:
 * ```typescript
 * const result = safeCompute(() => beregnAarsloen(data), 'AarsloenBeregning');
 *
 * if (isErr(result)) {
 *   console.error('Error:', result.error);
 * } else {
 *   console.log('Success:', result.value);
 * }
 * ```
 */

/**
 * Result type - kan være enten success eller failure
 */
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

/**
 * Wrap værdi i success result
 *
 * @param {T} value - Værdi at wrappe
 * @returns {Result<T>} Success result
 */
export function ok<T>(value: T): Result<T> {
  return { success: true, value };
}

/**
 * Wrap fejl i failure result
 *
 * @param {E} error - Fejl at wrappe
 * @returns {Result<never, E>} Failure result
 */
export function err<E = Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Type guard: Check om result er failure
 *
 * @param {Result<T>} result - Result at tjekke
 * @returns {boolean} True hvis failure
 */
export function isErr<T, E = Error>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

