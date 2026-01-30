/**
 * Safe Computation wrapper til MINEO
 *
 * Wrapper beregninger i try-catch og returnerer Result<T>.
 * Logger automatisk fejl til centraliseret logging system.
 *
 * Hvorfor?
 * - ErrorBoundary fanger KUN render-fejl
 * - Event handlers, async kode, og useMemo fanger IKKE af ErrorBoundary
 * - safeCompute sikrer at ALLE beregninger er beskyttet
 *
 * Eksempel:
 * ```typescript
 * const result = safeCompute(
 *   () => beregnMaanedPeriode(tableData),
 *   'Aarsloen.periodeBeregning'
 * );
 *
 * if (isOk(result)) {
 *   setPeriodeData(result.value);
 * } else {
 *   // Vis fejlbesked til bruger
 *   setError(getUserMessage(result.error));
 * }
 * ```
 */

import { ok, err } from '../types/result';
import type { Result } from '../types/result';
import { logError } from './logger';

/**
 * Wrap beregning i try-catch + automatisk logging
 *
 * @param {function} fn - Beregningsfunktion at køre
 * @param {string} context - Kontekst til logging (fx 'Aarsloen.periodeBeregning')
 * @returns {Result<T>} Success med value, eller failure med error
 */
export function safeCompute<T>(fn: () => T, context: string): Result<T> {
  try {
    const value = fn();
    return ok(value);
  } catch (error) {
    // Log fejl til IndexedDB
    logError('Beregningsfejl', {
      context,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Returner failure result
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Async version af safeCompute
 *
 * Wrapper async beregninger i try-catch + automatisk logging.
 *
 * @param {function} fn - Async beregningsfunktion at køre
 * @param {string} context - Kontekst til logging
 * @returns {Promise<Result<T>>} Promise med Result<T>
 */
export async function safeComputeAsync<T>(
  fn: () => Promise<T>,
  context: string
): Promise<Result<T>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    // Log fejl til IndexedDB
    logError('Async beregningsfejl', {
      context,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    // Returner failure result
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Wrap multiple beregninger og kør dem sekventielt
 *
 * Stopper ved første fejl og returnerer den.
 * Hvis alle succeeder, returneres array af resultater.
 *
 * @param {Array<function>} computations - Array af beregninger
 * @param {string} context - Kontekst til logging
 * @returns {Result<T[]>} Success med array af results, eller failure
 */
export function safeComputeMultiple<T>(
  computations: Array<() => T>,
  context: string
): Result<T[]> {
  try {
    const results: T[] = [];

    for (let i = 0; i < computations.length; i++) {
      const result = safeCompute(computations[i], `${context}[${i}]`);

      if (!result.success) {
        // Returner første fejl
        return result;
      }

      results.push(result.value);
    }

    return ok(results);
  } catch (error) {
    logError('Multiple beregninger fejlede', {
      context,
      error: error instanceof Error ? error : new Error(String(error)),
    });

    return err(error instanceof Error ? error : new Error(String(error)));
  }
}
