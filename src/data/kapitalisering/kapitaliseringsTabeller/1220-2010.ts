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

export const kapitaliseringsId = '1220/2010' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2011 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. januar 2011 eller senere' as const;
export const kapitaliseringsDatering = '28/10/2010' as const;
export const gyldigFra = toISODateString('2011-01-01');
export const gyldigTil = toISODateString('2011-12-31');

// Udtrukket fra BEK nr 1220 af 28/10/2010.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.
// Foedselsdato-graenserne i tabelvalget afviger fra senere bekendtgørelser
// og bevares 1:1 efter kilden.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadesdatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2011-01-01',     '1960-07-01',     null,     '67',     'A'],
  ['2011-01-01',     '1960-01-01',     '1960-06-30',     '66.5',     'B'],
  ['2011-01-01',     '1959-07-01',     '1959-12-31',     '66',     'C'],
  ['2011-01-01',     '1959-01-01',     '1959-06-30',     '65.5',     'D'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadesdatoFra, foedselsdatoFra, foedselsdatoTil, ophoersalderAarLabel, tabel]) => ({
    skadesdatoFra: toISODateString(skadesdatoFra),
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
    { alder: 5, maendFaktor: 33.519, kvinderFaktor: 33.98 },
    { alder: 6, maendFaktor: 33.006, kvinderFaktor: 33.467 },
    { alder: 7, maendFaktor: 32.491, kvinderFaktor: 32.953 },
    { alder: 8, maendFaktor: 31.975, kvinderFaktor: 32.437 },
    { alder: 9, maendFaktor: 31.458, kvinderFaktor: 31.919 },
    { alder: 10, maendFaktor: 30.939, kvinderFaktor: 31.401 },
    { alder: 11, maendFaktor: 30.419, kvinderFaktor: 30.881 },
    { alder: 12, maendFaktor: 29.897, kvinderFaktor: 30.359 },
    { alder: 13, maendFaktor: 29.375, kvinderFaktor: 29.836 },
    { alder: 14, maendFaktor: 28.851, kvinderFaktor: 29.312 },
    { alder: 15, maendFaktor: 28.326, kvinderFaktor: 28.786 },
    { alder: 16, maendFaktor: 27.8, kvinderFaktor: 28.259 },
    { alder: 17, maendFaktor: 27.272, kvinderFaktor: 27.73 },
    { alder: 18, maendFaktor: 26.744, kvinderFaktor: 27.201 },
    { alder: 19, maendFaktor: 26.214, kvinderFaktor: 26.67 },
    { alder: 20, maendFaktor: 25.684, kvinderFaktor: 26.138 },
    { alder: 21, maendFaktor: 25.152, kvinderFaktor: 25.604 },
    { alder: 22, maendFaktor: 24.619, kvinderFaktor: 25.07 },
    { alder: 23, maendFaktor: 24.086, kvinderFaktor: 24.534 },
    { alder: 24, maendFaktor: 23.552, kvinderFaktor: 23.997 },
    { alder: 25, maendFaktor: 23.016, kvinderFaktor: 23.459 },
    { alder: 26, maendFaktor: 22.48, kvinderFaktor: 22.92 },
    { alder: 27, maendFaktor: 21.944, kvinderFaktor: 22.38 },
    { alder: 28, maendFaktor: 21.406, kvinderFaktor: 21.839 },
    { alder: 29, maendFaktor: 20.868, kvinderFaktor: 21.297 },
    { alder: 30, maendFaktor: 20.33, kvinderFaktor: 20.754 },
    { alder: 31, maendFaktor: 19.791, kvinderFaktor: 20.21 },
    { alder: 32, maendFaktor: 19.252, kvinderFaktor: 19.666 },
    { alder: 33, maendFaktor: 18.712, kvinderFaktor: 19.121 },
    { alder: 34, maendFaktor: 18.172, kvinderFaktor: 18.575 },
    { alder: 35, maendFaktor: 17.632, kvinderFaktor: 18.028 },
    { alder: 36, maendFaktor: 17.091, kvinderFaktor: 17.481 },
    { alder: 37, maendFaktor: 16.551, kvinderFaktor: 16.933 },
    { alder: 38, maendFaktor: 16.01, kvinderFaktor: 16.384 },
    { alder: 39, maendFaktor: 15.47, kvinderFaktor: 15.836 },
    { alder: 40, maendFaktor: 14.93, kvinderFaktor: 15.286 },
    { alder: 41, maendFaktor: 14.389, kvinderFaktor: 14.736 },
    { alder: 42, maendFaktor: 13.849, kvinderFaktor: 14.186 },
    { alder: 43, maendFaktor: 13.309, kvinderFaktor: 13.636 },
    { alder: 44, maendFaktor: 12.77, kvinderFaktor: 13.085 },
    { alder: 45, maendFaktor: 12.23, kvinderFaktor: 12.534 },
    { alder: 46, maendFaktor: 11.691, kvinderFaktor: 11.982 },
    { alder: 47, maendFaktor: 11.153, kvinderFaktor: 11.43 },
    { alder: 48, maendFaktor: 10.614, kvinderFaktor: 10.878 },
    { alder: 49, maendFaktor: 10.076, kvinderFaktor: 10.325 },
    { alder: 50, maendFaktor: 9.537, kvinderFaktor: 9.772 },
    { alder: 51, maendFaktor: 8.999, kvinderFaktor: 9.218 },
    { alder: 52, maendFaktor: 8.461, kvinderFaktor: 8.664 },
  ],
  B: [
    { alder: 50, maendFaktor: 9.299, kvinderFaktor: 9.518 },
    { alder: 51, maendFaktor: 8.758, kvinderFaktor: 8.962 },
    { alder: 52, maendFaktor: 8.217, kvinderFaktor: 8.405 },
  ],
  C: [
    { alder: 51, maendFaktor: 8.518, kvinderFaktor: 8.706 },
    { alder: 52, maendFaktor: 7.974, kvinderFaktor: 8.147 },
    { alder: 53, maendFaktor: 7.43, kvinderFaktor: 7.587 },
  ],
  D: [
    { alder: 51, maendFaktor: 8.27, kvinderFaktor: 8.444 },
    { alder: 52, maendFaktor: 7.724, kvinderFaktor: 7.883 },
    { alder: 53, maendFaktor: 7.178, kvinderFaktor: 7.321 },
  ],
  E: [
    { alder: 52, maendFaktor: 7.474, kvinderFaktor: 7.619 },
    { alder: 53, maendFaktor: 6.925, kvinderFaktor: 7.055 },
    { alder: 54, maendFaktor: 6.374, kvinderFaktor: 6.489 },
    { alder: 55, maendFaktor: 5.821, kvinderFaktor: 5.922 },
    { alder: 56, maendFaktor: 5.266, kvinderFaktor: 5.352 },
    { alder: 57, maendFaktor: 4.709, kvinderFaktor: 4.779 },
    { alder: 58, maendFaktor: 4.147, kvinderFaktor: 4.204 },
    { alder: 59, maendFaktor: 3.582, kvinderFaktor: 3.624 },
    { alder: 60, maendFaktor: 3.011, kvinderFaktor: 3.041 },
    { alder: 61, maendFaktor: 2.433, kvinderFaktor: 2.452 },
    { alder: 62, maendFaktor: 1.848, kvinderFaktor: 1.856 },
  ],
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
  F: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.249, 1.871, 2.489, 3.106, 3.72, 4.332, 4.941, 5.548, 6.152] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.106, 3.72, 4.331, 4.94, 5.547, 6.151] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.719, 4.331, 4.939, 5.546, 6.15] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.719, 4.33, 4.938, 5.545, 6.148] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.718, 4.329, 4.937, 5.543, 6.146] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.104, 3.718, 4.328, 4.936, 5.542, 6.144] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.104, 3.717, 4.327, 4.935, 5.54, 6.142] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.103, 3.716, 4.326, 4.934, 5.538, 6.14] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.103, 3.715, 4.325, 4.932, 5.536, 6.137] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.102, 3.714, 4.324, 4.93, 5.534, 6.134] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.101, 3.713, 4.322, 4.928, 5.531, 6.131] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.486, 3.101, 3.712, 4.321, 4.926, 5.529, 6.128] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.486, 3.1, 3.711, 4.319, 4.924, 5.526, 6.124] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.485, 3.099, 3.71, 4.318, 4.922, 5.523, 6.12] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.485, 3.098, 3.709, 4.316, 4.919, 5.52, 6.116] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.484, 3.097, 3.707, 4.314, 4.917, 5.516, 6.111] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.248, 1.867, 2.483, 3.096, 3.705, 4.311, 4.913, 5.512, 6.106] },
    { alder: 35, faktorerPraHeleAar: [0.625, 1.248, 1.867, 2.483, 3.095, 3.704, 4.309, 4.91, 5.508, 6.101] },
    { alder: 36, faktorerPraHeleAar: [0.625, 1.248, 1.866, 2.482, 3.094, 3.702, 4.306, 4.906, 5.503, 6.095] },
    { alder: 37, faktorerPraHeleAar: [0.625, 1.247, 1.866, 2.481, 3.092, 3.7, 4.303, 4.902, 5.498, 6.088] },
    { alder: 38, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.091, 3.697, 4.3, 4.898, 5.492, 6.081] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.296, 4.893, 5.486, 6.073] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.087, 3.692, 4.293, 4.888, 5.479, 6.065] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.246, 1.864, 2.477, 3.085, 3.689, 4.288, 4.883, 5.472, 6.055] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.083, 3.686, 4.284, 4.877, 5.464, 6.045] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.474, 3.081, 3.682, 4.279, 4.87, 5.455, 6.034] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.472, 3.078, 3.678, 4.273, 4.863, 5.446, 6.022] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.47, 3.075, 3.674, 4.268, 4.855, 5.435, 6.009] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.244, 1.859, 2.468, 3.072, 3.67, 4.261, 4.846, 5.424, 5.995] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.244, 1.858, 2.466, 3.069, 3.665, 4.254, 4.837, 5.412, 5.98] },
    { alder: 48, faktorerPraHeleAar: [0.624, 1.243, 1.857, 2.464, 3.065, 3.659, 4.247, 4.826, 5.399, 5.963] },
    { alder: 49, faktorerPraHeleAar: [0.624, 1.243, 1.855, 2.461, 3.061, 3.653, 4.238, 4.815, 5.384, 5.944] },
    { alder: 50, faktorerPraHeleAar: [0.624, 1.242, 1.854, 2.459, 3.057, 3.647, 4.229, 4.803, 5.369, 5.925] },
    { alder: 51, faktorerPraHeleAar: [0.624, 1.242, 1.852, 2.456, 3.052, 3.64, 4.219, 4.79, 5.352, 5.903] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.241, 1.85, 2.453, 3.047, 3.632, 4.209, 4.776, 5.333, 5.88] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.24, 1.849, 2.449, 3.041, 3.624, 4.197, 4.76, 5.313, 5.854] },
    { alder: 54, faktorerPraHeleAar: [0.623, 1.239, 1.846, 2.445, 3.035, 3.615, 4.185, 4.744, 5.291, 5.827] },
    { alder: 55, faktorerPraHeleAar: [0.623, 1.238, 1.844, 2.441, 3.028, 3.605, 4.171, 4.725, 5.268, 5.797] },
    { alder: 56, faktorerPraHeleAar: [0.623, 1.237, 1.842, 2.437, 3.021, 3.594, 4.156, 4.705, 5.242] },
    { alder: 57, faktorerPraHeleAar: [0.623, 1.236, 1.839, 2.432, 3.013, 3.583, 4.14, 4.684] },
    { alder: 58, faktorerPraHeleAar: [0.622, 1.235, 1.836, 2.426, 3.004, 3.57, 4.122] },
    { alder: 59, faktorerPraHeleAar: [0.622, 1.233, 1.833, 2.42, 2.995, 3.556] },
    { alder: 60, faktorerPraHeleAar: [0.622, 1.232, 1.829, 2.414, 2.985] },
    { alder: 61, faktorerPraHeleAar: [0.621, 1.23, 1.826, 2.407] },
    { alder: 62, faktorerPraHeleAar: [0.621, 1.228, 1.821] },
    { alder: 63, faktorerPraHeleAar: [0.62, 1.226] },
    { alder: 64, faktorerPraHeleAar: [0.62] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
  G: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.49, 3.107, 3.722, 4.334, 4.944, 5.552, 6.157] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.249, 1.871, 2.49, 3.107, 3.721, 4.333, 4.943, 5.551, 6.156] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.249, 1.871, 2.49, 3.107, 3.721, 4.333, 4.943, 5.55, 6.155] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.249, 1.871, 2.49, 3.106, 3.721, 4.332, 4.942, 5.549, 6.154] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.249, 1.871, 2.489, 3.106, 3.72, 4.332, 4.941, 5.548, 6.152] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.106, 3.72, 4.331, 4.94, 5.547, 6.151] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.719, 4.331, 4.939, 5.546, 6.15] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.719, 4.33, 4.938, 5.545, 6.148] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.718, 4.329, 4.937, 5.543, 6.146] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.104, 3.718, 4.328, 4.936, 5.542, 6.144] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.104, 3.717, 4.327, 4.935, 5.54, 6.142] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.103, 3.716, 4.326, 4.934, 5.538, 6.14] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.103, 3.715, 4.325, 4.932, 5.536, 6.137] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.102, 3.714, 4.324, 4.93, 5.534, 6.134] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.101, 3.713, 4.322, 4.928, 5.531, 6.131] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.486, 3.101, 3.712, 4.321, 4.926, 5.529, 6.128] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.486, 3.1, 3.711, 4.319, 4.924, 5.526, 6.124] },
    { alder: 35, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.485, 3.099, 3.71, 4.318, 4.922, 5.523, 6.12] },
    { alder: 36, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.485, 3.098, 3.709, 4.316, 4.919, 5.52, 6.116] },
    { alder: 37, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.484, 3.097, 3.707, 4.314, 4.917, 5.516, 6.111] },
    { alder: 38, faktorerPraHeleAar: [0.626, 1.248, 1.867, 2.483, 3.096, 3.705, 4.311, 4.913, 5.512, 6.106] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.248, 1.867, 2.483, 3.095, 3.704, 4.309, 4.91, 5.508, 6.101] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.248, 1.866, 2.482, 3.094, 3.702, 4.306, 4.906, 5.503, 6.095] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.247, 1.866, 2.481, 3.092, 3.7, 4.303, 4.902, 5.498, 6.088] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.091, 3.697, 4.3, 4.898, 5.492, 6.081] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.296, 4.893, 5.486, 6.073] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.087, 3.692, 4.293, 4.888, 5.479, 6.065] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.246, 1.864, 2.477, 3.085, 3.689, 4.288, 4.883, 5.472, 6.055] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.083, 3.686, 4.284, 4.877, 5.464, 6.045] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.474, 3.081, 3.682, 4.279, 4.87, 5.455, 6.034] },
    { alder: 48, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.472, 3.078, 3.678, 4.273, 4.863, 5.446, 6.022] },
    { alder: 49, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.47, 3.075, 3.674, 4.268, 4.855, 5.435, 6.009] },
    { alder: 50, faktorerPraHeleAar: [0.625, 1.244, 1.859, 2.468, 3.072, 3.67, 4.261, 4.846, 5.424, 5.995] },
    { alder: 51, faktorerPraHeleAar: [0.625, 1.244, 1.858, 2.466, 3.069, 3.665, 4.254, 4.837, 5.412, 5.98] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.243, 1.857, 2.464, 3.065, 3.659, 4.247, 4.826, 5.399, 5.963] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.243, 1.855, 2.461, 3.061, 3.653, 4.238, 4.815, 5.384, 5.944] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.242, 1.854, 2.459, 3.057, 3.647, 4.229, 4.803, 5.369, 5.925] },
    { alder: 55, faktorerPraHeleAar: [0.624, 1.242, 1.852, 2.456, 3.052, 3.64, 4.219, 4.79, 5.352, 5.903] },
    { alder: 56, faktorerPraHeleAar: [0.624, 1.241, 1.85, 2.453, 3.047, 3.632, 4.209, 4.776, 5.333] },
    { alder: 57, faktorerPraHeleAar: [0.624, 1.24, 1.849, 2.449, 3.041, 3.624, 4.197, 4.76] },
    { alder: 58, faktorerPraHeleAar: [0.623, 1.239, 1.846, 2.445, 3.035, 3.615, 4.185] },
    { alder: 59, faktorerPraHeleAar: [0.623, 1.238, 1.844, 2.441, 3.028, 3.605] },
    { alder: 60, faktorerPraHeleAar: [0.623, 1.237, 1.842, 2.437, 3.021] },
    { alder: 61, faktorerPraHeleAar: [0.623, 1.236, 1.839, 2.432] },
    { alder: 62, faktorerPraHeleAar: [0.622, 1.235, 1.836] },
    { alder: 63, faktorerPraHeleAar: [0.622, 1.233] },
    { alder: 64, faktorerPraHeleAar: [0.622] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
