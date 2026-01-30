import type { RateEntry } from '../../data/interestRates';
import { referenceRates, surchargeRates } from '../../data/interestRates';
import { parseDanishDate } from '../dateUtils';
import { countInclusiveUtcDays } from '../utcDayMath';
import { toDanishDateString } from '../../types/branded';
import { calculateProcessInterest } from '../interestCalculator';

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
  const daysInYear = startDate.getFullYear() % 4 === 0 ? 366 : 365;
  const interest = (amount * totalRate / 100 * days) / daysInYear;
  return Math.round(interest * 100) / 100;
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
