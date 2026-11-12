import { kapitaliseringsbekendtgoerelser } from '../../data/kapitalisering/kapitaliseringsbekendtgoerelser';
import {
  type AldersFaktorRaekke,
  type ErhvervsevnetabTabelvalg,
  type KapitaliseringsTabelData,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import { getFolkepensionAlder, isWithinTwoYearsOfFolkepension } from '../../data/folkepensionAlderRates';
import { parseISODate, type ISODateString } from '../../types/branded';
import { endOfYearIso, getDayBeforeIso, isoYear } from '../../utils/isoDateHelpers';
import type { ErhvervsevnetabComposedValues } from '../../schemas/formSchemas';
import { SKAERING_2007_07_01 } from './eetSkaeringsdatoer';

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
  /**
   * Den tilskadekomne er født før kildens ældste årgang. Kilderne har ingen tabel for de årgange, fordi de i
   * hele kildens gyldighedsperiode er højst 2 år fra folkepensionsalderen (eller har nået den), så kun
   * særfaktoren kan komme i anvendelse. Den ældste årgangs tabel bruges alene som udgangspunkt for
   * interpolationen frem mod særfaktoren.
   */
  foedtFoerKildensAargange: boolean;
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
  const gyldigTil = nextEntry
    ? getDayBeforeIso(nextEntry.kapitaliseringsdatoFra)
    // Antagelse: alle kapitaliseringer for samme skadesinterval udstedes inden for ét kalenderår.
    // Brydes antagelsen (to bekendtgørelser i samme interval over et årsskifte), vil fallback give forkert gyldigTil.
    : endOfYearIso(isoYear(kandidat.kapitaliseringsdatoFra));
  if (!gyldigTil) return null;
  return dato <= gyldigTil ? kandidat.id : null;
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

/**
 * Kildens tabelvalg for skadesintervallet: det seneste afsnit, der gælder skadedatoen, og inden for det den
 * ene årgang, fødselsdatoen falder i. Årgangene er sammenhængende intervaller (håndhævet ved indlæsning).
 */
const resolveErhvervsevnetabTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadedato: ISODateString,
  fodselsdato: ISODateString
): ResolvedErhvervsevnetabTabel | null => {
  const afsnit = tabeldata.erhvervsevnetabTabelvalg
    .map((entry) => entry.skadedatoFra)
    .filter((skadedatoFra) => skadedatoFra <= skadedato)
    .reduce<ISODateString | null>((latest, current) => (latest === null || current > latest ? current : latest), null);
  if (afsnit === null) return null;

  const aargange = tabeldata.erhvervsevnetabTabelvalg.filter((entry) => entry.skadedatoFra === afsnit);
  const usesKoen = Object.keys(tabeldata.erhvervsevnetabKoensopdelteTabeller).length > 0;
  const aargang = aargange.find((entry) =>
    entry.foedselsdatoFra <= fodselsdato && (entry.foedselsdatoTil === null || fodselsdato <= entry.foedselsdatoTil)
  );
  if (aargang) return { tabel: aargang.tabel, usesKoen, foedtFoerKildensAargange: false };

  const aeldste = aargange.reduce<ErhvervsevnetabTabelvalg | null>(
    (earliest, current) => (earliest === null || current.foedselsdatoFra < earliest.foedselsdatoFra ? current : earliest),
    null
  );
  if (aeldste === null || fodselsdato >= aeldste.foedselsdatoFra) return null;
  return { tabel: aeldste.tabel, usesKoen, foedtFoerKildensAargange: true };
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
  if (tabelvalg.foedtFoerKildensAargange) {
    // Kildens fravær af en tabel er kun forsvarligt, når særfaktoren gælder. Ellers fail-closed.
    if (!isWithinTwoYearsOfFolkepension(fodselsdato, opslagsdato)) return null;
  }
  return {
    tabel: tabelvalg.tabel,
    usesKoen: tabelvalg.usesKoen,
    folkepensionsalderMaaneder: folkepensionAlder.alderMaaneder,
    folkepensionsalderLabel: folkepensionAlder.alderLabel,
  };
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

export const isTwoYearKapitaliseringApplicable = (
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): boolean => {
  // Ældre skader har ingen 2-årsydelse. Alderen alene må derfor ikke udløse
  // tvungen kapitalisering eller gøre de løbende ydelser til nul.
  if (!skadedato || skadedato < SKAERING_2007_07_01) return false;
  if (!fodselsdato || !controlDate) return false;
  // Regelvalget må ikke afhænge af, om faktoropslaget lykkes. Ellers bliver
  // manglende data fejlagtigt til fravær af kapitalisering frem for en fejl.
  return isWithinTwoYearsOfFolkepension(fodselsdato, controlDate);
};

/** Ældre skader fortsætter løbende i 2-årsvinduet, også ved en endelig afgørelse under 50 %. */
export const isUdenKapitaliseringFoer2007VedToAarsgraensen = (
  skadedato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): boolean => skadedato !== undefined && skadedato < SKAERING_2007_07_01
  && fodselsdato !== undefined && controlDate !== undefined
  && isWithinTwoYearsOfFolkepension(fodselsdato, controlDate);
