import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '1275/2016' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb efter lov om arbejdsskadesikring i 2017' as const;
export const kapitaliseringsDatering = '28/10/2016' as const;
export const gyldigFra = toISODateString('2017-01-01');
export const gyldigTil = toISODateString('2017-12-31');

// Udtrukket fra BEK nr 1275 af 28/10/2016.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     tabel
  ['2011-01-01',     '1963-01-01',     null,     'A'],
  ['2011-01-01',     '1955-07-01',     '1962-12-31',     'B'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     'C'],
  ['2011-01-01',     '1954-07-01',     '1954-12-31',     'D'],
  ['2011-01-01',     '1954-01-01',     '1954-06-30',     'E'],
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
    { alder: 5, faktor: 31.657 },
    { alder: 6, faktor: 31.215 },
    { alder: 7, faktor: 30.772 },
    { alder: 8, faktor: 30.326 },
    { alder: 9, faktor: 29.878 },
    { alder: 10, faktor: 29.428 },
    { alder: 11, faktor: 28.976 },
    { alder: 12, faktor: 28.521 },
    { alder: 13, faktor: 28.064 },
    { alder: 14, faktor: 27.605 },
    { alder: 15, faktor: 27.144 },
    { alder: 16, faktor: 26.68 },
    { alder: 17, faktor: 26.214 },
    { alder: 18, faktor: 25.747 },
    { alder: 19, faktor: 25.277 },
    { alder: 20, faktor: 24.805 },
    { alder: 21, faktor: 24.331 },
    { alder: 22, faktor: 23.855 },
    { alder: 23, faktor: 23.377 },
    { alder: 24, faktor: 22.897 },
    { alder: 25, faktor: 22.415 },
    { alder: 26, faktor: 21.931 },
    { alder: 27, faktor: 21.445 },
    { alder: 28, faktor: 20.958 },
    { alder: 29, faktor: 20.469 },
    { alder: 30, faktor: 19.978 },
    { alder: 31, faktor: 19.485 },
    { alder: 32, faktor: 18.991 },
    { alder: 33, faktor: 18.495 },
    { alder: 34, faktor: 17.997 },
    { alder: 35, faktor: 17.499 },
    { alder: 36, faktor: 16.998 },
    { alder: 37, faktor: 16.497 },
    { alder: 38, faktor: 15.994 },
    { alder: 39, faktor: 15.489 },
    { alder: 40, faktor: 14.984 },
    { alder: 41, faktor: 14.477 },
    { alder: 42, faktor: 13.97 },
    { alder: 43, faktor: 13.461 },
    { alder: 44, faktor: 12.951 },
    { alder: 45, faktor: 12.44 },
    { alder: 46, faktor: 11.928 },
    { alder: 47, faktor: 11.416 },
    { alder: 48, faktor: 10.902 },
    { alder: 49, faktor: 10.387 },
    { alder: 50, faktor: 9.871 },
    { alder: 51, faktor: 9.354 },
    { alder: 52, faktor: 8.835 },
    { alder: 53, faktor: 8.315 },
    { alder: 54, faktor: 7.794 },
    { alder: 55, faktor: 7.271 },
  ],
  B: [
    { alder: 54, faktor: 7.314 },
    { alder: 55, faktor: 6.785 },
    { alder: 56, faktor: 6.252 },
    { alder: 57, faktor: 5.717 },
    { alder: 58, faktor: 5.179 },
    { alder: 59, faktor: 4.636 },
    { alder: 60, faktor: 4.089 },
    { alder: 61, faktor: 3.536 },
    { alder: 62, faktor: 2.976 },
    { alder: 63, faktor: 2.409 },
  ],
  C: [
    { alder: 61, faktor: 3.26 },
    { alder: 62, faktor: 2.695 },
    { alder: 63, faktor: 2.122 },
  ],
  D: [
    { alder: 62, faktor: 2.414 },
    { alder: 63, faktor: 1.835 },
  ],
  E: [
    { alder: 62, faktor: 2.126 },
    { alder: 63, faktor: 1.541 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  F: [
    { alder: 18, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.463, 3.07, 3.672, 4.271, 4.867, 5.458, 6.046] },
    { alder: 19, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.463, 3.069, 3.672, 4.271, 4.866, 5.457, 6.045] },
    { alder: 20, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.463, 3.069, 3.672, 4.27, 4.865, 5.456, 6.044] },
    { alder: 21, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.463, 3.069, 3.671, 4.27, 4.864, 5.455, 6.042] },
    { alder: 22, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.462, 3.068, 3.671, 4.269, 4.863, 5.454, 6.041] },
    { alder: 23, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.462, 3.068, 3.67, 4.268, 4.862, 5.453, 6.039] },
    { alder: 24, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.462, 3.068, 3.67, 4.267, 4.861, 5.451, 6.037] },
    { alder: 25, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.462, 3.067, 3.669, 4.267, 4.86, 5.45, 6.035] },
    { alder: 26, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.461, 3.067, 3.668, 4.266, 4.859, 5.448, 6.033] },
    { alder: 27, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.461, 3.066, 3.668, 4.265, 4.858, 5.446, 6.031] },
    { alder: 28, faktorerPraHeleAar: [0.621, 1.238, 1.852, 2.461, 3.066, 3.667, 4.263, 4.856, 5.444, 6.028] },
    { alder: 29, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.065, 3.666, 4.262, 4.854, 5.442, 6.026] },
    { alder: 30, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.065, 3.665, 4.261, 4.853, 5.44, 6.023] },
    { alder: 31, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.46, 3.064, 3.664, 4.259, 4.851, 5.437, 6.019] },
    { alder: 32, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.459, 3.063, 3.663, 4.258, 4.848, 5.434, 6.016] },
    { alder: 33, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.459, 3.062, 3.661, 4.256, 4.846, 5.431, 6.012] },
    { alder: 34, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.458, 3.061, 3.66, 4.254, 4.843, 5.428, 6.007] },
    { alder: 35, faktorerPraHeleAar: [0.621, 1.238, 1.85, 2.457, 3.06, 3.659, 4.252, 4.841, 5.424, 6.003] },
    { alder: 36, faktorerPraHeleAar: [0.621, 1.238, 1.849, 2.457, 3.059, 3.657, 4.25, 4.838, 5.42, 5.998] },
    { alder: 37, faktorerPraHeleAar: [0.621, 1.237, 1.849, 2.456, 3.058, 3.655, 4.247, 4.834, 5.416, 5.992] },
    { alder: 38, faktorerPraHeleAar: [0.621, 1.237, 1.849, 2.455, 3.057, 3.653, 4.245, 4.831, 5.411, 5.986] },
    { alder: 39, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.454, 3.055, 3.651, 4.242, 4.827, 5.406, 5.98] },
    { alder: 40, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.453, 3.054, 3.649, 4.238, 4.822, 5.4, 5.973] },
    { alder: 41, faktorerPraHeleAar: [0.621, 1.237, 1.847, 2.452, 3.052, 3.646, 4.235, 4.818, 5.394, 5.965] },
    { alder: 42, faktorerPraHeleAar: [0.621, 1.236, 1.846, 2.451, 3.05, 3.644, 4.231, 4.812, 5.388, 5.956] },
    { alder: 43, faktorerPraHeleAar: [0.621, 1.236, 1.846, 2.45, 3.048, 3.641, 4.227, 4.807, 5.38, 5.947] },
    { alder: 44, faktorerPraHeleAar: [0.621, 1.236, 1.845, 2.448, 3.046, 3.637, 4.222, 4.801, 5.372, 5.937] },
    { alder: 45, faktorerPraHeleAar: [0.621, 1.235, 1.844, 2.447, 3.044, 3.634, 4.217, 4.794, 5.364, 5.926] },
    { alder: 46, faktorerPraHeleAar: [0.62, 1.235, 1.843, 2.445, 3.041, 3.63, 4.212, 4.787, 5.354, 5.914] },
    { alder: 47, faktorerPraHeleAar: [0.62, 1.234, 1.842, 2.444, 3.038, 3.626, 4.206, 4.779, 5.344, 5.901] },
    { alder: 48, faktorerPraHeleAar: [0.62, 1.234, 1.841, 2.442, 3.035, 3.621, 4.2, 4.77, 5.333, 5.887] },
    { alder: 49, faktorerPraHeleAar: [0.62, 1.234, 1.84, 2.44, 3.032, 3.616, 4.193, 4.761, 5.321, 5.872] },
    { alder: 50, faktorerPraHeleAar: [0.62, 1.233, 1.839, 2.437, 3.028, 3.611, 4.185, 4.751, 5.308, 5.855] },
    { alder: 51, faktorerPraHeleAar: [0.62, 1.232, 1.837, 2.435, 3.024, 3.605, 4.177, 4.74, 5.293, 5.837] },
    { alder: 52, faktorerPraHeleAar: [0.62, 1.232, 1.836, 2.432, 3.02, 3.598, 4.168, 4.728, 5.278, 5.817] },
    { alder: 53, faktorerPraHeleAar: [0.62, 1.231, 1.834, 2.429, 3.015, 3.591, 4.158, 4.715, 5.261, 5.796] },
    { alder: 54, faktorerPraHeleAar: [0.619, 1.23, 1.833, 2.426, 3.01, 3.584, 4.147, 4.701, 5.243, 5.773] },
    { alder: 55, faktorerPraHeleAar: [0.619, 1.229, 1.831, 2.422, 3.004, 3.575, 4.136, 4.685, 5.223, 5.748] },
    { alder: 56, faktorerPraHeleAar: [0.619, 1.229, 1.829, 2.418, 2.998, 3.566, 4.123, 4.668, 5.201, 5.721] },
    { alder: 57, faktorerPraHeleAar: [0.619, 1.228, 1.826, 2.414, 2.991, 3.556, 4.11, 4.65, 5.178, 5.691] },
    { alder: 58, faktorerPraHeleAar: [0.618, 1.227, 1.824, 2.41, 2.984, 3.546, 4.095, 4.63, 5.152] },
    { alder: 59, faktorerPraHeleAar: [0.618, 1.225, 1.821, 2.405, 2.976, 3.534, 4.079, 4.609] },
    { alder: 60, faktorerPraHeleAar: [0.618, 1.224, 1.818, 2.399, 2.967, 3.522, 4.061] },
    { alder: 61, faktorerPraHeleAar: [0.618, 1.223, 1.815, 2.394, 2.958, 3.508] },
    { alder: 62, faktorerPraHeleAar: [0.617, 1.221, 1.811, 2.387, 2.948] },
    { alder: 63, faktorerPraHeleAar: [0.617, 1.22, 1.808] },
    { alder: 64, faktorerPraHeleAar: [0.616] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

// Kilden indeholder ikke særskilte afløsningstabeller for forsørgertab.
export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
