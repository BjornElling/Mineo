/**
 * Re-export alle safe computation utilities
 *
 * Gør det nemmere at importere i komponenter:
 * import { safeCompute, isOk, getUserMessage } from '@/utils/safeComputations';
 */

// Result type
export type { Result } from '../types/result';
export { ok, err, isOk, isErr, map, flatMap, getOrElse } from '../types/result';

// Safe computation wrappers
export { safeCompute, safeComputeAsync, safeComputeMultiple } from './safeComputation';

// Error messages
export type { ErrorCode } from './errorMessages';
export {
  ERROR_MESSAGES,
  CalculationError,
  getUserMessage,
  isCalculationError,
} from './errorMessages';
