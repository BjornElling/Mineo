/**
 * Offentlige lønninger – Runtime-opslagsmodul
 *
 * Giver opslag i KL (kommunale) og RLTN (regionale) løntabeller.
 * Data stammer fra auto-genererede filer (se scripts/import-offentlig-loen.mjs).
 */

import { type DanishDateString } from '../types/branded';
import { formatDanishDate, getInclusivePeriodEndByMonths, parseDanishDate } from '../utils/dateUtils';
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
  const parsed = parseDanishDate(dato);
  if (!parsed) {
    throw new Error(`Ugyldig dato: ${dato} — kunne ikke parse dansk dato.`);
  }
  return parsed.getUTCFullYear() * 10000 + (parsed.getUTCMonth() + 1) * 100 + parsed.getUTCDate();
};

// ===== FORHÅNDSBEREGNET LOOKUP =====

/**
 * Splittet lookup-struktur for løntrin.
 * Adskiller numeriske løntrin (1-55) fra '55+' for eksplicit semantik.
 */
interface EntryLookup {
  readonly byTrin: ReadonlyMap<number, OffentligLoenEntry>;
  readonly plus55: OffentligLoenEntry;
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

    if (!plus55) {
      throw new Error(`Manglende løntrin 55+ for dato ${reg.effectiveDate}`);
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
          `${lookups[i - 1].effectiveDate} (${lookups[i - 1].effectiveDateNum}) ` +
          `efterfølges af ${lookups[i].effectiveDate} (${lookups[i].effectiveDateNum}).`
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

const findNewestReguleringOnOrBefore = (
  lookups: ReadonlyArray<ReguleringMedLookup>,
  targetNum: number
): ReguleringMedLookup | undefined => {
  // lookups er sorteret nyeste først: find første effectiveDateNum <= targetNum via binærsøgning
  let low = 0;
  let high = lookups.length - 1;
  let resultIndex = -1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const midNum = lookups[mid].effectiveDateNum;
    if (midNum <= targetNum) {
      resultIndex = mid;
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return resultIndex === -1 ? undefined : lookups[resultIndex];
};

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

  const reg = findNewestReguleringOnOrBefore(lookups, targetNum);
  if (!reg) return undefined;

  const entry = lookupEntry(reg.lookup, loentrin);
  if (!entry) {
    throw new Error(
      `${overenskomstType}: Mangler løntrin ${String(loentrin)} i regulering ${reg.effectiveDate}.`
    );
  }

  return {
    overenskomstType,
    effectiveDate: reg.effectiveDate,
    loentrin,
    loengruppe,
    maanedsLoen: entry.maanedsLoen[loengruppe],
    timeLoen: entry.timeLoen[loengruppe],
  };
};

/**
 * Finder den gældende offentlige løntabel for en specifik dato.
 * Returnerer den nyeste regulering hvor effectiveDate <= dato.
 */
export const getOffentligLoenTabelForDato = (
  overenskomstType: OffentligOverenskomstType,
  dato: DanishDateString
): Readonly<{
  overenskomstType: OffentligOverenskomstType;
  effectiveDate: DanishDateString;
  entries: ReadonlyArray<OffentligLoenEntry>;
}> | undefined => {
  const lookups = getLookups(overenskomstType);
  const targetNum = danishDateToNumber(dato);
  const reg = findNewestReguleringOnOrBefore(lookups, targetNum);
  if (!reg) return undefined;

  const sortedNumericTrin = Array.from(reg.lookup.byTrin.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([, entry]) => entry);

  const entries = [...sortedNumericTrin, reg.lookup.plus55];

  return {
    overenskomstType,
    effectiveDate: reg.effectiveDate,
    entries,
  };
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
  const startReg = findNewestReguleringOnOrBefore(lookups, startNum);
  if (startReg) {
    const entry = lookupEntry(startReg.lookup, loentrin);
    if (!entry) {
      throw new Error(
        `${overenskomstType}: Mangler løntrin ${String(loentrin)} i regulering ${startReg.effectiveDate}.`
      );
    }
    resultater.push(buildResultat(startReg, entry));
  }

  // 2. Saml reguleringer der træder i kraft inden for perioden (effectiveDate > startNum og <= endNum)
  //    Iterér baglæns (ældste først) for kronologisk output
  for (let i = lookups.length - 1; i >= 0; i--) {
    const reg = lookups[i];
    if (reg.effectiveDateNum > startNum && reg.effectiveDateNum <= endNum) {
      const entry = lookupEntry(reg.lookup, loentrin);
      if (!entry) {
        throw new Error(
          `${overenskomstType}: Mangler løntrin ${String(loentrin)} i regulering ${reg.effectiveDate}.`
        );
      }
      resultater.push(buildResultat(reg, entry));
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
 * (offentlige reguleringer håndteres som halvårlige perioder i Mineo)
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

  const tilDato = formatDanishDate(getInclusivePeriodEndByMonths(nyesteDate, 6));

  return {
    fraDato: aeldste.effectiveDate,
    tilDato,
  };
};
