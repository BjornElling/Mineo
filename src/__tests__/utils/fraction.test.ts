import { isFractionDraftAllowed, parseFractionString, sanitizePastedFraction } from '../../utils/fraction';

describe('fraction utils', () => {
  it('tillader kun tal, komma og brøkstreg i draft', () => {
    expect(isFractionDraftAllowed('123,45/678,9')).toBe(true);
    expect(isFractionDraftAllowed('123.45/678,9')).toBe(false);
  });

  it('renser punktummer ud af pasted brøk', () => {
    expect(sanitizePastedFraction('1.234,5/6.789,0')).toBe('1234,5/6789,0');
    expect(sanitizePastedFraction('1.25/3.5')).toBe('');
  });

  it('parser kun komma som decimaltegn', () => {
    expect(parseFractionString('1,25/3,5')).toMatchObject({
      ok: true,
      parsed: {
        factor: 1.25 / 3.5,
        value: '1,25/3,5',
      },
    });
    expect(parseFractionString('1.25/3.5')).toEqual({ ok: false, reason: 'invalid' });
  });

  it('afviser negative brøker som standard og accepterer dem når allowNegative er sat', () => {
    expect(parseFractionString('-3/4')).toEqual({ ok: false, reason: 'negative-not-allowed' });
    expect(parseFractionString('-3/4', { allowNegative: true })).toMatchObject({
      ok: true,
      parsed: {
        numerator: -3,
        denominator: 4,
        value: '-3/4',
        factor: -0.75,
      },
    });
  });

  it('afviser nul-tæller som standard og accepterer den når allowZeroNumerator er sat', () => {
    expect(parseFractionString('0/5')).toEqual({ ok: false, reason: 'zero-numerator' });
    expect(parseFractionString('0/5', { allowZeroNumerator: true })).toMatchObject({
      ok: true,
      parsed: {
        numerator: 0,
        denominator: 5,
        value: '0/5',
        factor: 0,
      },
    });
  });

  it('kan bevare ikke-kanonisk heltalsbrøk når canonicalizeOnCommit er false', () => {
    expect(parseFractionString('6/4', { canonicalizeOnCommit: false })).toMatchObject({
      ok: true,
      parsed: {
        numerator: 6,
        denominator: 4,
        value: '6/4',
        factor: 1.5,
        isIntegerFraction: true,
      },
    });
  });

  it('bevarer heltalsbrøker som indtastet som standard', () => {
    expect(parseFractionString('6/4')).toMatchObject({
      ok: true,
      parsed: {
        numerator: 6,
        denominator: 4,
        value: '6/4',
        factor: 1.5,
        isIntegerFraction: true,
      },
    });
  });

  it('kan reducere heltalsbrøker når canonicalizeOnCommit er sat eksplicit', () => {
    expect(parseFractionString('6/4', { canonicalizeOnCommit: true })).toMatchObject({
      ok: true,
      parsed: {
        numerator: 6,
        denominator: 4,
        value: '3/2',
        factor: 1.5,
        isIntegerFraction: true,
      },
    });
  });

  it('bevarer decimalbrøker uden gcd-reduktion', () => {
    expect(parseFractionString('1,5/3')).toMatchObject({
      ok: true,
      parsed: {
        numerator: 1.5,
        denominator: 3,
        value: '1,5/3',
        factor: 0.5,
        isIntegerFraction: false,
      },
    });
  });

  it('kan kræve heltalsbrøker', () => {
    expect(parseFractionString('1,5/3', { requireIntegerFraction: true })).toEqual({
      ok: false,
      reason: 'non-integer',
    });
  });
});
