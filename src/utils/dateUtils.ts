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
import { createDate, parseDanishDate, toISODateString } from '../types/branded';

import { formatCopenhagenISODate, formatDanishDate } from './dateFormatting';

export { createDate } from '../types/branded';
export { parseDanishDate } from '../types/branded';
export { formatDanishDate, formatToISO } from './dateFormatting';

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

/**
 * Dags dato i dansk tidszone (Europe/Copenhagen) som ISODateString.
 *
 * Bruges af fejlrapport-flowet (filnavne, email-emne), så datoen altid
 * afspejler den danske kalenderdag — uafhængigt af brugerens maskine-tidszone
 * og konsistent med rapportens danske tidsstempler.
 */
export const getTodayCopenhagenISO = (): ISODateString => {
  return formatCopenhagenISODate(new Date());
};

export const isLeapYear = (year: number): boolean => {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

export const getDaysInYear = (year: number): number => {
  return isLeapYear(year) ? 366 : 365;
};

/**
 * Returnerer om et ISO-år indeholder uge 53.
 *
 * ISO-år har 53 uger når 31. december falder på en torsdag,
 * eller når det er skudår og 31. december falder på en fredag.
 */
export const yearHas53Weeks = (year: number): boolean => {
  const dec31 = createDate(year, 11, 31);
  const dayOfWeek = dec31.getUTCDay();
  return dayOfWeek === 4 || (isLeapYear(year) && dayOfWeek === 5);
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

export const calculateUtcAgeInWholeYears = (birthDate: Date, referenceDate: Date): number | undefined => {
  if (!(birthDate instanceof Date) || !(referenceDate instanceof Date)) return undefined;
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(referenceDate.getTime())) return undefined;

  let age = referenceDate.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    referenceDate.getUTCMonth() < birthDate.getUTCMonth() ||
    (referenceDate.getUTCMonth() === birthDate.getUTCMonth() &&
      referenceDate.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
};

/**
 * Returnerer sidste dato i en periode der starter på `startDate` og varer `months` måneder.
 * Eksempel: 01-01 + 6 måneder -> 30-06 (inklusive slutdato).
 */
export const getInclusivePeriodEndByMonths = (startDate: Date, months: number): Date => {
  return addDays(addMonths(startDate, months), -1);
};

/**
 * Kanonisk helper for reguleringsdato-intervallernes `tilDato`:
 * "nyeste regulerings-startdato + N måneder − 1 dag", som dansk dato-streng.
 *
 * Parser start-datoen, lægger N måneder til, trækker én dag fra (inklusiv slutdato) og
 * formaterer tilbage til dansk format. Returnerer `undefined` hvis start-datoen ikke kan
 * parses (fail-closed for kilde-opslag — kalderen returnerer da et udefineret interval).
 *
 * Ét sted for parse → +N mdr − 1 dag → format, så KRL-satstabellen, KL-lønaftalerne og
 * offentlig løn deler nøjagtig samme aritmetik (tidligere tre identiske inline-kopier via
 * `getInclusivePeriodEndByMonths(…, 6)`).
 */
export const getInclusivePeriodEndDanishDate = (
  fraDato: DanishDateString,
  months: number
): DanishDateString | undefined => {
  const parsed = parseDanishDate(fraDato);
  if (!parsed) return undefined;
  return formatDanishDate(getInclusivePeriodEndByMonths(parsed, months));
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

  if (Number.isNaN(week) || Number.isNaN(year) || week < 1 || week > 53) {
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
