import type { ISODateString } from '../../types/branded';
import {
  formatIsoDateLong,
  formatUtcDateShort,
  formatUtcDateLong,
  formatISOToDanish,
  formatCopenhagenTimestampSeconds,
  formatCopenhagenISODate,
} from '../../utils/dateFormatting';

// ─── Helpers ──────────────────────────────────────────────────────────────

const iso = (s: string): ISODateString => s as ISODateString;

const utcDate = (y: number, m: number, d: number): Date => {
  return new Date(Date.UTC(y, m - 1, d));
};

// ─── formatISOToDanish ─────────────────────────────────────────────────────
// formatISOToDanish returnerer dansk numerisk format: dd-mm-yyyy

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

  it('undefined → tom streng', () => {
    expect(formatISOToDanish(undefined)).toBe('');
  });

  it('er deterministisk', () => {
    const r1 = formatISOToDanish(iso('2024-06-15'));
    const r2 = formatISOToDanish(iso('2024-06-15'));
    expect(r1).toBe(r2);
  });
});

// ─── formatCopenhagenTimestampSeconds ──────────────────────────────────────
// Fejlrapportens tidsstempler SKAL vises i dansk tidszone (Europe/Copenhagen),
// ikke UTC. Testene fikserer et kendt UTC-instant og verificerer det danske
// vægur – uafhængigt af maskinens egen tidszone.

describe('formatCopenhagenTimestampSeconds', () => {
  it('sommertid (CEST = UTC+2): 12:00Z → 14:00 dansk', () => {
    const instant = new Date('2026-06-10T12:00:00Z');
    expect(formatCopenhagenTimestampSeconds(instant)).toBe('2026-06-10 14:00:00');
  });

  it('vintertid (CET = UTC+1): 12:00Z → 13:00 dansk', () => {
    const instant = new Date('2026-01-15T12:00:00Z');
    expect(formatCopenhagenTimestampSeconds(instant)).toBe('2026-01-15 13:00:00');
  });

  it('midnat dansk tid vises som 00:00:00 (ikke 24)', () => {
    // 22:00Z i sommertid = 00:00 næste dag i dansk tid.
    const instant = new Date('2026-06-09T22:00:00Z');
    expect(formatCopenhagenTimestampSeconds(instant)).toBe('2026-06-10 00:00:00');
  });

  it('UTC-dag og dansk dag kan afvige nær midnat', () => {
    // 23:30Z = 01:30 næste dag i dansk sommertid → dato ruller frem.
    const instant = new Date('2026-06-09T23:30:00Z');
    expect(formatCopenhagenTimestampSeconds(instant)).toBe('2026-06-10 01:30:00');
  });

  it('kaster på ugyldig Date', () => {
    expect(() => formatCopenhagenTimestampSeconds(new Date('ugyldig'))).toThrow();
  });
});

// ─── formatCopenhagenISODate ───────────────────────────────────────────────

describe('formatCopenhagenISODate', () => {
  it('returnerer dansk kalenderdag (ikke UTC-dag) nær midnat', () => {
    // 23:30Z 9. juni = 10. juni i dansk sommertid.
    const instant = new Date('2026-06-09T23:30:00Z');
    expect(formatCopenhagenISODate(instant)).toBe('2026-06-10');
  });

  it('vintertid: 23:30Z 15. jan = 16. jan dansk', () => {
    const instant = new Date('2026-01-15T23:30:00Z');
    expect(formatCopenhagenISODate(instant)).toBe('2026-01-16');
  });

  it('kaster på ugyldig Date', () => {
    expect(() => formatCopenhagenISODate(new Date('ugyldig'))).toThrow();
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
// formatUtcDateShort delegerer til formatISOToDanish → dansk numerisk format

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
