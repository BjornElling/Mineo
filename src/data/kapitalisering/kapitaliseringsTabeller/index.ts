import type { ISODateString } from '../../../types/branded';
import * as k10029_2024 from './10029-2024';
import * as k10056_2025 from './10056-2025';
import * as k10141_2022 from './10141-2022';
import * as k10183_2025 from './10183-2025';
import * as k1022_2009 from './1022-2009';
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

export type KapitaliseringsType = 'bkg' | 'vejl';

export type AldersFaktorRaekke = Readonly<{
  alder: number;
  faktor: number;
}>;

export type AldersKoensopdeltFaktorRaekke = Readonly<{
  alder: number;
  maendFaktor: number;
  kvinderFaktor: number;
}>;

export type ErhvervsevnetabTabelvalg = Readonly<{
  skadedatoFra: ISODateString;
  foedselsdatoFra: ISODateString;
  foedselsdatoTil: ISODateString | null;
  tabel: string;
}>;

export type ForsoergertabTabelvalg = Readonly<{
  skadedatoFra: ISODateString;
  tabel: string;
}>;

type InputErhvervsevnetabTabelvalg = Readonly<{
  skadedatoFra: ISODateString;
  foedselsdatoFra: ISODateString;
  tabel: string;
  foedselsdatoTil?: ISODateString | null;
}>;

export type SaerfaktorPerSkadesinterval = Readonly<{
  skadedatoFra: ISODateString;
  faktor: number;
}>;

export type ForsoergertabMatrixRaekke = Readonly<{
  alder: number;
  faktorerPraHeleAar: readonly number[];
}>;

export type KapitaliseringsTabelData = Readonly<{
  kapitaliseringsId: string;
  kapitaliseringsType: KapitaliseringsType;
  kapitaliseringsFuldeNavn: string;
  kapitaliseringsDatering: string;
  gyldigFra: ISODateString;
  gyldigTil: ISODateString;
  kildePdfFil: string;
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
  gyldigFra: ISODateString;
  gyldigTil: ISODateString;
  erhvervsevnetabTabelvalg: readonly InputErhvervsevnetabTabelvalg[];
  erhvervsevnetabTabeller?: Readonly<Record<string, readonly AldersFaktorRaekke[]>>;
  erhvervsevnetabKoensopdelteTabeller?: Readonly<Record<string, readonly AldersKoensopdeltFaktorRaekke[]>>;
  forsoergertabTabelvalg?: readonly ForsoergertabTabelvalg[];
  forsoergertabTabeller?: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  forsoergertabTabellerMaend?: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  forsoergertabTabellerKvinder?: Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
  saerfaktorUnderToAarTilFpPerSkadesinterval?: readonly SaerfaktorPerSkadesinterval[];
}>;

const normalizeErhvervsevnetabTabelvalg = (
  entries: readonly InputErhvervsevnetabTabelvalg[]
): readonly ErhvervsevnetabTabelvalg[] =>
  entries.map((entry) => ({
    skadedatoFra: entry.skadedatoFra,
    foedselsdatoFra: entry.foedselsdatoFra,
    foedselsdatoTil: entry.foedselsdatoTil ?? null,
    tabel: entry.tabel,
  }));

const createKapitaliseringsEntry = (modul: KapitaliseringsModul): KapitaliseringsTabelData => ({
  kapitaliseringsId: modul.kapitaliseringsId,
  kapitaliseringsType: modul.kapitaliseringsType,
  kapitaliseringsFuldeNavn: modul.kapitaliseringsFuldeNavn,
  kapitaliseringsDatering: modul.kapitaliseringsDatering,
  gyldigFra: modul.gyldigFra,
  gyldigTil: modul.gyldigTil,
  kildePdfFil: `${modul.kapitaliseringsType === 'bkg' ? 'Bkg.' : 'Vejl.'} ${modul.kapitaliseringsId.replace('/', ' ')}.pdf`,
  erhvervsevnetabTabelvalg: normalizeErhvervsevnetabTabelvalg(modul.erhvervsevnetabTabelvalg),
  erhvervsevnetabTabeller: modul.erhvervsevnetabTabeller ?? {},
  erhvervsevnetabKoensopdelteTabeller: modul.erhvervsevnetabKoensopdelteTabeller ?? {},
  forsoergertabTabelvalg: modul.forsoergertabTabelvalg ?? [],
  forsoergertabTabeller: modul.forsoergertabTabeller ?? {},
  forsoergertabTabellerMaend: modul.forsoergertabTabellerMaend ?? {},
  forsoergertabTabellerKvinder: modul.forsoergertabTabellerKvinder ?? {},
  saerfaktorUnderToAarTilFpPerSkadesinterval: modul.saerfaktorUnderToAarTilFpPerSkadesinterval ?? [],
});

export const kapitaliseringsTabelDataById: Readonly<Record<string, KapitaliseringsTabelData>> = {
  [k10029_2024.kapitaliseringsId]: createKapitaliseringsEntry(k10029_2024),
  [k10056_2025.kapitaliseringsId]: createKapitaliseringsEntry(k10056_2025),
  [k10141_2022.kapitaliseringsId]: createKapitaliseringsEntry(k10141_2022),
  [k10183_2025.kapitaliseringsId]: createKapitaliseringsEntry(k10183_2025),
  [k1022_2009.kapitaliseringsId]: createKapitaliseringsEntry(k1022_2009),
  [k1047_2008.kapitaliseringsId]: createKapitaliseringsEntry(k1047_2008),
  [k1068_2003.kapitaliseringsId]: createKapitaliseringsEntry(k1068_2003),
  [k1156_2017.kapitaliseringsId]: createKapitaliseringsEntry(k1156_2017),
  [k1202_2013.kapitaliseringsId]: createKapitaliseringsEntry(k1202_2013),
  [k1220_2010.kapitaliseringsId]: createKapitaliseringsEntry(k1220_2010),
  [k1221_2010.kapitaliseringsId]: createKapitaliseringsEntry(k1221_2010),
  [k1233_2018.kapitaliseringsId]: createKapitaliseringsEntry(k1233_2018),
  [k1263_2007.kapitaliseringsId]: createKapitaliseringsEntry(k1263_2007),
  [k1275_2014.kapitaliseringsId]: createKapitaliseringsEntry(k1275_2014),
  [k1275_2016.kapitaliseringsId]: createKapitaliseringsEntry(k1275_2016),
  [k1358_2011.kapitaliseringsId]: createKapitaliseringsEntry(k1358_2011),
  [k1403_2011.kapitaliseringsId]: createKapitaliseringsEntry(k1403_2011),
  [k1663_2015.kapitaliseringsId]: createKapitaliseringsEntry(k1663_2015),
  [k1664_2015.kapitaliseringsId]: createKapitaliseringsEntry(k1664_2015),
  [k1700_2015.kapitaliseringsId]: createKapitaliseringsEntry(k1700_2015),
  [k198_2015.kapitaliseringsId]: createKapitaliseringsEntry(k198_2015),
  [k199_2015.kapitaliseringsId]: createKapitaliseringsEntry(k199_2015),
  [k440_2009.kapitaliseringsId]: createKapitaliseringsEntry(k440_2009),
  [k449_2009.kapitaliseringsId]: createKapitaliseringsEntry(k449_2009),
  [k678_2007.kapitaliseringsId]: createKapitaliseringsEntry(k678_2007),
  [k9376_2024.kapitaliseringsId]: createKapitaliseringsEntry(k9376_2024),
  [k9741_2020.kapitaliseringsId]: createKapitaliseringsEntry(k9741_2020),
  [k9820_2023.kapitaliseringsId]: createKapitaliseringsEntry(k9820_2023),
  [k9864_2021.kapitaliseringsId]: createKapitaliseringsEntry(k9864_2021),
  [k9870_2020.kapitaliseringsId]: createKapitaliseringsEntry(k9870_2020),
  [k9871_2020.kapitaliseringsId]: createKapitaliseringsEntry(k9871_2020),
  [k990_2012.kapitaliseringsId]: createKapitaliseringsEntry(k990_2012),
  [k9921_2019.kapitaliseringsId]: createKapitaliseringsEntry(k9921_2019),
} as const;

const assertAldersraekker = (
  rows: readonly Readonly<{ alder: number }>[],
  label: string,
): void => {
  let previousAge = -Infinity;
  for (const row of rows) {
    if (!Number.isInteger(row.alder) || row.alder <= previousAge) {
      throw new Error(`${label}: aldersværdierne skal være unikke heltal sorteret stigende`);
    }
    previousAge = row.alder;
  }
};

const assertFinite = (value: number, label: string): void => {
  if (!Number.isFinite(value)) throw new Error(`${label}: faktoren skal være et endeligt tal`);
};

/** Fail-closed validering af de 33 kilde-PDF'ers normaliserede runtime-payload. */
export const assertKapitaliseringsTabelDataIntegritet = (
  entries: Readonly<Record<string, KapitaliseringsTabelData>>
): void => {
  if (Object.keys(entries).length === 0) throw new Error('Kapitaliseringstabeller: registret er tomt');

  for (const [registeredId, entry] of Object.entries(entries)) {
    if (registeredId !== entry.kapitaliseringsId) {
      throw new Error(`Kapitaliseringstabel: registernøglen "${registeredId}" matcher ikke id "${entry.kapitaliseringsId}"`);
    }
    if (entry.gyldigFra > entry.gyldigTil || entry.kapitaliseringsFuldeNavn.trim() === '') {
      throw new Error(`Kapitaliseringstabel "${registeredId}": ugyldige metadata`);
    }

    // Et tabelvalg må bevidst mangle en faktor-payload, når originalkilden ikke indeholder
    // tabellen (fx tabel A i 1068/2003). Beregningslaget bruger fraværet til at fail-close
    // med en domænefejl; katalogvalideringen må ikke udfylde eller afvise dette kildefaktum.
    for (const [tableName, rows] of Object.entries(entry.erhvervsevnetabTabeller)) {
      assertAldersraekker(rows, `${registeredId}/${tableName}`);
      rows.forEach((row) => {
        assertFinite(row.faktor, `${registeredId}/${tableName}/${row.alder}`);
      });
    }
    for (const [tableName, rows] of Object.entries(entry.erhvervsevnetabKoensopdelteTabeller)) {
      assertAldersraekker(rows, `${registeredId}/${tableName}`);
      rows.forEach((row) => {
        assertFinite(row.maendFaktor, `${registeredId}/${tableName}/${row.alder}/mænd`);
        assertFinite(row.kvinderFaktor, `${registeredId}/${tableName}/${row.alder}/kvinder`);
      });
    }

    for (const [tableName, rows] of Object.entries({
      ...entry.forsoergertabTabeller,
      ...entry.forsoergertabTabellerMaend,
      ...entry.forsoergertabTabellerKvinder,
    })) {
      assertAldersraekker(rows, `${registeredId}/${tableName}`);
      rows.forEach((row) => {
        if (row.faktorerPraHeleAar.length === 0) {
          throw new Error(`${registeredId}/${tableName}/${row.alder}: faktorrækken er tom`);
        }
        row.faktorerPraHeleAar.forEach((factor, index) =>
          assertFinite(factor, `${registeredId}/${tableName}/${row.alder}/${index}`)
        );
      });
    }
    entry.saerfaktorUnderToAarTilFpPerSkadesinterval.forEach((row) =>
      assertFinite(row.faktor, `${registeredId}/særfaktor/${row.skadedatoFra}`)
    );
  }
};

assertKapitaliseringsTabelDataIntegritet(kapitaliseringsTabelDataById);

export const getKapitaliseringsTabelData = (kapitaliseringsId: string): KapitaliseringsTabelData | undefined => {
  return kapitaliseringsTabelDataById[kapitaliseringsId];
};
