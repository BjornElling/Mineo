/**
 * Renteberegningsmotor til procesrente med support for variable rentesatser.
 *
 * Håndterer:
 * - Referencesats-ændringer ved halvårsskift (1. januar og 1. juli)
 * - Tillægssats baseret på rentedato (7% før 1/3-2013, 8% derefter)
 * - Skudårsberegninger
 * - Halvårlige periodebaserede renteberegninger
 */

import type { RateEntry } from '../../data/interestRates';
import type { DanishDateString } from '../../types/branded';
import { createDate, getDaysInYear, parseDanishDate } from '../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../utils/utcDayMath';

type DatedRate = Readonly<{ date: Date; ratePct: number }>;

export type ProcessInterestPeriod = Readonly<{
  startDate: Date;
  endDate: Date;
  amount: number;
  referenceRatePct: number;
  surchargeRatePct: number;
  totalRatePct: number;
  days: number;
  interest: number;
}>;

export type ProcessInterestBreakdown = Readonly<{
  totalInterest: number;
  periods: ReadonlyArray<ProcessInterestPeriod>;
}>;

const normalizeRates = (rates: ReadonlyArray<RateEntry>): DatedRate[] => {
  return rates
    .map((entry) => ({
      date: parseDanishDate(entry.effectiveDate),
      ratePct: entry.ratePct,
    }))
    .filter((entry): entry is DatedRate => entry.date !== null && Number.isFinite(entry.ratePct))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
};

/**
 * Finder den gældende sats (procentpoint) på en specifik dato.
 */
const findRatePctOnDate = (rates: ReadonlyArray<DatedRate>, targetDate: Date): number | null => {
  let applicableRate: number | null = null;

  for (const entry of rates) {
    if (entry.date <= targetDate) {
      applicableRate = entry.ratePct;
    } else {
      break;
    }
  }

  return applicableRate;
};

/**
 * Finder tillægssats baseret på faktisk rentedato (data-driven).
 */
const calculateSurchargeRate = (rates: ReadonlyArray<DatedRate>, interestStartDate: Date): number | null => {
  return findRatePctOnDate(rates, interestStartDate);
};

export const findLatestReferenceRatePeriodEnd = (
  referenceRatesInput: ReadonlyArray<RateEntry>
): Date | null => {
  const referenceRatesSorted = normalizeRates(referenceRatesInput);
  const latestRate = referenceRatesSorted[referenceRatesSorted.length - 1];
  if (!latestRate) {
    return null;
  }

  return latestRate.date.getUTCMonth() < 6
    ? createDate(latestRate.date.getUTCFullYear(), 5, 30)
    : createDate(latestRate.date.getUTCFullYear(), 11, 31);
};

/**
 * Beregner rente for en periode med fast rentesats.
 *
 * Håndterer skudår korrekt ved at beregne rente pr. kalenderår.
 *
 * @param {number} amount - Hovedstol
 * @param {number} rate - Rentesats (procent)
 * @param {Date} startDate - Periodens startdato
 * @param {Date} endDate - Periodens slutdato (inklusiv)
 * @returns {number} Beregnet rentebeløb
 */
const calculatePeriodInterest = (amount: number, ratePct: number, startDate: Date, endDate: Date): number => {
  if (startDate > endDate) {
    return 0.0;
  }

  let totalInterest = 0.0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Find årets slutning eller periodens slutning (hvad der kommer først)
    const yearEnd = createDate(currentDate.getUTCFullYear(), 11, 31);
    const periodEnd = endDate < yearEnd ? new Date(endDate) : new Date(yearEnd);

    // Beregn dage i denne del af perioden (inklusiv slutdato)
    const days = countInclusiveUtcDays(currentDate, periodEnd);
    if (days === null) {
      return 0.0;
    }

    // Beregn rente for dette år
    const daysInYear = getDaysInYear(currentDate.getUTCFullYear());
    const yearInterest = (amount * ratePct / 100 * days) / daysInYear;

    totalInterest += yearInterest;

    // Flyt til næste år
    currentDate = createDate(currentDate.getUTCFullYear() + 1, 0, 1);
    if (currentDate > endDate) {
      break;
    }
  }

  return totalInterest;
};

/**
 * Beregner procesrente fra faktisk rentedato til beregningsdato (inklusiv).
 *
 * Beregningen opdeles i halvårlige perioder (1. jan - 30. jun, 1. jul - 31. dec)
 * hvor referencesatsen kan ændre sig ved periodens start.
 *
 * @param {string|number} amount - Beløb som string eller nummer
 * @param {string} interestStartDate - Startdato i format dd-mm-åååå
 * @param {string} calculationDate - Slutdato i format dd-mm-åååå
 * @returns {number|null} Samlet rentebeløb afrundet til 2 decimaler, eller null ved fejl
 */
export const calculateProcessInterestWithRates = (
  amount: number,
  interestStartDate: DanishDateString,
  calculationDate: DanishDateString,
  referenceRatesInput: ReadonlyArray<RateEntry>,
  surchargeRatesInput: ReadonlyArray<RateEntry>
): number | null => {
  const breakdown = calculateProcessInterestBreakdownWithRates(
    amount,
    interestStartDate,
    calculationDate,
    referenceRatesInput,
    surchargeRatesInput
  );

  return breakdown?.totalInterest ?? null;
};

export const calculateProcessInterestBreakdownWithRates = (
  amount: number,
  interestStartDate: DanishDateString,
  calculationDate: DanishDateString,
  referenceRatesInput: ReadonlyArray<RateEntry>,
  surchargeRatesInput: ReadonlyArray<RateEntry>
): ProcessInterestBreakdown | null => {
  const referenceRatesSorted = normalizeRates(referenceRatesInput);
  const surchargeRatesSorted = normalizeRates(surchargeRatesInput);
  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  if (!startDate || !endDate) {
    return null;
  }

  if (startDate > endDate) {
    return null;
  }

  const amountNum = amount;
  if (!Number.isFinite(amountNum)) {
    return null;
  }

  if (referenceRatesSorted.length === 0 || surchargeRatesSorted.length === 0) {
    return null;
  }

  const surchargeRate = calculateSurchargeRate(surchargeRatesSorted, startDate);
  if (surchargeRate === null) {
    return null;
  }

  let totalInterest = 0.0;
  const periods: ProcessInterestPeriod[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    let periodEnd;
    if (currentDate.getUTCMonth() < 6) {
      periodEnd = createDate(currentDate.getUTCFullYear(), 5, 30);
    } else {
      periodEnd = createDate(currentDate.getUTCFullYear(), 11, 31);
    }

    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    if (currentDate <= periodEnd) {
      const referenceRatePct = findRatePctOnDate(referenceRatesSorted, currentDate);
      if (referenceRatePct === null) {
        return null;
      }
      const totalRatePct = referenceRatePct + surchargeRate;
      const days = countInclusiveUtcDays(currentDate, periodEnd);
      if (days === null) {
        return null;
      }
      const periodInterest = calculatePeriodInterest(amountNum, totalRatePct, currentDate, periodEnd);
      totalInterest += periodInterest;
      periods.push({
        startDate: new Date(currentDate),
        endDate: new Date(periodEnd),
        amount: amountNum,
        referenceRatePct,
        surchargeRatePct: surchargeRate,
        totalRatePct,
        days,
        interest: periodInterest,
      });
    }

    if (periodEnd.getUTCMonth() === 5) {
      currentDate = createDate(periodEnd.getUTCFullYear(), 6, 1);
    } else {
      currentDate = createDate(periodEnd.getUTCFullYear() + 1, 0, 1);
    }

    if (currentDate > endDate) {
      break;
    }
  }

  return { totalInterest, periods };
};
