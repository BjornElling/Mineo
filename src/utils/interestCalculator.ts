/**
 * Renteberegningsmotor til procesrente med support for variable rentesatser.
 *
 * Håndterer:
 * - Referencesats-ændringer ved halvårsskift (1. januar og 1. juli)
 * - Tillægssats baseret på rentedato (7% før 1/3-2013, 8% derefter)
 * - Skudårsberegninger
 * - Halvårlige periodebaserede renteberegninger
 */

import type { RateEntry } from '../data/interestRates';
import { referenceRates, surchargeRates } from '../data/interestRates';
import type { DanishDateString } from '../types/branded';
import { createDate, parseDanishDate } from './dateUtils';
import { countInclusiveUtcDays } from './utcDayMath';

type DatedRate = Readonly<{ date: Date; ratePct: number }>;

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
 * Beregner antal dage i et givet år (365 eller 366).
 *
 * @param {number} year - r at kontrollere
 * @returns {number} 366 for skudår, 365 for normale år
 */
const getDaysInYear = (year: number): number => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
};

/**
 * Finder den gældende sats (procentpoint) på en specifik dato.
 */
const findRatePctOnDate = (rates: ReadonlyArray<DatedRate>, targetDate: Date): number => {
  let applicableRate: number | null = null;

  for (const entry of rates) {
    if (entry.date <= targetDate) {
      applicableRate = entry.ratePct;
    } else {
      break;
    }
  }

  if (applicableRate === null) {
    throw new Error(`Ingen sats fundet for dato ${targetDate.toLocaleDateString('da-DK')}`);
  }

  return applicableRate;
};

/**
 * Finder tillægssats baseret på faktisk rentedato (data-driven).
 */
const calculateSurchargeRate = (rates: ReadonlyArray<DatedRate>, interestStartDate: Date): number => {
  return findRatePctOnDate(rates, interestStartDate);
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
      throw new Error('calculatePeriodInterest expected endDate >= startDate');
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
  const referenceRatesSorted = normalizeRates(referenceRatesInput);
  const surchargeRatesSorted = normalizeRates(surchargeRatesInput);
  // Konverter datoer
  const startDate = parseDanishDate(interestStartDate);
  const endDate = parseDanishDate(calculationDate);

  // Valider datoer
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

  // Beregn tillægssats baseret på faktisk rentedato (gælder for hele perioden)
  const surchargeRate = calculateSurchargeRate(surchargeRatesSorted, startDate);

  // Generer halvårlige perioder og beregn rente
  let totalInterest = 0.0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Find næste halvårsskift (30. juni eller 31. december)
    let periodEnd;
    if (currentDate.getUTCMonth() < 6) {
      // Første halvår: til 30. juni
      periodEnd = createDate(currentDate.getUTCFullYear(), 5, 30);
    } else {
      // Andet halvår: til 31. december
      periodEnd = createDate(currentDate.getUTCFullYear(), 11, 31);
    }

    // Begræns til beregningens slutdato
    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    if (currentDate <= periodEnd) {
      // Find referencesats ved periodens start
      const referenceRatePct = findRatePctOnDate(referenceRatesSorted, currentDate);
      const totalRatePct = referenceRatePct + surchargeRate;

      // Beregn rente for denne halvårlige periode
      const periodInterest = calculatePeriodInterest(amountNum, totalRatePct, currentDate, periodEnd);
      totalInterest += periodInterest;
    }

    // Flyt til næste halvårlige periode
    if (periodEnd.getUTCMonth() === 5) {
      // Efter 30. juni -> start på 1. juli
      currentDate = createDate(periodEnd.getUTCFullYear(), 6, 1);
    } else {
      // Efter 31. december -> start på 1. januar næste år
      currentDate = createDate(periodEnd.getUTCFullYear() + 1, 0, 1);
    }

    if (currentDate > endDate) {
      break;
    }
  }

  return totalInterest;
};

// Legacy path - returns rounded result and should not be used in new engines.
export const calculateProcessInterest = (
  amount: number,
  interestStartDate: DanishDateString,
  calculationDate: DanishDateString
): number | null => {
  const raw = calculateProcessInterestWithRates(amount, interestStartDate, calculationDate, referenceRates, surchargeRates);
  if (raw === null) return null;
  return Math.round(raw * 100) / 100;
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator.
 *
 * @param {number} amount - Beløb at formatere
 * @returns {string} Formateret beløb, fx "1.234,56"
 */
export const formatAmount = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '0,00';
  }

  return amount.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
