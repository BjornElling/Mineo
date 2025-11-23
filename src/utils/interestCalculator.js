/**
 * Renteberegningsmotor til procesrente med support for variable rentesatser.
 *
 * Håndterer:
 * - Referencesats-ændringer ved halvårsskift (1. januar og 1. juli)
 * - Tillægssats baseret på rentedato (7% før 1/3-2013, 8% derefter)
 * - Skudårsberegninger
 * - Halvårlige periodebaserede renteberegninger
 */

import { referenceRates } from '../data/interestRates';

/**
 * Konverterer dansk datoformat (dd-mm-åååå) til Date-objekt.
 *
 * @param {string} dateStr - Dato i format dd-mm-åååå
 * @returns {Date|null} Date-objekt eller null hvis ugyldig
 */
const parseDanishDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return null;
  }

  const [dayStr, monthStr, yearStr] = parts;
  if (dayStr.length < 1 || monthStr.length < 1 || yearStr.length !== 4) {
    return null;
  }

  const day = Number(dayStr);
  const month = Number(monthStr);
  const year = Number(yearStr);

  if (
    Number.isNaN(day) ||
    Number.isNaN(month) ||
    Number.isNaN(year) ||
    day < 1 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  date.setFullYear(year);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
};

/**
 * Beregner antal dage i et givet år (365 eller 366).
 *
 * @param {number} year - År at kontrollere
 * @returns {number} 366 for skudår, 365 for normale år
 */
const getDaysInYear = (year) => {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
};

/**
 * Beregner antal dage mellem to datoer (inklusiv begge dage)
 * Bruger UTC for at undgå timezone-problemer
 *
 * @param {Date} startDate - Startdato
 * @param {Date} endDate - Slutdato
 * @returns {number} Antal dage mellem datoerne (inklusiv begge)
 */
const getDaysBetween = (startDate, endDate) => {
  // Brug UTC-versioner af datoerne for at undgå sommertid/vintertid-problemer
  const startUtc = Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endUtc = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const oneDay = 1000 * 60 * 60 * 24;
  const diffDays = (endUtc - startUtc) / oneDay;

  // +1 fordi begge dage er inkluderet
  return diffDays + 1;
};

/**
 * Parser rentesats-string til numerisk værdi.
 *
 * @param {string} rateStr - Rentesats som "2,75 %" eller "−0,45 %"
 * @returns {number} Rentesats som nummer
 */
const parseRate = (rateStr) => {
  // Fjern % og mellemrum, konverter komma til punktum
  // Håndter både minus-tegn (−) og bindestreg (-)
  const cleaned = rateStr.replace(/[%\s]/g, '').replace(',', '.').replace('−', '-');
  return parseFloat(cleaned);
};

/**
 * Finder den gældende referencesats på en specifik dato.
 *
 * Bruger den seneste sats der ikke er efter måldatoen.
 *
 * @param {Date} targetDate - Dato at finde sats for
 * @returns {number} Den gældende referencesats
 * @throws {Error} Hvis ingen sats findes for datoen
 */
const findReferenceRateOnDate = (targetDate) => {
  // Konverter alle rentesatser til Date-objekter og sorter (ældste først)
  const ratesWithDates = referenceRates
    .map((entry) => ({
      date: parseDanishDate(entry.effectiveDate),
      rate: parseRate(entry.rate),
    }))
    .filter((entry) => entry.date !== null)
    .sort((a, b) => a.date - b.date);

  let applicableRate = null;

  for (const entry of ratesWithDates) {
    if (entry.date <= targetDate) {
      applicableRate = entry.rate;
    } else {
      break;
    }
  }

  if (applicableRate === null) {
    throw new Error(`Ingen referencesats fundet for dato ${targetDate.toLocaleDateString('da-DK')}`);
  }

  return applicableRate;
};

/**
 * Beregner tillægssats baseret på faktisk rentedato.
 *
 * Satsen er 7% før 1. marts 2013 og 8% fra denne dato.
 *
 * @param {Date} interestStartDate - Rentens startdato
 * @returns {number} Tillægssatsen (7.0 eller 8.0)
 */
const calculateSurchargeRate = (interestStartDate) => {
  const surchargeChangeDate = new Date(2013, 2, 1); // 1. marts 2013
  return interestStartDate < surchargeChangeDate ? 7.0 : 8.0;
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
const calculatePeriodInterest = (amount, rate, startDate, endDate) => {
  if (startDate > endDate) {
    return 0.0;
  }

  let totalInterest = 0.0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Find årets slutning eller periodens slutning (hvad der kommer først)
    const yearEnd = new Date(currentDate.getFullYear(), 11, 31);
    const periodEnd = endDate < yearEnd ? new Date(endDate) : new Date(yearEnd);

    // Beregn dage i denne del af perioden (inklusiv slutdato)
    const days = getDaysBetween(currentDate, periodEnd);

    // Beregn rente for dette år
    const daysInYear = getDaysInYear(currentDate.getFullYear());
    const yearInterest = (amount * rate / 100 * days) / daysInYear;

    totalInterest += yearInterest;

    // Flyt til næste år
    currentDate = new Date(currentDate.getFullYear() + 1, 0, 1);
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
export const calculateProcessInterest = (amount, interestStartDate, calculationDate) => {
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

  // Konverter beløb til nummer
  let amountNum;
  if (typeof amount === 'string') {
    // Fjern tusindtalsseparatorer og konverter komma til punktum
    const cleanAmount = amount.replace(/\./g, '').replace(',', '.');
    amountNum = parseFloat(cleanAmount);
  } else {
    amountNum = Number(amount);
  }

  if (Number.isNaN(amountNum) || amountNum <= 0) {
    return null;
  }

  // Beregn tillægssats baseret på faktisk rentedato (gælder for hele perioden)
  const surchargeRate = calculateSurchargeRate(startDate);

  // Generer halvårlige perioder og beregn rente
  let totalInterest = 0.0;
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Find næste halvårsskift (30. juni eller 31. december)
    let periodEnd;
    if (currentDate.getMonth() < 6) {
      // Første halvår: til 30. juni
      periodEnd = new Date(currentDate.getFullYear(), 5, 30);
    } else {
      // Andet halvår: til 31. december
      periodEnd = new Date(currentDate.getFullYear(), 11, 31);
    }

    // Begræns til beregningens slutdato
    if (periodEnd > endDate) {
      periodEnd = new Date(endDate);
    }

    if (currentDate <= periodEnd) {
      // Find referencesats ved periodens start
      const referenceRate = findReferenceRateOnDate(currentDate);
      const totalRate = referenceRate + surchargeRate;

      // Beregn rente for denne halvårlige periode
      const periodInterest = calculatePeriodInterest(amountNum, totalRate, currentDate, periodEnd);
      totalInterest += periodInterest;
    }

    // Flyt til næste halvårlige periode
    if (periodEnd.getMonth() === 5) {
      // Efter 30. juni -> start på 1. juli
      currentDate = new Date(periodEnd.getFullYear(), 6, 1);
    } else {
      // Efter 31. december -> start på 1. januar næste år
      currentDate = new Date(periodEnd.getFullYear() + 1, 0, 1);
    }

    if (currentDate > endDate) {
      break;
    }
  }

  // Afrund til 2 decimaler (bankiers afrunding)
  return Math.round(totalInterest * 100) / 100;
};

/**
 * Formaterer beløb til dansk format med tusindtalsseparator.
 *
 * @param {number} amount - Beløb at formatere
 * @returns {string} Formateret beløb, fx "1.234,56"
 */
export const formatAmount = (amount) => {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return '0,00';
  }

  return amount.toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
