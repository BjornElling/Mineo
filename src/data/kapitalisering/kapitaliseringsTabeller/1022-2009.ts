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

export const kapitaliseringsId = '1022/2009' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2010 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. juli 2007 eller senere' as const;
export const kapitaliseringsDatering = '30/10/2009' as const;
export const gyldigFra = toISODateString('2010-01-01');
export const gyldigTil = toISODateString('2010-12-31');

// Udtrukket maskinelt fra Bkg. 1022 2009.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const HISTORISK_ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadesdatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2007-07-01',     '1960-07-01',     null,     '67',     'A'],
  ['2007-07-01',     '1960-01-01',     '1960-06-30',     '66.5',     'B'],
  ['2007-07-01',     '1959-07-01',     '1959-12-31',     '66',     'C'],
  ['2007-07-01',     '1959-01-01',     '1959-06-30',     '65.5',     'D'],
  ['2007-07-01',     '1900-01-01',     '1958-12-31',     '65',     'E'],
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

export const erhvervsevnetabTabelvalg = [] as const;

export const erhvervsevnetabTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = 
{
  A: [
    { alder: 5, maendFaktor: 32.91, kvinderFaktor: 33.38 },
    { alder: 6, maendFaktor: 32.379, kvinderFaktor: 32.848 },
    { alder: 7, maendFaktor: 31.847, kvinderFaktor: 32.316 },
    { alder: 8, maendFaktor: 31.315, kvinderFaktor: 31.783 },
    { alder: 9, maendFaktor: 30.782, kvinderFaktor: 31.25 },
    { alder: 10, maendFaktor: 30.249, kvinderFaktor: 30.716 },
    { alder: 11, maendFaktor: 29.716, kvinderFaktor: 30.182 },
    { alder: 12, maendFaktor: 29.182, kvinderFaktor: 29.647 },
    { alder: 13, maendFaktor: 28.647, kvinderFaktor: 29.111 },
    { alder: 14, maendFaktor: 28.113, kvinderFaktor: 28.575 },
    { alder: 15, maendFaktor: 27.578, kvinderFaktor: 28.039 },
    { alder: 16, maendFaktor: 27.043, kvinderFaktor: 27.502 },
    { alder: 17, maendFaktor: 26.507, kvinderFaktor: 26.965 },
    { alder: 18, maendFaktor: 25.972, kvinderFaktor: 26.428 },
    { alder: 19, maendFaktor: 25.436, kvinderFaktor: 25.89 },
    { alder: 20, maendFaktor: 24.9, kvinderFaktor: 25.352 },
    { alder: 21, maendFaktor: 24.364, kvinderFaktor: 24.813 },
    { alder: 22, maendFaktor: 23.828, kvinderFaktor: 24.274 },
    { alder: 23, maendFaktor: 23.292, kvinderFaktor: 23.736 },
    { alder: 24, maendFaktor: 22.756, kvinderFaktor: 23.196 },
    { alder: 25, maendFaktor: 22.22, kvinderFaktor: 22.657 },
    { alder: 26, maendFaktor: 21.685, kvinderFaktor: 22.118 },
    { alder: 27, maendFaktor: 21.149, kvinderFaktor: 21.578 },
    { alder: 28, maendFaktor: 20.614, kvinderFaktor: 21.039 },
    { alder: 29, maendFaktor: 20.079, kvinderFaktor: 20.499 },
    { alder: 30, maendFaktor: 19.544, kvinderFaktor: 19.959 },
    { alder: 31, maendFaktor: 19.01, kvinderFaktor: 19.42 },
    { alder: 32, maendFaktor: 18.476, kvinderFaktor: 18.881 },
    { alder: 33, maendFaktor: 17.943, kvinderFaktor: 18.342 },
    { alder: 34, maendFaktor: 17.411, kvinderFaktor: 17.803 },
    { alder: 35, maendFaktor: 16.879, kvinderFaktor: 17.264 },
    { alder: 36, maendFaktor: 16.348, kvinderFaktor: 16.725 },
    { alder: 37, maendFaktor: 15.817, kvinderFaktor: 16.187 },
    { alder: 38, maendFaktor: 15.288, kvinderFaktor: 15.65 },
    { alder: 39, maendFaktor: 14.759, kvinderFaktor: 15.113 },
    { alder: 40, maendFaktor: 14.232, kvinderFaktor: 14.576 },
    { alder: 41, maendFaktor: 13.705, kvinderFaktor: 14.04 },
    { alder: 42, maendFaktor: 13.18, kvinderFaktor: 13.504 },
    { alder: 43, maendFaktor: 12.655, kvinderFaktor: 12.969 },
    { alder: 44, maendFaktor: 12.132, kvinderFaktor: 12.434 },
    { alder: 45, maendFaktor: 11.61, kvinderFaktor: 11.9 },
    { alder: 46, maendFaktor: 11.089, kvinderFaktor: 11.367 },
    { alder: 47, maendFaktor: 10.569, kvinderFaktor: 10.834 },
    { alder: 48, maendFaktor: 10.05, kvinderFaktor: 10.301 },
    { alder: 49, maendFaktor: 9.532, kvinderFaktor: 9.77 },
    { alder: 50, maendFaktor: 9.015, kvinderFaktor: 9.238 },
    { alder: 51, maendFaktor: 8.499, kvinderFaktor: 8.707 }
  ],
  B: [
    { alder: 49, maendFaktor: 9.305, kvinderFaktor: 9.527 },
    { alder: 50, maendFaktor: 8.786, kvinderFaktor: 8.994 },
    { alder: 51, maendFaktor: 8.268, kvinderFaktor: 8.462 }
  ],
  C: [
    { alder: 50, maendFaktor: 8.557, kvinderFaktor: 8.75 },
    { alder: 51, maendFaktor: 8.038, kvinderFaktor: 8.216 },
    { alder: 52, maendFaktor: 7.518, kvinderFaktor: 7.682 }
  ],
  D: [
    { alder: 50, maendFaktor: 8.322, kvinderFaktor: 8.501 },
    { alder: 51, maendFaktor: 7.801, kvinderFaktor: 7.966 },
    { alder: 52, maendFaktor: 7.28, kvinderFaktor: 7.43 }
  ],
  E: [
    { alder: 51, maendFaktor: 7.564, kvinderFaktor: 7.715 },
    { alder: 52, maendFaktor: 7.041, kvinderFaktor: 7.178 },
    { alder: 53, maendFaktor: 6.518, kvinderFaktor: 6.641 },
    { alder: 54, maendFaktor: 5.994, kvinderFaktor: 6.103 },
    { alder: 55, maendFaktor: 5.469, kvinderFaktor: 5.564 },
    { alder: 56, maendFaktor: 4.944, kvinderFaktor: 5.024 },
    { alder: 57, maendFaktor: 4.416, kvinderFaktor: 4.483 },
    { alder: 58, maendFaktor: 3.886, kvinderFaktor: 3.939 },
    { alder: 59, maendFaktor: 3.353, kvinderFaktor: 3.393 },
    { alder: 60, maendFaktor: 2.816, kvinderFaktor: 2.843 },
    { alder: 61, maendFaktor: 2.273, kvinderFaktor: 2.29 },
    { alder: 62, maendFaktor: 1.725, kvinderFaktor: 1.732 }
  ]
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = 
{
  F: [
    { alder: 18, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.328, 2.907, 3.485, 4.061, 4.637, 5.211, 5.783] },
    { alder: 19, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.328, 2.906, 3.484, 4.061, 4.636, 5.21, 5.782] },
    { alder: 20, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.484, 4.06, 4.635, 5.209, 5.781] },
    { alder: 21, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.483, 4.059, 4.634, 5.207, 5.779] },
    { alder: 22, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.905, 3.483, 4.059, 4.633, 5.206, 5.777] },
    { alder: 23, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.905, 3.482, 4.058, 4.632, 5.205, 5.776] },
    { alder: 24, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.326, 2.905, 3.481, 4.057, 4.631, 5.203, 5.774] },
    { alder: 25, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.326, 2.904, 3.481, 4.056, 4.629, 5.201, 5.771] },
    { alder: 26, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.326, 2.904, 3.48, 4.055, 4.628, 5.199, 5.769] },
    { alder: 27, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.325, 2.903, 3.479, 4.054, 4.626, 5.197, 5.766] },
    { alder: 28, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.478, 4.052, 4.625, 5.195, 5.764] },
    { alder: 29, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.477, 4.051, 4.623, 5.193, 5.76] },
    { alder: 30, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.324, 2.901, 3.476, 4.049, 4.621, 5.19, 5.757] },
    { alder: 31, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.324, 2.9, 3.475, 4.048, 4.618, 5.187, 5.753] },
    { alder: 32, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.323, 2.899, 3.474, 4.046, 4.616, 5.184, 5.749] },
    { alder: 33, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.323, 2.898, 3.472, 4.044, 4.613, 5.18, 5.745] },
    { alder: 34, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.322, 2.897, 3.471, 4.042, 4.61, 5.177, 5.74] },
    { alder: 35, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.321, 2.896, 3.469, 4.04, 4.607, 5.172, 5.735] },
    { alder: 36, faktorerPraHeleAar: [0.583, 1.164, 1.744, 2.32, 2.895, 3.467, 4.037, 4.604, 5.168, 5.729] },
    { alder: 37, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.32, 2.894, 3.465, 4.034, 4.6, 5.163, 5.723] },
    { alder: 38, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.319, 2.892, 3.463, 4.031, 4.596, 5.158, 5.716] },
    { alder: 39, faktorerPraHeleAar: [0.583, 1.164, 1.742, 2.318, 2.891, 3.461, 4.028, 4.592, 5.152, 5.709] },
    { alder: 40, faktorerPraHeleAar: [0.583, 1.164, 1.742, 2.317, 2.889, 3.458, 4.024, 4.587, 5.146, 5.701] },
    { alder: 41, faktorerPraHeleAar: [0.583, 1.163, 1.741, 2.316, 2.887, 3.455, 4.02, 4.581, 5.139, 5.692] },
    { alder: 42, faktorerPraHeleAar: [0.583, 1.163, 1.74, 2.314, 2.885, 3.452, 4.016, 4.576, 5.131, 5.682] },
    { alder: 43, faktorerPraHeleAar: [0.583, 1.163, 1.739, 2.313, 2.883, 3.449, 4.011, 4.569, 5.123, 5.672] },
    { alder: 44, faktorerPraHeleAar: [0.583, 1.162, 1.739, 2.311, 2.88, 3.445, 4.006, 4.563, 5.114, 5.661] },
    { alder: 45, faktorerPraHeleAar: [0.583, 1.162, 1.738, 2.31, 2.878, 3.441, 4.001, 4.555, 5.104, 5.648] },
    { alder: 46, faktorerPraHeleAar: [0.583, 1.162, 1.737, 2.308, 2.875, 3.437, 3.995, 4.547, 5.094, 5.635] },
    { alder: 47, faktorerPraHeleAar: [0.582, 1.161, 1.736, 2.306, 2.872, 3.432, 3.988, 4.538, 5.082, 5.62] },
    { alder: 48, faktorerPraHeleAar: [0.582, 1.161, 1.734, 2.304, 2.868, 3.427, 3.981, 4.529, 5.07, 5.604] },
    { alder: 49, faktorerPraHeleAar: [0.582, 1.16, 1.733, 2.301, 2.864, 3.422, 3.973, 4.518, 5.056, 5.587] },
    { alder: 50, faktorerPraHeleAar: [0.582, 1.159, 1.732, 2.299, 2.86, 3.416, 3.965, 4.507, 5.042, 5.569] },
    { alder: 51, faktorerPraHeleAar: [0.582, 1.159, 1.73, 2.296, 2.856, 3.409, 3.956, 4.494, 5.026, 5.548] },
    { alder: 52, faktorerPraHeleAar: [0.582, 1.158, 1.729, 2.293, 2.851, 3.402, 3.945, 4.481, 5.008, 5.526] },
    { alder: 53, faktorerPraHeleAar: [0.582, 1.157, 1.727, 2.29, 2.846, 3.394, 3.935, 4.466, 4.989, 5.502] },
    { alder: 54, faktorerPraHeleAar: [0.581, 1.156, 1.725, 2.286, 2.84, 3.386, 3.923, 4.451, 4.969, 5.476] },
    { alder: 55, faktorerPraHeleAar: [0.581, 1.156, 1.723, 2.282, 2.834, 3.376, 3.91, 4.433, 4.946, 5.448] },
    { alder: 56, faktorerPraHeleAar: [0.581, 1.155, 1.72, 2.278, 2.827, 3.366, 3.896, 4.415, 4.922] },
    { alder: 57, faktorerPraHeleAar: [0.581, 1.153, 1.718, 2.273, 2.82, 3.355, 3.881, 4.395] },
    { alder: 58, faktorerPraHeleAar: [0.58, 1.152, 1.715, 2.268, 2.811, 3.344, 3.864] },
    { alder: 59, faktorerPraHeleAar: [0.58, 1.151, 1.712, 2.263, 2.803, 3.331] },
    { alder: 60, faktorerPraHeleAar: [0.58, 1.15, 1.709, 2.257, 2.793] },
    { alder: 61, faktorerPraHeleAar: [0.579, 1.148, 1.705, 2.251] },
    { alder: 62, faktorerPraHeleAar: [0.579, 1.146, 1.701] },
    { alder: 63, faktorerPraHeleAar: [0.579, 1.145] },
    { alder: 64, faktorerPraHeleAar: [0.578] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = 
{
  G: [
    { alder: 18, faktorerPraHeleAar: [0.584, 1.166, 1.748, 2.328, 2.908, 3.486, 4.063, 4.639, 5.214, 5.788] },
    { alder: 19, faktorerPraHeleAar: [0.584, 1.166, 1.748, 2.328, 2.907, 3.486, 4.063, 4.639, 5.213, 5.787] },
    { alder: 20, faktorerPraHeleAar: [0.584, 1.166, 1.748, 2.328, 2.907, 3.485, 4.062, 4.638, 5.212, 5.786] },
    { alder: 21, faktorerPraHeleAar: [0.584, 1.166, 1.748, 2.328, 2.907, 3.485, 4.062, 4.637, 5.212, 5.785] },
    { alder: 22, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.328, 2.907, 3.485, 4.061, 4.637, 5.211, 5.783] },
    { alder: 23, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.328, 2.906, 3.484, 4.061, 4.636, 5.21, 5.782] },
    { alder: 24, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.484, 4.06, 4.635, 5.209, 5.781] },
    { alder: 25, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.483, 4.059, 4.634, 5.207, 5.779] },
    { alder: 26, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.905, 3.483, 4.059, 4.633, 5.206, 5.777] },
    { alder: 27, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.905, 3.482, 4.058, 4.632, 5.205, 5.776] },
    { alder: 28, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.326, 2.905, 3.481, 4.057, 4.631, 5.203, 5.774] },
    { alder: 29, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.326, 2.904, 3.481, 4.056, 4.629, 5.201, 5.771] },
    { alder: 30, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.326, 2.904, 3.48, 4.055, 4.628, 5.199, 5.769] },
    { alder: 31, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.325, 2.903, 3.479, 4.054, 4.626, 5.197, 5.766] },
    { alder: 32, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.478, 4.052, 4.625, 5.195, 5.764] },
    { alder: 33, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.477, 4.051, 4.623, 5.193, 5.76] },
    { alder: 34, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.324, 2.901, 3.476, 4.049, 4.621, 5.19, 5.757] },
    { alder: 35, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.324, 2.9, 3.475, 4.048, 4.618, 5.187, 5.753] },
    { alder: 36, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.323, 2.899, 3.474, 4.046, 4.616, 5.184, 5.749] },
    { alder: 37, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.323, 2.898, 3.472, 4.044, 4.613, 5.18, 5.745] },
    { alder: 38, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.322, 2.897, 3.471, 4.042, 4.61, 5.177, 5.74] },
    { alder: 39, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.321, 2.896, 3.469, 4.04, 4.607, 5.172, 5.735] },
    { alder: 40, faktorerPraHeleAar: [0.583, 1.164, 1.744, 2.32, 2.895, 3.467, 4.037, 4.604, 5.168, 5.729] },
    { alder: 41, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.32, 2.894, 3.465, 4.034, 4.6, 5.163, 5.723] },
    { alder: 42, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.319, 2.892, 3.463, 4.031, 4.596, 5.158, 5.716] },
    { alder: 43, faktorerPraHeleAar: [0.583, 1.164, 1.742, 2.318, 2.891, 3.461, 4.028, 4.592, 5.152, 5.709] },
    { alder: 44, faktorerPraHeleAar: [0.583, 1.164, 1.742, 2.317, 2.889, 3.458, 4.024, 4.587, 5.146, 5.701] },
    { alder: 45, faktorerPraHeleAar: [0.583, 1.163, 1.741, 2.316, 2.887, 3.455, 4.02, 4.581, 5.139, 5.692] },
    { alder: 46, faktorerPraHeleAar: [0.583, 1.163, 1.74, 2.314, 2.885, 3.452, 4.016, 4.576, 5.131, 5.682] },
    { alder: 47, faktorerPraHeleAar: [0.583, 1.163, 1.739, 2.313, 2.883, 3.449, 4.011, 4.569, 5.123, 5.672] },
    { alder: 48, faktorerPraHeleAar: [0.583, 1.162, 1.739, 2.311, 2.88, 3.445, 4.006, 4.563, 5.114, 5.661] },
    { alder: 49, faktorerPraHeleAar: [0.583, 1.162, 1.738, 2.31, 2.878, 3.441, 4.001, 4.555, 5.104, 5.648] },
    { alder: 50, faktorerPraHeleAar: [0.583, 1.162, 1.737, 2.308, 2.875, 3.437, 3.995, 4.547, 5.094, 5.635] },
    { alder: 51, faktorerPraHeleAar: [0.582, 1.161, 1.736, 2.306, 2.872, 3.432, 3.988, 4.538, 5.082, 5.62] },
    { alder: 52, faktorerPraHeleAar: [0.582, 1.161, 1.734, 2.304, 2.868, 3.427, 3.981, 4.529, 5.07, 5.604] },
    { alder: 53, faktorerPraHeleAar: [0.582, 1.16, 1.733, 2.301, 2.864, 3.422, 3.973, 4.518, 5.056, 5.587] },
    { alder: 54, faktorerPraHeleAar: [0.582, 1.159, 1.732, 2.299, 2.86, 3.416, 3.965, 4.507, 5.042, 5.569] },
    { alder: 55, faktorerPraHeleAar: [0.582, 1.159, 1.73, 2.296, 2.856, 3.409, 3.956, 4.494, 5.026, 5.548] },
    { alder: 56, faktorerPraHeleAar: [0.582, 1.158, 1.729, 2.293, 2.851, 3.402, 3.945, 4.481, 5.008] },
    { alder: 57, faktorerPraHeleAar: [0.582, 1.157, 1.727, 2.29, 2.846, 3.394, 3.935, 4.466] },
    { alder: 58, faktorerPraHeleAar: [0.581, 1.156, 1.725, 2.286, 2.84, 3.386, 3.923] },
    { alder: 59, faktorerPraHeleAar: [0.581, 1.156, 1.723, 2.282, 2.834, 3.376] },
    { alder: 60, faktorerPraHeleAar: [0.581, 1.155, 1.72, 2.278, 2.827] },
    { alder: 61, faktorerPraHeleAar: [0.581, 1.153, 1.718, 2.273] },
    { alder: 62, faktorerPraHeleAar: [0.58, 1.152, 1.715] },
    { alder: 63, faktorerPraHeleAar: [0.58, 1.151] },
    { alder: 64, faktorerPraHeleAar: [0.58] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabAfloesningsTabellerKoensopdelt = {} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;
