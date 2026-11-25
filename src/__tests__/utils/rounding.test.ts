import { formatRoundedCanonical, roundByMethod } from '../../utils/rounding';

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

  it('formatRoundedCanonical bruger afrundingsmetoden og normaliserer decimalantallet', () => {
    expect(formatRoundedCanonical(1.235, 2)).toBe('1.24');
    expect(formatRoundedCanonical(-1.231, 2, 'floor')).toBe('-1.24');
    expect(formatRoundedCanonical(1.231, 2, 'ceil')).toBe('1.24');
    expect(formatRoundedCanonical(1.234, 2, 'none')).toBe('1.23');
    expect(formatRoundedCanonical(1.234, Number.POSITIVE_INFINITY)).toBe('1');
  });

  /**
   * Fund A i værdiklasse-gennemgangen 2026-11-24: et resultat, der i decimaler går præcis op eller ligger
   * præcis på en halv, må ikke afrundes efter den binære regnestøj, kommatallet bærer.
   */
  it('afrunder efter den decimale værdi, ikke efter binær regnestøj', () => {
    // 64.500 × 82 % = 52.890 – kommatallet er 52.890,00000000001.
    expect(roundByMethod(64500 * (1 - 18 / 100), 0, 'ceil')).toBe(52890);
    // 100.050 × 0,29 = 29.014,5 – kommatallet er 29.014,499999999996.
    expect(roundByMethod(100050 * 0.29, 0, 'halfAwayFromZero')).toBe(29015);
    expect(roundByMethod(-(100050 * 0.29), 0, 'halfAwayFromZero')).toBe(-29015);
    // 8,20 × 12,5 % = 1,025.
    expect(roundByMethod(8.2 * 0.125, 2, 'halfAwayFromZero')).toBe(1.03);
    // Med decimaler: 0,07 og 0,29 er ikke lige over/under sig selv.
    expect(roundByMethod(0.07, 2, 'ceil')).toBe(0.07);
    expect(roundByMethod(0.29, 2, 'floor')).toBe(0.29);
    // Kontrast: en reel brøkdel langt under øren bevares som brøkdel og afgør retningen.
    expect(roundByMethod(52890.0001, 0, 'ceil')).toBe(52891);
    expect(roundByMethod(29014.4999, 0, 'halfAwayFromZero')).toBe(29014);
    expect(roundByMethod(120.000001 / 12, 0, 'ceil')).toBe(11);
  });
});
