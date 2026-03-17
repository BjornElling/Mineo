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

export const kapitaliseringsId = '440/2009' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb fra 1. juli 2009 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. juli 2007 eller senere' as const;
export const kapitaliseringsDatering = '29/05/2009' as const;
export const gyldigFra = toISODateString('2009-07-01');
export const gyldigTil = toISODateString('2009-12-31');

// Udtrukket maskinelt fra Bkg. 440 2009.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadesdatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2007-07-01',     '1960-07-01',     null,     '67',     'A'],
  ['2007-07-01',     '1960-01-01',     '1960-06-30',     '66.5',     'B'],
  ['2007-07-01',     '1959-07-01',     '1959-12-31',     '66',     'C'],
  ['2007-07-01',     '1959-01-01',     '1959-06-30',     '65.5',     'D'],
  ['2007-07-01',     '1900-01-01',     '1958-12-31',     '65',     'E'],
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

export const erhvervsevnetabTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = 
{
  A: [
    { alder: 5, maendFaktor: 30.319, kvinderFaktor: 30.729 },
    { alder: 6, maendFaktor: 29.865, kvinderFaktor: 30.276 },
    { alder: 7, maendFaktor: 29.41, kvinderFaktor: 29.821 },
    { alder: 8, maendFaktor: 28.954, kvinderFaktor: 29.365 },
    { alder: 9, maendFaktor: 28.496, kvinderFaktor: 28.908 },
    { alder: 10, maendFaktor: 28.036, kvinderFaktor: 28.448 },
    { alder: 11, maendFaktor: 27.575, kvinderFaktor: 27.987 },
    { alder: 12, maendFaktor: 27.112, kvinderFaktor: 27.525 },
    { alder: 13, maendFaktor: 26.648, kvinderFaktor: 27.06 },
    { alder: 14, maendFaktor: 26.182, kvinderFaktor: 26.595 },
    { alder: 15, maendFaktor: 25.715, kvinderFaktor: 26.127 },
    { alder: 16, maendFaktor: 25.247, kvinderFaktor: 25.658 },
    { alder: 17, maendFaktor: 24.777, kvinderFaktor: 25.188 },
    { alder: 18, maendFaktor: 24.305, kvinderFaktor: 24.716 },
    { alder: 19, maendFaktor: 23.833, kvinderFaktor: 24.242 },
    { alder: 20, maendFaktor: 23.359, kvinderFaktor: 23.767 },
    { alder: 21, maendFaktor: 22.884, kvinderFaktor: 23.291 },
    { alder: 22, maendFaktor: 22.408, kvinderFaktor: 22.813 },
    { alder: 23, maendFaktor: 21.93, kvinderFaktor: 22.334 },
    { alder: 24, maendFaktor: 21.451, kvinderFaktor: 21.853 },
    { alder: 25, maendFaktor: 20.972, kvinderFaktor: 21.371 },
    { alder: 26, maendFaktor: 20.491, kvinderFaktor: 20.888 },
    { alder: 27, maendFaktor: 20.009, kvinderFaktor: 20.403 },
    { alder: 28, maendFaktor: 19.526, kvinderFaktor: 19.917 },
    { alder: 29, maendFaktor: 19.043, kvinderFaktor: 19.43 },
    { alder: 30, maendFaktor: 18.558, kvinderFaktor: 18.942 },
    { alder: 31, maendFaktor: 18.073, kvinderFaktor: 18.453 },
    { alder: 32, maendFaktor: 17.587, kvinderFaktor: 17.962 },
    { alder: 33, maendFaktor: 17.1, kvinderFaktor: 17.471 },
    { alder: 34, maendFaktor: 16.613, kvinderFaktor: 16.978 },
    { alder: 35, maendFaktor: 16.125, kvinderFaktor: 16.485 },
    { alder: 36, maendFaktor: 15.636, kvinderFaktor: 15.99 },
    { alder: 37, maendFaktor: 15.147, kvinderFaktor: 15.495 },
    { alder: 38, maendFaktor: 14.658, kvinderFaktor: 14.999 },
    { alder: 39, maendFaktor: 14.169, kvinderFaktor: 14.502 },
    { alder: 40, maendFaktor: 13.679, kvinderFaktor: 14.004 },
    { alder: 41, maendFaktor: 13.189, kvinderFaktor: 13.505 },
    { alder: 42, maendFaktor: 12.698, kvinderFaktor: 13.006 },
    { alder: 43, maendFaktor: 12.208, kvinderFaktor: 12.506 },
    { alder: 44, maendFaktor: 11.717, kvinderFaktor: 12.005 },
    { alder: 45, maendFaktor: 11.227, kvinderFaktor: 11.504 },
    { alder: 46, maendFaktor: 10.736, kvinderFaktor: 11.002 },
    { alder: 47, maendFaktor: 10.245, kvinderFaktor: 10.499 },
    { alder: 48, maendFaktor: 9.754, kvinderFaktor: 9.995 },
    { alder: 49, maendFaktor: 9.262, kvinderFaktor: 9.491 },
    { alder: 50, maendFaktor: 8.771, kvinderFaktor: 8.986 }
  ],
  B: [
    { alder: 49, maendFaktor: 9.047, kvinderFaktor: 9.261 },
    { alder: 50, maendFaktor: 8.553, kvinderFaktor: 8.754 }
  ],
  C: [
    { alder: 49, maendFaktor: 8.831, kvinderFaktor: 9.03 },
    { alder: 50, maendFaktor: 8.335, kvinderFaktor: 8.521 },
    { alder: 51, maendFaktor: 7.839, kvinderFaktor: 8.011 }
  ],
  D: [
    { alder: 50, maendFaktor: 8.111, kvinderFaktor: 8.284 },
    { alder: 51, maendFaktor: 7.613, kvinderFaktor: 7.772 }
  ],
  E: [
    { alder: 50, maendFaktor: 7.887, kvinderFaktor: 8.047 },
    { alder: 51, maendFaktor: 7.386, kvinderFaktor: 7.533 },
    { alder: 52, maendFaktor: 6.884, kvinderFaktor: 7.017 },
    { alder: 53, maendFaktor: 6.38, kvinderFaktor: 6.5 },
    { alder: 54, maendFaktor: 5.875, kvinderFaktor: 5.981 },
    { alder: 55, maendFaktor: 5.368, kvinderFaktor: 5.46 },
    { alder: 56, maendFaktor: 4.858, kvinderFaktor: 4.937 },
    { alder: 57, maendFaktor: 4.345, kvinderFaktor: 4.41 },
    { alder: 58, maendFaktor: 3.829, kvinderFaktor: 3.881 },
    { alder: 59, maendFaktor: 3.308, kvinderFaktor: 3.347 },
    { alder: 60, maendFaktor: 2.782, kvinderFaktor: 2.809 },
    { alder: 61, maendFaktor: 2.25, kvinderFaktor: 2.266 },
    { alder: 62, maendFaktor: 1.709, kvinderFaktor: 1.717 }
  ]
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = 
{
  F: [
    { alder: 18, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.869, 3.435, 3.998, 4.559, 5.117, 5.672] },
    { alder: 19, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.869, 3.435, 3.998, 4.558, 5.116, 5.671] },
    { alder: 20, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.868, 3.434, 3.997, 4.557, 5.115, 5.669] },
    { alder: 21, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.868, 3.434, 3.996, 4.556, 5.113, 5.668] },
    { alder: 22, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.868, 3.433, 3.996, 4.555, 5.112, 5.666] },
    { alder: 23, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.299, 2.867, 3.433, 3.995, 4.554, 5.111, 5.664] },
    { alder: 24, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.299, 2.867, 3.432, 3.994, 4.553, 5.109, 5.662] },
    { alder: 25, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.299, 2.866, 3.431, 3.993, 4.552, 5.107, 5.66] },
    { alder: 26, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.299, 2.866, 3.43, 3.992, 4.55, 5.106, 5.658] },
    { alder: 27, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.298, 2.865, 3.43, 3.991, 4.549, 5.104, 5.655] },
    { alder: 28, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.298, 2.865, 3.429, 3.989, 4.547, 5.101, 5.652] },
    { alder: 29, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.297, 2.864, 3.428, 3.988, 4.545, 5.099, 5.649] },
    { alder: 30, faktorerPraHeleAar: [0.579, 1.155, 1.727, 2.297, 2.863, 3.427, 3.987, 4.543, 5.096, 5.646] },
    { alder: 31, faktorerPraHeleAar: [0.579, 1.155, 1.727, 2.297, 2.863, 3.426, 3.985, 4.541, 5.094, 5.642] },
    { alder: 32, faktorerPraHeleAar: [0.579, 1.154, 1.727, 2.296, 2.862, 3.424, 3.983, 4.539, 5.09, 5.638] },
    { alder: 33, faktorerPraHeleAar: [0.579, 1.154, 1.727, 2.295, 2.861, 3.423, 3.981, 4.536, 5.087, 5.634] },
    { alder: 34, faktorerPraHeleAar: [0.579, 1.154, 1.726, 2.295, 2.86, 3.421, 3.979, 4.533, 5.083, 5.629] },
    { alder: 35, faktorerPraHeleAar: [0.579, 1.154, 1.726, 2.294, 2.859, 3.42, 3.977, 4.53, 5.079, 5.624] },
    { alder: 36, faktorerPraHeleAar: [0.579, 1.154, 1.725, 2.293, 2.858, 3.418, 3.974, 4.527, 5.075, 5.619] },
    { alder: 37, faktorerPraHeleAar: [0.579, 1.154, 1.725, 2.293, 2.856, 3.416, 3.972, 4.523, 5.07, 5.613] },
    { alder: 38, faktorerPraHeleAar: [0.579, 1.153, 1.724, 2.292, 2.855, 3.414, 3.969, 4.519, 5.065, 5.606] },
    { alder: 39, faktorerPraHeleAar: [0.578, 1.153, 1.724, 2.291, 2.853, 3.412, 3.965, 4.515, 5.059, 5.599] },
    { alder: 40, faktorerPraHeleAar: [0.578, 1.153, 1.723, 2.29, 2.852, 3.409, 3.962, 4.51, 5.053, 5.591] },
    { alder: 41, faktorerPraHeleAar: [0.578, 1.153, 1.723, 2.288, 2.85, 3.406, 3.958, 4.505, 5.046, 5.582] },
    { alder: 42, faktorerPraHeleAar: [0.578, 1.152, 1.722, 2.287, 2.848, 3.403, 3.954, 4.499, 5.039, 5.573] },
    { alder: 43, faktorerPraHeleAar: [0.578, 1.152, 1.721, 2.286, 2.845, 3.4, 3.949, 4.493, 5.031, 5.563] },
    { alder: 44, faktorerPraHeleAar: [0.578, 1.152, 1.72, 2.284, 2.843, 3.396, 3.944, 4.486, 5.022, 5.552] },
    { alder: 45, faktorerPraHeleAar: [0.578, 1.151, 1.72, 2.283, 2.84, 3.393, 3.939, 4.479, 5.013, 5.54] },
    { alder: 46, faktorerPraHeleAar: [0.578, 1.151, 1.719, 2.281, 2.838, 3.388, 3.933, 4.471, 5.003, 5.527] },
    { alder: 47, faktorerPraHeleAar: [0.578, 1.15, 1.718, 2.279, 2.834, 3.384, 3.927, 4.462, 4.991, 5.513] },
    { alder: 48, faktorerPraHeleAar: [0.578, 1.15, 1.716, 2.277, 2.831, 3.379, 3.919, 4.453, 4.979, 5.497] },
    { alder: 49, faktorerPraHeleAar: [0.578, 1.149, 1.715, 2.275, 2.827, 3.373, 3.912, 4.443, 4.966, 5.48] },
    { alder: 50, faktorerPraHeleAar: [0.577, 1.149, 1.714, 2.272, 2.823, 3.367, 3.904, 4.432, 4.951, 5.462] },
    { alder: 51, faktorerPraHeleAar: [0.577, 1.148, 1.712, 2.269, 2.819, 3.361, 3.894, 4.42, 4.936, 5.442] },
    { alder: 52, faktorerPraHeleAar: [0.577, 1.147, 1.711, 2.266, 2.814, 3.354, 3.885, 4.406, 4.919, 5.421] },
    { alder: 53, faktorerPraHeleAar: [0.577, 1.147, 1.709, 2.263, 2.809, 3.346, 3.874, 4.392, 4.9, 5.398] },
    { alder: 54, faktorerPraHeleAar: [0.577, 1.146, 1.707, 2.26, 2.803, 3.338, 3.862, 4.377, 4.88, 5.372] },
    { alder: 55, faktorerPraHeleAar: [0.577, 1.145, 1.705, 2.256, 2.797, 3.329, 3.85, 4.36, 4.858, 5.345] },
    { alder: 56, faktorerPraHeleAar: [0.576, 1.144, 1.703, 2.252, 2.79, 3.319, 3.836, 4.342, 4.835] },
    { alder: 57, faktorerPraHeleAar: [0.576, 1.143, 1.7, 2.247, 2.783, 3.308, 3.821, 4.322] },
    { alder: 58, faktorerPraHeleAar: [0.576, 1.142, 1.697, 2.242, 2.775, 3.296, 3.805] },
    { alder: 59, faktorerPraHeleAar: [0.576, 1.14, 1.694, 2.237, 2.767, 3.284] },
    { alder: 60, faktorerPraHeleAar: [0.575, 1.139, 1.691, 2.231, 2.757] },
    { alder: 61, faktorerPraHeleAar: [0.575, 1.138, 1.688, 2.224] },
    { alder: 62, faktorerPraHeleAar: [0.574, 1.136, 1.684] },
    { alder: 63, faktorerPraHeleAar: [0.574, 1.134] },
    { alder: 64, faktorerPraHeleAar: [0.574] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = 
{
  G: [
    { alder: 18, faktorerPraHeleAar: [0.579, 1.156, 1.73, 2.301, 2.87, 3.436, 4, 4.561, 5.12, 5.676] },
    { alder: 19, faktorerPraHeleAar: [0.579, 1.156, 1.729, 2.301, 2.87, 3.436, 4, 4.561, 5.119, 5.675] },
    { alder: 20, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.301, 2.869, 3.436, 3.999, 4.56, 5.118, 5.674] },
    { alder: 21, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.301, 2.869, 3.435, 3.999, 4.559, 5.118, 5.673] },
    { alder: 22, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.869, 3.435, 3.998, 4.559, 5.117, 5.672] },
    { alder: 23, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.869, 3.435, 3.998, 4.558, 5.116, 5.671] },
    { alder: 24, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.868, 3.434, 3.997, 4.557, 5.115, 5.669] },
    { alder: 25, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.868, 3.434, 3.996, 4.556, 5.113, 5.668] },
    { alder: 26, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.3, 2.868, 3.433, 3.996, 4.555, 5.112, 5.666] },
    { alder: 27, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.299, 2.867, 3.433, 3.995, 4.554, 5.111, 5.664] },
    { alder: 28, faktorerPraHeleAar: [0.579, 1.155, 1.729, 2.299, 2.867, 3.432, 3.994, 4.553, 5.109, 5.662] },
    { alder: 29, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.299, 2.866, 3.431, 3.993, 4.552, 5.107, 5.66] },
    { alder: 30, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.299, 2.866, 3.43, 3.992, 4.55, 5.106, 5.658] },
    { alder: 31, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.298, 2.865, 3.43, 3.991, 4.549, 5.104, 5.655] },
    { alder: 32, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.298, 2.865, 3.429, 3.989, 4.547, 5.101, 5.652] },
    { alder: 33, faktorerPraHeleAar: [0.579, 1.155, 1.728, 2.297, 2.864, 3.428, 3.988, 4.545, 5.099, 5.649] },
    { alder: 34, faktorerPraHeleAar: [0.579, 1.155, 1.727, 2.297, 2.863, 3.427, 3.987, 4.543, 5.096, 5.646] },
    { alder: 35, faktorerPraHeleAar: [0.579, 1.155, 1.727, 2.297, 2.863, 3.426, 3.985, 4.541, 5.094, 5.642] },
    { alder: 36, faktorerPraHeleAar: [0.579, 1.154, 1.727, 2.296, 2.862, 3.424, 3.983, 4.539, 5.09, 5.638] },
    { alder: 37, faktorerPraHeleAar: [0.579, 1.154, 1.727, 2.295, 2.861, 3.423, 3.981, 4.536, 5.087, 5.634] },
    { alder: 38, faktorerPraHeleAar: [0.579, 1.154, 1.726, 2.295, 2.86, 3.421, 3.979, 4.533, 5.083, 5.629] },
    { alder: 39, faktorerPraHeleAar: [0.579, 1.154, 1.726, 2.294, 2.859, 3.42, 3.977, 4.53, 5.079, 5.624] },
    { alder: 40, faktorerPraHeleAar: [0.579, 1.154, 1.725, 2.293, 2.858, 3.418, 3.974, 4.527, 5.075, 5.619] },
    { alder: 41, faktorerPraHeleAar: [0.579, 1.154, 1.725, 2.293, 2.856, 3.416, 3.972, 4.523, 5.07, 5.613] },
    { alder: 42, faktorerPraHeleAar: [0.579, 1.153, 1.724, 2.292, 2.855, 3.414, 3.969, 4.519, 5.065, 5.606] },
    { alder: 43, faktorerPraHeleAar: [0.578, 1.153, 1.724, 2.291, 2.853, 3.412, 3.965, 4.515, 5.059, 5.599] },
    { alder: 44, faktorerPraHeleAar: [0.578, 1.153, 1.723, 2.29, 2.852, 3.409, 3.962, 4.51, 5.053, 5.591] },
    { alder: 45, faktorerPraHeleAar: [0.578, 1.153, 1.723, 2.288, 2.85, 3.406, 3.958, 4.505, 5.046, 5.582] },
    { alder: 46, faktorerPraHeleAar: [0.578, 1.152, 1.722, 2.287, 2.848, 3.403, 3.954, 4.499, 5.039, 5.573] },
    { alder: 47, faktorerPraHeleAar: [0.578, 1.152, 1.721, 2.286, 2.845, 3.4, 3.949, 4.493, 5.031, 5.563] },
    { alder: 48, faktorerPraHeleAar: [0.578, 1.152, 1.72, 2.284, 2.843, 3.396, 3.944, 4.486, 5.022, 5.552] },
    { alder: 49, faktorerPraHeleAar: [0.578, 1.151, 1.72, 2.283, 2.84, 3.393, 3.939, 4.479, 5.013, 5.54] },
    { alder: 50, faktorerPraHeleAar: [0.578, 1.151, 1.719, 2.281, 2.838, 3.388, 3.933, 4.471, 5.003, 5.527] },
    { alder: 51, faktorerPraHeleAar: [0.578, 1.15, 1.718, 2.279, 2.834, 3.384, 3.927, 4.462, 4.991, 5.513] },
    { alder: 52, faktorerPraHeleAar: [0.578, 1.15, 1.716, 2.277, 2.831, 3.379, 3.919, 4.453, 4.979, 5.497] },
    { alder: 53, faktorerPraHeleAar: [0.578, 1.149, 1.715, 2.275, 2.827, 3.373, 3.912, 4.443, 4.966, 5.48] },
    { alder: 54, faktorerPraHeleAar: [0.577, 1.149, 1.714, 2.272, 2.823, 3.367, 3.904, 4.432, 4.951, 5.462] },
    { alder: 55, faktorerPraHeleAar: [0.577, 1.148, 1.712, 2.269, 2.819, 3.361, 3.894, 4.42, 4.936, 5.442] },
    { alder: 56, faktorerPraHeleAar: [0.577, 1.147, 1.711, 2.266, 2.814, 3.354, 3.885, 4.406, 4.919] },
    { alder: 57, faktorerPraHeleAar: [0.577, 1.147, 1.709, 2.263, 2.809, 3.346, 3.874, 4.392] },
    { alder: 58, faktorerPraHeleAar: [0.577, 1.146, 1.707, 2.26, 2.803, 3.338, 3.862] },
    { alder: 59, faktorerPraHeleAar: [0.577, 1.145, 1.705, 2.256, 2.797, 3.329] },
    { alder: 60, faktorerPraHeleAar: [0.576, 1.144, 1.703, 2.252, 2.79] },
    { alder: 61, faktorerPraHeleAar: [0.576, 1.143, 1.7, 2.247] },
    { alder: 62, faktorerPraHeleAar: [0.576, 1.142, 1.697] },
    { alder: 63, faktorerPraHeleAar: [0.576, 1.14] },
    { alder: 64, faktorerPraHeleAar: [0.575] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabAfloesningsTabellerKoensopdelt = {} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;
