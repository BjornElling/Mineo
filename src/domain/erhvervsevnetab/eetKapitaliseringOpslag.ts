import { kapitaliseringsbekendtgoerelser } from '../../data/kapitalisering/kapitaliseringsbekendtgoerelser';
import {
  getKapitaliseringsTabelData,
  type AldersFaktorRaekke,
  type ErhvervsevnetabTabelvalg,
  type KapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { getFolkepensionAlder } from '../../data/folkepensionAlderRates';
import type { ISODateString } from '../../types/branded';
import { dateToISO, parseISODate } from '../../types/branded';
import { addDays } from '../../utils/dateUtils';
import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';

export type AgeYearsMonths = Readonly<{
  years: number;
  months: number;
  totalMonths: number;
}>;

export type ResolvedKapitaliseringTabelvalg = Readonly<{
  tabel: string;
  folkepensionsalderMaaneder: number;
  folkepensionsalderLabel: string;
  usesKoen: boolean;
}>;

type ResolvedErhvervsevnetabTabel = Readonly<{
  tabel: string;
  usesKoen: boolean;
}>;

export const resolveKapitaliseringsbekendtgoerelseId = (
  skadedato: ISODateString,
  dato: ISODateString
): string | null => {
  const skadesinterval = kapitaliseringsbekendtgoerelser
    .filter((interval) => interval.skadedatoFra <= skadedato)
    .reduce<typeof kapitaliseringsbekendtgoerelser[number] | null>((latest, current) => {
      if (!latest) return current;
      return current.skadedatoFra > latest.skadedatoFra ? current : latest;
    }, null);

  if (!skadesinterval) return null;

  const sortedKapitaliseringer = [...skadesinterval.kapitaliseringer].sort((a, b) =>
    a.kapitaliseringsdatoFra.localeCompare(b.kapitaliseringsdatoFra)
  );

  let kandidatIndex = -1;
  for (let i = sortedKapitaliseringer.length - 1; i >= 0; i -= 1) {
    if (sortedKapitaliseringer[i]!.kapitaliseringsdatoFra <= dato) {
      kandidatIndex = i;
      break;
    }
  }
  if (kandidatIndex < 0) return null;

  const kandidat = sortedKapitaliseringer[kandidatIndex]!;
  const nextEntry = sortedKapitaliseringer[kandidatIndex + 1];
  const nextDate = nextEntry ? parseISODate(nextEntry.kapitaliseringsdatoFra) : null;
  const gyldigTil = nextDate
    ? dateToISO(addDays(nextDate, -1))
    // Antagelse: alle kapitaliseringer for samme skadesinterval udstedes inden for ét kalenderår.
    // Brydes antagelsen (to bekendtgørelser i samme interval over et årsskifte), vil fallback give forkert gyldigTil.
    : (`${kandidat.kapitaliseringsdatoFra.slice(0, 4)}-12-31` as ISODateString);
  if (!gyldigTil) return null;
  return dato <= gyldigTil ? kandidat.id : null;
};

const resolveModernFoerMinimumFoedselsdatoTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadedato: ISODateString,
  fodselsdato: ISODateString
): ResolvedErhvervsevnetabTabel | null => {
  const relevanteEntries = tabeldata.erhvervsevnetabTabelvalg.filter(
    (entry) =>
      entry.skadedatoFra <= skadedato &&
      entry.foedselsdatoTil === null
  );
  if (relevanteEntries.length === 0) return null;

  const relevantskadedatoFra = relevanteEntries.reduce<ISODateString>(
    (latest, current) => (current.skadedatoFra > latest ? current.skadedatoFra : latest),
    relevanteEntries[0]!.skadedatoFra
  );
  const entriesForSkadesinterval = relevanteEntries.filter((entry) => entry.skadedatoFra === relevantskadedatoFra);
  if (entriesForSkadesinterval.length === 0) return null;

  const earliestEntry = entriesForSkadesinterval.reduce<ErhvervsevnetabTabelvalg>(
    (earliest, current) => (current.foedselsdatoFra < earliest.foedselsdatoFra ? current : earliest),
    entriesForSkadesinterval[0]!
  );

  if (fodselsdato >= earliestEntry.foedselsdatoFra) return null;

  return {
    tabel: earliestEntry.tabel,
    usesKoen: Object.keys(tabeldata.erhvervsevnetabKoensopdelteTabeller).length > 0,
  };
};

export const calculateAgeYearsMonths = (
  fodselsdato: ISODateString,
  referenceDato: ISODateString
): AgeYearsMonths | null => {
  const birthDate = parseISODate(fodselsdato);
  const refDate = parseISODate(referenceDato);
  if (!birthDate || !refDate) return null;
  if (refDate < birthDate) return null;

  let years = refDate.getUTCFullYear() - birthDate.getUTCFullYear();
  let months = refDate.getUTCMonth() - birthDate.getUTCMonth();
  // Dag-sammenligningen bruger getUTCDate fordi parseISODate altid returnerer midnat UTC.
  // Ændres parseISODate til lokal tid, skal dette opdateres tilsvarende.
  if (refDate.getUTCDate() < birthDate.getUTCDate()) {
    months -= 1;
  }
  while (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;

  return { years, months, totalMonths: years * 12 + months };
};

const resolveErhvervsevnetabTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadedato: ISODateString,
  fodselsdato: ISODateString
): ResolvedErhvervsevnetabTabel | null => {
  const kandidat = tabeldata.erhvervsevnetabTabelvalg
    .filter((entry) => {
      if (entry.skadedatoFra > skadedato) return false;
      if (entry.foedselsdatoFra > fodselsdato) return false;
      if (entry.foedselsdatoTil && fodselsdato > entry.foedselsdatoTil) return false;
      return true;
    })
    .reduce<ErhvervsevnetabTabelvalg | null>((latest, current) => {
      if (!latest) return current;
      if (current.skadedatoFra !== latest.skadedatoFra) {
        return current.skadedatoFra > latest.skadedatoFra ? current : latest;
      }
      return current.foedselsdatoFra > latest.foedselsdatoFra ? current : latest;
    }, null);

  if (!kandidat) {
    return resolveModernFoerMinimumFoedselsdatoTabelvalg(tabeldata, skadedato, fodselsdato);
  }

  return {
    tabel: kandidat.tabel,
    usesKoen: Object.keys(tabeldata.erhvervsevnetabKoensopdelteTabeller).length > 0,
  };
};

export const resolveKapitaliseringTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadedato: ISODateString,
  fodselsdato: ISODateString,
  opslagsdato: ISODateString
): ResolvedKapitaliseringTabelvalg | null => {
  const tabelvalg = resolveErhvervsevnetabTabelvalg(tabeldata, skadedato, fodselsdato);
  if (!tabelvalg) return null;
  const folkepensionAlder = getFolkepensionAlder(fodselsdato, opslagsdato);
  if (!folkepensionAlder) return null;
  return {
    ...tabelvalg,
    folkepensionsalderMaaneder: folkepensionAlder.alderMaaneder,
    folkepensionsalderLabel: folkepensionAlder.alderLabel,
  };
};

export const resolveKapitaliseringTabelvalgForControlDate = (
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): ResolvedKapitaliseringTabelvalg | null => {
  if (!skadedato || !fodselsdato || !controlDate) return null;

  const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadedato, controlDate);
  if (!controlBekId) return null;

  const controlData = getKapitaliseringsTabelData(controlBekId);
  if (!controlData) return null;

  return resolveKapitaliseringTabelvalg(controlData, skadedato, fodselsdato, controlDate);
};

export type ResolveFactorTableResult = Readonly<{
  rows: readonly AldersFaktorRaekke[] | null;
  reason: 'missing-table' | 'missing-koen' | null;
  koenOpdelt: boolean;
}>;

export const resolveSaerfaktor = (
  tabeldata: KapitaliseringsTabelData,
  skadedato: ISODateString
): number | null => {
  const kandidat = tabeldata.saerfaktorUnderToAarTilFpPerSkadesinterval
    .filter((entry) => entry.skadedatoFra <= skadedato)
    .reduce<typeof tabeldata.saerfaktorUnderToAarTilFpPerSkadesinterval[number] | null>((latest, current) => {
      if (!latest) return current;
      return current.skadedatoFra > latest.skadedatoFra ? current : latest;
    }, null);
  return kandidat?.faktor ?? null;
};

export const interpolateFactorWithinTable = (
  rows: readonly AldersFaktorRaekke[],
  age: AgeYearsMonths,
  maanedsAfhaengig: boolean
): number | null => {
  const first = rows[0];
  const last = rows[rows.length - 1];
  if (!first || !last) return null;
  if (age.years < first.alder) return null;
  if (age.years > last.alder) return null;
  // I månedsafhængige tabeller er fx "64 år, 2 måneder" ikke lig med faktor-rækken for 64 år.
  // Når alderen ligger efter tabellens sidste hele år, skal kaldere falde videre til
  // interpolation mod særfaktoren i intervallet frem til 2-årsgrænsen før folkepension.
  if (age.years === last.alder) {
    return maanedsAfhaengig && age.months > 0 ? null : last.faktor;
  }
  const lower = rows.find((r) => r.alder === age.years);
  const upper = rows.find((r) => r.alder === age.years + 1);
  if (!lower || !upper) return null;
  if (!maanedsAfhaengig) return lower.faktor;
  return ((12 - age.months) / 12) * lower.faktor + (age.months / 12) * upper.faktor;
};

export const interpolateFactorBeyondTable = (
  rows: readonly AldersFaktorRaekke[],
  age: AgeYearsMonths,
  folkepensionsalderMaaneder: number,
  saerfaktor: number,
  maanedsAfhaengig: boolean
): number | null => {
  const last = rows[rows.length - 1];
  if (!last) return null;
  const lastAgeMonths = last.alder * 12;
  const boundaryMonths = folkepensionsalderMaaneder - 24;
  if (boundaryMonths < lastAgeMonths) return null;
  if (maanedsAfhaengig) {
    if (age.totalMonths <= lastAgeMonths) return last.faktor;
    if (age.totalMonths >= boundaryMonths) return saerfaktor;
    const totalMonths = boundaryMonths - lastAgeMonths;
    if (totalMonths <= 0) return null;
    const monthsOver = age.totalMonths - lastAgeMonths;
    return last.faktor + (monthsOver / totalMonths) * (saerfaktor - last.faktor);
  } else {
    if (age.years * 12 <= lastAgeMonths) return last.faktor;
    if (age.years * 12 >= boundaryMonths) return saerfaktor;
    const totalMonths = boundaryMonths - lastAgeMonths;
    if (totalMonths <= 0) return null;
    const monthsOver = age.years * 12 - lastAgeMonths;
    return last.faktor + (monthsOver / totalMonths) * (saerfaktor - last.faktor);
  }
};

export const resolveFactorTable = (
  tabeldata: KapitaliseringsTabelData,
  tabel: string,
  koen: ErhvervsevnetabComposedValues['koen']
): ResolveFactorTableResult => {
  const simpleTable = tabeldata.erhvervsevnetabTabeller[tabel];
  if (simpleTable && simpleTable.length > 0) {
    return { rows: simpleTable, reason: null, koenOpdelt: false };
  }
  const koensTable = tabeldata.erhvervsevnetabKoensopdelteTabeller[tabel];
  if (!koensTable || koensTable.length === 0) {
    return { rows: null, reason: 'missing-table', koenOpdelt: false };
  }
  if (!koen) {
    return { rows: null, reason: 'missing-koen', koenOpdelt: true };
  }
  const normalized = koensTable.map<AldersFaktorRaekke>((row) => ({
    alder: row.alder,
    faktor: koen === 'Mand' ? row.maendFaktor : row.kvinderFaktor,
  }));
  return { rows: normalized, reason: null, koenOpdelt: true };
};

export const isUnderOrEqualTwoYearsToFpByBekendtgoerelse = (
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): boolean => {
  const controlTabelvalg = resolveKapitaliseringTabelvalgForControlDate(skadedato, fodselsdato, controlDate);
  if (!controlTabelvalg) return false;
  if (!fodselsdato || !controlDate) return false;

  const controlAge = calculateAgeYearsMonths(fodselsdato, controlDate);
  if (!controlAge) return false;

  return controlTabelvalg.folkepensionsalderMaaneder - controlAge.totalMonths <= 24;
};
