import { parsePercentToDecimal, parsePercentPointString, parseAmount } from '../../utils/numberParsing';

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

  it('"12.5" (punkt som decimaltegn) → 0 (dansk locale: punkt er IKKE decimaltegn)', () => {
    // Konsolideret locale-politik: komma er decimaltegn, punktum er tusindtalsseparator.
    // "12.5" har ikke punktum efterfulgt af præcis 3 cifre → ugyldigt → 0.
    // (Tidligere tolererede denne ene parser punkt-decimal; nu er reglen ens overalt.)
    expect(parsePercentToDecimal('12.5')).toBe(0);
  });

  it('"12.500" → 125 (punktum som tusindtalsseparator, dansk locale)', () => {
    expect(parsePercentToDecimal('12.500')).toBeCloseTo(125, 10);
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

describe('parsePercentPointString (kanonisk pct-point-parser)', () => {
  it('dansk komma-decimal → pct-point', () => {
    expect(parsePercentPointString('12,5')).toBe(12.5);
    expect(parsePercentPointString('12,5 %')).toBe(12.5);
  });

  it('tusindtalsseparator (punktum) → pct-point', () => {
    expect(parsePercentPointString('1.234,56')).toBeCloseTo(1234.56, 10);
  });

  it('punkt som decimaltegn afvises (dansk locale) → undefined', () => {
    expect(parsePercentPointString('12.5')).toBeUndefined();
  });

  it('tal-input returneres uændret', () => {
    expect(parsePercentPointString(15)).toBe(15);
    expect(parsePercentPointString(NaN)).toBeUndefined();
  });

  it('tom/undefined → undefined', () => {
    expect(parsePercentPointString('')).toBeUndefined();
    expect(parsePercentPointString('   ')).toBeUndefined();
    expect(parsePercentPointString(undefined)).toBeUndefined();
  });

  it('ingen float-artefakt: heltals-pct er eksakt (modsat /100*100-round-trip)', () => {
    // parsePercentToDecimal('15')*100 gav tidligere 15.000000000000002; den kanoniske
    // pct-point-parser returnerer eksakt 15.
    expect(parsePercentPointString('15')).toBe(15);
    expect(parsePercentToDecimal('15')).toBeCloseTo(0.15, 12);
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
