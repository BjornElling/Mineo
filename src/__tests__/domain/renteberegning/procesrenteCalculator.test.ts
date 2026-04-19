import type { RateEntry } from '../../../data/interestRates';
import { toDanishDateString } from '../../../types/branded';
import { calculateProcessInterestWithRates } from '../../../domain/renteberegning/procesrenteCalculator';
import { getDaysInYear, parseDanishDate } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';

// ─── calculateProcessInterestWithRates — null-paths og edge cases ────────────

const buildMinimalRates = (): { ref: RateEntry[]; sur: RateEntry[] } => ({
  ref: [{ effectiveDate: toDanishDateString('01-01-2010'), ratePct: 2 }],
  sur: [{ effectiveDate: toDanishDateString('01-01-2010'), ratePct: 8 }],
});

const buildExpectedInterest = (amount: number, start: string, end: string, ratePct: number): number => {
  const startDate = parseDanishDate(start);
  const endDate = parseDanishDate(end);
  if (!startDate || !endDate) {
    throw new Error('Invalid test dates');
  }
  const days = countInclusiveUtcDays(startDate, endDate);
  if (days === null) {
    throw new Error('Invalid date order');
  }

  return (amount * ratePct / 100 * days) / getDaysInYear(startDate.getUTCFullYear());
};

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
    expect(result).toBe(buildExpectedInterest(10000, '15-06-2024', '15-06-2024', 10));
  });

  it('multi-år periode krydser halvårsskift og årsgrænse', () => {
    const { ref, sur } = buildMinimalRates();
    const result = calculateProcessInterestWithRates(
      100000,
      toDanishDateString('01-01-2023'),
      toDanishDateString('31-12-2024'),
      ref,
      sur
    );
    const expected2023 = buildExpectedInterest(100000, '01-01-2023', '31-12-2023', 10);
    const expected2024 = buildExpectedInterest(100000, '01-01-2024', '31-12-2024', 10);
    expect(result).toBe(expected2023 + expected2024);
  });
});
