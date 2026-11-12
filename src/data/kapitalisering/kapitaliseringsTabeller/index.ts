import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import { getDayBeforeIso } from '../../../utils/isoDateHelpers';
import * as k10029_2024 from './10029-2024';
import * as k10056_2025 from './10056-2025';
import * as k10141_2022 from './10141-2022';
import * as k10183_2025 from './10183-2025';
import * as k1022_2009 from './1022-2009';
import * as k10253_2026 from './10253-2026';
import * as k1047_2008 from './1047-2008';
import * as k1068_2003 from './1068-2003';
import * as k1156_2017 from './1156-2017';
import * as k1202_2013 from './1202-2013';
import * as k1220_2010 from './1220-2010';
import * as k1221_2010 from './1221-2010';
import * as k1233_2018 from './1233-2018';
import * as k1263_2007 from './1263-2007';
import * as k1275_2014 from './1275-2014';
import * as k1275_2016 from './1275-2016';
import * as k1358_2011 from './1358-2011';
import * as k1403_2011 from './1403-2011';
import * as k1663_2015 from './1663-2015';
import * as k1664_2015 from './1664-2015';
import * as k1700_2015 from './1700-2015';
import * as k198_2015 from './198-2015';
import * as k199_2015 from './199-2015';
import * as k229_2014 from './229-2014';
import * as k440_2009 from './440-2009';
import * as k449_2009 from './449-2009';
import * as k678_2007 from './678-2007';
import * as k9376_2024 from './9376-2024';
import * as k9741_2020 from './9741-2020';
import * as k9820_2023 from './9820-2023';
import * as k9864_2021 from './9864-2021';
import * as k9870_2020 from './9870-2020';
import * as k9871_2020 from './9871-2020';
import * as k990_2012 from './990-2012';
import * as k9921_2019 from './9921-2019';

/*
 * Kapitaliseringstabellerne: én fil pr. bekendtgørelse/vejledning, alle med samme struktur.
 *
 * - `kildetabeller` er HELE kildens tabelliste. Hver tabel er enten i registret (og så peger et tabelvalg på
 *   den) eller står i `udeladteKildetabeller` med en begrundelse. Integritetskontrollen herunder afviser
 *   både en valgt tabel uden faktorer, en indlæst tabel uden tabelvalg og en kildetabel, der hverken er
 *   indlæst eller begrundet udeladt – en manglende tabel kan derfor ikke længere opstå tavst.
 * - Tabelvalgene er eksplicitte og fuldstændige: EET-årgangene er sammenhængende intervaller, og
 *   forsørgertabsvalget (inkl. kønsopdeling) står i data – ikke i domænekoden.
 * - Særfaktoren (≤ 2 år til folkepension) findes for præcis de skadesintervaller fra 1. juli 2007, som
 *   kilden dækker; ældre skadesintervaller har ingen særfaktor i nogen kilde.
 */

export type KapitaliseringsType = 'bkg' | 'vejl';

/** Hvorfor en kildetabel bevidst ikke er i registret. */
export type UdeladelsesGrund =
  /** Lov om sikring mod følger af arbejdsskade (ulykker før 2004, sygdomme anmeldt før 2005). */
  | 'skader-foer-2004'
  /** Afløsningsbeløb efter lov om sikring mod følger af arbejdsskade. */
  | 'afloesningsbeloeb'
  /** Fremtidige permanente behandlingsudgifter beregnes ikke i Mineo. */
  | 'behandlingsudgifter'
  /** Varigt mén beregnes ikke i Mineo. */
  | 'varigt-men';

export type AldersFaktorRaekke = Readonly<{
  alder: number;
  faktor: number;
}>;

export type AldersKoensopdeltFaktorRaekke = Readonly<{
  alder: number;
  maendFaktor: number;
  kvinderFaktor: number;
}>;

export type ForsoergertabMatrixRaekke = Readonly<{
  alder: number;
  faktorerPraHeleAar: readonly number[];
}>;

/** Datafilernes rå form; datoerne valideres og brandes ved indlæsning. */
export type RaaErhvervsevnetabTabelvalg = Readonly<{
  skadedatoFra: string;
  foedselsdatoFra: string;
  foedselsdatoTil: string | null;
  tabel: string;
}>;

export type RaaForsoergertabTabelvalg =
  | Readonly<{ skadedatoFra: string; tabel: string }>
  | Readonly<{ skadedatoFra: string; tabelMaend: string; tabelKvinder: string }>;

export type RaaSaerfaktor = Readonly<{
  skadedatoFra: string;
  faktor: number;
}>;

export type ErhvervsevnetabTabelvalg = Readonly<{
  skadedatoFra: ISODateString;
  foedselsdatoFra: ISODateString;
  /** `null` kun for den yngste årgang i skadesintervallet. */
  foedselsdatoTil: ISODateString | null;
  tabel: string;
}>;

export type ForsoergertabTabelvalg =
  | Readonly<{ skadedatoFra: ISODateString; koensopdelt: false; tabel: string }>
  | Readonly<{ skadedatoFra: ISODateString; koensopdelt: true; tabelMaend: string; tabelKvinder: string }>;

export type SaerfaktorPerSkadesinterval = Readonly<{
  skadedatoFra: ISODateString;
  faktor: number;
}>;

export type KapitaliseringsTabelData = Readonly<{
  kapitaliseringsId: string;
  kapitaliseringsType: KapitaliseringsType;
  kapitaliseringsFuldeNavn: string;
  kapitaliseringsDatering: string;
  gyldigFra: ISODateString;
  gyldigTil: ISODateString;
  kildePdfFil: string;
  /** Ændringsakter, hvis tabeller eller tekst indgår i den gældende udgave (fx BEK 1339/2013 for 1202/2013). */
  supplerendeKildePdfFiler: readonly string[];
  kildetabeller: readonly string[];
  udeladteKildetabeller: Readonly<Record<string, UdeladelsesGrund>>;
  erhvervsevnetabTabelvalg: readonly ErhvervsevnetabTabelvalg[];
  erhvervsevnetabTabeller: Readonly<Record<string, readonly AldersFaktorRaekke[]>>;
  erhvervsevnetabKoensopdelteTabeller: Readonly<Record<string, readonly AldersKoensopdeltFaktorRaekke[]>>;
  forsoergertabTabelvalg: readonly ForsoergertabTabelvalg[];
  forsoergertabTabeller: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  forsoergertabTabellerMaend: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  forsoergertabTabellerKvinder: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  saerfaktorUnderToAarTilFpPerSkadesinterval: readonly SaerfaktorPerSkadesinterval[];
}>;

type KapitaliseringsModul = Readonly<{
  kapitaliseringsId: string;
  kapitaliseringsType: KapitaliseringsType;
  kapitaliseringsFuldeNavn: string;
  kapitaliseringsDatering: string;
  gyldigFra: string;
  gyldigTil: string;
  supplerendeKildePdfFiler: readonly string[];
  kildetabeller: readonly string[];
  udeladteKildetabeller: Readonly<Record<string, UdeladelsesGrund>>;
  erhvervsevnetabTabelvalg: readonly RaaErhvervsevnetabTabelvalg[];
  forsoergertabTabelvalg: readonly RaaForsoergertabTabelvalg[];
  saerfaktorUnderToAarTilFp: readonly RaaSaerfaktor[];
  erhvervsevnetabTabeller: Readonly<Record<string, readonly AldersFaktorRaekke[]>>;
  erhvervsevnetabKoensopdelteTabeller: Readonly<Record<string, readonly AldersKoensopdeltFaktorRaekke[]>>;
  forsoergertabTabeller: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  forsoergertabTabellerMaend: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  forsoergertabTabellerKvinder: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
}>;

const kildePdfFil = (type: KapitaliseringsType, id: string): string =>
  `${type === 'bkg' ? 'Bkg.' : 'Vejl.'} ${id.replace('/', ' ')}.pdf`;

const toForsoergertabTabelvalg = (raa: RaaForsoergertabTabelvalg): ForsoergertabTabelvalg =>
  'tabel' in raa
    ? { skadedatoFra: toISODateString(raa.skadedatoFra), koensopdelt: false, tabel: raa.tabel }
    : {
      skadedatoFra: toISODateString(raa.skadedatoFra),
      koensopdelt: true,
      tabelMaend: raa.tabelMaend,
      tabelKvinder: raa.tabelKvinder,
    };

const createKapitaliseringsEntry = (modul: KapitaliseringsModul): KapitaliseringsTabelData => ({
  kapitaliseringsId: modul.kapitaliseringsId,
  kapitaliseringsType: modul.kapitaliseringsType,
  kapitaliseringsFuldeNavn: modul.kapitaliseringsFuldeNavn,
  kapitaliseringsDatering: modul.kapitaliseringsDatering,
  gyldigFra: toISODateString(modul.gyldigFra),
  gyldigTil: toISODateString(modul.gyldigTil),
  kildePdfFil: kildePdfFil(modul.kapitaliseringsType, modul.kapitaliseringsId),
  supplerendeKildePdfFiler: modul.supplerendeKildePdfFiler,
  kildetabeller: modul.kildetabeller,
  udeladteKildetabeller: modul.udeladteKildetabeller,
  erhvervsevnetabTabelvalg: modul.erhvervsevnetabTabelvalg.map((valg) => ({
    skadedatoFra: toISODateString(valg.skadedatoFra),
    foedselsdatoFra: toISODateString(valg.foedselsdatoFra),
    foedselsdatoTil: valg.foedselsdatoTil === null ? null : toISODateString(valg.foedselsdatoTil),
    tabel: valg.tabel,
  })),
  erhvervsevnetabTabeller: modul.erhvervsevnetabTabeller,
  erhvervsevnetabKoensopdelteTabeller: modul.erhvervsevnetabKoensopdelteTabeller,
  forsoergertabTabelvalg: modul.forsoergertabTabelvalg.map(toForsoergertabTabelvalg),
  forsoergertabTabeller: modul.forsoergertabTabeller,
  forsoergertabTabellerMaend: modul.forsoergertabTabellerMaend,
  forsoergertabTabellerKvinder: modul.forsoergertabTabellerKvinder,
  saerfaktorUnderToAarTilFpPerSkadesinterval: modul.saerfaktorUnderToAarTilFp.map((raekke) => ({
    skadedatoFra: toISODateString(raekke.skadedatoFra),
    faktor: raekke.faktor,
  })),
});

const MODULER: readonly KapitaliseringsModul[] = [
  k10029_2024, k10056_2025, k10141_2022, k10183_2025, k1022_2009, k10253_2026, k1047_2008, k1068_2003,
  k1156_2017, k1202_2013, k1220_2010, k1221_2010, k1233_2018, k1263_2007, k1275_2014, k1275_2016,
  k1358_2011, k1403_2011, k1663_2015, k1664_2015, k1700_2015, k198_2015, k199_2015, k229_2014,
  k440_2009, k449_2009, k678_2007, k9376_2024, k9741_2020, k9820_2023, k9864_2021, k9870_2020,
  k9871_2020, k990_2012, k9921_2019,
];

export const kapitaliseringsTabelDataById: Readonly<Record<string, KapitaliseringsTabelData>> = Object.fromEntries(
  MODULER.map((modul) => [modul.kapitaliseringsId, createKapitaliseringsEntry(modul)])
);

/** Særfaktoren findes i kilderne for skader fra denne dato (lov nr. 496 af 6. juni 2007). */
export const SAERFAKTOR_SKADEDATO_FRA = toISODateString('2007-07-01');

const fail = (message: string): never => {
  throw new Error(`Kapitaliseringstabeller: ${message}`);
};

const assertAldersraekker = (rows: readonly Readonly<{ alder: number }>[], label: string): void => {
  if (rows.length === 0) fail(`${label}: faktortabellen er tom`);
  let previousAge = -Infinity;
  for (const row of rows) {
    if (!Number.isInteger(row.alder) || row.alder <= previousAge) {
      fail(`${label}: aldersværdierne skal være unikke heltal sorteret stigende`);
    }
    previousAge = row.alder;
  }
};

const assertFaktor = (value: number, label: string): void => {
  if (!Number.isFinite(value)) fail(`${label}: faktoren skal være et endeligt tal`);
  if (value <= 0) fail(`${label}: faktoren skal være positiv`);
};

const sammeMaengde = (a: ReadonlySet<string>, b: ReadonlySet<string>): boolean =>
  a.size === b.size && [...a].every((value) => b.has(value));

const disjunkteNavne = (label: string, ...grupper: readonly (readonly string[])[]): Set<string> => {
  const alle = new Set<string>();
  for (const gruppe of grupper) {
    for (const navn of gruppe) {
      if (alle.has(navn)) fail(`${label}: tabel ${navn} er registreret flere gange`);
      alle.add(navn);
    }
  }
  return alle;
};

const assertTabeller = (id: string, entry: KapitaliseringsTabelData): void => {
  for (const [navn, rows] of Object.entries(entry.erhvervsevnetabTabeller)) {
    assertAldersraekker(rows, `${id}/${navn}`);
    rows.forEach((row) => assertFaktor(row.faktor, `${id}/${navn}/${row.alder}`));
  }
  for (const [navn, rows] of Object.entries(entry.erhvervsevnetabKoensopdelteTabeller)) {
    assertAldersraekker(rows, `${id}/${navn}`);
    rows.forEach((row) => {
      assertFaktor(row.maendFaktor, `${id}/${navn}/${row.alder}/mænd`);
      assertFaktor(row.kvinderFaktor, `${id}/${navn}/${row.alder}/kvinder`);
    });
  }
  for (const [navn, rows] of Object.entries({
    ...entry.forsoergertabTabeller,
    ...entry.forsoergertabTabellerMaend,
    ...entry.forsoergertabTabellerKvinder,
  })) {
    assertAldersraekker(rows, `${id}/${navn}`);
    rows.forEach((row) => {
      if (row.faktorerPraHeleAar.length === 0) fail(`${id}/${navn}/${row.alder}: faktorrækken er tom`);
      row.faktorerPraHeleAar.forEach((faktor, index) => assertFaktor(faktor, `${id}/${navn}/${row.alder}/${index}`));
    });
  }
};

/** Hvert skadesintervals årgange skal dække et sammenhængende fødselsdatointerval med én åben (yngste) årgang. */
const assertEetTabelvalg = (id: string, entry: KapitaliseringsTabelData): Set<string> => {
  const grupper = new Map<string, ErhvervsevnetabTabelvalg[]>();
  for (const valg of entry.erhvervsevnetabTabelvalg) {
    if (valg.tabel.trim() === '') fail(`${id}: tomt EET-tabelvalg ved ${valg.skadedatoFra}`);
    if (valg.foedselsdatoTil !== null && valg.foedselsdatoFra > valg.foedselsdatoTil) {
      fail(`${id}: ugyldigt EET-tabelvalg ved ${valg.skadedatoFra} (${valg.foedselsdatoFra} > ${valg.foedselsdatoTil})`);
    }
    grupper.set(valg.skadedatoFra, [...(grupper.get(valg.skadedatoFra) ?? []), valg]);
  }
  for (const [skadedatoFra, valg] of grupper) {
    const sorteret = [...valg].sort((a, b) => a.foedselsdatoFra.localeCompare(b.foedselsdatoFra));
    sorteret.forEach((current, index) => {
      const next = sorteret[index + 1];
      if (next === undefined) {
        if (current.foedselsdatoTil !== null) fail(`${id}: den yngste årgang ved ${skadedatoFra} skal være åben`);
        return;
      }
      if (current.foedselsdatoTil === null || current.foedselsdatoTil !== getDayBeforeIso(next.foedselsdatoFra)) {
        fail(`${id}: EET-årgangene ved ${skadedatoFra} overlapper eller har et hul ved ${next.foedselsdatoFra}`);
      }
    });
  }
  return new Set(grupper.keys());
};

const assertKapitaliseringsEntry = (registeredId: string, entry: KapitaliseringsTabelData): void => {
  const id = entry.kapitaliseringsId;
  if (registeredId !== id) fail(`registernøglen "${registeredId}" matcher ikke id "${id}"`);
  if (entry.gyldigFra > entry.gyldigTil || entry.kapitaliseringsFuldeNavn.trim() === '') {
    fail(`"${id}": ugyldige metadata`);
  }
  assertTabeller(id, entry);

  // Kildens tabeller: hver er enten indlæst eller begrundet udeladt – aldrig begge, aldrig ingen af delene.
  const eetNavne = disjunkteNavne(id, Object.keys(entry.erhvervsevnetabTabeller), Object.keys(entry.erhvervsevnetabKoensopdelteTabeller));
  const ftNavne = disjunkteNavne(
    id,
    Object.keys(entry.forsoergertabTabeller),
    Object.keys(entry.forsoergertabTabellerMaend),
    Object.keys(entry.forsoergertabTabellerKvinder),
  );
  const registrerede = disjunkteNavne(id, [...eetNavne], [...ftNavne], Object.keys(entry.udeladteKildetabeller));
  const kilde = disjunkteNavne(`${id} (kildetabeller)`, entry.kildetabeller);
  if (!sammeMaengde(registrerede, kilde)) {
    fail(
      `${id}: kildens tabeller [${[...kilde].join(', ')}] skal hver være indlæst eller begrundet udeladt; `
      + `registret har [${[...registrerede].join(', ')}]`
    );
  }

  // Tabelvalg og tabeller: hvert valg peger på en indlæst tabel, og hver indlæst tabel kan vælges.
  const eetSkadedatoer = assertEetTabelvalg(id, entry);
  const eetValgte = new Set(entry.erhvervsevnetabTabelvalg.map((valg) => valg.tabel));
  if (!sammeMaengde(eetValgte, eetNavne)) {
    fail(`${id}: EET-tabelvalg [${[...eetValgte].join(', ')}] matcher ikke EET-tabellerne [${[...eetNavne].join(', ')}]`);
  }
  const koensopdeltEet = Object.keys(entry.erhvervsevnetabKoensopdelteTabeller).length > 0;
  if (koensopdeltEet && Object.keys(entry.erhvervsevnetabTabeller).length > 0) {
    fail(`${id}: blander kønsopdelte og kønsneutrale EET-tabeller`);
  }

  const ftSkadedatoer = new Set<string>();
  const ftValgte = new Set<string>();
  for (const valg of entry.forsoergertabTabelvalg) {
    if (ftSkadedatoer.has(valg.skadedatoFra)) fail(`${id}: duplikeret forsørgertabsvalg ved ${valg.skadedatoFra}`);
    ftSkadedatoer.add(valg.skadedatoFra);
    if (valg.koensopdelt !== koensopdeltEet) {
      fail(`${id}: forsørgertabsvalget ved ${valg.skadedatoFra} følger ikke bekendtgørelsens kønsopdeling`);
    }
    if (valg.koensopdelt) {
      if (!(valg.tabelMaend in entry.forsoergertabTabellerMaend)) fail(`${id}: forsørgertabstabel ${valg.tabelMaend} (mænd) mangler`);
      if (!(valg.tabelKvinder in entry.forsoergertabTabellerKvinder)) fail(`${id}: forsørgertabstabel ${valg.tabelKvinder} (kvinder) mangler`);
      ftValgte.add(valg.tabelMaend).add(valg.tabelKvinder);
    } else {
      if (!(valg.tabel in entry.forsoergertabTabeller)) fail(`${id}: forsørgertabstabel ${valg.tabel} mangler`);
      ftValgte.add(valg.tabel);
    }
  }
  if (!sammeMaengde(ftValgte, ftNavne)) {
    fail(`${id}: forsørgertabsvalg [${[...ftValgte].join(', ')}] matcher ikke tabellerne [${[...ftNavne].join(', ')}]`);
  }
  if (!sammeMaengde(ftSkadedatoer, eetSkadedatoer)) {
    fail(`${id}: forsørgertab og erhvervsevnetab dækker forskellige skadesintervaller`);
  }

  // Særfaktoren: præcis én pr. skadesinterval fra 1. juli 2007 – og ingen for ældre skadesintervaller.
  const saerfaktorDatoer = new Set<string>();
  for (const raekke of entry.saerfaktorUnderToAarTilFpPerSkadesinterval) {
    if (saerfaktorDatoer.has(raekke.skadedatoFra)) fail(`${id}: duplikeret særfaktorinterval ${raekke.skadedatoFra}`);
    saerfaktorDatoer.add(raekke.skadedatoFra);
    assertFaktor(raekke.faktor, `${id}/særfaktor/${raekke.skadedatoFra}`);
  }
  const forventedeSaerfaktorDatoer = new Set([...eetSkadedatoer].filter((dato) => dato >= SAERFAKTOR_SKADEDATO_FRA));
  if (!sammeMaengde(saerfaktorDatoer, forventedeSaerfaktorDatoer)) {
    fail(
      `${id}: særfaktor findes for [${[...saerfaktorDatoer].join(', ')}], `
      + `men skal findes for præcis [${[...forventedeSaerfaktorDatoer].join(', ')}]`
    );
  }
};

/** Fail-closed validering af kilde-PDF'ernes normaliserede runtime-payload. */
export const assertKapitaliseringsTabelDataIntegritet = (
  entries: Readonly<Record<string, KapitaliseringsTabelData>>,
): void => {
  if (Object.keys(entries).length === 0) fail('registret er tomt');
  for (const [registeredId, entry] of Object.entries(entries)) assertKapitaliseringsEntry(registeredId, entry);
};

assertKapitaliseringsTabelDataIntegritet(kapitaliseringsTabelDataById);

export const getKapitaliseringsTabelData = (kapitaliseringsId: string): KapitaliseringsTabelData | undefined => {
  return kapitaliseringsTabelDataById[kapitaliseringsId];
};
