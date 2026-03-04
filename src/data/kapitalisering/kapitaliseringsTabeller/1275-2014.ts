import type { ISODateString } from '../../../types/branded';
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

export const kapitaliseringsId = '1275/2014' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2015 efter lov om arbejdsskadesikring' as const;
export const kapitaliseringsDatering = '04/12/2014' as const;
export const gyldigFra = toISODateString('2015-01-01');
export const gyldigTil = toISODateString('2015-02-28');

// Udtrukket fra BEK nr 1275 af 04/12/2014.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const HISTORISK_ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadesdatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2011-01-01',     '1955-07-01',     null,     '67',     'A'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     '66.5',     'B'],
  ['2011-01-01',     '1954-07-01',     '1954-12-31',     '66',     'C'],
  ['2011-01-01',     '1954-01-01',     '1954-06-30',     '65.5',     'D'],
] as const;

export const historiskErhvervsevnetabTabelvalg = HISTORISK_ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadesdatoFra, foedselsdatoFra, foedselsdatoTil, ophoersalderAarLabel, tabel]) => ({
    skadesdatoFra: toISODateString(skadesdatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    foedselsdatoTil: foedselsdatoTil ? toISODateString(foedselsdatoTil) : null,
    ophoersalderAarLabel,
    tabel,
  })
);

export const erhvervsevnetabTabeller = {
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
  A: [
    { alder: 5, maendFaktor: 29.159, kvinderFaktor: 29.52 },
    { alder: 6, maendFaktor: 28.773, kvinderFaktor: 29.136 },
    { alder: 7, maendFaktor: 28.385, kvinderFaktor: 28.749 },
    { alder: 8, maendFaktor: 27.993, kvinderFaktor: 28.36 },
    { alder: 9, maendFaktor: 27.599, kvinderFaktor: 27.968 },
    { alder: 10, maendFaktor: 27.202, kvinderFaktor: 27.572 },
    { alder: 11, maendFaktor: 26.802, kvinderFaktor: 27.174 },
    { alder: 12, maendFaktor: 26.399, kvinderFaktor: 26.772 },
    { alder: 13, maendFaktor: 25.994, kvinderFaktor: 26.368 },
    { alder: 14, maendFaktor: 25.585, kvinderFaktor: 25.961 },
    { alder: 15, maendFaktor: 25.174, kvinderFaktor: 25.55 },
    { alder: 16, maendFaktor: 24.759, kvinderFaktor: 25.137 },
    { alder: 17, maendFaktor: 24.342, kvinderFaktor: 24.72 },
    { alder: 18, maendFaktor: 23.922, kvinderFaktor: 24.301 },
    { alder: 19, maendFaktor: 23.499, kvinderFaktor: 23.879 },
    { alder: 20, maendFaktor: 23.073, kvinderFaktor: 23.453 },
    { alder: 21, maendFaktor: 22.645, kvinderFaktor: 23.025 },
    { alder: 22, maendFaktor: 22.213, kvinderFaktor: 22.594 },
    { alder: 23, maendFaktor: 21.779, kvinderFaktor: 22.159 },
    { alder: 24, maendFaktor: 21.343, kvinderFaktor: 21.722 },
    { alder: 25, maendFaktor: 20.903, kvinderFaktor: 21.282 },
    { alder: 26, maendFaktor: 20.461, kvinderFaktor: 20.839 },
    { alder: 27, maendFaktor: 20.016, kvinderFaktor: 20.392 },
    { alder: 28, maendFaktor: 19.569, kvinderFaktor: 19.944 },
    { alder: 29, maendFaktor: 19.119, kvinderFaktor: 19.492 },
    { alder: 30, maendFaktor: 18.666, kvinderFaktor: 19.037 },
    { alder: 31, maendFaktor: 18.212, kvinderFaktor: 18.579 },
    { alder: 32, maendFaktor: 17.754, kvinderFaktor: 18.119 },
    { alder: 33, maendFaktor: 17.295, kvinderFaktor: 17.656 },
    { alder: 34, maendFaktor: 16.832, kvinderFaktor: 17.19 },
    { alder: 35, maendFaktor: 16.368, kvinderFaktor: 16.721 },
    { alder: 36, maendFaktor: 15.902, kvinderFaktor: 16.25 },
    { alder: 37, maendFaktor: 15.433, kvinderFaktor: 15.776 },
    { alder: 38, maendFaktor: 14.962, kvinderFaktor: 15.299 },
    { alder: 39, maendFaktor: 14.489, kvinderFaktor: 14.82 },
    { alder: 40, maendFaktor: 14.014, kvinderFaktor: 14.338 },
    { alder: 41, maendFaktor: 13.537, kvinderFaktor: 13.853 },
    { alder: 42, maendFaktor: 13.058, kvinderFaktor: 13.366 },
    { alder: 43, maendFaktor: 12.577, kvinderFaktor: 12.877 },
    { alder: 44, maendFaktor: 12.094, kvinderFaktor: 12.384 },
    { alder: 45, maendFaktor: 11.609, kvinderFaktor: 11.89 },
    { alder: 46, maendFaktor: 11.122, kvinderFaktor: 11.392 },
    { alder: 47, maendFaktor: 10.633, kvinderFaktor: 10.892 },
    { alder: 48, maendFaktor: 10.143, kvinderFaktor: 10.39 },
    { alder: 49, maendFaktor: 9.65, kvinderFaktor: 9.885 },
    { alder: 50, maendFaktor: 9.155, kvinderFaktor: 9.377 },
    { alder: 51, maendFaktor: 8.658, kvinderFaktor: 8.866 },
    { alder: 52, maendFaktor: 8.159, kvinderFaktor: 8.352 },
    { alder: 53, maendFaktor: 7.657, kvinderFaktor: 7.835 },
    { alder: 54, maendFaktor: 7.152, kvinderFaktor: 7.315 },
    { alder: 55, maendFaktor: 6.644, kvinderFaktor: 6.791 },
    { alder: 56, maendFaktor: 6.132, kvinderFaktor: 6.263 },
    { alder: 57, maendFaktor: 5.617, kvinderFaktor: 5.731 },
    { alder: 58, maendFaktor: 5.097, kvinderFaktor: 5.195 },
    { alder: 59, maendFaktor: 4.572, kvinderFaktor: 4.653 },
    { alder: 60, maendFaktor: 4.04, kvinderFaktor: 4.105 },
    { alder: 61, maendFaktor: 3.502, kvinderFaktor: 3.551 },
  ],
  B: [
    { alder: 59, maendFaktor: 4.315, kvinderFaktor: 4.386 },
    { alder: 60, maendFaktor: 3.778, kvinderFaktor: 3.833 },
    { alder: 61, maendFaktor: 3.234, kvinderFaktor: 3.274 },
  ],
  C: [
    { alder: 60, maendFaktor: 3.516, kvinderFaktor: 3.561 },
    { alder: 61, maendFaktor: 2.965, kvinderFaktor: 2.997 },
    { alder: 62, maendFaktor: 2.405, kvinderFaktor: 2.425 },
  ],
  D: [
    { alder: 60, maendFaktor: 3.245, kvinderFaktor: 3.282 },
    { alder: 61, maendFaktor: 2.688, kvinderFaktor: 2.713 },
    { alder: 62, maendFaktor: 2.121, kvinderFaktor: 2.135 },
  ],
  E: [
    { alder: 61, maendFaktor: 2.411, kvinderFaktor: 2.429 },
    { alder: 62, maendFaktor: 1.837, kvinderFaktor: 1.845 },
  ],
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
  F: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.659, 4.25, 4.837, 5.418, 5.994] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.659, 4.25, 4.836, 5.417, 5.992] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.658, 4.249, 4.835, 5.416, 5.991] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.658, 4.249, 4.834, 5.414, 5.989] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.657, 4.248, 4.833, 5.413, 5.988] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.459, 3.061, 3.656, 4.247, 4.832, 5.412, 5.986] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.06, 3.656, 4.246, 4.831, 5.41, 5.984] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.06, 3.655, 4.245, 4.829, 5.408, 5.981] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.059, 3.654, 4.244, 4.828, 5.406, 5.979] },
    { alder: 27, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.059, 3.653, 4.243, 4.826, 5.404, 5.976] },
    { alder: 28, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.058, 3.652, 4.241, 4.824, 5.402, 5.973] },
    { alder: 29, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.057, 3.651, 4.24, 4.822, 5.399, 5.97] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.056, 3.65, 4.238, 4.82, 5.396, 5.967] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.456, 3.056, 3.649, 4.237, 4.818, 5.393, 5.963] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.456, 3.055, 3.648, 4.235, 4.816, 5.39, 5.959] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.24, 1.85, 2.455, 3.054, 3.646, 4.233, 4.813, 5.387, 5.954] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.053, 3.645, 4.23, 4.81, 5.383, 5.949] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.052, 3.643, 4.228, 4.807, 5.379, 5.944] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.453, 3.05, 3.641, 4.225, 4.803, 5.374, 5.938] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.452, 3.049, 3.639, 4.222, 4.799, 5.369, 5.932] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.239, 1.848, 2.451, 3.047, 3.637, 4.219, 4.795, 5.363, 5.925] },
    { alder: 39, faktorerPraHeleAar: [0.622, 1.238, 1.848, 2.45, 3.046, 3.634, 4.216, 4.79, 5.357, 5.917] },
    { alder: 40, faktorerPraHeleAar: [0.622, 1.238, 1.847, 2.449, 3.044, 3.632, 4.212, 4.785, 5.351, 5.909] },
    { alder: 41, faktorerPraHeleAar: [0.622, 1.238, 1.846, 2.448, 3.042, 3.629, 4.208, 4.78, 5.344, 5.9] },
    { alder: 42, faktorerPraHeleAar: [0.622, 1.237, 1.846, 2.446, 3.04, 3.625, 4.204, 4.774, 5.336, 5.89] },
    { alder: 43, faktorerPraHeleAar: [0.622, 1.237, 1.845, 2.445, 3.037, 3.622, 4.199, 4.767, 5.328, 5.88] },
    { alder: 44, faktorerPraHeleAar: [0.622, 1.237, 1.844, 2.443, 3.035, 3.618, 4.193, 4.76, 5.319, 5.868] },
    { alder: 45, faktorerPraHeleAar: [0.622, 1.236, 1.843, 2.442, 3.032, 3.614, 4.188, 4.753, 5.309, 5.855] },
    { alder: 46, faktorerPraHeleAar: [0.622, 1.236, 1.842, 2.44, 3.029, 3.61, 4.181, 4.744, 5.298, 5.842] },
    { alder: 47, faktorerPraHeleAar: [0.622, 1.235, 1.841, 2.438, 3.026, 3.605, 4.175, 4.735, 5.286, 5.827] },
    { alder: 48, faktorerPraHeleAar: [0.622, 1.235, 1.84, 2.435, 3.022, 3.599, 4.167, 4.725, 5.273, 5.811] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.234, 1.838, 2.433, 3.018, 3.594, 4.159, 4.714, 5.259, 5.793] },
    { alder: 50, faktorerPraHeleAar: [0.621, 1.234, 1.837, 2.43, 3.014, 3.587, 4.15, 4.703, 5.244, 5.774] },
    { alder: 51, faktorerPraHeleAar: [0.621, 1.233, 1.835, 2.427, 3.009, 3.58, 4.141, 4.69, 5.228, 5.753] },
    { alder: 52, faktorerPraHeleAar: [0.621, 1.232, 1.833, 2.424, 3.004, 3.573, 4.13, 4.676, 5.21, 5.731] },
    { alder: 53, faktorerPraHeleAar: [0.621, 1.231, 1.831, 2.421, 2.998, 3.565, 4.119, 4.661, 5.19, 5.706] },
    { alder: 54, faktorerPraHeleAar: [0.621, 1.231, 1.829, 2.417, 2.992, 3.556, 4.107, 4.645, 5.169, 5.68] },
    { alder: 55, faktorerPraHeleAar: [0.62, 1.23, 1.827, 2.413, 2.986, 3.546, 4.093, 4.627, 5.146, 5.651] },
    { alder: 56, faktorerPraHeleAar: [0.62, 1.229, 1.825, 2.408, 2.979, 3.536, 4.079, 4.608, 5.121, 5.62] },
    { alder: 57, faktorerPraHeleAar: [0.62, 1.227, 1.822, 2.403, 2.971, 3.524, 4.063, 4.587, 5.095, 5.586] },
    { alder: 58, faktorerPraHeleAar: [0.62, 1.226, 1.819, 2.398, 2.963, 3.512, 4.046, 4.564, 5.065] },
    { alder: 59, faktorerPraHeleAar: [0.619, 1.225, 1.816, 2.392, 2.953, 3.499, 4.028, 4.54] },
    { alder: 60, faktorerPraHeleAar: [0.619, 1.223, 1.813, 2.386, 2.943, 3.484, 4.007] },
    { alder: 61, faktorerPraHeleAar: [0.619, 1.222, 1.809, 2.379, 2.933] },
    { alder: 62, faktorerPraHeleAar: [0.618, 1.22, 1.805] },
    { alder: 63, faktorerPraHeleAar: [0.618, 1.218] },
    { alder: 64, faktorerPraHeleAar: [0.617] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
  G: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.241, 1.854, 2.461, 3.063, 3.66, 4.252, 4.839, 5.421, 5.998] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.063, 3.66, 4.252, 4.839, 5.42, 5.997] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.063, 3.66, 4.252, 4.838, 5.42, 5.996] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.063, 3.659, 4.251, 4.837, 5.419, 5.995] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.659, 4.25, 4.837, 5.418, 5.994] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.659, 4.25, 4.836, 5.417, 5.992] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.062, 3.658, 4.249, 4.835, 5.416, 5.991] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.658, 4.249, 4.834, 5.414, 5.989] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.657, 4.248, 4.833, 5.413, 5.988] },
    { alder: 27, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.459, 3.061, 3.656, 4.247, 4.832, 5.412, 5.986] },
    { alder: 28, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.06, 3.656, 4.246, 4.831, 5.41, 5.984] },
    { alder: 29, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.06, 3.655, 4.245, 4.829, 5.408, 5.981] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.059, 3.654, 4.244, 4.828, 5.406, 5.979] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.059, 3.653, 4.243, 4.826, 5.404, 5.976] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.058, 3.652, 4.241, 4.824, 5.402, 5.973] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.057, 3.651, 4.24, 4.822, 5.399, 5.97] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.056, 3.65, 4.238, 4.82, 5.396, 5.967] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.456, 3.056, 3.649, 4.237, 4.818, 5.393, 5.963] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.456, 3.055, 3.648, 4.235, 4.816, 5.39, 5.959] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.24, 1.85, 2.455, 3.054, 3.646, 4.233, 4.813, 5.387, 5.954] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.053, 3.645, 4.23, 4.81, 5.383, 5.949] },
    { alder: 39, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.052, 3.643, 4.228, 4.807, 5.379, 5.944] },
    { alder: 40, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.453, 3.05, 3.641, 4.225, 4.803, 5.374, 5.938] },
    { alder: 41, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.452, 3.049, 3.639, 4.222, 4.799, 5.369, 5.932] },
    { alder: 42, faktorerPraHeleAar: [0.623, 1.239, 1.848, 2.451, 3.047, 3.637, 4.219, 4.795, 5.363, 5.925] },
    { alder: 43, faktorerPraHeleAar: [0.622, 1.238, 1.848, 2.45, 3.046, 3.634, 4.216, 4.79, 5.357, 5.917] },
    { alder: 44, faktorerPraHeleAar: [0.622, 1.238, 1.847, 2.449, 3.044, 3.632, 4.212, 4.785, 5.351, 5.909] },
    { alder: 45, faktorerPraHeleAar: [0.622, 1.238, 1.846, 2.448, 3.042, 3.629, 4.208, 4.78, 5.344, 5.9] },
    { alder: 46, faktorerPraHeleAar: [0.622, 1.237, 1.846, 2.446, 3.04, 3.625, 4.204, 4.774, 5.336, 5.89] },
    { alder: 47, faktorerPraHeleAar: [0.622, 1.237, 1.845, 2.445, 3.037, 3.622, 4.199, 4.767, 5.328, 5.88] },
    { alder: 48, faktorerPraHeleAar: [0.622, 1.237, 1.844, 2.443, 3.035, 3.618, 4.193, 4.76, 5.319, 5.868] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.236, 1.843, 2.442, 3.032, 3.614, 4.188, 4.753, 5.309, 5.855] },
    { alder: 50, faktorerPraHeleAar: [0.622, 1.236, 1.842, 2.44, 3.029, 3.61, 4.181, 4.744, 5.298, 5.842] },
    { alder: 51, faktorerPraHeleAar: [0.622, 1.235, 1.841, 2.438, 3.026, 3.605, 4.175, 4.735, 5.286, 5.827] },
    { alder: 52, faktorerPraHeleAar: [0.622, 1.235, 1.84, 2.435, 3.022, 3.599, 4.167, 4.725, 5.273, 5.811] },
    { alder: 53, faktorerPraHeleAar: [0.622, 1.234, 1.838, 2.433, 3.018, 3.594, 4.159, 4.714, 5.259, 5.793] },
    { alder: 54, faktorerPraHeleAar: [0.621, 1.234, 1.837, 2.43, 3.014, 3.587, 4.15, 4.703, 5.244, 5.774] },
    { alder: 55, faktorerPraHeleAar: [0.621, 1.233, 1.835, 2.427, 3.009, 3.58, 4.141, 4.69, 5.228, 5.753] },
    { alder: 56, faktorerPraHeleAar: [0.621, 1.232, 1.833, 2.424, 3.004, 3.573, 4.13, 4.676, 5.21, 5.731] },
    { alder: 57, faktorerPraHeleAar: [0.621, 1.231, 1.831, 2.421, 2.998, 3.565, 4.119, 4.661, 5.19, 5.706] },
    { alder: 58, faktorerPraHeleAar: [0.621, 1.231, 1.829, 2.417, 2.992, 3.556, 4.107, 4.645, 5.169] },
    { alder: 59, faktorerPraHeleAar: [0.62, 1.23, 1.827, 2.413, 2.986, 3.546, 4.093, 4.627] },
    { alder: 60, faktorerPraHeleAar: [0.62, 1.229, 1.825, 2.408, 2.979, 3.536, 4.079] },
    { alder: 61, faktorerPraHeleAar: [0.62, 1.227, 1.822, 2.403, 2.971] },
    { alder: 62, faktorerPraHeleAar: [0.62, 1.226, 1.819] },
    { alder: 63, faktorerPraHeleAar: [0.619, 1.225] },
    { alder: 64, faktorerPraHeleAar: [0.619] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

