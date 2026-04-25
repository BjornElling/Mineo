export const DEFAULT_NUMERIC_TOLERANCE = 0.000001;

export const isWithinTolerance = (
  actual: number,
  expected: number,
  tolerance: number = DEFAULT_NUMERIC_TOLERANCE
): boolean => {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || !Number.isFinite(tolerance)) {
    return false;
  }
  return Math.abs(actual - expected) <= Math.abs(tolerance);
};

export const isEffectivelyZero = (
  value: number | undefined,
  tolerance: number = DEFAULT_NUMERIC_TOLERANCE
): boolean => isWithinTolerance(value ?? 0, 0, tolerance);

export const differsFromZero = (
  value: number | undefined,
  tolerance: number = DEFAULT_NUMERIC_TOLERANCE
): boolean => !isEffectivelyZero(value, tolerance);

export const isGreaterThanWithTolerance = (
  left: number,
  right: number,
  tolerance: number = DEFAULT_NUMERIC_TOLERANCE
): boolean => Number.isFinite(left) && Number.isFinite(right) && left > right + Math.abs(tolerance);

export const clampToNonNegative = (value: number): number => (
  Number.isFinite(value) ? Math.max(0, value) : 0
);
