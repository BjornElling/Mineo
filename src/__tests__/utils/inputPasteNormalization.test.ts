import {
  normalizeAmountPaste,
  normalizeDatePaste,
  normalizeFractionPaste,
  normalizeIntegerPaste,
  normalizePercentPaste,
  normalizeWeekPaste,
  normalizeYearPaste,
} from '../../utils/inputPasteNormalization';

describe('inputPasteNormalization', () => {
  it('normalizes date paste by scanning sequential digit groups', () => {
    expect(normalizeDatePaste('adffergregs//sgd1712,56//')).toBe('17-12-56');
    expect(normalizeDatePaste('a1b2c1999')).toBe('1-2-1999');
    expect(normalizeDatePaste('17121956')).toBe('17-12-1956');
  });

  it('normalizes integer paste from the first digit run with truncation', () => {
    expect(normalizeIntegerPaste('adffergregs//sgd1712,56//', { maxDigits: 4 })).toBe('1712');
    expect(normalizeIntegerPaste('ab1712cd', { maxDigits: 3 })).toBe('171');
    expect(normalizeIntegerPaste('ab1712cd', { maxDigits: 4, maxValue: 170 })).toBe('17');
    expect(normalizeIntegerPaste('abc - 1712cd', { maxDigits: 4, allowNegative: true })).toBe('-1712');
  });

  it('normalizes amount paste to the first number token with comma decimals', () => {
    expect(normalizeAmountPaste('adffergregs//sgd1712,56//')).toBe('1712,56');
    expect(normalizeAmountPaste('abc12,')).toBe('12,');
    expect(normalizeAmountPaste('foo 100+25')).toBe('100');
    expect(normalizeAmountPaste('foo - 100,25 bar', { allowNegative: true })).toBe('-100,25');
  });

  it('normalizes percent paste to the longest prefix within max value', () => {
    expect(normalizePercentPaste('adffergregs//sgd1712,56//', { maxValue: 100 })).toBe('17');
    expect(normalizePercentPaste('abc1007', { maxValue: 100 })).toBe('100');
    expect(normalizePercentPaste('abc999', { maxValue: 8 })).toBe('');
  });

  it('normalizes percent paste without capping when max value is undefined', () => {
    expect(normalizePercentPaste('adffergregs//sgd1712,56//', { maxValue: undefined })).toBe('1712');
  });

  it('normalizes fraction paste from first number slash optional denominator', () => {
    expect(normalizeFractionPaste('adffergregs//sgd1712,56//')).toBe('1712,56/');
    expect(normalizeFractionPaste('foo12,5/bar8,25baz')).toBe('12,5/8,25');
    expect(normalizeFractionPaste('foo12,5bar')).toBe('12,5');
  });

  it('normalizes week paste with week cap and year extraction', () => {
    expect(normalizeWeekPaste('adffergregs//sgd1712,56//')).toBe('17/12');
    expect(normalizeWeekPaste('abc539999')).toBe('53/9999');
    expect(normalizeWeekPaste('abc549999')).toBe('5/4999');
  });

  it('normalizes year paste from the first contiguous digit sequence', () => {
    expect(normalizeYearPaste('adffergregs//sgd1712,56//')).toBe('1712');
    expect(normalizeYearPaste('abc56def2020')).toBe('56');
  });
});
