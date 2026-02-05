export const containsAnyDigit = (input: string): boolean => {
  return /\d/.test(input);
};

export const normalizeTrailingSeparator = (input: string): string => {
  const trimmed = input.trim();
  if (/^[+-]?\d+[.,]$/.test(trimmed) || /^[+-]?\d{1,3}(?:\.\d{3})*[.,]$/.test(trimmed)) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
};

export const sanitizePastedAmount = (text: string): string => {
  const allowed = text.match(/[0-9+\-*/x()., ]/g) ?? [];
  return allowed.join('');
};

/**
 * Truncate to a fixed scale without rounding.
 */
export const truncateToScale = (value: number, precision: number): number => {
  if (!Number.isFinite(value)) return value;
  if (precision <= 0) return Math.trunc(value);
  const factor = 10 ** precision;
  return Math.trunc(value * factor) / factor;
};

export const normalizeZero = (value: number): number => {
  return Object.is(value, -0) ? 0 : value;
};
