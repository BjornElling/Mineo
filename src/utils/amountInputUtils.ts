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
  const normalizedMinus = text.replace(/\u2212/g, '-');
  const allowed = normalizedMinus.match(/[0-9+\-*/x()., ]/g) ?? [];
  return allowed.join('');
};

export const normalizeZero = (value: number): number => {
  return Object.is(value, -0) ? 0 : value;
};
