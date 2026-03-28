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
import { reportSystemIssue } from './systemIssueReporter';

const toSafeComputeCodeSuffix = (context: string): string => {
  return context
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';
};

/**
 * Wrap beregning i try-catch + automatisk logging
 *
 * @param {function} fn - Beregningsfunktion at køre
 * @param {string} context - Kontekst til logging (fx 'Aarsloen.periodeBeregning')
 * @returns {Result<T>} Success med value, eller failure med error
 */
export function safeCompute<T>(
  fn: () => T,
  context: string,
  options?: Readonly<{ code?: string }>
): Result<T> {
  try {
    const value = fn();
    return ok(value);
  } catch (error) {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    reportSystemIssue({
      code: options?.code ?? `safe_compute:${toSafeComputeCodeSuffix(context)}`,
      area: 'calculation',
      context,
      userMessage: 'Beregningsfejl',
      developerMessage: normalizedError.message,
      error: normalizedError,
    });

    // Returner failure result
    return err(normalizedError);
  }
}

