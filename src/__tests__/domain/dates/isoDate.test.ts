import { describe, expect, it } from 'vitest';
import type { ISODateString } from '../../../types/branded';
import { parseIsoDateOrUndefined, isoDateToDate } from '../../../domain/dates/isoDate';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

// ─── parseIsoDateOrUndefined ───────────────────────────────────────────────
// parseIsoDateOrUndefined tager en string og returnerer ISODateString | undefined (ikke Date)

describe('parseIsoDateOrUndefined', () => {
  it('gyldig ISO dato → returnerer ISODateString uændret', () => {
    expect(parseIsoDateOrUndefined(iso('2024-01-15'))).toBe('2024-01-15');
  });

  it('2024-02-29 (skudår) → returnerer strengen (isISODateString=true for valid format)', () => {
    // isISODateString tjekker kun format, ikke kalender-gyldighed
    expect(parseIsoDateOrUndefined(iso('2024-02-29'))).toBe('2024-02-29');
  });

  it('gyldig ISO dato med whitespace → returnerer trimmet ISODateString', () => {
    const result = parseIsoDateOrUndefined('  2024-01-15  ' as unknown as ISODateString);
    expect(result).toBe('2024-01-15');
  });

  it('undefined input → undefined', () => {
    expect(parseIsoDateOrUndefined(undefined)).toBeUndefined();
  });

  it('ikke-ISO streng (dansk format) → undefined', () => {
    expect(parseIsoDateOrUndefined('01-01-2024' as unknown as ISODateString)).toBeUndefined();
  });

  it('tom streng → undefined', () => {
    expect(parseIsoDateOrUndefined('' as unknown as ISODateString)).toBeUndefined();
  });

  it('er deterministisk', () => {
    const r1 = parseIsoDateOrUndefined(iso('2024-06-15'));
    const r2 = parseIsoDateOrUndefined(iso('2024-06-15'));
    expect(r1).toBe(r2);
  });
});

// ─── isoDateToDate ─────────────────────────────────────────────────────────

describe('isoDateToDate', () => {
  it('gyldig ISO dato → returnerer Date', () => {
    const result = isoDateToDate(iso('2024-06-15'));
    expect(result).toBeInstanceOf(Date);
  });

  it('2024-06-15 → korrekt UTC dato', () => {
    const result = isoDateToDate(iso('2024-06-15'));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(5); // juni = 5
    expect(result.getUTCDate()).toBe(15);
  });

  it('2024-12-31 → korrekt', () => {
    const result = isoDateToDate(iso('2024-12-31'));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(11);
    expect(result.getUTCDate()).toBe(31);
  });

  it('2024-01-01 → korrekt', () => {
    const result = isoDateToDate(iso('2024-01-01'));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(0);
    expect(result.getUTCDate()).toBe(1);
  });

  it('2024-02-29 (skudår) → korrekt', () => {
    const result = isoDateToDate(iso('2024-02-29'));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(1); // februar = 1
    expect(result.getUTCDate()).toBe(29);
  });

  it('er deterministisk', () => {
    const d1 = isoDateToDate(iso('2024-06-15'));
    const d2 = isoDateToDate(iso('2024-06-15'));
    expect(d1.getTime()).toBe(d2.getTime());
  });

  it('DST-skift: 2024-03-31 (dansk sommertid) → korrekt UTC dato', () => {
    const result = isoDateToDate(iso('2024-03-31'));
    expect(result.getUTCFullYear()).toBe(2024);
    expect(result.getUTCMonth()).toBe(2); // marts = 2
    expect(result.getUTCDate()).toBe(31);
  });
});
