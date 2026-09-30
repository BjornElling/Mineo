import {
  hasSafeDecimalDigits,
  isSafeCanonicalDecimal,
  isSafeCanonicalInteger,
  isSafeCanonicalNumber,
  isSafeScaledInteger,
} from '../../utils/numericSafety';

describe('numericSafety', () => {
  it('afgrænser heltal ved JavaScripts eksakte heltalsgrænse', () => {
    expect(isSafeCanonicalInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeCanonicalInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isSafeScaledInteger(BigInt(Number.MAX_SAFE_INTEGER), 0)).toBe(true);
    expect(isSafeScaledInteger(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 0)).toBe(false);
  });

  it('måler decimalinput i den mindste betydende decimalenhed', () => {
    expect(hasSafeDecimalDigits('70368744177663', '99', 2)).toBe(true);
    expect(hasSafeDecimalDigits('70368744177664', '00', 2)).toBe(false);
    expect(hasSafeDecimalDigits('1', '230', 2)).toBe(true);
    expect(hasSafeDecimalDigits('1', '234', 2)).toBe(false);
  });

  it('afviser ugyldige decimaltegn og kontrollerer negative skalerede heltal', () => {
    expect(hasSafeDecimalDigits('', '1', 2)).toBe(false);
    expect(hasSafeDecimalDigits('1', 'x', 2)).toBe(false);
    expect(hasSafeDecimalDigits('1', '', 2)).toBe(true);
    expect(hasSafeDecimalDigits('000', '00', 2)).toBe(true);
    expect(isSafeScaledInteger(1n, -1)).toBe(false);
    expect(isSafeScaledInteger(-1n, 0)).toBe(true);
  });

  it('kræver et sikkert skaleret heltal for canonical decimalværdi', () => {
    expect(isSafeCanonicalDecimal(0.29, 2)).toBe(true);
    expect(isSafeCanonicalDecimal(0.1 + 0.2, 2)).toBe(true);
    expect(isSafeCanonicalDecimal(1.23, 2)).toBe(true);
    expect(isSafeCanonicalDecimal(1.234, 2)).toBe(false);
    expect(isSafeCanonicalDecimal(70_368_744_177_663.99, 2)).toBe(true);
    expect(isSafeCanonicalDecimal(70_368_744_177_664, 2)).toBe(false);
  });

  it('afviser centværdier i et binary64-område hvor nabocents kolliderer', () => {
    const first = Number('90071992547409.90');
    const next = Number('90071992547409.91');

    expect(first).toBe(next);
    expect(isSafeCanonicalDecimal(first, 2)).toBe(false);
    expect(isSafeCanonicalDecimal(next, 2)).toBe(false);
  });

  it('afviser non-finite, ugyldig og for stor decimalpræcision', () => {
    expect(isSafeCanonicalDecimal(Number.NaN, 2)).toBe(false);
    expect(isSafeCanonicalDecimal(1, 1.5)).toBe(false);
    expect(isSafeCanonicalDecimal(1, -1)).toBe(false);
    expect(isSafeCanonicalDecimal(1, 309)).toBe(false);
    expect(isSafeCanonicalDecimal(Number.MAX_VALUE, 0)).toBe(false);
  });

  it('afgrænser frie number-værdier uden at forbyde sikre decimaler', () => {
    expect(isSafeCanonicalNumber(0.5)).toBe(true);
    expect(isSafeCanonicalNumber(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeCanonicalNumber(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isSafeCanonicalNumber(Number.NaN)).toBe(false);
    expect(isSafeCanonicalNumber(Number.POSITIVE_INFINITY)).toBe(false);
  });
});
