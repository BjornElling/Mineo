/**
 * Beregner danske SH-dage (søgnehelligdage på hverdage)
 *
 * SH-dage er danske helligdage der falder på hverdage (mandag-fredag).
 */

import { parseISODate, type ISODateString } from '../../types/branded';
import { addDays, createDate, formatToISO } from '../../utils/dateUtils';

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

  return createDate(year, month - 1, day);
};

/**
 * Beregner alle danske helligdage for et givet år
 */
export const beregnHelligdage = (year: number): Date[] => {
  const paaske = beregnPaaskedag(year);

  const helligdage = [
    createDate(year, 0, 1),                  // Nytårsdag
    addDays(paaske, -3),                     // Skærtorsdag
    addDays(paaske, -2),                     // Langfredag
    paaske,                                  // Påskedag
    addDays(paaske, 1),                      // Anden påskedag
    addDays(paaske, 39),                     // Kristi himmelfartsdag
    addDays(paaske, 49),                     // Pinsedag
    addDays(paaske, 50),                     // Anden pinsedag
    createDate(year, 11, 25),                // Juledag
    createDate(year, 11, 26),                // Anden juledag
  ];

  // Store bededag (fjerde fredag efter påske - kun til og med 2023)
  if (year <= 2023) {
    helligdage.push(addDays(paaske, 26));
  }

  return helligdage;
};

export interface NavngivetHelligdag {
  date: Date;
  navn: string;
}

/**
 * Beregner alle danske helligdage for et givet år, med deres navne.
 * Bruges i PDF-rendereren til at vise helligdagsnavne.
 */
export const beregnHelligdageMedNavn = (year: number): NavngivetHelligdag[] => {
  const paaske = beregnPaaskedag(year);

  const helligdage: NavngivetHelligdag[] = [
    { date: createDate(year, 0, 1), navn: 'Nytårsdag' },
    { date: addDays(paaske, -3), navn: 'Skærtorsdag' },
    { date: addDays(paaske, -2), navn: 'Langfredag' },
    { date: paaske, navn: 'Påskedag' },
    { date: addDays(paaske, 1), navn: 'Anden påskedag' },
    { date: addDays(paaske, 39), navn: 'Kristi himmelfartsdag' },
    { date: addDays(paaske, 49), navn: 'Pinsedag' },
    { date: addDays(paaske, 50), navn: 'Anden pinsedag' },
    { date: createDate(year, 11, 25), navn: 'Juledag' },
    { date: createDate(year, 11, 26), navn: 'Anden juledag' },
  ];

  if (year <= 2023) {
    helligdage.push({ date: addDays(paaske, 26), navn: 'Store bededag' });
  }

  return helligdage;
};

/**
 * Tjekker om en dato er en hverdag (mandag-fredag)
 */
export const erHverdagUtc = (date: Date): boolean => {
  const dayOfWeek = date.getUTCDay();
  return dayOfWeek >= 1 && dayOfWeek <= 5; // Mandag=1 til Fredag=5
};

export const erSHDag = (date: Date): boolean => erHverdagUtc(date);

export const buildSHDageSetForDatoSet = (
  datoSet: ReadonlySet<ISODateString>
): ReadonlySet<ISODateString> => {
  const shDageSet = new Set<ISODateString>();
  if (!datoSet || datoSet.size === 0) {
    return shDageSet;
  }

  const datoer = Array.from(datoSet)
    .map((dateStr) => parseISODate(dateStr))
    .filter((d): d is Date => d !== undefined);

  if (datoer.length === 0) {
    return shDageSet;
  }

  const times = datoer.map((d) => d.getTime());
  const minDato = new Date(Math.min(...times));
  const maxDato = new Date(Math.max(...times));

  for (let year = minDato.getUTCFullYear(); year <= maxDato.getUTCFullYear(); year += 1) {
    for (const helligdag of beregnHelligdage(year)) {
      const helligdagStr = formatToISO(helligdag);
      if (datoSet.has(helligdagStr) && erSHDag(helligdag)) {
        shDageSet.add(helligdagStr);
      }
    }
  }

  return shDageSet;
};

export const buildSHDageSetForIsoRange = (
  fra: ISODateString,
  til: ISODateString
): ReadonlySet<ISODateString> => {
  const fraDato = parseISODate(fra);
  const tilDato = parseISODate(til);
  if (!fraDato || !tilDato || fraDato > tilDato) {
    return new Set<ISODateString>();
  }

  const datoSet = new Set<ISODateString>();
  let current = new Date(fraDato);
  while (current <= tilDato) {
    datoSet.add(formatToISO(current));
    current = addDays(current, 1);
  }

  return buildSHDageSetForDatoSet(datoSet);
};

/**
 * Beregner antal SH-dage mellem to datoer
 * SH-dage er helligdage der falder på hverdage (mandag-fredag)
 */
export const beregnSHDage = (fraDato: Date, tilDato: Date): number => {
  if (!fraDato || !tilDato || fraDato > tilDato) {
    return 0;
  }
  const fra = formatToISO(fraDato);
  const til = formatToISO(tilDato);
  return buildSHDageSetForIsoRange(fra, til).size;
};

/**
 * Beregner antal SH-dage for et set af unikke datoer
 * Bruges til at undgå at tælle samme helligdag flere gange ved overlappende perioder
 */
export const beregnSHDageForDatoSet = (datoSet: ReadonlySet<ISODateString>): number => {
  return buildSHDageSetForDatoSet(datoSet).size;
};
