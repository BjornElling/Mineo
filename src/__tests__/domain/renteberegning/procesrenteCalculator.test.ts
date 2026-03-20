import type { RateEntry } from '../../../data/interestRates';
import { referenceRates, surchargeRates } from '../../../data/interestRates';
import { parseDanishDate } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { toDanishDateString } from '../../../types/branded';
import { calculateProcessInterest, calculateProcessInterestWithRates } from '../../../domain/renteberegning/procesrenteCalculator';
import { roundByMethod } from '../../../utils/rounding';

const sortRates = (rates: ReadonlyArray<RateEntry>): RateEntry[] => {
  return [...rates].sort((a, b) => {
    const aDate = parseDanishDate(a.effectiveDate);
    const bDate = parseDanishDate(b.effectiveDate);
    if (!aDate || !bDate) return 0;
    return aDate.getTime() - bDate.getTime();
  });
};

const findRatePctOnDate = (rates: ReadonlyArray<RateEntry>, targetDate: Date): number => {
  let applicableRate: number | null = null;
  for (const entry of sortRates(rates)) {
    const entryDate = parseDanishDate(entry.effectiveDate);
    if (!entryDate) continue;
    if (entryDate <= targetDate) {
      applicableRate = entry.ratePct;
    } else {
      break;
    }
  }
  if (applicableRate === null) {
    throw new Error('No rate found for test date');
  }
  return applicableRate;
};

const buildExpectedInterest = (amount: number, start: string, end: string): number => {
  const startDate = parseDanishDate(start);
  const endDate = parseDanishDate(end);
  if (!startDate || !endDate) {
    throw new Error('Invalid test dates');
  }

  const days = countInclusiveUtcDays(startDate, endDate);
  if (days === null) {
    throw new Error('Invalid date order');
  }

  const referenceRate = findRatePctOnDate(referenceRates, startDate);
  const surchargeRate = findRatePctOnDate(surchargeRates, startDate);
  const totalRate = referenceRate + surchargeRate;
  const daysInYear = startDate.getUTCFullYear() % 4 === 0 ? 366 : 365;
  const interest = (amount * totalRate / 100 * days) / daysInYear;
  return roundByMethod(interest, 2, 'halfAwayFromZero');
};

describe('calculateProcessInterest', () => {
  it('is DST-neutral across DST start', () => {
    const amount = 100000;
    const start = toDanishDateString('30-03-2024');
    const end = toDanishDateString('02-04-2024');
    const expected = buildExpectedInterest(amount, start, end);
    expect(calculateProcessInterest(amount, start, end)).toBe(expected);
  });

  it('is DST-neutral across DST end', () => {
    const amount = 100000;
    const start = toDanishDateString('26-10-2024');
    const end = toDanishDateString('28-10-2024');
    const expected = buildExpectedInterest(amount, start, end);
    expect(calculateProcessInterest(amount, start, end)).toBe(expected);
  });
});

// ─── calculateProcessInterestWithRates — null-paths og edge cases ────────────

const buildMinimalRates = (): { ref: RateEntry[]; sur: RateEntry[] } => ({
  ref: [{ effectiveDate: toDanishDateString('01-01-2010'), ratePct: 2 }],
  sur: [{ effectiveDate: toDanishDateString('01-01-2010'), ratePct: 8 }],
});

// Omgå branded-type-validering for null-path tests — parseDanishDate tager 'DanishDateString | string'
// men calculateProcessInterestWithRates tager DanishDateString; vi caster til at teste null-paths.
const badDate = 'not-a-date' as unknown as Parameters<typeof calculateProcessInterestWithRates>[0];

describe('calculateProcessInterestWithRates — null-paths', () => {
  it('ugyldig startdato (ikke-parseable) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      badDate,
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('ugyldig slutdato (ikke-parseable) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toDanishDateString('01-01-2024'),
      badDate,
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('startDate > endDate → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      1000,
      toDanishDateString('31-12-2024'),
      toDanishDateString('01-01-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('non-finite beløb (Infinity) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      Number.POSITIVE_INFINITY,
      toDanishDateString('01-01-2024'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('non-finite beløb (NaN) → null', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      Number.NaN,
      toDanishDateString('01-01-2024'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).toBeNull();
  });

  it('startDate === endDate → ikke null (én dags rente)', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      10000,
      toDanishDateString('15-06-2024'),
      toDanishDateString('15-06-2024'),
      ref,
      sur
    );
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });

  it('multi-år periode krydser halvårsskift og årsgrænse', () => {
    const { ref, sur } = buildMinimalRates();
    // Jan 2023 → Dec 2024: krydser 1 juli, 1 jan og 1 juli
    const result = calculateProcessInterestWithRates(
      100000,
      toDanishDateString('01-01-2023'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    expect(result).not.toBeNull();
    expect(result).toBeGreaterThan(0);
  });
});

describe('calculateProcessInterest — legacy wrapper', () => {
  it('returnerer afrundet tal (ikke null) for gyldige inputs', () => {
    const result = calculateProcessInterest(
      50000,
      toDanishDateString('01-06-2024'),
      toDanishDateString('30-06-2024')
    );
    expect(result).not.toBeNull();
    expect(typeof result).toBe('number');
    expect(Number.isFinite(result!)).toBe(true);
    // Resultat skal matche calculateProcessInterestWithRates med produktion-satser
    const raw = calculateProcessInterestWithRates(
      50000,
      toDanishDateString('01-06-2024'),
      toDanishDateString('30-06-2024'),
      referenceRates,
      surchargeRates
    );
    expect(result).toBe(roundByMethod(raw ?? 0, 2, 'halfAwayFromZero'));
  });

  it('ugyldig dato (ikke-parseable) → null', () => {
    const result = calculateProcessInterest(
      1000,
      badDate,
      toDanishDateString('31-12-2024')
    );
    expect(result).toBeNull();
  });
});
