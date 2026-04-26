import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '990/2012' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2013 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. januar 2011 eller senere' as const;
export const kapitaliseringsDatering = '12/10/2012' as const;
export const gyldigFra = toISODateString('2013-01-01');
export const gyldigTil = toISODateString('2013-12-31');

// Udtrukket fra BEK nr 990 af 12/10/2012.
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
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
  A: [
    { alder: 5, maendFaktor: 31.497, kvinderFaktor: 31.91 },
    { alder: 6, maendFaktor: 31.045, kvinderFaktor: 31.459 },
    { alder: 7, maendFaktor: 30.591, kvinderFaktor: 31.007 },
    { alder: 8, maendFaktor: 30.135, kvinderFaktor: 30.551 },
    { alder: 9, maendFaktor: 29.676, kvinderFaktor: 30.094 },
    { alder: 10, maendFaktor: 29.216, kvinderFaktor: 29.634 },
    { alder: 11, maendFaktor: 28.753, kvinderFaktor: 29.172 },
    { alder: 12, maendFaktor: 28.288, kvinderFaktor: 28.708 },
    { alder: 13, maendFaktor: 27.821, kvinderFaktor: 28.242 },
    { alder: 14, maendFaktor: 27.352, kvinderFaktor: 27.773 },
    { alder: 15, maendFaktor: 26.881, kvinderFaktor: 27.302 },
    { alder: 16, maendFaktor: 26.408, kvinderFaktor: 26.829 },
    { alder: 17, maendFaktor: 25.933, kvinderFaktor: 26.354 },
    { alder: 18, maendFaktor: 25.456, kvinderFaktor: 25.876 },
    { alder: 19, maendFaktor: 24.976, kvinderFaktor: 25.397 },
    { alder: 20, maendFaktor: 24.495, kvinderFaktor: 24.915 },
    { alder: 21, maendFaktor: 24.012, kvinderFaktor: 24.431 },
    { alder: 22, maendFaktor: 23.527, kvinderFaktor: 23.945 },
    { alder: 23, maendFaktor: 23.04, kvinderFaktor: 23.457 },
    { alder: 24, maendFaktor: 22.552, kvinderFaktor: 22.966 },
    { alder: 25, maendFaktor: 22.061, kvinderFaktor: 22.474 },
    { alder: 26, maendFaktor: 21.569, kvinderFaktor: 21.98 },
    { alder: 27, maendFaktor: 21.075, kvinderFaktor: 21.484 },
    { alder: 28, maendFaktor: 20.58, kvinderFaktor: 20.986 },
    { alder: 29, maendFaktor: 20.083, kvinderFaktor: 20.486 },
    { alder: 30, maendFaktor: 19.584, kvinderFaktor: 19.984 },
    { alder: 31, maendFaktor: 19.084, kvinderFaktor: 19.48 },
    { alder: 32, maendFaktor: 18.583, kvinderFaktor: 18.974 },
    { alder: 33, maendFaktor: 18.08, kvinderFaktor: 18.467 },
    { alder: 34, maendFaktor: 17.576, kvinderFaktor: 17.958 },
    { alder: 35, maendFaktor: 17.071, kvinderFaktor: 17.447 },
    { alder: 36, maendFaktor: 16.564, kvinderFaktor: 16.935 },
    { alder: 37, maendFaktor: 16.056, kvinderFaktor: 16.421 },
    { alder: 38, maendFaktor: 15.548, kvinderFaktor: 15.905 },
    { alder: 39, maendFaktor: 15.038, kvinderFaktor: 15.388 },
    { alder: 40, maendFaktor: 14.527, kvinderFaktor: 14.869 },
    { alder: 41, maendFaktor: 14.016, kvinderFaktor: 14.349 },
    { alder: 42, maendFaktor: 13.503, kvinderFaktor: 13.828 },
    { alder: 43, maendFaktor: 12.99, kvinderFaktor: 13.305 },
    { alder: 44, maendFaktor: 12.476, kvinderFaktor: 12.78 },
    { alder: 45, maendFaktor: 11.961, kvinderFaktor: 12.255 },
    { alder: 46, maendFaktor: 11.446, kvinderFaktor: 11.728 },
    { alder: 47, maendFaktor: 10.93, kvinderFaktor: 11.199 },
    { alder: 48, maendFaktor: 10.412, kvinderFaktor: 10.669 },
    { alder: 49, maendFaktor: 9.894, kvinderFaktor: 10.137 },
    { alder: 50, maendFaktor: 9.375, kvinderFaktor: 9.604 },
    { alder: 51, maendFaktor: 8.855, kvinderFaktor: 9.07 },
    { alder: 52, maendFaktor: 8.334, kvinderFaktor: 8.533 },
    { alder: 53, maendFaktor: 7.812, kvinderFaktor: 7.995 },
    { alder: 54, maendFaktor: 7.287, kvinderFaktor: 7.454 },
    { alder: 55, maendFaktor: 6.761, kvinderFaktor: 6.912 },
    { alder: 56, maendFaktor: 6.233, kvinderFaktor: 6.366 },
    { alder: 57, maendFaktor: 5.701, kvinderFaktor: 5.818 },
    { alder: 58, maendFaktor: 5.167, kvinderFaktor: 5.266 },
    { alder: 59, maendFaktor: 4.628, kvinderFaktor: 4.711 },
  ],
  B: [
    { alder: 57, maendFaktor: 5.448, kvinderFaktor: 5.552 },
    { alder: 58, maendFaktor: 4.909, kvinderFaktor: 4.997 },
    { alder: 59, maendFaktor: 4.366, kvinderFaktor: 4.437 },
  ],
  C: [
    { alder: 58, maendFaktor: 4.651, kvinderFaktor: 4.727 },
    { alder: 59, maendFaktor: 4.103, kvinderFaktor: 4.164 },
    { alder: 60, maendFaktor: 3.549, kvinderFaktor: 3.596 },
  ],
  D: [
    { alder: 58, maendFaktor: 4.386, kvinderFaktor: 4.452 },
    { alder: 59, maendFaktor: 3.833, kvinderFaktor: 3.884 },
    { alder: 60, maendFaktor: 3.274, kvinderFaktor: 3.312 },
  ],
  E: [
    { alder: 59, maendFaktor: 3.562, kvinderFaktor: 3.605 },
    { alder: 60, maendFaktor: 2.998, kvinderFaktor: 3.028 },
    { alder: 61, maendFaktor: 2.426, kvinderFaktor: 2.444 },
    { alder: 62, maendFaktor: 1.846, kvinderFaktor: 1.854 },
  ],
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
  F: [
    { alder: 18, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.09, 3.697, 4.301, 4.9, 5.496, 6.088] },
    { alder: 19, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.09, 3.697, 4.3, 4.9, 5.495, 6.087] },
    { alder: 20, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.09, 3.696, 4.299, 4.899, 5.494, 6.086] },
    { alder: 21, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.696, 4.299, 4.898, 5.493, 6.084] },
    { alder: 22, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.298, 4.897, 5.491, 6.082] },
    { alder: 23, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.297, 4.895, 5.49, 6.08] },
    { alder: 24, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.088, 3.694, 4.296, 4.894, 5.488, 6.078] },
    { alder: 25, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.088, 3.693, 4.295, 4.893, 5.486, 6.076] },
    { alder: 26, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.087, 3.693, 4.294, 4.891, 5.484, 6.073] },
    { alder: 27, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.477, 3.087, 3.692, 4.293, 4.89, 5.482, 6.071] },
    { alder: 28, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.477, 3.086, 3.691, 4.291, 4.888, 5.48, 6.068] },
    { alder: 29, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.476, 3.085, 3.69, 4.29, 4.886, 5.477, 6.064] },
    { alder: 30, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.476, 3.084, 3.689, 4.288, 4.884, 5.475, 6.061] },
    { alder: 31, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.084, 3.687, 4.287, 4.881, 5.471, 6.057] },
    { alder: 32, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.083, 3.686, 4.285, 4.879, 5.468, 6.053] },
    { alder: 33, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.474, 3.082, 3.684, 4.283, 4.876, 5.465, 6.048] },
    { alder: 34, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.474, 3.081, 3.683, 4.28, 4.873, 5.461, 6.043] },
    { alder: 35, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.473, 3.079, 3.681, 4.278, 4.87, 5.456, 6.038] },
    { alder: 36, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.472, 3.078, 3.679, 4.275, 4.866, 5.452, 6.032] },
    { alder: 37, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.471, 3.077, 3.677, 4.272, 4.862, 5.446, 6.025] },
    { alder: 38, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.47, 3.075, 3.675, 4.269, 4.858, 5.441, 6.018] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.469, 3.073, 3.672, 4.266, 4.853, 5.435, 6.01] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.244, 1.859, 2.468, 3.072, 3.67, 4.262, 4.848, 5.428, 6.002] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.244, 1.858, 2.467, 3.07, 3.667, 4.258, 4.842, 5.421, 5.993] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.244, 1.857, 2.465, 3.067, 3.663, 4.253, 4.836, 5.413, 5.983] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.244, 1.857, 2.464, 3.065, 3.66, 4.248, 4.83, 5.404, 5.972] },
    { alder: 44, faktorerPraHeleAar: [0.624, 1.243, 1.856, 2.462, 3.062, 3.656, 4.243, 4.823, 5.395, 5.96] },
    { alder: 45, faktorerPraHeleAar: [0.624, 1.243, 1.855, 2.461, 3.06, 3.652, 4.237, 4.815, 5.385, 5.947] },
    { alder: 46, faktorerPraHeleAar: [0.624, 1.242, 1.854, 2.459, 3.057, 3.647, 4.231, 4.806, 5.374, 5.933] },
    { alder: 47, faktorerPraHeleAar: [0.624, 1.242, 1.853, 2.457, 3.053, 3.642, 4.224, 4.797, 5.362, 5.918] },
    { alder: 48, faktorerPraHeleAar: [0.624, 1.241, 1.851, 2.454, 3.05, 3.637, 4.216, 4.787, 5.349, 5.902] },
    { alder: 49, faktorerPraHeleAar: [0.624, 1.241, 1.85, 2.452, 3.046, 3.631, 4.208, 4.776, 5.335, 5.884] },
    { alder: 50, faktorerPraHeleAar: [0.624, 1.24, 1.849, 2.449, 3.041, 3.625, 4.199, 4.764, 5.319, 5.864] },
    { alder: 51, faktorerPraHeleAar: [0.624, 1.239, 1.847, 2.446, 3.037, 3.618, 4.189, 4.751, 5.302, 5.843] },
    { alder: 52, faktorerPraHeleAar: [0.623, 1.239, 1.845, 2.443, 3.031, 3.61, 4.179, 4.737, 5.284, 5.82] },
    { alder: 53, faktorerPraHeleAar: [0.623, 1.238, 1.843, 2.439, 3.026, 3.602, 4.167, 4.722, 5.264, 5.795] },
    { alder: 54, faktorerPraHeleAar: [0.623, 1.237, 1.841, 2.436, 3.02, 3.593, 4.155, 4.705, 5.243, 5.768] },
    { alder: 55, faktorerPraHeleAar: [0.623, 1.236, 1.839, 2.431, 3.013, 3.583, 4.141, 4.687, 5.22, 5.738] },
    { alder: 56, faktorerPraHeleAar: [0.623, 1.235, 1.836, 2.427, 3.006, 3.573, 4.127, 4.667, 5.194, 5.707] },
    { alder: 57, faktorerPraHeleAar: [0.622, 1.234, 1.834, 2.422, 2.998, 3.561, 4.111, 4.646, 5.167, 5.672] },
    { alder: 58, faktorerPraHeleAar: [0.622, 1.232, 1.831, 2.417, 2.989, 3.548, 4.093, 4.623, 5.137] },
    { alder: 59, faktorerPraHeleAar: [0.622, 1.231, 1.828, 2.411, 2.98, 3.535, 4.074] },
    { alder: 60, faktorerPraHeleAar: [0.621, 1.23, 1.824, 2.405, 2.97] },
    { alder: 61, faktorerPraHeleAar: [0.621, 1.228, 1.82, 2.398] },
    { alder: 62, faktorerPraHeleAar: [0.62, 1.226, 1.816] },
    { alder: 63, faktorerPraHeleAar: [0.62, 1.224] },
    { alder: 64, faktorerPraHeleAar: [0.62] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
  G: [
    { alder: 18, faktorerPraHeleAar: [0.625, 1.247, 1.866, 2.48, 3.091, 3.699, 4.303, 4.903, 5.5, 6.093] },
    { alder: 19, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.091, 3.699, 4.302, 4.902, 5.499, 6.092] },
    { alder: 20, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.091, 3.698, 4.302, 4.902, 5.498, 6.091] },
    { alder: 21, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.091, 3.698, 4.301, 4.901, 5.497, 6.09] },
    { alder: 22, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.48, 3.09, 3.697, 4.301, 4.9, 5.496, 6.088] },
    { alder: 23, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.09, 3.697, 4.3, 4.9, 5.495, 6.087] },
    { alder: 24, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.09, 3.696, 4.299, 4.899, 5.494, 6.086] },
    { alder: 25, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.696, 4.299, 4.898, 5.493, 6.084] },
    { alder: 26, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.298, 4.897, 5.491, 6.082] },
    { alder: 27, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.297, 4.895, 5.49, 6.08] },
    { alder: 28, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.088, 3.694, 4.296, 4.894, 5.488, 6.078] },
    { alder: 29, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.088, 3.693, 4.295, 4.893, 5.486, 6.076] },
    { alder: 30, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.087, 3.693, 4.294, 4.891, 5.484, 6.073] },
    { alder: 31, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.477, 3.087, 3.692, 4.293, 4.89, 5.482, 6.071] },
    { alder: 32, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.477, 3.086, 3.691, 4.291, 4.888, 5.48, 6.068] },
    { alder: 33, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.476, 3.085, 3.69, 4.29, 4.886, 5.477, 6.064] },
    { alder: 34, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.476, 3.084, 3.689, 4.288, 4.884, 5.475, 6.061] },
    { alder: 35, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.084, 3.687, 4.287, 4.881, 5.471, 6.057] },
    { alder: 36, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.083, 3.686, 4.285, 4.879, 5.468, 6.053] },
    { alder: 37, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.474, 3.082, 3.684, 4.283, 4.876, 5.465, 6.048] },
    { alder: 38, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.474, 3.081, 3.683, 4.28, 4.873, 5.461, 6.043] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.473, 3.079, 3.681, 4.278, 4.87, 5.456, 6.038] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.472, 3.078, 3.679, 4.275, 4.866, 5.452, 6.032] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.471, 3.077, 3.677, 4.272, 4.862, 5.446, 6.025] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.47, 3.075, 3.675, 4.269, 4.858, 5.441, 6.018] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.469, 3.073, 3.672, 4.266, 4.853, 5.435, 6.01] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.244, 1.859, 2.468, 3.072, 3.67, 4.262, 4.848, 5.428, 6.002] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.244, 1.858, 2.467, 3.07, 3.667, 4.258, 4.842, 5.421, 5.993] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.244, 1.857, 2.465, 3.067, 3.663, 4.253, 4.836, 5.413, 5.983] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.244, 1.857, 2.464, 3.065, 3.66, 4.248, 4.83, 5.404, 5.972] },
    { alder: 48, faktorerPraHeleAar: [0.624, 1.243, 1.856, 2.462, 3.062, 3.656, 4.243, 4.823, 5.395, 5.96] },
    { alder: 49, faktorerPraHeleAar: [0.624, 1.243, 1.855, 2.461, 3.06, 3.652, 4.237, 4.815, 5.385, 5.947] },
    { alder: 50, faktorerPraHeleAar: [0.624, 1.242, 1.854, 2.459, 3.057, 3.647, 4.231, 4.806, 5.374, 5.933] },
    { alder: 51, faktorerPraHeleAar: [0.624, 1.242, 1.853, 2.457, 3.053, 3.642, 4.224, 4.797, 5.362, 5.918] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.241, 1.851, 2.454, 3.05, 3.637, 4.216, 4.787, 5.349, 5.902] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.241, 1.85, 2.452, 3.046, 3.631, 4.208, 4.776, 5.335, 5.884] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.24, 1.849, 2.449, 3.041, 3.625, 4.199, 4.764, 5.319, 5.864] },
    { alder: 55, faktorerPraHeleAar: [0.624, 1.239, 1.847, 2.446, 3.037, 3.618, 4.189, 4.751, 5.302, 5.843] },
    { alder: 56, faktorerPraHeleAar: [0.623, 1.239, 1.845, 2.443, 3.031, 3.61, 4.179, 4.737, 5.284, 5.82] },
    { alder: 57, faktorerPraHeleAar: [0.623, 1.238, 1.843, 2.439, 3.026, 3.602, 4.167, 4.722, 5.264, 5.795] },
    { alder: 58, faktorerPraHeleAar: [0.623, 1.237, 1.841, 2.436, 3.02, 3.593, 4.155, 4.705, 5.243] },
    { alder: 59, faktorerPraHeleAar: [0.623, 1.236, 1.839, 2.431, 3.013, 3.583, 4.141] },
    { alder: 60, faktorerPraHeleAar: [0.623, 1.235, 1.836, 2.427, 3.006] },
    { alder: 61, faktorerPraHeleAar: [0.622, 1.234, 1.834, 2.422] },
    { alder: 62, faktorerPraHeleAar: [0.622, 1.232, 1.831] },
    { alder: 63, faktorerPraHeleAar: [0.622, 1.231] },
    { alder: 64, faktorerPraHeleAar: [0.621] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
