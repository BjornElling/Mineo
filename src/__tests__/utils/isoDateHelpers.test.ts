import type { ISODateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';
import {
  validateIsoRange,
  minISO,
  maxISO,
  endOfYearIso,
  getDayAfterIso,
  getDayBeforeIso,
  iterateDatesInclusive,
  iterateIsoDatesInclusive,
  collectIsoDatesInclusive,
  buildIsoDateSetInclusive,
  isoYear,
  parseOptionalIsoDate,
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
    expect(result?.fra).toBe(toISODateString('2024-01-01'));
    expect(result?.til).toBe(toISODateString('2024-12-31'));
  });

  it('fra = til → returnerer IsoRange', () => {
    const result = validateIsoRange(iso('2024-06-15'), iso('2024-06-15'));
    expect(result).not.toBeUndefined();
    expect(result?.fra).toBe(toISODateString('2024-06-15'));
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
    expect(minISO(iso('2024-01-01'), iso('2024-06-15'))).toBe(toISODateString('2024-01-01'));
  });

  it('to datoer: anden er mindst', () => {
    expect(minISO(iso('2024-12-31'), iso('2024-01-01'))).toBe(toISODateString('2024-01-01'));
  });

  it('ens datoer → returnerer en af dem', () => {
    expect(minISO(iso('2024-06-15'), iso('2024-06-15'))).toBe(toISODateString('2024-06-15'));
  });

  it('første undefined → returnerer anden', () => {
    expect(minISO(undefined, iso('2024-06-15'))).toBe(toISODateString('2024-06-15'));
  });

  it('anden undefined → returnerer første', () => {
    expect(minISO(iso('2024-06-15'), undefined)).toBe(toISODateString('2024-06-15'));
  });

  it('begge undefined → undefined', () => {
    expect(minISO(undefined, undefined)).toBeUndefined();
  });

  it('år-grænse: 2023 < 2024', () => {
    expect(minISO(iso('2023-12-31'), iso('2024-01-01'))).toBe(toISODateString('2023-12-31'));
  });
});

// ─── maxISO ───────────────────────────────────────────────────────────────

describe('maxISO', () => {
  it('to datoer → returnerer den største', () => {
    expect(maxISO(iso('2024-01-01'), iso('2024-06-15'))).toBe(toISODateString('2024-06-15'));
  });

  it('to datoer: første er størst', () => {
    expect(maxISO(iso('2024-12-31'), iso('2024-01-01'))).toBe(toISODateString('2024-12-31'));
  });

  it('ens datoer → returnerer en af dem', () => {
    expect(maxISO(iso('2024-06-15'), iso('2024-06-15'))).toBe(toISODateString('2024-06-15'));
  });

  it('første undefined → returnerer anden', () => {
    expect(maxISO(undefined, iso('2024-06-15'))).toBe(toISODateString('2024-06-15'));
  });

  it('anden undefined → returnerer første', () => {
    expect(maxISO(iso('2024-06-15'), undefined)).toBe(toISODateString('2024-06-15'));
  });

  it('begge undefined → undefined', () => {
    expect(maxISO(undefined, undefined)).toBeUndefined();
  });

  it('år-grænse: 2024 > 2023', () => {
    expect(maxISO(iso('2023-12-31'), iso('2024-01-01'))).toBe(toISODateString('2024-01-01'));
  });
});

describe('isoYear', () => {
  it('returnerer årstallet fra en valideret ISO-dato', () => {
    expect(isoYear(iso('2024-02-29'))).toBe(2024);
  });
});

describe('endOfYearIso', () => {
  it('returnerer årets sidste ISO-dag', () => {
    expect(endOfYearIso(2024)).toBe(toISODateString('2024-12-31'));
  });
});

describe('getDayBeforeIso', () => {
  it('håndterer månedsskift', () => {
    expect(getDayBeforeIso(iso('2025-03-01'))).toBe(toISODateString('2025-02-28'));
  });

  it('håndterer skudårsdag', () => {
    expect(getDayBeforeIso(iso('2024-03-01'))).toBe(toISODateString('2024-02-29'));
  });

  it('håndterer årsskifte', () => {
    expect(getDayBeforeIso(iso('2025-01-01'))).toBe(toISODateString('2024-12-31'));
  });

  it('undefined → undefined', () => {
    expect(getDayBeforeIso(undefined)).toBeUndefined();
  });
});

describe('getDayAfterIso', () => {
  it('håndterer månedsskift', () => {
    expect(getDayAfterIso(iso('2024-02-29'))).toBe(toISODateString('2024-03-01'));
  });

  it('håndterer årsskifte', () => {
    expect(getDayAfterIso(iso('2024-12-31'))).toBe(toISODateString('2025-01-01'));
  });
});

describe('parseOptionalIsoDate', () => {
  it('trimmer og validerer ISO-datoer', () => {
    expect(parseOptionalIsoDate('  2024-01-15  ')).toBe(toISODateString('2024-01-15'));
  });

  it('afviser ugyldige og ikke-strenge værdier', () => {
    expect(parseOptionalIsoDate('15-01-2024')).toBeUndefined();
    expect(parseOptionalIsoDate('2024-02-30')).toBeUndefined();
    expect(parseOptionalIsoDate(undefined)).toBeUndefined();
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

  it('callback kan stoppe iterationen tidligt med false', () => {
    const dates: number[] = [];
    iterateDatesInclusive(utcDate(2024, 6, 1), utcDate(2024, 6, 10), (d) => {
      dates.push(d.getUTCDate());
      return dates.length < 3;
    });
    expect(dates).toEqual([1, 2, 3]);
  });

  it('nytårsskift: 2023-12-30 til 2024-01-02 → 4 callbacks', () => {
    let count = 0;
    iterateDatesInclusive(utcDate(2023, 12, 30), utcDate(2024, 1, 2), () => count++);
    expect(count).toBe(4);
  });
});

describe('iterateIsoDatesInclusive', () => {
  it('itererer ISO-strenge inklusiv–inklusiv', () => {
    const result: ISODateString[] = [];
    iterateIsoDatesInclusive(iso('2024-01-30'), iso('2024-02-02'), (d) => result.push(d));
    expect(result).toEqual([
      iso('2024-01-30'),
      iso('2024-01-31'),
      iso('2024-02-01'),
      iso('2024-02-02'),
    ]);
  });

  it('enkelt dag → 1 ISO', () => {
    const result: ISODateString[] = [];
    iterateIsoDatesInclusive(iso('2024-06-15'), iso('2024-06-15'), (d) => result.push(d));
    expect(result).toEqual([iso('2024-06-15')]);
  });

  it('fra > til → ingen iterationer (fail-closed)', () => {
    let count = 0;
    iterateIsoDatesInclusive(iso('2024-06-15'), iso('2024-06-14'), () => count++);
    expect(count).toBe(0);
  });
});

describe('collectIsoDatesInclusive', () => {
  it('bygger kronologisk array af alle dage', () => {
    expect(collectIsoDatesInclusive(iso('2024-02-28'), iso('2024-03-01'))).toEqual([
      iso('2024-02-28'),
      iso('2024-02-29'),
      iso('2024-03-01'),
    ]);
  });

  it('fra > til → tomt array', () => {
    expect(collectIsoDatesInclusive(iso('2024-03-01'), iso('2024-02-28'))).toEqual([]);
  });

  it('antal elementer = inklusiv dag-tælling for et helt år (skudår)', () => {
    expect(collectIsoDatesInclusive(iso('2024-01-01'), iso('2024-12-31'))).toHaveLength(366);
  });
});

describe('buildIsoDateSetInclusive', () => {
  it('bygger Set med alle dage', () => {
    const set = buildIsoDateSetInclusive(iso('2024-01-01'), iso('2024-01-03'));
    expect(set.size).toBe(3);
    expect(set.has(iso('2024-01-02'))).toBe(true);
  });

  it('fra > til → tomt Set', () => {
    expect(buildIsoDateSetInclusive(iso('2024-01-03'), iso('2024-01-01')).size).toBe(0);
  });

  it('collect og buildSet er konsistente (samme dage)', () => {
    const arr = collectIsoDatesInclusive(iso('2023-12-30'), iso('2024-01-02'));
    const set = buildIsoDateSetInclusive(iso('2023-12-30'), iso('2024-01-02'));
    expect(new Set(arr)).toEqual(set);
  });
});

// ─── validateISODateRange ──────────────────────────────────────────────────
// validateISODateRange returnerer { isValid: boolean; errorMessage: string }

describe('validateISODateRange', () => {
  it('dato indenfor range → isValid = true', () => {
    const result = validateISODateRange(toISODateString('2024-06-15'), toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result.isValid).toBe(true);
    expect(result.errorMessage).toBe('');
  });

  it('dato = minDate → isValid = true', () => {
    const result = validateISODateRange(toISODateString('2024-01-01'), toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result.isValid).toBe(true);
  });

  it('dato = maxDate → isValid = true', () => {
    const result = validateISODateRange(toISODateString('2024-12-31'), toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result.isValid).toBe(true);
  });

  it('dato < minDate → isValid = false med fejlbesked', () => {
    const result = validateISODateRange(toISODateString('2023-12-31'), toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('dato > maxDate → isValid = false med fejlbesked', () => {
    const result = validateISODateRange(toISODateString('2025-01-01'), toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toBeTruthy();
  });

  it('ikke-ISO dato → isValid = false', () => {
    const result = validateISODateRange('01-01-2024', toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    expect(result.isValid).toBe(false);
  });

  it('fejlbesked indeholder den formaterede dato', () => {
    const result = validateISODateRange(toISODateString('2023-12-31'), toISODateString('2024-01-01'), toISODateString('2024-12-31'));
    // Fejlbesked skal indeholde datoer i dansk format
    expect(result.errorMessage).toContain('01-01-2024');
  });
});
