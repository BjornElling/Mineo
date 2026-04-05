import { toISODateString } from '../../../types/branded';

export interface AldersFaktorRaekke {
  alder: number;
  faktor: number;
}

export interface AldersKoensopdeltFaktorRaekke {
  alder: number;
  maendFaktor: number;
  kvinderFaktor: number;
}

export interface ForsoergertabMatrixRaekke {
  alder: number;
  faktorerPraHeleAar: readonly number[];
}

export const kapitaliseringsId = '1202/2013' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2014 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. januar 2011 eller senere' as const;
export const kapitaliseringsDatering = '10/10/2013' as const;
export const gyldigFra = toISODateString('2014-01-01');
export const gyldigTil = toISODateString('2014-12-31');

// Udtrukket fra BEK nr 1202 af 10/10/2013.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2011-01-01',     '1955-07-01',     null,     '67',     'A'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     '66.5',     'B'],
  ['2011-01-01',     '1954-07-01',     '1954-12-31',     '66',     'C'],
  ['2011-01-01',     '1954-01-01',     '1954-06-30',     '65.5',     'D'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, foedselsdatoTil, ophoersalderAarLabel, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    foedselsdatoTil: foedselsdatoTil ? toISODateString(foedselsdatoTil) : null,
    folkepensionsalderAar: null,
    ophoersalderAarLabel,
    tabel,
  })
);

export const erhvervsevnetabTabeller = {
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
  A: [
    { alder: 5, maendFaktor: 30.547, kvinderFaktor: 30.939 },
    { alder: 6, maendFaktor: 30.122, kvinderFaktor: 30.516 },
    { alder: 7, maendFaktor: 29.694, kvinderFaktor: 30.089 },
    { alder: 8, maendFaktor: 29.264, kvinderFaktor: 29.661 },
    { alder: 9, maendFaktor: 28.831, kvinderFaktor: 29.229 },
    { alder: 10, maendFaktor: 28.396, kvinderFaktor: 28.795 },
    { alder: 11, maendFaktor: 27.959, kvinderFaktor: 28.359 },
    { alder: 12, maendFaktor: 27.519, kvinderFaktor: 27.92 },
    { alder: 13, maendFaktor: 27.076, kvinderFaktor: 27.478 },
    { alder: 14, maendFaktor: 26.631, kvinderFaktor: 27.034 },
    { alder: 15, maendFaktor: 26.184, kvinderFaktor: 26.587 },
    { alder: 16, maendFaktor: 25.734, kvinderFaktor: 26.138 },
    { alder: 17, maendFaktor: 25.282, kvinderFaktor: 25.686 },
    { alder: 18, maendFaktor: 24.828, kvinderFaktor: 25.232 },
    { alder: 19, maendFaktor: 24.371, kvinderFaktor: 24.775 },
    { alder: 20, maendFaktor: 23.912, kvinderFaktor: 24.316 },
    { alder: 21, maendFaktor: 23.451, kvinderFaktor: 23.854 },
    { alder: 22, maendFaktor: 22.987, kvinderFaktor: 23.39 },
    { alder: 23, maendFaktor: 22.522, kvinderFaktor: 22.924 },
    { alder: 24, maendFaktor: 22.054, kvinderFaktor: 22.455 },
    { alder: 25, maendFaktor: 21.584, kvinderFaktor: 21.983 },
    { alder: 26, maendFaktor: 21.112, kvinderFaktor: 21.509 },
    { alder: 27, maendFaktor: 20.638, kvinderFaktor: 21.033 },
    { alder: 28, maendFaktor: 20.161, kvinderFaktor: 20.555 },
    { alder: 29, maendFaktor: 19.683, kvinderFaktor: 20.074 },
    { alder: 30, maendFaktor: 19.203, kvinderFaktor: 19.591 },
    { alder: 31, maendFaktor: 18.721, kvinderFaktor: 19.106 },
    { alder: 32, maendFaktor: 18.237, kvinderFaktor: 18.618 },
    { alder: 33, maendFaktor: 17.752, kvinderFaktor: 18.129 },
    { alder: 34, maendFaktor: 17.265, kvinderFaktor: 17.637 },
    { alder: 35, maendFaktor: 16.776, kvinderFaktor: 17.143 },
    { alder: 36, maendFaktor: 16.285, kvinderFaktor: 16.647 },
    { alder: 37, maendFaktor: 15.793, kvinderFaktor: 16.149 },
    { alder: 38, maendFaktor: 15.3, kvinderFaktor: 15.649 },
    { alder: 39, maendFaktor: 14.805, kvinderFaktor: 15.147 },
    { alder: 40, maendFaktor: 14.309, kvinderFaktor: 14.644 },
    { alder: 41, maendFaktor: 13.811, kvinderFaktor: 14.138 },
    { alder: 42, maendFaktor: 13.312, kvinderFaktor: 13.63 },
    { alder: 43, maendFaktor: 12.812, kvinderFaktor: 13.121 },
    { alder: 44, maendFaktor: 12.311, kvinderFaktor: 12.609 },
    { alder: 45, maendFaktor: 11.808, kvinderFaktor: 12.096 },
    { alder: 46, maendFaktor: 11.304, kvinderFaktor: 11.581 },
    { alder: 47, maendFaktor: 10.799, kvinderFaktor: 11.064 },
    { alder: 48, maendFaktor: 10.293, kvinderFaktor: 10.546 },
    { alder: 49, maendFaktor: 9.786, kvinderFaktor: 10.025 },
    { alder: 50, maendFaktor: 9.277, kvinderFaktor: 9.502 },
    { alder: 51, maendFaktor: 8.766, kvinderFaktor: 8.977 },
    { alder: 52, maendFaktor: 8.254, kvinderFaktor: 8.45 },
    { alder: 53, maendFaktor: 7.74, kvinderFaktor: 7.921 },
    { alder: 54, maendFaktor: 7.224, kvinderFaktor: 7.389 },
    { alder: 55, maendFaktor: 6.706, kvinderFaktor: 6.854 },
    { alder: 56, maendFaktor: 6.184, kvinderFaktor: 6.317 },
    { alder: 57, maendFaktor: 5.66, kvinderFaktor: 5.775 },
    { alder: 58, maendFaktor: 5.132, kvinderFaktor: 5.23 },
    { alder: 59, maendFaktor: 4.599, kvinderFaktor: 4.681 },
    { alder: 60, maendFaktor: 4.061, kvinderFaktor: 4.126 },
  ],
  B: [
    { alder: 58, maendFaktor: 4.877, kvinderFaktor: 4.964 },
    { alder: 59, maendFaktor: 4.339, kvinderFaktor: 4.41 },
    { alder: 60, maendFaktor: 3.796, kvinderFaktor: 3.851 },
  ],
  C: [
    { alder: 59, maendFaktor: 4.079, kvinderFaktor: 4.14 },
    { alder: 60, maendFaktor: 3.531, kvinderFaktor: 3.576 },
    { alder: 61, maendFaktor: 2.975, kvinderFaktor: 3.007 },
  ],
  D: [
    { alder: 59, maendFaktor: 3.811, kvinderFaktor: 3.863 },
    { alder: 60, maendFaktor: 3.257, kvinderFaktor: 3.295 },
    { alder: 61, maendFaktor: 2.696, kvinderFaktor: 2.721 },
  ],
  E: [
    { alder: 60, maendFaktor: 2.984, kvinderFaktor: 3.013 },
    { alder: 61, maendFaktor: 2.416, kvinderFaktor: 2.434 },
    { alder: 62, maendFaktor: 1.839, kvinderFaktor: 1.847 },
  ],
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
