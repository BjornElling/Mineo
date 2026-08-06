import {
  normalizePastedAmount,
  containsAnyDigit,
  normalizeTrailingSeparator,
  normalizeZero,
} from '../../utils/amountInputUtils';

// De tidligere `sanitizePastedAmount`-tests er fjernet sammen med funktionen:
// den havde ingen produktions-callsites og var kun holdt i live af sine egne
// tests. `normalizePastedAmount` nedenfor er den faktiske paste-indgang.

describe('normalizePastedAmount', () => {
  it('normaliserer dansk valutaformat med kr til rent beløb', () => {
    expect(normalizePastedAmount('9.602,05 kr.')).toBe('9602,05');
  });

  it('udtrækker beløb fra labeltekst før valutaenhed', () => {
    expect(normalizePastedAmount('Hovedstol: 17.613,05 kr.')).toBe('17613,05');
  });

  it('normaliserer international valutaformat med spaces og punktum-decimal', () => {
    expect(normalizePastedAmount('DKK 9 602.05')).toBe('9602,05');
  });

  it('behandler ét komma som dansk decimalseparator også med tre decimalcifre', () => {
    expect(normalizePastedAmount('12,987')).toBe('12,987');
  });

  it('bevarer udtryk som udtryk i stedet for at tvinge tal-normalisering', () => {
    expect(normalizePastedAmount('1.200,50 / 2')).toBe('1.200,50 / 2');
    expect(normalizePastedAmount('2X3')).toBe('2x3');
  });

  it('bevarer subtraktion som udtryk i stedet for at tolke det som negativt beløb', () => {
    expect(normalizePastedAmount('1200 - 200')).toBe('1200 - 200');
    expect(normalizePastedAmount('1.200,50 - 2')).toBe('1.200,50 - 2');
  });

  it('tolker parentes-notation som negativt beløb for plain money-like paste', () => {
    expect(normalizePastedAmount('(9.602,05 kr.)')).toBe('-9602,05');
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
