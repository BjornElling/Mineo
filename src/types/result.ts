/**
 * Result type til eksplicit fejlhåndtering
 *
 * Inspireret af Rust's Result<T, E> type.
 * Tvinger udviklere til at håndtere både success og failure cases eksplicit.
 *
 * Hvorfor IKKE unwrap()?
 * - unwrap() ville returnere T | null, hvilket tillader silent failures
 * - Alle steder skal i stedet bruge isOk() og håndtere fejl eksplicit
 * - Dette sikrer at fejl ALDRIG ignoreres
 *
 * Eksempel:
 * ```typescript
 * const result = safeCompute(() => beregnAarsloen(data), 'AarsloenBeregning');
 *
 * if (isOk(result)) {
 *   console.log('Success:', result.value);
 * } else {
 *   console.error('Error:', result.error);
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
 * Type guard: Check om result er success
 *
 * @param {Result<T>} result - Result at tjekke
 * @returns {boolean} True hvis success
 */
export function isOk<T, E = Error>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
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

/**
 * Map success value til ny værdi
 *
 * Hvis result er success, kører mapper-funktionen på value.
 * Hvis result er failure, returneres fejlen uændret.
 *
 * @param {Result<T>} result - Result at mappe
 * @param {function} mapper - Funktion til at transformere success value
 * @returns {Result<U>} Mapped result
 */
export function map<T, U, E = Error>(
  result: Result<T, E>,
  mapper: (value: T) => U
): Result<U, E> {
  if (isOk(result)) {
    return { success: true, value: mapper(result.value) };
  }
  return result;
}

/**
 * Chain result-returnerende operationer
 *
 * Hvis result er success, kører mapper-funktionen (som returnerer et nyt Result).
 * Hvis result er failure, returneres fejlen uændret.
 *
 * @param {Result<T>} result - Result at chaine
 * @param {function} mapper - Funktion der returnerer nyt Result
 * @returns {Result<U>} Chained result
 */
export function flatMap<T, U, E = Error>(
  result: Result<T, E>,
  mapper: (value: T) => Result<U, E>
): Result<U, E> {
  if (isOk(result)) {
    return mapper(result.value);
  }
  return result;
}

/**
 * Hent værdi eller fallback
 *
 * Hvis result er success, returneres value.
 * Hvis result er failure, returneres fallback.
 *
 * @param {Result<T>} result - Result at udpakke
 * @param {T} fallback - Fallback værdi hvis failure
 * @returns {T} Value eller fallback
 */
export function getOrElse<T, E = Error>(result: Result<T, E>, fallback: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return fallback;
}
