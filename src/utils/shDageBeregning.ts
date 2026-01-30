/**
 * Beregner danske SH-dage (søgnehelligdage på hverdage)
 *
 * SH-dage er danske helligdage der falder på hverdage (mandag-fredag).
 */

import { addDays, parseDanishDate, parseWeekString, formatToISO, parseISODate } from './dateUtils';

/**
 * Beregner påskedag for et givet år
 * Bruger Meeus/Jones/Butcher algoritme for gregoriansk kalender
 */
const beregnPaaskedag = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(year, month - 1, day);
};

/**
 * Beregner alle danske helligdage for et givet år
 */
export const beregnHelligdage = (year: number): Date[] => {
  const paaske = beregnPaaskedag(year);

  const helligdage = [
    new Date(year, 0, 1),                    // Nytårsdag
    addDays(paaske, -3),                     // Skærtorsdag
    addDays(paaske, -2),                     // Langfredag
    paaske,                                  // Påskedag
    addDays(paaske, 1),                      // Anden påskedag
    addDays(paaske, 39),                     // Kristi himmelfartsdag
    addDays(paaske, 49),                     // Pinsedag
    addDays(paaske, 50),                     // Anden pinsedag
    new Date(year, 11, 25),                  // Juledag
    new Date(year, 11, 26),                  // Anden juledag
  ];

  // Store bededag (fjerde fredag efter påske - kun til og med 2023)
  if (year <= 2023) {
    helligdage.push(addDays(paaske, 26));
  }

  return helligdage;
};

/**
 * Tjekker om en dato er en hverdag (mandag-fredag)
 */
const erHverdag = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Mandag=1 til Fredag=5
};

/**
 * Tjekker om to datoer er samme dag
 */
const _erSammeDag = (date1: Date, date2: Date): boolean => {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
};

/**
 * Beregner antal SH-dage mellem to datoer
 * SH-dage er helligdage der falder på hverdage (mandag-fredag)
 */
export const beregnSHDage = (fraDato: Date, tilDato: Date): number => {
  if (!fraDato || !tilDato || fraDato > tilDato) {
    return 0;
  }

  // Find alle år i perioden
  const aarSet = new Set<number>();
  for (let year = fraDato.getFullYear(); year <= tilDato.getFullYear(); year++) {
    aarSet.add(year);
  }

  // Saml alle helligdage for de relevante år
  const alleHelligdage: Date[] = [];
  aarSet.forEach(year => {
    alleHelligdage.push(...beregnHelligdage(year));
  });

  // Tæl helligdage der falder inden for perioden og på hverdage
  let antalSH = 0;
  alleHelligdage.forEach(helligdag => {
    if (helligdag >= fraDato && helligdag <= tilDato && erHverdag(helligdag)) {
      antalSH++;
    }
  });

  return antalSH;
};

/**
 * Beregner antal SH-dage for et set af unikke datoer
 * Bruges til at undgå at tælle samme helligdag flere gange ved overlappende perioder
 */
export const beregnSHDageForDatoSet = (datoSet: Set<string>): number => {
  if (!datoSet || datoSet.size === 0) {
    return 0;
  }

  // Konverter dato-strings til Date-objekter
  const datoer = Array.from(datoSet as Set<string>)
    .map((dateStr) => parseISODate(dateStr as any)) // dateStr er allerede valideret ISO string
    .filter((d): d is Date => d !== null);

  if (datoer.length === 0) {
    return 0;
  }

  // Find min og max dato
  const times = datoer.map((d) => d.getTime());
  const minDato = new Date(Math.min(...times));
  const maxDato = new Date(Math.max(...times));

  // Find alle år i perioden
  const aarSet = new Set<number>();
  for (let year = minDato.getFullYear(); year <= maxDato.getFullYear(); year++) {
    aarSet.add(year);
  }

  // Saml alle helligdage for de relevante år
  const alleHelligdage: Date[] = [];
  aarSet.forEach(year => {
    alleHelligdage.push(...beregnHelligdage(year));
  });

  // Tæl helligdage der er i vores dato-set og på hverdage
  let antalSH = 0;
  alleHelligdage.forEach(helligdag => {
    // Konverter helligdag til ISO-format (undgå timezone-problemer)
    const helligdagStr = formatToISO(helligdag);

    if (datoSet.has(helligdagStr) && erHverdag(helligdag)) {
      antalSH++;
    }
  });

  return antalSH;
};

// Re-export for bagudkompatibilitet
export { parseDanishDate, parseWeekString };
