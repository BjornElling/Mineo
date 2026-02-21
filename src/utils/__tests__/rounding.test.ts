import { describe, expect, it } from 'vitest';
import { roundByMethod } from '../rounding';

describe('roundByMethod', () => {
  it('rounder halfAwayFromZero symmetrisk for positive og negative halvdele', () => {
    expect(roundByMethod(0.5, 0, 'halfAwayFromZero')).toBe(1);
    expect(roundByMethod(-0.5, 0, 'halfAwayFromZero')).toBe(-1);
    expect(roundByMethod(2.005, 2, 'halfAwayFromZero')).toBe(2.01);
    expect(roundByMethod(-2.005, 2, 'halfAwayFromZero')).toBe(-2.01);
  });

  it('understøtter floor og ceil deterministisk for positive og negative værdier', () => {
    expect(roundByMethod(1.239, 2, 'floor')).toBe(1.23);
    expect(roundByMethod(-1.231, 2, 'floor')).toBe(-1.24);
    expect(roundByMethod(1.231, 2, 'ceil')).toBe(1.24);
    expect(roundByMethod(-1.239, 2, 'ceil')).toBe(-1.23);
  });

  it('normaliserer -0 og fail-closed på ugyldige tal', () => {
    expect(Object.is(roundByMethod(-0, 2, 'none'), -0)).toBe(false);
    expect(roundByMethod(Number.NaN, 2, 'halfAwayFromZero')).toBe(0);
    expect(roundByMethod(Number.POSITIVE_INFINITY, 2, 'halfAwayFromZero')).toBe(0);
  });

  it('håndterer store tal uden inkonsistent afrunding', () => {
    expect(roundByMethod(123456789.555, 2, 'halfAwayFromZero')).toBe(123456789.56);
    expect(roundByMethod(-123456789.555, 2, 'halfAwayFromZero')).toBe(-123456789.56);
  });
});

