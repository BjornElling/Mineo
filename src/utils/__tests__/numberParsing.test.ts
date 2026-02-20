import { parsePercentToDecimal } from '../numberParsing';

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
});
