import { describe, expect, it } from 'vitest';
import { parsePercentToDecimal, parseAmount } from '../../utils/numberParsing';

describe('parsePercentToDecimal', () => {
  it('parses Danish-formatted percent with thousand separators', () => {
    expect(parsePercentToDecimal('1.234,56 %')).toBeCloseTo(12.3456, 10);
  });

  it('parses simple comma decimal percent', () => {
    expect(parsePercentToDecimal('12,5%')).toBeCloseTo(0.125, 10);
  });

  it('returns 0 for invalid input', () => {
    expect(parsePercentToDecimal('abc')).toBe(0);
  });

  it('undefined → 0', () => {
    expect(parsePercentToDecimal(undefined)).toBe(0);
  });

  it('tom streng → 0', () => {
    expect(parsePercentToDecimal('')).toBe(0);
  });

  it('tal (number) → deler med 100', () => {
    expect(parsePercentToDecimal(50)).toBeCloseTo(0.5, 10);
  });

  it('number NaN → 0', () => {
    expect(parsePercentToDecimal(NaN)).toBe(0);
  });

  it('number Infinity → 0', () => {
    expect(parsePercentToDecimal(Infinity)).toBe(0);
  });

  it('"12.5" (punkt som decimal) → 0.125', () => {
    // Kun komma, ingen punkt-separator → punkt er decimal
    expect(parsePercentToDecimal('12.5')).toBeCloseTo(0.125, 10);
  });

  it('"100" → 1.0', () => {
    expect(parsePercentToDecimal('100')).toBeCloseTo(1.0, 10);
  });

  it('"0,5 %" → 0.005', () => {
    expect(parsePercentToDecimal('0,5 %')).toBeCloseTo(0.005, 10);
  });

  it('whitespace trimmes', () => {
    expect(parsePercentToDecimal('  12 %  ')).toBeCloseTo(0.12, 10);
  });
});

describe('parseAmount', () => {
  it('undefined → 0', () => {
    expect(parseAmount(undefined)).toBe(0);
  });

  it('finite number → samme tal', () => {
    expect(parseAmount(42)).toBe(42);
    expect(parseAmount(-15.5)).toBe(-15.5);
    expect(parseAmount(0)).toBe(0);
  });

  it('NaN → 0', () => {
    expect(parseAmount(NaN)).toBe(0);
  });

  it('Infinity → 0', () => {
    expect(parseAmount(Infinity)).toBe(0);
  });

  it('AmountValue {kind:"number"} → value', () => {
    expect(parseAmount({ kind: 'number', value: 42 })).toBe(42);
  });

  it('AmountValue {kind:"expression"} → value', () => {
    expect(parseAmount({ kind: 'expression', expression: '20+22', value: 42 })).toBe(42);
  });

  it('AmountValue med NaN value → 0', () => {
    expect(parseAmount({ kind: 'number', value: NaN })).toBe(0);
  });
});
