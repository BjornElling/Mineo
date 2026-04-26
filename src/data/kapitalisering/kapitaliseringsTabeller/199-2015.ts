import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '199/2015' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb efter lov om arbejdsskadesikring i 2015' as const;
export const kapitaliseringsDatering = '25/02/2015' as const;
export const gyldigFra = toISODateString('2015-03-01');
export const gyldigTil = toISODateString('2015-12-28');

// Udtrukket fra BEK nr 199 af 25/02/2015.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     tabel
  ['2011-01-01',     '1955-07-01',     null,     'A'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     'B'],
  ['2011-01-01',     '1954-07-01',     '1954-12-31',     'C'],
  ['2011-01-01',     '1954-01-01',     '1954-06-30',     'D'],
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
    { alder: 5, faktor: 29.337 },
    { alder: 6, faktor: 28.953 },
    { alder: 7, faktor: 28.565 },
    { alder: 8, faktor: 28.175 },
    { alder: 9, faktor: 27.782 },
    { alder: 10, faktor: 27.385 },
    { alder: 11, faktor: 26.986 },
    { alder: 12, faktor: 26.584 },
    { alder: 13, faktor: 26.179 },
    { alder: 14, faktor: 25.771 },
    { alder: 15, faktor: 25.36 },
    { alder: 16, faktor: 24.946 },
    { alder: 17, faktor: 24.529 },
    { alder: 18, faktor: 24.11 },
    { alder: 19, faktor: 23.687 },
    { alder: 20, faktor: 23.261 },
    { alder: 21, faktor: 22.833 },
    { alder: 22, faktor: 22.402 },
    { alder: 23, faktor: 21.967 },
    { alder: 24, faktor: 21.53 },
    { alder: 25, faktor: 21.09 },
    { alder: 26, faktor: 20.648 },
    { alder: 27, faktor: 20.202 },
    { alder: 28, faktor: 19.754 },
    { alder: 29, faktor: 19.303 },
    { alder: 30, faktor: 18.85 },
    { alder: 31, faktor: 18.394 },
    { alder: 32, faktor: 17.935 },
    { alder: 33, faktor: 17.473 },
    { alder: 34, faktor: 17.009 },
    { alder: 35, faktor: 16.543 },
    { alder: 36, faktor: 16.074 },
    { alder: 37, faktor: 15.603 },
    { alder: 38, faktor: 15.129 },
    { alder: 39, faktor: 14.653 },
    { alder: 40, faktor: 14.174 },
    { alder: 41, faktor: 13.693 },
    { alder: 42, faktor: 13.21 },
    { alder: 43, faktor: 12.725 },
    { alder: 44, faktor: 12.238 },
    { alder: 45, faktor: 11.748 },
    { alder: 46, faktor: 11.256 },
    { alder: 47, faktor: 10.762 },
    { alder: 48, faktor: 10.265 },
    { alder: 49, faktor: 9.766 },
    { alder: 50, faktor: 9.265 },
    { alder: 51, faktor: 8.761 },
    { alder: 52, faktor: 8.255 },
    { alder: 53, faktor: 7.745 },
    { alder: 54, faktor: 7.233 },
    { alder: 55, faktor: 6.717 },
    { alder: 56, faktor: 6.197 },
    { alder: 57, faktor: 5.674 },
    { alder: 58, faktor: 5.145 },
    { alder: 59, faktor: 4.612 },
    { alder: 60, faktor: 4.073 },
    { alder: 61, faktor: 3.527 },
  ],
  B: [
    { alder: 59, faktor: 4.35 },
    { alder: 60, faktor: 3.806 },
    { alder: 61, faktor: 3.254 },
  ],
  C: [
    { alder: 60, faktor: 3.539 },
    { alder: 61, faktor: 2.981 },
    { alder: 62, faktor: 2.415 },
  ],
  D: [
    { alder: 60, faktor: 3.264 },
    { alder: 61, faktor: 2.7 },
    { alder: 62, faktor: 2.128 },
  ],
  E: [
    { alder: 61, faktor: 2.42 },
    { alder: 62, faktor: 1.841 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  F: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.063, 3.66, 4.251, 4.838, 5.42, 5.996] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.063, 3.659, 4.251, 4.837, 5.419, 5.995] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.659, 4.25, 4.837, 5.418, 5.993] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.659, 4.25, 4.836, 5.417, 5.992] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.658, 4.249, 4.835, 5.415, 5.991] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.658, 4.248, 4.834, 5.414, 5.989] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.657, 4.248, 4.833, 5.413, 5.987] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.459, 3.061, 3.656, 4.247, 4.832, 5.411, 5.985] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.06, 3.656, 4.246, 4.83, 5.41, 5.983] },
    { alder: 27, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.06, 3.655, 4.245, 4.829, 5.408, 5.981] },
    { alder: 28, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.059, 3.654, 4.244, 4.828, 5.406, 5.978] },
    { alder: 29, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.058, 3.653, 4.242, 4.826, 5.404, 5.976] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.058, 3.652, 4.241, 4.824, 5.401, 5.973] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.057, 3.651, 4.24, 4.822, 5.399, 5.969] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.056, 3.65, 4.238, 4.82, 5.396, 5.966] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.456, 3.055, 3.649, 4.236, 4.818, 5.393, 5.962] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.456, 3.055, 3.647, 4.234, 4.815, 5.39, 5.958] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.24, 1.85, 2.455, 3.054, 3.646, 4.232, 4.812, 5.386, 5.953] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.052, 3.644, 4.23, 4.809, 5.382, 5.948] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.454, 3.051, 3.643, 4.228, 4.806, 5.378, 5.943] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.453, 3.05, 3.641, 4.225, 4.802, 5.373, 5.937] },
    { alder: 39, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.452, 3.049, 3.639, 4.222, 4.798, 5.368, 5.93] },
    { alder: 40, faktorerPraHeleAar: [0.623, 1.239, 1.848, 2.451, 3.047, 3.636, 4.219, 4.794, 5.362, 5.923] },
    { alder: 41, faktorerPraHeleAar: [0.622, 1.238, 1.847, 2.45, 3.045, 3.634, 4.215, 4.789, 5.356, 5.916] },
    { alder: 42, faktorerPraHeleAar: [0.622, 1.238, 1.847, 2.449, 3.043, 3.631, 4.211, 4.784, 5.35, 5.907] },
    { alder: 43, faktorerPraHeleAar: [0.622, 1.238, 1.846, 2.447, 3.041, 3.628, 4.207, 4.779, 5.343, 5.898] },
    { alder: 44, faktorerPraHeleAar: [0.622, 1.237, 1.845, 2.446, 3.039, 3.625, 4.203, 4.773, 5.335, 5.888] },
    { alder: 45, faktorerPraHeleAar: [0.622, 1.237, 1.845, 2.445, 3.037, 3.621, 4.198, 4.766, 5.326, 5.878] },
    { alder: 46, faktorerPraHeleAar: [0.622, 1.237, 1.844, 2.443, 3.034, 3.618, 4.193, 4.759, 5.317, 5.866] },
    { alder: 47, faktorerPraHeleAar: [0.622, 1.236, 1.843, 2.441, 3.031, 3.613, 4.187, 4.751, 5.307, 5.853] },
    { alder: 48, faktorerPraHeleAar: [0.622, 1.236, 1.842, 2.439, 3.028, 3.609, 4.18, 4.743, 5.296, 5.839] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.235, 1.841, 2.437, 3.025, 3.604, 4.173, 4.734, 5.284, 5.824] },
    { alder: 50, faktorerPraHeleAar: [0.622, 1.235, 1.839, 2.435, 3.021, 3.598, 4.166, 4.723, 5.271, 5.808] },
    { alder: 51, faktorerPraHeleAar: [0.622, 1.234, 1.838, 2.432, 3.017, 3.593, 4.158, 4.713, 5.257, 5.79] },
    { alder: 52, faktorerPraHeleAar: [0.621, 1.234, 1.836, 2.43, 3.013, 3.586, 4.149, 4.701, 5.241, 5.77] },
    { alder: 53, faktorerPraHeleAar: [0.621, 1.233, 1.835, 2.427, 3.008, 3.579, 4.139, 4.688, 5.225, 5.749] },
    { alder: 54, faktorerPraHeleAar: [0.621, 1.232, 1.833, 2.423, 3.003, 3.572, 4.129, 4.674, 5.206, 5.726] },
    { alder: 55, faktorerPraHeleAar: [0.621, 1.231, 1.831, 2.42, 2.997, 3.563, 4.117, 4.658, 5.187, 5.702] },
    { alder: 56, faktorerPraHeleAar: [0.621, 1.23, 1.829, 2.416, 2.991, 3.554, 4.105, 4.642, 5.165, 5.675] },
    { alder: 57, faktorerPraHeleAar: [0.62, 1.229, 1.827, 2.412, 2.985, 3.545, 4.091, 4.624, 5.142, 5.646] },
    { alder: 58, faktorerPraHeleAar: [0.62, 1.228, 1.824, 2.407, 2.977, 3.534, 4.076, 4.604, 5.117] },
    { alder: 59, faktorerPraHeleAar: [0.62, 1.227, 1.822, 2.402, 2.97, 3.522, 4.06, 4.583] },
    { alder: 60, faktorerPraHeleAar: [0.62, 1.226, 1.819, 2.397, 2.961, 3.51, 4.043] },
    { alder: 61, faktorerPraHeleAar: [0.619, 1.225, 1.815, 2.391, 2.952] },
    { alder: 62, faktorerPraHeleAar: [0.619, 1.223, 1.812] },
    { alder: 63, faktorerPraHeleAar: [0.618, 1.221] },
    { alder: 64, faktorerPraHeleAar: [0.618] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
