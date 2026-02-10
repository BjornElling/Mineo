/**
 * Centraliserede dato-funktioner
 *
 * Alle funktioner arbejder med date-only som UTC-dage (ingen tid).
 * Brug denne fil til low-level helpers og UI-nær logik; nye domæneberegninger
 * skal primært bruge branded ISODateString og dedikerede domain-moduler.
 * VIGTIGT: Brug ALDRIG toISOString() eller new Date(isoString) direkte,
 * da disse kan forårsage timezone-shifts der ændrer datoen ±1 dag.
 */

import type { DateInterval } from '../types/common';
import type { DanishDateString, ISODateString } from '../types/branded';
import { toDanishDateString, toISODateString } from '../types/branded';

/**
 * Opretter en Date-objekt med eksplicit år, måned og dag
 * Sikrer at året er korrekt sat (vigtigt for tværårs-beregninger)
 */
export const createDate = (year: number, monthIndex: number, day: number): Date => {
  const date = new Date(Date.UTC(year, monthIndex, day));
  date.setUTCFullYear(year);
  return date;
};

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

/**
 * Returnerer den mindste af to ISO-datoer (åååå-mm-dd)
 *
 * Bruger lexicografisk sammenligning, hvilket er sikkert for ISO-format.
 *
 * @param date1 - Første ISO-dato
 * @param date2 - Anden ISO-dato
 * @returns Den mindste dato
 *
 * @example
 * minIsoDate('2025-12-31', '2026-01-01') // '2025-12-31'
 * minIsoDate('2025-01-15', '2025-01-10') // '2025-01-10'
 */
export const minIsoDate = (date1: ISODateString, date2: ISODateString): ISODateString => {
  return date1 < date2 ? date1 : date2;
};

/**
 * Beregner præcis antal måneder mellem to datoer (begge dage inklusiv)
 *
 * Beregningen tager højde for delvis måneder ved at:
 * 1. Beregne andel af startmåneden: (tilbageværende dage inkl. fra-dato) / dage i måneden
 * 2. Tælle hele måneder mellem start- og slutmåned
 * 3. Beregne andel af slutmåneden: (dage fra start til slut-dato) / dage i måneden
 *
 * @param fraDate - Startdato (dd-mm-åååå)
 * @param tilDate - Slutdato (dd-mm-åååå)
 * @returns Antal måneder (med decimaler) eller null hvis ugyldige datoer
 *
 * @example
 * beregnMaanederMellemDatoer('15-01-2024', '14-03-2024')
 * // Fra 15. januar til 14. marts 2024
 * // Startmåned (januar): 17 dage tilbage (inkl. 15.) af 31 = 0.548
 * // Hele måneder: 1 måned (februar)
 * // Slutmåned (marts): 14 dage af 31 = 0.452
 * // Total: 0.548 + 1 + 0.452 = 2.00 måneder
 */
export const beregnMaanederMellemDatoer = (fraDate: string, tilDate: string): number | null => {
  const fraDato = parseDanishDate(fraDate);
  const tilDato = parseDanishDate(tilDate);

  if (!fraDato || !tilDato || fraDato > tilDato) {
    return null;
  }

  const fraYear = fraDato.getUTCFullYear();
  const fraMonth = fraDato.getUTCMonth();
  const fraDay = fraDato.getUTCDate();

  const tilYear = tilDato.getUTCFullYear();
  const tilMonth = tilDato.getUTCMonth();
  const tilDay = tilDato.getUTCDate();

  // Hvis samme måned og år
  if (fraYear === tilYear && fraMonth === tilMonth) {
    const dageIMaaned = new Date(Date.UTC(fraYear, fraMonth + 1, 0)).getUTCDate();
    const antalDage = tilDay - fraDay + 1; // +1 fordi begge dage er inklusiv
    return antalDage / dageIMaaned;
  }

  // Beregn andel af startmåneden
  const dageIStartMaaned = new Date(Date.UTC(fraYear, fraMonth + 1, 0)).getUTCDate();
  const tilbageMaanedDage = dageIStartMaaned - fraDay + 1; // +1 fordi fra-dag er inklusiv
  const startMaanedAndel = tilbageMaanedDage / dageIStartMaaned;

  // Beregn antal hele måneder mellem start og slut (eksklusiv begge)
  let heleMaaneder = 0;
  let currentYear = fraYear;
  let currentMonth = fraMonth + 1; // Start fra måneden efter fra-måneden

  while (currentYear < tilYear || (currentYear === tilYear && currentMonth < tilMonth)) {
    heleMaaneder++;
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }

  // Beregn andel af slutmåneden
  const dageISlutMaaned = new Date(Date.UTC(tilYear, tilMonth + 1, 0)).getUTCDate();
  const slutMaanedAndel = tilDay / dageISlutMaaned;

  // Totalsum
  const totalMaaneder = startMaanedAndel + heleMaaneder + slutMaanedAndel;

  // Rund til 2 decimaler
  return Math.round(totalMaaneder * 100) / 100;
};
