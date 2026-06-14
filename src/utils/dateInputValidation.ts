/**
 * Dato-input validering
 *
 * Funktioner til format-validering og inputnær interval-tjek.
 */

import { getTodayLocalISO, isLeapYear } from './dateUtils';

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
  // Fail-closed: ikke-numerisk input (fx "ab") giver NaN fra parseInt; uden denne
  // guard ville 2000+NaN/1900+NaN returnere NaN og dermed bryde number|null-kontrakten.
  if (!Number.isFinite(yearNum)) return null;

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
