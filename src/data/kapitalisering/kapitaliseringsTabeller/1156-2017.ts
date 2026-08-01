import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '1156/2017' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb efter lov om arbejdsskadesikring i 2018' as const;
export const kapitaliseringsDatering = '30/10/2017' as const;
export const gyldigFra = toISODateString('2018-01-01');
export const gyldigTil = toISODateString('2018-12-31');

// Udtrukket fra BEK nr 1156 af 30/10/2017.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     tabel
  ['2011-01-01',     '1963-01-01',     null,     'A'],
  ['2011-01-01',     '1955-07-01',     '1962-12-31',     'B'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     'C'],
  ['2011-01-01',     '1954-07-01',     '1954-12-31',     'D'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, foedselsdatoTil, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    foedselsdatoTil: foedselsdatoTil ? toISODateString(foedselsdatoTil) : null,
    tabel,
  })
);

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 5, faktor: 35.476 },
    { alder: 6, faktor: 34.92 },
    { alder: 7, faktor: 34.363 },
    { alder: 8, faktor: 33.805 },
    { alder: 9, faktor: 33.247 },
    { alder: 10, faktor: 32.688 },
    { alder: 11, faktor: 32.128 },
    { alder: 12, faktor: 31.568 },
    { alder: 13, faktor: 31.007 },
    { alder: 14, faktor: 30.445 },
    { alder: 15, faktor: 29.883 },
    { alder: 16, faktor: 29.321 },
    { alder: 17, faktor: 28.758 },
    { alder: 18, faktor: 28.194 },
    { alder: 19, faktor: 27.63 },
    { alder: 20, faktor: 27.066 },
    { alder: 21, faktor: 26.501 },
    { alder: 22, faktor: 25.936 },
    { alder: 23, faktor: 25.371 },
    { alder: 24, faktor: 24.806 },
    { alder: 25, faktor: 24.24 },
    { alder: 26, faktor: 23.674 },
    { alder: 27, faktor: 23.108 },
    { alder: 28, faktor: 22.543 },
    { alder: 29, faktor: 21.977 },
    { alder: 30, faktor: 21.411 },
    { alder: 31, faktor: 20.845 },
    { alder: 32, faktor: 20.28 },
    { alder: 33, faktor: 19.715 },
    { alder: 34, faktor: 19.15 },
    { alder: 35, faktor: 18.586 },
    { alder: 36, faktor: 18.022 },
    { alder: 37, faktor: 17.459 },
    { alder: 38, faktor: 16.896 },
    { alder: 39, faktor: 16.334 },
    { alder: 40, faktor: 15.772 },
    { alder: 41, faktor: 15.211 },
    { alder: 42, faktor: 14.651 },
    { alder: 43, faktor: 14.092 },
    { alder: 44, faktor: 13.534 },
    { alder: 45, faktor: 12.976 },
    { alder: 46, faktor: 12.42 },
    { alder: 47, faktor: 11.864 },
    { alder: 48, faktor: 11.31 },
    { alder: 49, faktor: 10.756 },
    { alder: 50, faktor: 10.203 },
    { alder: 51, faktor: 9.651 },
    { alder: 52, faktor: 9.099 },
    { alder: 53, faktor: 8.548 },
    { alder: 54, faktor: 7.997 },
    { alder: 55, faktor: 7.446 },
    { alder: 56, faktor: 6.895 },
  ],
  B: [
    { alder: 55, faktor: 6.936 },
    { alder: 56, faktor: 6.379 },
    { alder: 57, faktor: 5.822 },
    { alder: 58, faktor: 5.264 },
    { alder: 59, faktor: 4.703 },
    { alder: 60, faktor: 4.139 },
    { alder: 61, faktor: 3.572 },
    { alder: 62, faktor: 3.001 },
    { alder: 63, faktor: 2.423 },
    { alder: 64, faktor: 1.839 },
  ],
  C: [
    { alder: 62, faktor: 2.715 },
    { alder: 63, faktor: 2.132 },
    { alder: 64, faktor: 1.543 },
  ],
  D: [
    { alder: 63, faktor: 1.842 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  E: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.244, 1.864, 2.482, 3.099, 3.715, 4.33, 4.942, 5.554, 6.164] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.244, 1.864, 2.482, 3.099, 3.715, 4.329, 4.942, 5.553, 6.163] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.244, 1.864, 2.482, 3.099, 3.714, 4.328, 4.941, 5.552, 6.161] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.244, 1.863, 2.482, 3.099, 3.714, 4.328, 4.94, 5.551, 6.16] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.244, 1.863, 2.482, 3.098, 3.714, 4.327, 4.939, 5.55, 6.158] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.244, 1.863, 2.481, 3.098, 3.713, 4.326, 4.938, 5.548, 6.157] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.244, 1.863, 2.481, 3.098, 3.712, 4.326, 4.937, 5.547, 6.155] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.244, 1.863, 2.481, 3.097, 3.712, 4.325, 4.936, 5.545, 6.153] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.243, 1.863, 2.481, 3.097, 3.711, 4.324, 4.935, 5.544, 6.151] },
    { alder: 27, faktorerPraHeleAar: [0.622, 1.243, 1.863, 2.48, 3.096, 3.71, 4.323, 4.933, 5.542, 6.148] },
    { alder: 28, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.48, 3.096, 3.71, 4.322, 4.932, 5.54, 6.146] },
    { alder: 29, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.48, 3.095, 3.709, 4.32, 4.93, 5.537, 6.143] },
    { alder: 30, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.479, 3.094, 3.708, 4.319, 4.928, 5.535, 6.14] },
    { alder: 31, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.479, 3.094, 3.707, 4.317, 4.926, 5.532, 6.136] },
    { alder: 32, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.478, 3.093, 3.705, 4.316, 4.924, 5.529, 6.133] },
    { alder: 33, faktorerPraHeleAar: [0.622, 1.243, 1.861, 2.478, 3.092, 3.704, 4.314, 4.921, 5.526, 6.129] },
    { alder: 34, faktorerPraHeleAar: [0.622, 1.243, 1.861, 2.477, 3.091, 3.703, 4.312, 4.919, 5.523, 6.124] },
    { alder: 35, faktorerPraHeleAar: [0.622, 1.243, 1.861, 2.476, 3.09, 3.701, 4.31, 4.916, 5.519, 6.119] },
    { alder: 36, faktorerPraHeleAar: [0.622, 1.242, 1.86, 2.476, 3.089, 3.7, 4.308, 4.913, 5.515, 6.114] },
    { alder: 37, faktorerPraHeleAar: [0.622, 1.242, 1.86, 2.475, 3.088, 3.698, 4.305, 4.909, 5.511, 6.109] },
    { alder: 38, faktorerPraHeleAar: [0.622, 1.242, 1.859, 2.474, 3.086, 3.696, 4.302, 4.906, 5.506, 6.102] },
    { alder: 39, faktorerPraHeleAar: [0.622, 1.242, 1.859, 2.473, 3.085, 3.694, 4.299, 4.902, 5.5, 6.096] },
    { alder: 40, faktorerPraHeleAar: [0.622, 1.242, 1.858, 2.472, 3.083, 3.691, 4.296, 4.897, 5.495, 6.088] },
    { alder: 41, faktorerPraHeleAar: [0.622, 1.241, 1.858, 2.471, 3.082, 3.689, 4.292, 4.892, 5.488, 6.08] },
    { alder: 42, faktorerPraHeleAar: [0.622, 1.241, 1.857, 2.47, 3.08, 3.686, 4.289, 4.887, 5.482, 6.072] },
    { alder: 43, faktorerPraHeleAar: [0.622, 1.241, 1.856, 2.469, 3.078, 3.683, 4.284, 4.881, 5.474, 6.062] },
    { alder: 44, faktorerPraHeleAar: [0.622, 1.24, 1.856, 2.467, 3.076, 3.68, 4.28, 4.875, 5.466, 6.052] },
    { alder: 45, faktorerPraHeleAar: [0.622, 1.24, 1.855, 2.466, 3.073, 3.676, 4.275, 4.868, 5.457, 6.041] },
    { alder: 46, faktorerPraHeleAar: [0.622, 1.24, 1.854, 2.464, 3.07, 3.672, 4.269, 4.861, 5.448, 6.028] },
    { alder: 47, faktorerPraHeleAar: [0.622, 1.239, 1.853, 2.463, 3.068, 3.668, 4.263, 4.853, 5.437, 6.015] },
    { alder: 48, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.461, 3.064, 3.663, 4.257, 4.844, 5.426, 6.001] },
    { alder: 49, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.458, 3.061, 3.658, 4.249, 4.835, 5.413, 5.985] },
    { alder: 50, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.456, 3.057, 3.653, 4.242, 4.824, 5.4, 5.968] },
    { alder: 51, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.454, 3.053, 3.647, 4.233, 4.813, 5.385, 5.949] },
    { alder: 52, faktorerPraHeleAar: [0.621, 1.237, 1.847, 2.451, 3.049, 3.64, 4.224, 4.801, 5.369, 5.929] },
    { alder: 53, faktorerPraHeleAar: [0.621, 1.236, 1.845, 2.448, 3.044, 3.633, 4.214, 4.787, 5.352, 5.907] },
    { alder: 54, faktorerPraHeleAar: [0.621, 1.235, 1.843, 2.445, 3.039, 3.625, 4.203, 4.773, 5.333, 5.883] },
    { alder: 55, faktorerPraHeleAar: [0.62, 1.234, 1.841, 2.441, 3.033, 3.617, 4.192, 4.757, 5.313, 5.858] },
    { alder: 56, faktorerPraHeleAar: [0.62, 1.233, 1.839, 2.437, 3.027, 3.607, 4.179, 4.74, 5.29, 5.83] },
    { alder: 57, faktorerPraHeleAar: [0.62, 1.232, 1.837, 2.433, 3.02, 3.598, 4.165, 4.721, 5.266, 5.799] },
    { alder: 58, faktorerPraHeleAar: [0.62, 1.231, 1.834, 2.428, 3.013, 3.587, 4.15, 4.701, 5.24] },
    { alder: 59, faktorerPraHeleAar: [0.619, 1.23, 1.832, 2.423, 3.005, 3.575, 4.133, 4.679] },
    { alder: 60, faktorerPraHeleAar: [0.619, 1.229, 1.829, 2.418, 2.996, 3.562, 4.116] },
    { alder: 61, faktorerPraHeleAar: [0.619, 1.227, 1.825, 2.412, 2.986, 3.548] },
    { alder: 62, faktorerPraHeleAar: [0.618, 1.226, 1.822, 2.406, 2.976] },
    { alder: 63, faktorerPraHeleAar: [0.618, 1.224, 1.818, 2.399] },
    { alder: 64, faktorerPraHeleAar: [0.618, 1.222] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;
