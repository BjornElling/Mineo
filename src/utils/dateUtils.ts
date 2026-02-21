/**
 * Centraliserede dato-funktioner
 *
 * Alle funktioner arbejder med date-only som UTC-dage (ingen tid).
 * Brug denne fil til low-level helpers og UI-nær logik; nye domæneberegninger
 * skal primært bruge branded ISODateString og dedikerede domain-moduler.
 * VIGTIGT: Brug ALDRIG toISOString() eller new Date(isoString) direkte,
 * da disse kan forårsage timezone-shifts der ændrer datoen ±1 dag.
 */

import type { DateInterval } from '../types/calculation';
import type { DanishDateString, ISODateString } from '../types/branded';
import { toDanishDateString, toISODateString } from '../types/branded';
import { createDate as createUTCDate } from './datePrimitives';

/**
 * Opretter en Date-objekt med eksplicit år, måned og dag
 * Sikrer at året er korrekt sat (vigtigt for tværårs-beregninger)
 */
export const createDate = createUTCDate;

/**
 * Konverterer dansk datoformat (dd-mm-åååå) til Date-objekt
 */
export const parseDanishDate = (dateStr: DanishDateString | string): Date | null => {
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
    month > 12 ||
    year < 1900 ||
    year > 2100
  ) {
    return null;
  }

  const date = createDate(year, month - 1, day);

  // Valider at datoen er gyldig (fanger fx 31-02-2025)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }

  return date;
};

/**
 * Konverterer Date-objekt til dansk format (dd-mm-åååå)
 */
export const formatDanishDate = (date: Date): DanishDateString => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('Invalid Date passed to formatDanishDate.');
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return toDanishDateString(`${day}-${month}-${year}`);
};

/**
 * Konverterer Date-objekt til ISO format (åååå-mm-dd)
 * Manuel formatering for at undgå timezone-problemer
 */
export const formatToISO = (date: Date): ISODateString => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return toISODateString(`${year}-${month}-${day}`);
};

/**
 * Dags dato i lokal kalender (dd-mm-åååå) som ISODateString.
 *
 * VIGTIGT: "I dag" skal afspejle brugerens lokale kalenderdag,
 * ikke UTC-datoen (som kan være forskudt omkring midnat).
 */
export const getTodayLocalISO = (): ISODateString => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return toISODateString(`${year}-${month}-${day}`);
};

export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

export const getDaysInYear = (year: number): number => {
  return isLeapYear(year) ? 366 : 365;
};

/**
 * Tilføjer et antal dage til en dato
 */
export const addDays = (date: Date, days: number): Date => {
  // UTC-baseret date-only aritmetik (ingen lokal tidszone).
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};

/**
 * Tilføjer et antal måneder til en dato
 * Håndterer måned-overskridelse og forskellige måneders længder korrekt.
 * Semantik: Hvis dagen ikke findes i mål-måneden, clamps til sidste dag i måneden.
 */
export const addMonths = (date: Date, months: number): Date => {
  if (!months) {
    return new Date(date.getTime());
  }

  const day = date.getUTCDate();
  const targetMonth = date.getUTCMonth() + months;
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const result = createDate(targetYear, normalizedMonth, 1);
  const daysInTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, daysInTargetMonth));

  return result;
};

/**
 * Parser uge-streng (uu/åååå) til dato-interval (mandag til søndag)
 * Bruger ISO week date system
 */
export const parseWeekString = (weekStr: string): DateInterval | null => {
  if (!weekStr || typeof weekStr !== 'string') {
    return null;
  }

  const parts = weekStr.split('/');
  if (parts.length !== 2) {
    return null;
  }

  const week = parseInt(parts[0], 10);
  const year = parseInt(parts[1], 10);

  if (isNaN(week) || isNaN(year) || week < 1 || week > 53) {
    return null;
  }

  // Brug ISO week date system - find mandag i den angivne uge
  const jan4 = createDate(year, 0, 4);
  const jan4Day = jan4.getUTCDay() || 7; // Søndag = 7 i stedet for 0
  const weekOneMonday = new Date(jan4);
  weekOneMonday.setUTCDate(jan4.getUTCDate() - jan4Day + 1);

  const targetMonday = new Date(weekOneMonday);
  targetMonday.setUTCDate(weekOneMonday.getUTCDate() + (week - 1) * 7);

  const targetSunday = new Date(targetMonday);
  targetSunday.setUTCDate(targetMonday.getUTCDate() + 6);

  return { start: targetMonday, end: targetSunday };
};
