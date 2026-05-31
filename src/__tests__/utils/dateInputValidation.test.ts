import { toISODateString } from '../../types/branded';
import {
  isValidDate,
  interpretYear,
  validateDateRange,
} from '../../utils/dateInputValidation';

// ─── isValidDate ──────────────────────────────────────────────────────────

describe('isValidDate', () => {
  it('15-06-2024 → gyldig', () => {
    expect(isValidDate(15, 6, 2024)).toBe(true);
  });

  it('1-1-2024 → gyldig (grænseværdi)', () => {
    expect(isValidDate(1, 1, 2024)).toBe(true);
  });

  it('31-12-2024 → gyldig (grænseværdi)', () => {
    expect(isValidDate(31, 12, 2024)).toBe(true);
  });

  it('29-02-2024 (skudår) → gyldig', () => {
    expect(isValidDate(29, 2, 2024)).toBe(true);
  });

  it('29-02-2023 (ikke-skudår) → ugyldig', () => {
    expect(isValidDate(29, 2, 2023)).toBe(false);
  });

  it('28-02-2023 (ikke-skudår) → gyldig', () => {
    expect(isValidDate(28, 2, 2023)).toBe(true);
  });

  it('31-04-2024 (april har 30 dage) → ugyldig', () => {
    expect(isValidDate(31, 4, 2024)).toBe(false);
  });

  it('30-04-2024 → gyldig', () => {
    expect(isValidDate(30, 4, 2024)).toBe(true);
  });

  it('dag = 0 → ugyldig', () => {
    expect(isValidDate(0, 6, 2024)).toBe(false);
  });

  it('dag = 32 → ugyldig', () => {
    expect(isValidDate(32, 6, 2024)).toBe(false);
  });

  it('måned = 0 → ugyldig', () => {
    expect(isValidDate(15, 0, 2024)).toBe(false);
  });

  it('måned = 13 → ugyldig', () => {
    expect(isValidDate(15, 13, 2024)).toBe(false);
  });

  it('31-01-2024 → gyldig', () => {
    expect(isValidDate(31, 1, 2024)).toBe(true);
  });

  it('31-06-2024 (juni har 30 dage) → ugyldig', () => {
    expect(isValidDate(31, 6, 2024)).toBe(false);
  });
});

// ─── interpretYear ────────────────────────────────────────────────────────

describe('interpretYear', () => {
  it('4-cifret år → returnerer som-er', () => {
    expect(interpretYear('2024')).toBe(2024);
    expect(interpretYear('1990')).toBe(1990);
  });

  it('1-cifret år → fortolkes som 200x', () => {
    expect(interpretYear('5')).toBe(2005);
    expect(interpretYear('9')).toBe(2009);
  });

  it('2-cifret år tæt på nuværende → 20xx', () => {
    // 2026 (nuværende år) + 5 = 2031. Så 24 → 2024 (< 2031)
    expect(interpretYear('24')).toBe(2024);
  });

  it('2-cifret år langt frem → 19xx (over currentYear + 5)', () => {
    // 80 → 2080 > currentYear + 5 → 1980
    expect(interpretYear('80')).toBe(1980);
  });

  it('3-cifret år → null (ugyldigt)', () => {
    expect(interpretYear('202')).toBeNull();
  });
});

// ─── validateDateRange ────────────────────────────────────────────────────

describe('validateDateRange', () => {
  it('dato indenfor range → true', () => {
    expect(validateDateRange('15-06-2024', toISODateString('2024-01-01'), toISODateString('2024-12-31'))).toBe(true);
  });

  it('dato = minDate → true', () => {
    expect(validateDateRange('01-01-2024', toISODateString('2024-01-01'), toISODateString('2024-12-31'))).toBe(true);
  });

  it('dato = maxDate → true', () => {
    expect(validateDateRange('31-12-2024', toISODateString('2024-01-01'), toISODateString('2024-12-31'))).toBe(true);
  });

  it('dato < minDate → fejlstreng', () => {
    const result = validateDateRange('31-12-2023', toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result).not.toBe(true);
    expect(typeof result).toBe('string');
  });

  it('dato > maxDate → fejlstreng', () => {
    const result = validateDateRange('01-01-2025', toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result).not.toBe(true);
    expect(typeof result).toBe('string');
  });

  it('tom dato → true (ingen validering af tomme felter)', () => {
    expect(validateDateRange('', toISODateString('2024-01-01'), toISODateString('2024-12-31'))).toBe(true);
  });

  it('for kort dato → true (ingen validering)', () => {
    expect(validateDateRange('15-06', toISODateString('2024-01-01'), toISODateString('2024-12-31'))).toBe(true);
  });

  it('ugyldig dato der ikke kan parses → true (graceful håndtering)', () => {
    expect(validateDateRange('abc-def-ghij', toISODateString('2024-01-01'), toISODateString('2024-12-31'))).toBe(true);
  });
});
