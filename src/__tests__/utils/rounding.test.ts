import { roundByMethod } from '../../utils/rounding';

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

  it('NEGATIVE_INFINITY → 0 (fail-closed)', () => {
    expect(roundByMethod(Number.NEGATIVE_INFINITY, 2, 'halfAwayFromZero')).toBe(0);
  });

  it('none returnerer tallet uændret (ingen afrunding)', () => {
    expect(roundByMethod(1.23456, 2, 'none')).toBe(1.23456);
    expect(roundByMethod(3.99999, 4, 'none')).toBe(3.99999);
  });

  it('floor med decimals=0 → heltalsafrunding ned', () => {
    expect(roundByMethod(1.9, 0, 'floor')).toBe(1);
    expect(roundByMethod(-1.1, 0, 'floor')).toBe(-2);
  });

  it('ceil med decimals=0 → heltalsafrunding op', () => {
    expect(roundByMethod(1.1, 0, 'ceil')).toBe(2);
    expect(roundByMethod(-1.9, 0, 'ceil')).toBe(-1);
  });

  it('halfAwayFromZero med decimals=0 → nærmeste heltal', () => {
    expect(roundByMethod(1.5, 0, 'halfAwayFromZero')).toBe(2);
    expect(roundByMethod(1.49, 0, 'halfAwayFromZero')).toBe(1);
    expect(roundByMethod(-1.5, 0, 'halfAwayFromZero')).toBe(-2);
  });
});
