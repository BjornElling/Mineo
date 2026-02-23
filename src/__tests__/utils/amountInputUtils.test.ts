import {
  sanitizePastedAmount,
  containsAnyDigit,
  normalizeTrailingSeparator,
  normalizeZero,
} from '../../utils/amountInputUtils';

describe('sanitizePastedAmount', () => {
  it('removes all non-allowed characters on paste', () => {
    expect(sanitizePastedAmount('ab1c2,3d')).toBe('12,3');
  });

  it('normalizes unicode minus to ASCII minus on paste', () => {
    expect(sanitizePastedAmount('−12,50')).toBe('-12,50');
  });

  it('bevarer tilladte operatorer (+, -, *, /, x, (, ), .)', () => {
    expect(sanitizePastedAmount('1+2*3/4')).toBe('1+2*3/4');
  });

  it('tom streng → tom streng', () => {
    expect(sanitizePastedAmount('')).toBe('');
  });
});

describe('containsAnyDigit', () => {
  it('streng med tal → true', () => {
    expect(containsAnyDigit('abc1def')).toBe(true);
  });

  it('kun bogstaver → false', () => {
    expect(containsAnyDigit('abc')).toBe(false);
  });

  it('tom streng → false', () => {
    expect(containsAnyDigit('')).toBe(false);
  });

  it('kun separatorer → false', () => {
    expect(containsAnyDigit('.,+')).toBe(false);
  });
});

describe('normalizeTrailingSeparator', () => {
  it('trailing komma fjernes fra heltal', () => {
    expect(normalizeTrailingSeparator('18,')).toBe('18');
  });

  it('trailing punkt fjernes fra heltal', () => {
    expect(normalizeTrailingSeparator('18.')).toBe('18');
  });

  it('trailing komma fjernes fra tal med tusindtals-separator', () => {
    expect(normalizeTrailingSeparator('1.000,')).toBe('1.000');
  });

  it('streng uden trailing separator returneres uændret', () => {
    expect(normalizeTrailingSeparator('18,5')).toBe('18,5');
  });

  it('whitespace trimmes, og trailing komma fjernes (begge)', () => {
    // trim() sker INDEN separator-tjek → '  18,  ' → '18,' → '18'
    expect(normalizeTrailingSeparator('  18,  ')).toBe('18');
  });

  it('whitespace trimmes fra streng uden trailing separator', () => {
    expect(normalizeTrailingSeparator('  18,5  ')).toBe('18,5');
  });

  it('tom streng → tom streng', () => {
    expect(normalizeTrailingSeparator('')).toBe('');
  });
});

describe('normalizeZero', () => {
  it('-0 → 0', () => {
    const result = normalizeZero(-0);
    expect(result).toBe(0);
    expect(Object.is(result, -0)).toBe(false);
  });

  it('0 → 0 (ikke -0)', () => {
    const result = normalizeZero(0);
    expect(Object.is(result, -0)).toBe(false);
    expect(result).toBe(0);
  });

  it('positive tal → uændret', () => {
    expect(normalizeZero(42)).toBe(42);
  });

  it('negative tal → uændret', () => {
    expect(normalizeZero(-5)).toBe(-5);
  });
});
