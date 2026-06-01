import type { ISODateString } from '../../../types/branded';
import { isoDateToDate } from '../../../domain/dates/isoDate';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

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
