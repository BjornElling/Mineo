/**
 * Dato-validering
 *
 * Funktioner til validering af datoer, format-kontrol og interval-tjek
 */

import { danishToISO, isISODateString, isoToDanish } from '../types/branded';
import { createDate, getTodayLocalISO } from './dateUtils';
import type { ISODateString } from '../types/branded';

/**
 * Tjekker om et år er skudår
 *
 * @param {number} year - Året der skal tjekkes
 * @returns {boolean} True hvis skudår
 */
export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

/**
 * Validerer om en dato er gyldig (eksisterer i kalenderen)
 *
 * @param {number} day - Dag (1-31)
 * @param {number} month - Måned (1-12)
 * @param {number} year - År
 * @returns {boolean} True hvis datoen er gyldig
 */
export const isValidDate = (day: number, month: number, year: number): boolean => {
  if (day < 1 || day > 31) return false;
  if (month < 1 || month > 12) return false;

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (day > daysInMonth[month - 1]) return false;

  return true;
};

/**
 * Intelligent år-fortolkning for 1-4 cifre
 *
 * @param {string} yearStr - År-streng (1-4 cifre)
 * @returns {number|null} Fortolket år eller null hvis ugyldigt
 */
export const interpretYear = (yearStr: string): number | null => {
  const currentYear = Number(getTodayLocalISO().slice(0, 4));
  const yearNum = parseInt(yearStr, 10);

  if (yearStr.length === 1) {
    // 1 ciffer -> 200x
    return 2000 + yearNum;
  } else if (yearStr.length === 2) {
    // 2 cifre -> intelligent fortolkning
    const year20xx = 2000 + yearNum;
    const year19xx = 1900 + yearNum;

    if (year20xx > currentYear + 5) {
      return year19xx;
    }
    return year20xx;
  } else if (yearStr.length === 3) {
    // 3 cifre -> fejl
    return null;
  } else if (yearStr.length === 4) {
    // 4 cifre -> brug som de er
    return yearNum;
  }

  return null;
};

/**
 * Parser ISO-dato (åååå-mm-dd) til Date-objekt
 *
 * @param {string} isoDate - ISO-formateret dato
 * @returns {Date|null} Date-objekt eller null hvis ugyldig
 */
export const parseISODate = (isoDate: string): Date | null => {
  if (!isoDate) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = createDate(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
};

/**
 * Formaterer ISO-dato til dansk format
 *
 * @param {string} isoDate - ISO-formateret dato (åååå-mm-dd)
 * @returns {string} Dansk formateret dato (dd-mm-åååå)
 */
export const formatISOToDanish = (isoDate: string): string => {
  const danish = isoToDanish(isISODateString(isoDate) ? (isoDate as ISODateString) : undefined);
  return danish ?? '';
};

/**
 * Tjekker om dato-format er gyldigt (ikke om datoen eksisterer i interval)
 *
 * @param {string} day - Dag-streng
 * @param {string} month - Måned-streng
 * @param {string} year - År-streng
 * @returns {boolean} True hvis formatet er gyldigt
 */
export const isDateFormatValid = (day: string, month: string, year: string): boolean => {
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(month, 10);

  // Grundlæggende validering af dag og måned
  if (dayNum < 1 || dayNum > 31) return false;
  if (monthNum < 1 || monthNum > 12) return false;

  // Hvis vi har et år, tjek med det specifikke år
  if (year && year.length === 4) {
    const yearNum = parseInt(year, 10);
    return isValidDate(dayNum, monthNum, yearNum);
  }

  // Ellers tjek med et skudår for at tillade maksimale dage
  return isValidDate(dayNum, monthNum, 2024);
};

/**
 * Validerer om dato er inden for et interval
 *
 * Denne funktion kaldes KUN på komplette, sanerede datoer (dd-mm-åååå)
 * fra StyledDateField's handleBlur, så der er ingen behov for at tjekke
 * om datoen er under indtastning.
 *
 * @param {string} dateStr - Dato i dansk format (dd-mm-åååå)
 * @param {string} minDate - Min-dato i ISO-format (åååå-mm-dd)
 * @param {string} maxDate - Max-dato i ISO-format (åååå-mm-dd)
 * @returns {true|string} True hvis OK, ellers fejlbesked
 */
export const validateDateRange = (dateStr: string, minDate: string, maxDate: string): true | string => {
  if (!dateStr || dateStr.length < 10) return true; // Tom eller ugyldig dato

  const isoDate = danishToISO(dateStr);
  if (!isoDate) return true;

  const normalizedMin = isISODateString(minDate) ? (minDate as ISODateString) : undefined;
  const normalizedMax = isISODateString(maxDate) ? (maxDate as ISODateString) : undefined;

  const result = validateISODateRange(isoDate, normalizedMin, normalizedMax);
  return result.isValid ? true : result.errorMessage;
};

/**
 * Validerer en dato-streng (format og interval)
 *
 * @param {string} dateStr - Dato i dansk format (dd-mm-åååå)
 * @param {string} minDate - Min-dato i ISO-format (åååå-mm-dd)
 * @param {string} maxDate - Max-dato i ISO-format (åååå-mm-dd)
 * @returns {Object} { isValid: boolean, errorMessage: string }
 */
export const validateDate = (dateStr: string, minDate: string, maxDate: string): { isValid: boolean; errorMessage: string } => {
  const parts = dateStr.split('-');
  const day = parts[0] || '';
  const month = parts[1] || '';
  const year = parts[2] || '';

  // Tjek format hvis dag og måned er indtastet
  if (day.length === 2 && month.length === 2) {
    if (!isDateFormatValid(day, month, year)) {
      return { isValid: false, errorMessage: 'Ugyldig dato' };
    }
  } else if (day.length === 2) {
    // Tjek kun dag
    const dayNum = parseInt(day, 10);
    if (dayNum < 1 || dayNum > 31) {
      return { isValid: false, errorMessage: 'Ugyldig dato' };
    }
  } else if (month.length === 2) {
    // Tjek kun måned
    const monthNum = parseInt(month, 10);
    if (monthNum < 1 || monthNum > 12) {
      return { isValid: false, errorMessage: 'Ugyldig dato' };
    }
  }

  // Tjek interval hvis komplet dato (dd-mm-åååå)
  if (year.length === 4 && day.length === 2 && month.length === 2) {
    const rangeError = validateDateRange(dateStr, minDate, maxDate);
    if (rangeError !== true) {
      return { isValid: false, errorMessage: rangeError };
    }
  }

  // Hvis vi kom hertil uden fejl, er datoen gyldig
  return { isValid: true, errorMessage: '' };
};

/**
 * Validerer ISO-dato mod ISO min/max bounds
 *
 * VIGTIGT: Lexicografisk sammenligning er korrekt for ISO (yyyy-mm-dd).
 * Kontrakt: Funktionen skal være ren/pure (ingen sideeffekter).
 *
 * @param {string} isoDate - ISO-format (yyyy-mm-dd)
 * @param {string|undefined} minDate - ISO min bound
 * @param {string|undefined} maxDate - ISO max bound
 * @returns {Object} { isValid: boolean, errorMessage: string }
 */
export const validateISODateRange = (
  isoDate: string,
  minDate: string | undefined,
  maxDate: string | undefined
): { isValid: boolean; errorMessage: string } => {
  if (!isISODateString(isoDate)) {
    return { isValid: false, errorMessage: 'Ugyldig dato' };
  }

  const normalizedMin = isISODateString(minDate) ? (minDate as ISODateString) : undefined;
  const normalizedMax = isISODateString(maxDate) ? (maxDate as ISODateString) : undefined;

  if (normalizedMin && normalizedMax && (isoDate < normalizedMin || isoDate > normalizedMax)) {
    return {
      isValid: false,
      errorMessage: `Dato skal være mellem ${formatISOToDanish(normalizedMin)} og ${formatISOToDanish(normalizedMax)}`,
    };
  }

  if (normalizedMin && isoDate < normalizedMin) {
    return { isValid: false, errorMessage: `Dato skal være efter ${formatISOToDanish(normalizedMin)}` };
  }

  if (normalizedMax && isoDate > normalizedMax) {
    return { isValid: false, errorMessage: `Dato skal være før ${formatISOToDanish(normalizedMax)}` };
  }

  return { isValid: true, errorMessage: '' };
};
