import {
  formatPercent,
  formatCurrency,
  formatAsAmount,
  formatAsAmountTrimmed,
  isSingularCount,
  formatCountWithUnit,
} from '../../utils/formatUtils';
import { parseAmount } from '../../utils/numberParsing';

describe('formatPercent', () => {
  it('afrunder deterministisk og bruger dansk komma', () => {
    expect(formatPercent(33.333333)).toBe('33,33 %');
    expect(formatPercent(10)).toBe('10 %');
  });

  it('heltals-procent uden decimaler → ingen trailing .00', () => {
    expect(formatPercent(12)).toBe('12 %');
    expect(formatPercent(0)).toBe('0 %');
  });

  it('én decimal → ingen trailing 0', () => {
    expect(formatPercent(12.5)).toBe('12,5 %');
  });

  it('NaN → tom streng', () => {
    expect(formatPercent(NaN)).toBe('');
  });

  it('Infinity → tom streng', () => {
    expect(formatPercent(Infinity)).toBe('');
  });

  it('negativ procent → negativt tal med dansk komma', () => {
    expect(formatPercent(-5.5)).toBe('-5,5 %');
  });
});

describe('formatCurrency', () => {
  it('undefined → tom streng', () => {
    expect(formatCurrency(undefined)).toBe('');
  });

  it('null → tom streng', () => {
    expect(formatCurrency(null)).toBe('');
  });

  it('1234.56 → dansk format med punktum og komma', () => {
    expect(formatCurrency(1234.56)).toBe('1.234,56');
  });

  it('0 → "0,00"', () => {
    expect(formatCurrency(0)).toBe('0,00');
  });

  it('1000000 → "1.000.000,00"', () => {
    expect(formatCurrency(1000000)).toBe('1.000.000,00');
  });

  it('negativ beløb → negativt format', () => {
    expect(formatCurrency(-1234.56)).toBe('-1.234,56');
  });
});

describe('formatAsAmount', () => {
  it('undefined → tom streng', () => {
    expect(formatAsAmount(undefined)).toBe('');
  });

  it('null → tom streng', () => {
    expect(formatAsAmount(null)).toBe('');
  });

  it('NaN → tom streng', () => {
    expect(formatAsAmount(NaN)).toBe('');
  });

  it('standard precision 2', () => {
    expect(formatAsAmount(1234.567)).toBe('1.234,57');
  });

  it('precision 0 → ingen decimaler', () => {
    expect(formatAsAmount(1234.7, 0)).toBe('1.235');
  });

  it('precision 4', () => {
    expect(formatAsAmount(1.23456, 4)).toBe('1,2346');
  });

  it('negativ → minus-tegn', () => {
    expect(formatAsAmount(-500, 0)).toBe('-500');
  });

  it('Infinity → roundByMethod behandler det (ikke tom streng — isNaN(Infinity)=false)', () => {
    // DOKUMENTATION: formatAsAmount tjekker kun isNaN, ikke !isFinite.
    // Infinity passerer isNaN-tjekket og behandles af roundByMethod.
    // Dette er den faktiske adfærd — ikke nødvendigvis tilsigtet.
    const result = formatAsAmount(Infinity);
    expect(typeof result).toBe('string');
  });

  it('precision > 6 → clampes til 6', () => {
    // resolvedPrecision = min(6, trunc(10)) = 6
    const result = formatAsAmount(1.1234567, 10);
    expect(result).toBe('1,123457');
  });

  it('precision < 0 → clampes til 0 (ingen decimaler)', () => {
    const result = formatAsAmount(1234.7, -1);
    expect(result).toBe('1.235');
  });

  it('precision = NaN → defaults til 2', () => {
    const result = formatAsAmount(1234.567, NaN);
    expect(result).toBe('1.234,57');
  });
});

describe('formatAsAmountTrimmed', () => {
  it('fjerner trailing nuller efter komma', () => {
    expect(formatAsAmountTrimmed(22.81, 4)).toBe('22,81');
    expect(formatAsAmountTrimmed(22.8, 4)).toBe('22,8');
  });

  it('bevarer hele tal uden komma', () => {
    expect(formatAsAmountTrimmed(23, 4)).toBe('23');
  });

  it('returnerer tom streng for ugyldige input', () => {
    expect(formatAsAmountTrimmed(undefined, 4)).toBe('');
  });
});

describe('isSingularCount', () => {
  it('1.0 → true', () => expect(isSingularCount(1.0)).toBe(true));
  it('1.00000001 → true (inden for epsilon 0.0000001)', () => expect(isSingularCount(1.00000001)).toBe(true));
  it('2.0 → false', () => expect(isSingularCount(2.0)).toBe(false));
  it('0.0 → false', () => expect(isSingularCount(0.0)).toBe(false));
});

describe('formatCountWithUnit', () => {
  it('1 dag → "1 dag"', () => {
    expect(formatCountWithUnit(1, 'dag', 'dage')).toBe('1 dag');
  });

  it('2 dage → "2 dage"', () => {
    expect(formatCountWithUnit(2, 'dag', 'dage')).toContain('dage');
  });

  it('0 → plural form', () => {
    expect(formatCountWithUnit(0, 'dag', 'dage')).toContain('dage');
  });
});

describe('parseAmount', () => {
  it('undefined → 0', () => {
    expect(parseAmount(undefined)).toBe(0);
  });

  it('12.5 → 12.5', () => {
    expect(parseAmount(12.5)).toBe(12.5);
  });

  it('AmountValue kind:number → value', () => {
    expect(parseAmount({ kind: 'number', value: 42 })).toBe(42);
  });
});
