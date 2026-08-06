/**
 * Safe Computation wrapper til Mineo
 *
 * Wrapper beregninger i try-catch og returnerer Result<T>.
 * Logger automatisk fejl til centraliseret logging system.
 *
 * Hvorfor?
 * - ErrorBoundary fanger render-fase-fejl, herunder useMemo under render
 * - Event handlers og async kode fanges ikke af ErrorBoundary
 * - safeCompute lader beregninger fail-closed uden at route brugeren til crash-fallback
 *
 * Eksempel:
 * ```typescript
 * const result = safeCompute(
 *   () => beregnMaanedPeriode(tableData),
 *   'Aarsloen.periodeBeregning'
 * );
 *
 * if (isErr(result)) {
 *   // Vis fejlbesked til bruger
 *   setError(getUserMessage(result.error));
 * } else {
 *   setPeriodeData(result.value);
 * }
 * ```
 */

import { ok, err } from '../types/result';
import type { Result } from '../types/result';
import { asciiSlug } from './asciiSlug';
import { reportSystemIssue } from './systemIssueReporter';
import { asError } from './typeGuards';

const toSafeComputeCodeSuffix = (context: string): string =>
  asciiSlug(context, { separator: '_', fallback: 'unknown' });

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
    const normalizedError = asError(error);
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
