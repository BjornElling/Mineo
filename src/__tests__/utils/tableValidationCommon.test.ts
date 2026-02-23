import { describe, expect, it } from 'vitest';
import { isZeroOnlyString, isAmountValueStrict, isEffectivelyEmptyNumber, ZERO_ONLY_PATTERN } from '../../utils/tableValidationCommon';

describe('ZERO_ONLY_PATTERN', () => {
  it('matcher "0"', () => {
    expect(ZERO_ONLY_PATTERN.test('0')).toBe(true);
  });

  it('matcher "00"', () => {
    expect(ZERO_ONLY_PATTERN.test('00')).toBe(true);
  });

  it('matcher "0.0"', () => {
    expect(ZERO_ONLY_PATTERN.test('0.0')).toBe(true);
  });

  it('matcher "0,0"', () => {
    expect(ZERO_ONLY_PATTERN.test('0,0')).toBe(true);
  });

  it('matcher ikke "1"', () => {
    expect(ZERO_ONLY_PATTERN.test('1')).toBe(false);
  });

  it('matcher ikke "0.1"', () => {
    expect(ZERO_ONLY_PATTERN.test('0.1')).toBe(false);
  });
});

describe('isZeroOnlyString', () => {
  it('"0" → true', () => {
    expect(isZeroOnlyString('0')).toBe(true);
  });

  it('"00" → true', () => {
    expect(isZeroOnlyString('00')).toBe(true);
  });

  it('"0.0" → true', () => {
    expect(isZeroOnlyString('0.0')).toBe(true);
  });

  it('"0,0" → true', () => {
    expect(isZeroOnlyString('0,0')).toBe(true);
  });

  it('trimmer whitespace: "  0  " → true', () => {
    expect(isZeroOnlyString('  0  ')).toBe(true);
  });

  it('"1" → false', () => {
    expect(isZeroOnlyString('1')).toBe(false);
  });

  it('"10" → false', () => {
    expect(isZeroOnlyString('10')).toBe(false);
  });

  it('"0.1" → false', () => {
    expect(isZeroOnlyString('0.1')).toBe(false);
  });

  it('tom streng → false (matcher ikke pattern)', () => {
    expect(isZeroOnlyString('')).toBe(false);
  });
});

describe('isAmountValueStrict', () => {
  it('number AmountValue → true', () => {
    expect(isAmountValueStrict({ kind: 'number', value: 100 })).toBe(true);
  });

  it('expression AmountValue → true', () => {
    expect(isAmountValueStrict({ kind: 'expression', value: 500, expression: '200+300' })).toBe(true);
  });

  it('null → false', () => {
    expect(isAmountValueStrict(null)).toBe(false);
  });

  it('undefined → false', () => {
    expect(isAmountValueStrict(undefined)).toBe(false);
  });

  it('string → false', () => {
    expect(isAmountValueStrict('100')).toBe(false);
  });

  it('number → false', () => {
    expect(isAmountValueStrict(100)).toBe(false);
  });

  it('objekt med ukendt kind → kaster i DEV (invariant)', () => {
    // isAmountValueStrict kaster i DEV-mode ved ukendt kind — det er intentionelt (fail-loud)
    expect(() => isAmountValueStrict({})).toThrow();
  });

  it('number-kind med string value → false', () => {
    expect(isAmountValueStrict({ kind: 'number', value: '100' })).toBe(false);
  });
});

describe('isEffectivelyEmptyNumber', () => {
  it('0 → true', () => {
    expect(isEffectivelyEmptyNumber(0)).toBe(true);
  });

  it('NaN → true', () => {
    expect(isEffectivelyEmptyNumber(NaN)).toBe(true);
  });

  it('Infinity → true', () => {
    expect(isEffectivelyEmptyNumber(Infinity)).toBe(true);
  });

  it('-Infinity → true', () => {
    expect(isEffectivelyEmptyNumber(-Infinity)).toBe(true);
  });

  it('1 → false', () => {
    expect(isEffectivelyEmptyNumber(1)).toBe(false);
  });

  it('-1 → false', () => {
    expect(isEffectivelyEmptyNumber(-1)).toBe(false);
  });

  it('0.01 → false', () => {
    expect(isEffectivelyEmptyNumber(0.01)).toBe(false);
  });

  it('store tal → false', () => {
    expect(isEffectivelyEmptyNumber(1_000_000)).toBe(false);
  });
});
