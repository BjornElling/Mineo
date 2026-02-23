import { describe, expect, it } from 'vitest';
import type { ISODateString } from '../../types/branded';
import {
  formatIsoDateShort,
  formatIsoDateLong,
  formatUtcDateShort,
  formatUtcDateLong,
  formatISOToDanish,
} from '../../utils/dateFormatting';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const utcDate = (y: number, m: number, d: number): Date => {
  return new Date(Date.UTC(y, m - 1, d));
};

// ─── formatIsoDateShort ────────────────────────────────────────────────────
// formatIsoDateShort returnerer dansk numerisk format: dd-mm-yyyy

describe('formatIsoDateShort', () => {
  it('2024-01-15 → 15-01-2024', () => {
    expect(formatIsoDateShort(iso('2024-01-15'))).toBe('15-01-2024');
  });

  it('2024-12-31 → 31-12-2024', () => {
    expect(formatIsoDateShort(iso('2024-12-31'))).toBe('31-12-2024');
  });

  it('2024-06-01 → 01-06-2024', () => {
    expect(formatIsoDateShort(iso('2024-06-01'))).toBe('01-06-2024');
  });

  it('undefined → tom streng', () => {
    expect(formatIsoDateShort(undefined)).toBe('');
  });

  it('er deterministisk', () => {
    const r1 = formatIsoDateShort(iso('2024-06-15'));
    const r2 = formatIsoDateShort(iso('2024-06-15'));
    expect(r1).toBe(r2);
  });
});

// ─── formatIsoDateLong ─────────────────────────────────────────────────────

describe('formatIsoDateLong', () => {
  it('indeholder årstal 2024', () => {
    const result = formatIsoDateLong(iso('2024-06-15'));
    expect(result).toContain('2024');
  });

  it('indeholder dag og fuldt månedsnavn', () => {
    const result = formatIsoDateLong(iso('2024-01-15'));
    expect(result).toMatch(/15/);
    expect(result).toMatch(/januar/i);
  });

  it('juni er korrekt', () => {
    const result = formatIsoDateLong(iso('2024-06-01'));
    expect(result).toMatch(/juni/i);
  });

  it('er deterministisk', () => {
    const r1 = formatIsoDateLong(iso('2024-06-15'));
    const r2 = formatIsoDateLong(iso('2024-06-15'));
    expect(r1).toBe(r2);
  });
});

// ─── formatUtcDateShort ────────────────────────────────────────────────────
// formatUtcDateShort delegerer til formatIsoDateShort → dansk numerisk format

describe('formatUtcDateShort', () => {
  it('2024-06-15 UTC → 15-06-2024', () => {
    const d = utcDate(2024, 6, 15);
    expect(formatUtcDateShort(d)).toBe('15-06-2024');
  });

  it('2024-01-01 UTC → 01-01-2024', () => {
    const d = utcDate(2024, 1, 1);
    expect(formatUtcDateShort(d)).toBe('01-01-2024');
  });

  it('undefined → tom streng', () => {
    expect(formatUtcDateShort(undefined)).toBe('');
  });

  it('er deterministisk', () => {
    const d = utcDate(2024, 6, 15);
    expect(formatUtcDateShort(d)).toBe(formatUtcDateShort(d));
  });
});

// ─── formatUtcDateLong ─────────────────────────────────────────────────────

describe('formatUtcDateLong', () => {
  it('indeholder årstal 2024', () => {
    const d = utcDate(2024, 6, 15);
    expect(formatUtcDateLong(d)).toContain('2024');
  });

  it('indeholder fuldt månedsnavn januar og dag', () => {
    const d = utcDate(2024, 1, 15);
    const result = formatUtcDateLong(d);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/januar/i);
  });

  it('juni → indeholder juni', () => {
    const d = utcDate(2024, 6, 1);
    expect(formatUtcDateLong(d)).toMatch(/juni/i);
  });

  it('undefined → tom streng', () => {
    expect(formatUtcDateLong(undefined)).toBe('');
  });

  it('er deterministisk', () => {
    const d = utcDate(2024, 6, 15);
    expect(formatUtcDateLong(d)).toBe(formatUtcDateLong(d));
  });
});

// ─── formatISOToDanish ─────────────────────────────────────────────────────

describe('formatISOToDanish', () => {
  it('2024-01-15 → 15-01-2024', () => {
    expect(formatISOToDanish(iso('2024-01-15'))).toBe('15-01-2024');
  });

  it('2024-12-31 → 31-12-2024', () => {
    expect(formatISOToDanish(iso('2024-12-31'))).toBe('31-12-2024');
  });

  it('2024-06-01 → 01-06-2024', () => {
    expect(formatISOToDanish(iso('2024-06-01'))).toBe('01-06-2024');
  });

  it('er deterministisk', () => {
    const r1 = formatISOToDanish(iso('2024-06-15'));
    const r2 = formatISOToDanish(iso('2024-06-15'));
    expect(r1).toBe(r2);
  });
});
