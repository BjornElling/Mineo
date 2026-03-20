import type { ISODateString } from '../../types/branded';
import {
  validateIsoRange,
  minISO,
  maxISO,
  iterateDatesInclusive,
  validateISODateRange,
} from '../../utils/isoDateHelpers';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const utcDate = (y: number, m: number, d: number): Date =>
  new Date(Date.UTC(y, m - 1, d));

// ─── validateIsoRange ─────────────────────────────────────────────────────
// validateIsoRange returnerer IsoRange | undefined (ikke {valid: boolean})

describe('validateIsoRange', () => {
  it('fra < til → returnerer IsoRange med korrekte værdier', () => {
    const result = validateIsoRange(iso('2024-01-01'), iso('2024-12-31'));
    expect(result).not.toBeUndefined();
    expect(result?.fra).toBe('2024-01-01');
    expect(result?.til).toBe('2024-12-31');
  });

  it('fra = til → returnerer IsoRange', () => {
    const result = validateIsoRange(iso('2024-06-15'), iso('2024-06-15'));
    expect(result).not.toBeUndefined();
    expect(result?.fra).toBe('2024-06-15');
  });

  it('fra > til → undefined', () => {
    expect(validateIsoRange(iso('2024-12-31'), iso('2024-01-01'))).toBeUndefined();
  });

  it('fra = undefined → undefined', () => {
    expect(validateIsoRange(undefined, iso('2024-12-31'))).toBeUndefined();
  });

  it('til = undefined → undefined', () => {
    expect(validateIsoRange(iso('2024-01-01'), undefined)).toBeUndefined();
  });

  it('begge undefined → undefined', () => {
    expect(validateIsoRange(undefined, undefined)).toBeUndefined();
  });
});

// ─── minISO ───────────────────────────────────────────────────────────────

describe('minISO', () => {
  it('to datoer → returnerer den mindste', () => {
    expect(minISO(iso('2024-01-01'), iso('2024-06-15'))).toBe('2024-01-01');
  });

  it('to datoer: anden er mindst', () => {
    expect(minISO(iso('2024-12-31'), iso('2024-01-01'))).toBe('2024-01-01');
  });

  it('ens datoer → returnerer en af dem', () => {
    expect(minISO(iso('2024-06-15'), iso('2024-06-15'))).toBe('2024-06-15');
  });

  it('første undefined → returnerer anden', () => {
    expect(minISO(undefined, iso('2024-06-15'))).toBe('2024-06-15');
  });

  it('anden undefined → returnerer første', () => {
    expect(minISO(iso('2024-06-15'), undefined)).toBe('2024-06-15');
  });

  it('begge undefined → undefined', () => {
    expect(minISO(undefined, undefined)).toBeUndefined();
  });

  it('år-grænse: 2023 < 2024', () => {
    expect(minISO(iso('2023-12-31'), iso('2024-01-01'))).toBe('2023-12-31');
  });
});

// ─── maxISO ───────────────────────────────────────────────────────────────

describe('maxISO', () => {
  it('to datoer → returnerer den største', () => {
    expect(maxISO(iso('2024-01-01'), iso('2024-06-15'))).toBe('2024-06-15');
  });

  it('to datoer: første er størst', () => {
    expect(maxISO(iso('2024-12-31'), iso('2024-01-01'))).toBe('2024-12-31');
  });

  it('ens datoer → returnerer en af dem', () => {
    expect(maxISO(iso('2024-06-15'), iso('2024-06-15'))).toBe('2024-06-15');
  });

  it('første undefined → returnerer anden', () => {
    expect(maxISO(undefined, iso('2024-06-15'))).toBe('2024-06-15');
  });

  it('anden undefined → returnerer første', () => {
    expect(maxISO(iso('2024-06-15'), undefined)).toBe('2024-06-15');
  });

  it('begge undefined → undefined', () => {
    expect(maxISO(undefined, undefined)).toBeUndefined();
  });

  it('år-grænse: 2024 > 2023', () => {
    expect(maxISO(iso('2023-12-31'), iso('2024-01-01'))).toBe('2024-01-01');
  });
});

// ─── iterateDatesInclusive ────────────────────────────────────────────────
// iterateDatesInclusive tager Date-objekter, ikke ISO-strenge

describe('iterateDatesInclusive', () => {
  it('enkelt dag → 1 callback', () => {
    const count: number[] = [];
    const d = utcDate(2024, 6, 15);
    iterateDatesInclusive(d, d, () => count.push(1));
    expect(count).toHaveLength(1);
  });

  it('to dage → 2 callbacks med korrekte UTC-datoer', () => {
    const dates: number[] = [];
    iterateDatesInclusive(utcDate(2024, 6, 14), utcDate(2024, 6, 15), (d) => dates.push(d.getUTCDate()));
    expect(dates).toHaveLength(2);
    expect(dates[0]).toBe(14);
    expect(dates[1]).toBe(15);
  });

  it('en uge → 7 callbacks', () => {
    let count = 0;
    iterateDatesInclusive(utcDate(2024, 1, 1), utcDate(2024, 1, 7), () => count++);
    expect(count).toBe(7);
  });

  it('månedsskift: 2024-01-30 til 2024-02-02 → 4 callbacks', () => {
    const months: number[] = [];
    const days: number[] = [];
    iterateDatesInclusive(utcDate(2024, 1, 30), utcDate(2024, 2, 2), (d) => {
      months.push(d.getUTCMonth());
      days.push(d.getUTCDate());
    });
    expect(months).toHaveLength(4);
    expect(months[0]).toBe(0); // januar
    expect(days[0]).toBe(30);
    expect(months[3]).toBe(1); // februar
    expect(days[3]).toBe(2);
  });

  it('DST-skift: 2024-03-29 til 2024-04-01 → 4 callbacks', () => {
    let count = 0;
    iterateDatesInclusive(utcDate(2024, 3, 29), utcDate(2024, 4, 1), () => count++);
    expect(count).toBe(4);
  });

  it('start > end → ingen callbacks', () => {
    let count = 0;
    iterateDatesInclusive(utcDate(2024, 6, 15), utcDate(2024, 6, 14), () => count++);
    expect(count).toBe(0);
  });

  it('nytårsskift: 2023-12-30 til 2024-01-02 → 4 callbacks', () => {
    let count = 0;
    iterateDatesInclusive(utcDate(2023, 12, 30), utcDate(2024, 1, 2), () => count++);
    expect(count).toBe(4);
  });
});

// ─── validateISODateRange ──────────────────────────────────────────────────
// validateISODateRange returnerer { isValid: boolean; errorMessage: string }

describe('validateISODateRange', () => {
  it('dato indenfor range → isValid = true', () => {
    const result = validateISODateRange('2024-06-15', '2024-01-01', '2024-12-31');
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBe('');
  });

  it('dato = minDate → isValid = true', () => {
    const result = validateISODateRange('2024-01-01', '2024-01-01', '2024-12-31');
    expect(result.isValid).toBe(true);
  });

  it('dato = maxDate → isValid = true', () => {
    const result = validateISODateRange('2024-12-31', '2024-01-01', '2024-12-31');
    expect(result.isValid).toBe(true);
  });

  it('dato < minDate → isValid = false med fejlbesked', () => {
    const result = validateISODateRange('2023-12-31', '2024-01-01', '2024-12-31');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('dato > maxDate → isValid = false med fejlbesked', () => {
    const result = validateISODateRange('2025-01-01', '2024-01-01', '2024-12-31');
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('ikke-ISO dato → isValid = false', () => {
    const result = validateISODateRange('01-01-2024', '2024-01-01', '2024-12-31');
    expect(result.isValid).toBe(false);
  });

  it('fejlbesked indeholder den formaterede dato', () => {
    const result = validateISODateRange('2023-12-31', '2024-01-01', '2024-12-31');
    // Fejlbesked skal indeholde datoer i dansk format
    expect(result.errorMessage).toContain('01-01-2024');
  });
});
