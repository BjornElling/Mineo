import type { AmountValue } from '../schemas/amountExpressionSchema';

export const ZERO_ONLY_PATTERN = /^0+(?:[.,]0*)?$/;

export const isZeroOnlyString = (value: string): boolean => {
  return ZERO_ONLY_PATTERN.test(value.trim());
};

export const isAmountValueStrict = (value: unknown): value is AmountValue => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as AmountValue;
  if (candidate.kind === 'number') {
    return typeof candidate.value === 'number';
  }
  if (candidate.kind === 'expression') {
    return typeof candidate.value === 'number' && typeof candidate.expression === 'string';
  }
  if (import.meta.env.DEV) {
    const kind = (candidate as Readonly<{ kind?: unknown }>).kind;
    if (typeof kind === 'string') {
      throw new Error(`AmountValue: Ukendt kind "${kind}" i validation.`);
    }
    throw new Error('AmountValue: Ukendt kind (ikke-string) i validation.');
  }
  return false;
};

export const isEffectivelyEmptyNumber = (value: number): boolean => {
  return !Number.isFinite(value) || value === 0;
};
