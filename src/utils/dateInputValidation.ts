/**
 * Dato-input validering
 *
 * Funktioner til format-validering og inputnær interval-tjek.
 */

import { danishToISO, isISODateString } from '../types/branded';
import { getTodayLocalISO, isLeapYear } from './dateUtils';
import type { ISODateString } from '../types/branded';
import { validateISODateRange } from './isoDateHelpers';

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
    return 2000 + yearNum;
  } else if (yearStr.length === 2) {
    const year20xx = 2000 + yearNum;
    const year19xx = 1900 + yearNum;

    if (year20xx > currentYear + 5) {
      return year19xx;
    }
    return year20xx;
  } else if (yearStr.length === 3) {
    return null;
  } else if (yearStr.length === 4) {
    return yearNum;
  }

  return null;
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
  if (!dateStr || dateStr.length < 10) return true;

  const isoDate = danishToISO(dateStr);
  if (!isoDate) return true;

  const normalizedMin = isISODateString(minDate) ? (minDate as ISODateString) : undefined;
  const normalizedMax = isISODateString(maxDate) ? (maxDate as ISODateString) : undefined;

  const result = validateISODateRange(isoDate, normalizedMin, normalizedMax);
  return result.isValid ? true : result.errorMessage;
};
