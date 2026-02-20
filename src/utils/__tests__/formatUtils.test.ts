import { describe, expect, it } from 'vitest';
import { formatPercent } from '../formatUtils';
import { parseAmount } from '../numberParsing';

describe('formatUtils', () => {
  it('formatPercent afrunder deterministisk og bruger dansk komma', () => {
    expect(formatPercent(33.333333)).toBe('33,33 %');
    expect(formatPercent(10)).toBe('10 %');
  });

  it('parseAmount håndterer kun number/AmountValue/undefined', () => {
    expect(parseAmount(undefined)).toBe(0);
    expect(parseAmount(12.5)).toBe(12.5);
    expect(parseAmount({ kind: 'number', value: 42 })).toBe(42);
  });
});
