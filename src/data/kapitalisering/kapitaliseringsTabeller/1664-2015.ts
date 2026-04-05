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

export const kapitaliseringsId = '1664/2015' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb efter lov om arbejdsskadesikring i 2016' as const;
export const kapitaliseringsDatering = '15/12/2015' as const;
export const gyldigFra = toISODateString('2016-01-01');
export const gyldigTil = toISODateString('2016-12-31');

// Udtrukket fra BEK nr 1664 af 15/12/2015.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2011-01-01',     '1963-01-01',     null,     '68',     'A'],
  ['2011-01-01',     '1955-07-01',     '1962-12-31',     '67',     'B'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     '66.5',     'C'],
  ['2011-01-01',     '1954-07-01',     '1954-12-31',     '66',     'D'],
  ['2011-01-01',     '1954-01-01',     '1954-06-30',     '65.5',     'E'],
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
  A: [
    { alder: 5, faktor: 31.299 },
    { alder: 6, faktor: 30.868 },
    { alder: 7, faktor: 30.434 },
    { alder: 8, faktor: 29.999 },
    { alder: 9, faktor: 29.561 },
    { alder: 10, faktor: 29.12 },
    { alder: 11, faktor: 28.678 },
    { alder: 12, faktor: 28.233 },
    { alder: 13, faktor: 27.785 },
    { alder: 14, faktor: 27.335 },
    { alder: 15, faktor: 26.883 },
    { alder: 16, faktor: 26.429 },
    { alder: 17, faktor: 25.972 },
    { alder: 18, faktor: 25.513 },
    { alder: 19, faktor: 25.052 },
    { alder: 20, faktor: 24.589 },
    { alder: 21, faktor: 24.123 },
    { alder: 22, faktor: 23.655 },
    { alder: 23, faktor: 23.185 },
    { alder: 24, faktor: 22.713 },
    { alder: 25, faktor: 22.239 },
    { alder: 26, faktor: 21.763 },
    { alder: 27, faktor: 21.285 },
    { alder: 28, faktor: 20.805 },
    { alder: 29, faktor: 20.323 },
    { alder: 30, faktor: 19.839 },
    { alder: 31, faktor: 19.353 },
    { alder: 32, faktor: 18.865 },
    { alder: 33, faktor: 18.376 },
    { alder: 34, faktor: 17.885 },
    { alder: 35, faktor: 17.392 },
    { alder: 36, faktor: 16.898 },
    { alder: 37, faktor: 16.403 },
    { alder: 38, faktor: 15.905 },
    { alder: 39, faktor: 15.407 },
    { alder: 40, faktor: 14.907 },
    { alder: 41, faktor: 14.405 },
    { alder: 42, faktor: 13.903 },
    { alder: 43, faktor: 13.399 },
    { alder: 44, faktor: 12.894 },
    { alder: 45, faktor: 12.387 },
    { alder: 46, faktor: 11.88 },
    { alder: 47, faktor: 11.371 },
    { alder: 48, faktor: 10.861 },
    { alder: 49, faktor: 10.35 },
    { alder: 50, faktor: 9.838 },
    { alder: 51, faktor: 9.324 },
    { alder: 52, faktor: 8.809 },
    { alder: 53, faktor: 8.292 },
    { alder: 54, faktor: 7.774 },
  ],
  B: [
    { alder: 53, faktor: 7.821 },
    { alder: 54, faktor: 7.297 },
    { alder: 55, faktor: 6.769 },
    { alder: 56, faktor: 6.24 },
    { alder: 57, faktor: 5.707 },
    { alder: 58, faktor: 5.17 },
    { alder: 59, faktor: 4.629 },
    { alder: 60, faktor: 4.084 },
    { alder: 61, faktor: 3.532 },
    { alder: 62, faktor: 2.974 },
  ],
  C: [
    { alder: 60, faktor: 3.814 },
    { alder: 61, faktor: 3.257 },
    { alder: 62, faktor: 2.693 },
  ],
  D: [
    { alder: 61, faktor: 2.982 },
    { alder: 62, faktor: 2.413 },
    { alder: 63, faktor: 1.835 },
  ],
  E: [
    { alder: 61, faktor: 2.7 },
    { alder: 62, faktor: 2.125 },
    { alder: 63, faktor: 1.54 },
  ],
  F: [
    { alder: 62, faktor: 1.837 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  G: [
    { alder: 18, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.461, 3.067, 3.668, 4.266, 4.859, 5.449, 6.034] },
    { alder: 19, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.461, 3.066, 3.668, 4.265, 4.858, 5.448, 6.033] },
    { alder: 20, faktorerPraHeleAar: [0.621, 1.238, 1.852, 2.461, 3.066, 3.667, 4.264, 4.858, 5.447, 6.032] },
    { alder: 21, faktorerPraHeleAar: [0.621, 1.238, 1.852, 2.461, 3.066, 3.667, 4.264, 4.857, 5.446, 6.03] },
    { alder: 22, faktorerPraHeleAar: [0.621, 1.238, 1.852, 2.461, 3.066, 3.666, 4.263, 4.856, 5.444, 6.029] },
    { alder: 23, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.065, 3.666, 4.262, 4.855, 5.443, 6.027] },
    { alder: 24, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.065, 3.665, 4.262, 4.854, 5.442, 6.025] },
    { alder: 25, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.064, 3.665, 4.261, 4.853, 5.44, 6.023] },
    { alder: 26, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.064, 3.664, 4.26, 4.851, 5.439, 6.021] },
    { alder: 27, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.459, 3.063, 3.663, 4.259, 4.85, 5.437, 6.019] },
    { alder: 28, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.459, 3.063, 3.662, 4.258, 4.848, 5.435, 6.017] },
    { alder: 29, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.459, 3.062, 3.662, 4.256, 4.847, 5.433, 6.014] },
    { alder: 30, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.458, 3.062, 3.661, 4.255, 4.845, 5.43, 6.011] },
    { alder: 31, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.458, 3.061, 3.66, 4.254, 4.843, 5.428, 6.008] },
    { alder: 32, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.457, 3.06, 3.658, 4.252, 4.841, 5.425, 6.004] },
    { alder: 33, faktorerPraHeleAar: [0.621, 1.238, 1.849, 2.457, 3.059, 3.657, 4.25, 4.838, 5.422, 6] },
    { alder: 34, faktorerPraHeleAar: [0.621, 1.237, 1.849, 2.456, 3.058, 3.656, 4.248, 4.836, 5.418, 5.996] },
    { alder: 35, faktorerPraHeleAar: [0.621, 1.237, 1.849, 2.455, 3.057, 3.654, 4.246, 4.833, 5.415, 5.991] },
    { alder: 36, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.455, 3.056, 3.653, 4.244, 4.83, 5.411, 5.986] },
    { alder: 37, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.454, 3.055, 3.651, 4.241, 4.827, 5.406, 5.981] },
    { alder: 38, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.453, 3.054, 3.649, 4.239, 4.823, 5.402, 5.975] },
    { alder: 39, faktorerPraHeleAar: [0.621, 1.237, 1.847, 2.452, 3.052, 3.647, 4.236, 4.819, 5.397, 5.968] },
    { alder: 40, faktorerPraHeleAar: [0.621, 1.236, 1.847, 2.451, 3.051, 3.645, 4.233, 4.815, 5.391, 5.961] },
    { alder: 41, faktorerPraHeleAar: [0.621, 1.236, 1.846, 2.45, 3.049, 3.642, 4.229, 4.81, 5.385, 5.953] },
    { alder: 42, faktorerPraHeleAar: [0.621, 1.236, 1.845, 2.449, 3.047, 3.639, 4.225, 4.805, 5.378, 5.945] },
    { alder: 43, faktorerPraHeleAar: [0.621, 1.235, 1.845, 2.448, 3.045, 3.636, 4.221, 4.799, 5.371, 5.936] },
    { alder: 44, faktorerPraHeleAar: [0.62, 1.235, 1.844, 2.447, 3.043, 3.633, 4.217, 4.793, 5.363, 5.926] },
    { alder: 45, faktorerPraHeleAar: [0.62, 1.235, 1.843, 2.445, 3.041, 3.63, 4.212, 4.787, 5.354, 5.915] },
    { alder: 46, faktorerPraHeleAar: [0.62, 1.234, 1.842, 2.443, 3.038, 3.626, 4.206, 4.779, 5.345, 5.903] },
    { alder: 47, faktorerPraHeleAar: [0.62, 1.234, 1.841, 2.442, 3.035, 3.622, 4.2, 4.772, 5.335, 5.89] },
    { alder: 48, faktorerPraHeleAar: [0.62, 1.234, 1.84, 2.44, 3.032, 3.617, 4.194, 4.763, 5.324, 5.876] },
    { alder: 49, faktorerPraHeleAar: [0.62, 1.233, 1.839, 2.438, 3.029, 3.612, 4.187, 4.754, 5.312, 5.861] },
    { alder: 50, faktorerPraHeleAar: [0.62, 1.233, 1.838, 2.435, 3.025, 3.607, 4.179, 4.744, 5.299, 5.844] },
    { alder: 51, faktorerPraHeleAar: [0.62, 1.232, 1.836, 2.433, 3.021, 3.601, 4.171, 4.733, 5.284, 5.826] },
    { alder: 52, faktorerPraHeleAar: [0.62, 1.231, 1.835, 2.43, 3.017, 3.594, 4.162, 4.721, 5.269, 5.806] },
    { alder: 53, faktorerPraHeleAar: [0.619, 1.231, 1.833, 2.427, 3.012, 3.587, 4.152, 4.708, 5.252, 5.785] },
    { alder: 54, faktorerPraHeleAar: [0.619, 1.23, 1.832, 2.424, 3.007, 3.58, 4.142, 4.693, 5.234, 5.762] },
    { alder: 55, faktorerPraHeleAar: [0.619, 1.229, 1.83, 2.42, 3.001, 3.571, 4.13, 4.678, 5.214, 5.737] },
    { alder: 56, faktorerPraHeleAar: [0.619, 1.228, 1.828, 2.417, 2.995, 3.562, 4.118, 4.661, 5.192, 5.71] },
    { alder: 57, faktorerPraHeleAar: [0.619, 1.227, 1.825, 2.412, 2.988, 3.552, 4.104, 4.643, 5.169, 5.68] },
    { alder: 58, faktorerPraHeleAar: [0.618, 1.226, 1.823, 2.408, 2.981, 3.542, 4.089, 4.623, 5.143] },
    { alder: 59, faktorerPraHeleAar: [0.618, 1.225, 1.82, 2.403, 2.973, 3.53, 4.073, 4.602] },
    { alder: 60, faktorerPraHeleAar: [0.618, 1.224, 1.817, 2.398, 2.965, 3.517, 4.056] },
    { alder: 61, faktorerPraHeleAar: [0.617, 1.222, 1.814, 2.392, 2.955, 3.504] },
    { alder: 62, faktorerPraHeleAar: [0.617, 1.221, 1.81, 2.385] },
    { alder: 63, faktorerPraHeleAar: [0.617, 1.219] },
    { alder: 64, faktorerPraHeleAar: [0.616] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
