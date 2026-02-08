/**
 * Offentlige lønninger – Runtime-opslagsmodul
 *
 * Giver opslag i KL (kommunale) og RLTN (regionale) løntabeller.
 * Data stammer fra auto-genererede filer (se scripts/import-offentlig-loen.mjs).
 */

import { type DanishDateString } from '../types/branded';
import { addDays, addMonths, formatDanishDate, parseDanishDate } from '../utils/dateUtils';
import type {
  OffentligOverenskomstType,
  Loengruppe,
  Loentrin,
  OffentligLoenEntry,
  OffentligLoenRegulering,
  OffentligLoenResultat,
} from './offentligLoenTypes';
import { klLoenSatser } from './KL/klLoenSatser';
import { rltnLoenSatser } from './RLTN/rltnLoenSatser';

// ===== HELPER FUNKTIONER =====

const danishDateToNumber = (dato: DanishDateString): number => {
  const [day, month, year] = dato.split('-').map(Number);
  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
    throw new Error(`Ugyldig dato: ${dato} — kunne ikke parse dag/måned/år.`);
  }
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    throw new Error(`Ugyldig dato: ${dato} — dag=${day}, måned=${month}, år=${year} er uden for rimelig range.`);
  }
  return year * 10000 + month * 100 + day;
};

// ===== FORHÅNDSBEREGNET LOOKUP =====

/**
 * Splittet lookup-struktur for løntrin.
 * Adskiller numeriske løntrin (1-55) fra '55+' for eksplicit semantik.
 */
interface EntryLookup {
  readonly byTrin: ReadonlyMap<number, OffentligLoenEntry>;
  readonly plus55: OffentligLoenEntry | undefined;
}

interface ReguleringMedLookup {
  readonly effectiveDate: DanishDateString;
  readonly effectiveDateNum: number;
  readonly lookup: EntryLookup;
}

/** Slår et løntrin op i den splittede lookup-struktur */
const lookupEntry = (lookup: EntryLookup, loentrin: Loentrin): OffentligLoenEntry | undefined => {
  if (loentrin === '55+') return lookup.plus55;
  return lookup.byTrin.get(loentrin);
};

const buildReguleringLookups = (
  satser: ReadonlyArray<OffentligLoenRegulering>,
  label: string
): ReadonlyArray<ReguleringMedLookup> => {
  const lookups = satser.map((reg) => {
    const byTrin = new Map<number, OffentligLoenEntry>();
    let plus55: OffentligLoenEntry | undefined;

    for (const entry of reg.entries) {
      if (entry.loentrin === '55+') {
        if (plus55 !== undefined) {
          throw new Error(`Duplikeret løntrin 55+ for dato ${reg.effectiveDate}`);
        }
        plus55 = entry;
      } else {
        if (byTrin.has(entry.loentrin)) {
          throw new Error(
            `Duplikeret løntrin ${entry.loentrin} for dato ${reg.effectiveDate}`
          );
        }
        byTrin.set(entry.loentrin, entry);
      }
    }

    return {
      effectiveDate: reg.effectiveDate,
      effectiveDateNum: danishDateToNumber(reg.effectiveDate),
      lookup: { byTrin, plus55 },
    };
  });

  // Integritetstjek: unikke effectiveDates
  const dateNums = new Set(lookups.map((l) => l.effectiveDateNum));
  if (dateNums.size !== lookups.length) {
    throw new Error(`${label}: Duplikerede effectiveDates i lønsatser-data.`);
  }

  // Integritetstjek: sikr nyeste-først sortering (stoler ikke på genereret rækkefølge)
  for (let i = 1; i < lookups.length; i++) {
    if (lookups[i].effectiveDateNum >= lookups[i - 1].effectiveDateNum) {
      throw new Error(
        `${label}: Lønsatser er ikke sorteret nyeste først. ` +
          `${lookups[i - 1].effectiveDate} efterfølges af ${lookups[i].effectiveDate}.`
      );
    }
  }

  return lookups;
};

// Sorteret nyeste først (valideret af buildReguleringLookups)
const klLookups = buildReguleringLookups(klLoenSatser, 'KL');
const rltnLookups = buildReguleringLookups(rltnLoenSatser, 'RLTN');

const getLookups = (
  type: OffentligOverenskomstType
): ReadonlyArray<ReguleringMedLookup> =>
  type === 'KL' ? klLookups : rltnLookups;

// ===== EKSPORTEREDE OPSLAGS-FUNKTIONER =====

/**
 * Finder lønværdi for en specifik dato.
 * Returnerer den nyeste regulering hvor effectiveDate <= dato.
 */
export const getOffentligLoenForDato = (
  overenskomstType: OffentligOverenskomstType,
  dato: DanishDateString,
  loentrin: Loentrin,
  loengruppe: Loengruppe
): OffentligLoenResultat | undefined => {
  const lookups = getLookups(overenskomstType);
  const targetNum = danishDateToNumber(dato);

  // Satser er sorteret nyeste først — find første hvor effectiveDate <= dato
  for (const reg of lookups) {
    if (reg.effectiveDateNum <= targetNum) {
      const entry = lookupEntry(reg.lookup, loentrin);
      if (!entry) return undefined;

      return {
        overenskomstType,
        effectiveDate: reg.effectiveDate,
        loentrin,
        loengruppe,
        maanedsLoen: entry.maanedsLoen[loengruppe],
        timeLoen: entry.timeLoen[loengruppe],
      };
    }
  }

  return undefined;
};

/**
 * Finder alle reguleringer inden for en periode.
 *
 * Returnerer:
 * 1. Den gældende regulering ved periodens start (nyeste effectiveDate <= fraDato)
 * 2. Alle reguleringer der træder i kraft inden for perioden (effectiveDate > fraDato og <= tilDato)
 *
 * Resultatet er sorteret ældste først (kronologisk).
 */
export const getOffentligLoenForPeriode = (
  overenskomstType: OffentligOverenskomstType,
  fraDato: DanishDateString,
  tilDato: DanishDateString,
  loentrin: Loentrin,
  loengruppe: Loengruppe
): ReadonlyArray<OffentligLoenResultat> => {
  const lookups = getLookups(overenskomstType);
  const startNum = danishDateToNumber(fraDato);
  const endNum = danishDateToNumber(tilDato);

  if (startNum > endNum) return [];

  const resultater: OffentligLoenResultat[] = [];

  const buildResultat = (reg: ReguleringMedLookup, entry: OffentligLoenEntry): OffentligLoenResultat => ({
    overenskomstType,
    effectiveDate: reg.effectiveDate,
    loentrin,
    loengruppe,
    maanedsLoen: entry.maanedsLoen[loengruppe],
    timeLoen: entry.timeLoen[loengruppe],
  });

  // 1. Find gældende regulering ved periodens start (nyeste effectiveDate <= startNum)
  //    lookups er sorteret nyeste først, så den første match er den nyeste
  for (const reg of lookups) {
    if (reg.effectiveDateNum <= startNum) {
      const entry = lookupEntry(reg.lookup, loentrin);
      if (entry) {
        resultater.push(buildResultat(reg, entry));
      }
      break;
    }
  }

  // 2. Saml reguleringer der træder i kraft inden for perioden (effectiveDate > startNum og <= endNum)
  //    Iterér baglæns (ældste først) for kronologisk output
  for (let i = lookups.length - 1; i >= 0; i--) {
    const reg = lookups[i];
    if (reg.effectiveDateNum > startNum && reg.effectiveDateNum <= endNum) {
      const entry = lookupEntry(reg.lookup, loentrin);
      if (entry) {
        resultater.push(buildResultat(reg, entry));
      }
    }
  }

  return resultater;
};

/**
 * Returnerer alle regulerings-ikrafttrædelsesdatoer for en overenskomsttype.
 * Sorteret ældste først (kronologisk).
 */
export const getReguleringsDatoer = (
  overenskomstType: OffentligOverenskomstType
): ReadonlyArray<DanishDateString> => {
  const lookups = getLookups(overenskomstType);
  // lookups er nyeste først, returnér ældste først
  return [...lookups].reverse().map((r) => r.effectiveDate);
};

/**
 * Returnerer dato-intervallet for en overenskomsttype.
 *
 * fraDato = ældste regulerings-startdato
 * tilDato = nyeste regulerings-startdato + 6 måneder − 1 dag
 */
export const getReguleringsDatoIntervalForOffentligLoen = (
  overenskomstType: OffentligOverenskomstType
): { fraDato: DanishDateString; tilDato: DanishDateString } | undefined => {
  const lookups = getLookups(overenskomstType);
  if (lookups.length === 0) return undefined;

  // Nyeste er først, ældste er sidst
  const nyeste = lookups[0];
  const aeldste = lookups[lookups.length - 1];

  const nyesteDate = parseDanishDate(nyeste.effectiveDate);
  if (!nyesteDate) return undefined;

  const tilDato = formatDanishDate(addDays(addMonths(nyesteDate, 6), -1));

  return {
    fraDato: aeldste.effectiveDate,
    tilDato,
  };
};
