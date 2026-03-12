import { kapitaliseringsbekendtgoerelser } from '../../data/kapitalisering/kapitaliseringsbekendtgørelser';
import {
  getKapitaliseringsTabelData,
  type HistoriskErhvervsevnetabTabelvalg,
  type HistoriskErhvervsevnetabTabelvalgUdenFoedselsdato,
  type KapitaliseringsTabelData,
  type ModerneErhvervsevnetabTabelvalg,
} from '../../data/kapitalisering/kapitaliseringsTabeller';
import type { ISODateString } from '../../types/branded';
import { dateToISO, parseISODate } from '../../types/branded';
import { addDays } from '../../utils/dateUtils';

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

type DerivedFoerMinimumFp = Readonly<{
  folkepensionsalderMaaneder: number;
  folkepensionsalderLabel: string;
}>;

export const resolveKapitaliseringsbekendtgoerelseId = (
  skadesdato: ISODateString,
  dato: ISODateString
): string | null => {
  const skadesinterval = kapitaliseringsbekendtgoerelser
    .filter((interval) => interval.skadesdatoFra <= skadesdato)
    .reduce<typeof kapitaliseringsbekendtgoerelser[number] | null>((latest, current) => {
      if (!latest) return current;
      return current.skadesdatoFra > latest.skadesdatoFra ? current : latest;
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
    : (`${kandidat.kapitaliseringsdatoFra.slice(0, 4)}-12-31` as ISODateString);
  if (!gyldigTil) return null;
  return dato <= gyldigTil ? kandidat.id : null;
};

const parseAgeLabelToMonths = (label: string): number | null => {
  const trimmed = label.trim().replace(',', '.');
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed)) return null;
  const months = Math.round(parsed * 12);
  return months >= 0 ? months : null;
};

const deriveFoerMinimumFoedselsdatoFp = (
  fodselsdato: ISODateString
): DerivedFoerMinimumFp | null => {
  if (fodselsdato >= ('1955-01-01' as ISODateString) && fodselsdato < ('1955-07-01' as ISODateString)) {
    return { folkepensionsalderMaaneder: 798, folkepensionsalderLabel: '66,5 år' };
  }
  if (fodselsdato >= ('1954-07-01' as ISODateString) && fodselsdato < ('1955-01-01' as ISODateString)) {
    return { folkepensionsalderMaaneder: 792, folkepensionsalderLabel: '66 år' };
  }
  if (fodselsdato >= ('1954-01-01' as ISODateString) && fodselsdato < ('1954-07-01' as ISODateString)) {
    return { folkepensionsalderMaaneder: 786, folkepensionsalderLabel: '65,5 år' };
  }
  if (fodselsdato < ('1954-01-01' as ISODateString)) {
    return { folkepensionsalderMaaneder: 780, folkepensionsalderLabel: '65 år' };
  }
  return null;
};

const resolveModernFoerMinimumFoedselsdatoTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString,
  fodselsdato: ISODateString
): ResolvedKapitaliseringTabelvalg | null => {
  const relevanteEntries = tabeldata.erhvervsevnetabTabelvalg.filter((entry) => entry.skadesdatoFra <= skadesdato);
  if (relevanteEntries.length === 0) return null;

  const relevantSkadesdatoFra = relevanteEntries.reduce<ISODateString>(
    (latest, current) => (current.skadesdatoFra > latest ? current.skadesdatoFra : latest),
    relevanteEntries[0]!.skadesdatoFra
  );
  const entriesForSkadesinterval = relevanteEntries.filter((entry) => entry.skadesdatoFra === relevantSkadesdatoFra);
  if (entriesForSkadesinterval.length === 0) return null;

  const earliestEntry = entriesForSkadesinterval.reduce<ModerneErhvervsevnetabTabelvalg>(
    (earliest, current) => (current.foedselsdatoFra < earliest.foedselsdatoFra ? current : earliest),
    entriesForSkadesinterval[0]!
  );

  if (fodselsdato >= earliestEntry.foedselsdatoFra) return null;

  const derivedFp = deriveFoerMinimumFoedselsdatoFp(fodselsdato);
  if (!derivedFp) return null;

  return {
    tabel: earliestEntry.tabel,
    folkepensionsalderMaaneder: derivedFp.folkepensionsalderMaaneder,
    folkepensionsalderLabel: derivedFp.folkepensionsalderLabel,
    usesKoen: false,
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

const resolveModernTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString,
  fodselsdato: ISODateString
): ResolvedKapitaliseringTabelvalg | null => {
  const kandidat = tabeldata.erhvervsevnetabTabelvalg
    .filter((entry) => entry.skadesdatoFra <= skadesdato && entry.foedselsdatoFra <= fodselsdato)
    .reduce<ModerneErhvervsevnetabTabelvalg | null>((latest, current) => {
      if (!latest) return current;
      if (current.skadesdatoFra !== latest.skadesdatoFra) {
        return current.skadesdatoFra > latest.skadesdatoFra ? current : latest;
      }
      return current.foedselsdatoFra > latest.foedselsdatoFra ? current : latest;
    }, null);

  if (!kandidat) {
    return resolveModernFoerMinimumFoedselsdatoTabelvalg(tabeldata, skadesdato, fodselsdato);
  }

  return {
    tabel: kandidat.tabel,
    folkepensionsalderMaaneder: kandidat.folkepensionsalderAar * 12,
    folkepensionsalderLabel: `${kandidat.folkepensionsalderAar} år`,
    usesKoen: false,
  };
};

const resolveHistoriskTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString,
  fodselsdato: ISODateString
): ResolvedKapitaliseringTabelvalg | null => {
  const kandidat = tabeldata.historiskErhvervsevnetabTabelvalg
    .filter((entry) => {
      if (entry.skadesdatoFra > skadesdato) return false;
      if (entry.foedselsdatoFra > fodselsdato) return false;
      if (entry.foedselsdatoTil && fodselsdato > entry.foedselsdatoTil) return false;
      return true;
    })
    .reduce<HistoriskErhvervsevnetabTabelvalg | null>((latest, current) => {
      if (!latest) return current;
      if (current.skadesdatoFra !== latest.skadesdatoFra) {
        return current.skadesdatoFra > latest.skadesdatoFra ? current : latest;
      }
      return current.foedselsdatoFra > latest.foedselsdatoFra ? current : latest;
    }, null);

  if (!kandidat) return null;
  const fpMonths = parseAgeLabelToMonths(kandidat.ophoersalderAarLabel);
  if (fpMonths === null) return null;

  return {
    tabel: kandidat.tabel,
    folkepensionsalderMaaneder: fpMonths,
    folkepensionsalderLabel: `${kandidat.ophoersalderAarLabel.replace('.', ',')} år`,
    usesKoen: true,
  };
};

const resolveHistoriskTabelvalgUdenFoedselsdato = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString
): ResolvedKapitaliseringTabelvalg | null => {
  const kandidat = tabeldata.historiskErhvervsevnetabTabelvalgUdenFoedselsdato
    .filter((entry) => entry.skadesdatoFra <= skadesdato)
    .reduce<HistoriskErhvervsevnetabTabelvalgUdenFoedselsdato | null>((latest, current) => {
      if (!latest) return current;
      return current.skadesdatoFra > latest.skadesdatoFra ? current : latest;
    }, null);

  if (!kandidat) return null;
  const fpMonths = parseAgeLabelToMonths(kandidat.ophoersalderAarLabel);
  if (fpMonths === null) return null;

  return {
    tabel: kandidat.tabel,
    folkepensionsalderMaaneder: fpMonths,
    folkepensionsalderLabel: `${kandidat.ophoersalderAarLabel.replace('.', ',')} år`,
    usesKoen: true,
  };
};

export const resolveKapitaliseringTabelvalg = (
  tabeldata: KapitaliseringsTabelData,
  skadesdato: ISODateString,
  fodselsdato: ISODateString
): ResolvedKapitaliseringTabelvalg | null => {
  if (tabeldata.erhvervsevnetabTabelvalg.length > 0) {
    return resolveModernTabelvalg(tabeldata, skadesdato, fodselsdato);
  }
  if (tabeldata.historiskErhvervsevnetabTabelvalg.length > 0) {
    return resolveHistoriskTabelvalg(tabeldata, skadesdato, fodselsdato);
  }
  return resolveHistoriskTabelvalgUdenFoedselsdato(tabeldata, skadesdato);
};

export const resolveKapitaliseringTabelvalgForControlDate = (
  skadesdato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): ResolvedKapitaliseringTabelvalg | null => {
  if (!skadesdato || !fodselsdato || !controlDate) return null;

  const controlBekId = resolveKapitaliseringsbekendtgoerelseId(skadesdato, controlDate);
  if (!controlBekId) return null;

  const controlData = getKapitaliseringsTabelData(controlBekId);
  if (!controlData) return null;

  return resolveKapitaliseringTabelvalg(controlData, skadesdato, fodselsdato);
};

export const isUnderOrEqualTwoYearsToFpByBekendtgoerelse = (
  skadesdato: ISODateString | undefined,
  fodselsdato: ISODateString | undefined,
  controlDate: ISODateString | undefined
): boolean => {
  const controlTabelvalg = resolveKapitaliseringTabelvalgForControlDate(skadesdato, fodselsdato, controlDate);
  if (!controlTabelvalg) return false;
  if (!fodselsdato || !controlDate) return false;

  const controlAge = calculateAgeYearsMonths(fodselsdato, controlDate);
  if (!controlAge) return false;

  return controlTabelvalg.folkepensionsalderMaaneder - controlAge.totalMonths <= 24;
};
