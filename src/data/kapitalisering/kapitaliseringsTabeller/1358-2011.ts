import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '1358/2011' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2012 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. januar 2011 eller senere' as const;
export const kapitaliseringsDatering = '22/12/2011' as const;
export const gyldigFra = toISODateString('2012-01-01');
export const gyldigTil = toISODateString('2012-12-31');

// Udtrukket fra BEK nr 1358 af 22/12/2011.
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
    { alder: 5, maendFaktor: 34.012, kvinderFaktor: 34.485 },
    { alder: 6, maendFaktor: 33.483, kvinderFaktor: 33.956 },
    { alder: 7, maendFaktor: 32.954, kvinderFaktor: 33.427 },
    { alder: 8, maendFaktor: 32.423, kvinderFaktor: 32.896 },
    { alder: 9, maendFaktor: 31.891, kvinderFaktor: 32.364 },
    { alder: 10, maendFaktor: 31.358, kvinderFaktor: 31.83 },
    { alder: 11, maendFaktor: 30.823, kvinderFaktor: 31.296 },
    { alder: 12, maendFaktor: 30.288, kvinderFaktor: 30.76 },
    { alder: 13, maendFaktor: 29.752, kvinderFaktor: 30.223 },
    { alder: 14, maendFaktor: 29.215, kvinderFaktor: 29.685 },
    { alder: 15, maendFaktor: 28.676, kvinderFaktor: 29.146 },
    { alder: 16, maendFaktor: 28.137, kvinderFaktor: 28.605 },
    { alder: 17, maendFaktor: 27.597, kvinderFaktor: 28.064 },
    { alder: 18, maendFaktor: 27.056, kvinderFaktor: 27.522 },
    { alder: 19, maendFaktor: 26.514, kvinderFaktor: 26.978 },
    { alder: 20, maendFaktor: 25.971, kvinderFaktor: 26.434 },
    { alder: 21, maendFaktor: 25.428, kvinderFaktor: 25.888 },
    { alder: 22, maendFaktor: 24.883, kvinderFaktor: 25.342 },
    { alder: 23, maendFaktor: 24.339, kvinderFaktor: 24.794 },
    { alder: 24, maendFaktor: 23.793, kvinderFaktor: 24.246 },
    { alder: 25, maendFaktor: 23.247, kvinderFaktor: 23.697 },
    { alder: 26, maendFaktor: 22.7, kvinderFaktor: 23.147 },
    { alder: 27, maendFaktor: 22.153, kvinderFaktor: 22.596 },
    { alder: 28, maendFaktor: 21.606, kvinderFaktor: 22.045 },
    { alder: 29, maendFaktor: 21.058, kvinderFaktor: 21.493 },
    { alder: 30, maendFaktor: 20.51, kvinderFaktor: 20.94 },
    { alder: 31, maendFaktor: 19.962, kvinderFaktor: 20.387 },
    { alder: 32, maendFaktor: 19.413, kvinderFaktor: 19.833 },
    { alder: 33, maendFaktor: 18.864, kvinderFaktor: 19.278 },
    { alder: 34, maendFaktor: 18.316, kvinderFaktor: 18.723 },
    { alder: 35, maendFaktor: 17.767, kvinderFaktor: 18.168 },
    { alder: 36, maendFaktor: 17.219, kvinderFaktor: 17.612 },
    { alder: 37, maendFaktor: 16.67, kvinderFaktor: 17.056 },
    { alder: 38, maendFaktor: 16.122, kvinderFaktor: 16.5 },
    { alder: 39, maendFaktor: 15.574, kvinderFaktor: 15.944 },
    { alder: 40, maendFaktor: 15.027, kvinderFaktor: 15.387 },
    { alder: 41, maendFaktor: 14.479, kvinderFaktor: 14.83 },
    { alder: 42, maendFaktor: 13.933, kvinderFaktor: 14.273 },
    { alder: 43, maendFaktor: 13.387, kvinderFaktor: 13.716 },
    { alder: 44, maendFaktor: 12.841, kvinderFaktor: 13.158 },
    { alder: 45, maendFaktor: 12.296, kvinderFaktor: 12.601 },
    { alder: 46, maendFaktor: 11.751, kvinderFaktor: 12.044 },
    { alder: 47, maendFaktor: 11.207, kvinderFaktor: 11.486 },
    { alder: 48, maendFaktor: 10.663, kvinderFaktor: 10.929 },
    { alder: 49, maendFaktor: 10.12, kvinderFaktor: 10.371 },
    { alder: 50, maendFaktor: 9.577, kvinderFaktor: 9.813 },
    { alder: 51, maendFaktor: 9.034, kvinderFaktor: 9.255 },
    { alder: 52, maendFaktor: 8.492, kvinderFaktor: 8.696 },
    { alder: 53, maendFaktor: 7.949, kvinderFaktor: 8.137 },
    { alder: 54, maendFaktor: 7.406, kvinderFaktor: 7.577 },
    { alder: 55, maendFaktor: 6.863, kvinderFaktor: 7.016 },
    { alder: 56, maendFaktor: 6.318, kvinderFaktor: 6.454 },
    { alder: 57, maendFaktor: 5.772, kvinderFaktor: 5.89 },
    { alder: 58, maendFaktor: 5.224, kvinderFaktor: 5.325 },
  ],
  B: [
    { alder: 56, maendFaktor: 6.061, kvinderFaktor: 6.184 },
    { alder: 57, maendFaktor: 5.512, kvinderFaktor: 5.618 },
    { alder: 58, maendFaktor: 4.96, kvinderFaktor: 5.049 },
  ],
  C: [
    { alder: 57, maendFaktor: 5.252, kvinderFaktor: 5.345 },
    { alder: 58, maendFaktor: 4.696, kvinderFaktor: 4.773 },
    { alder: 59, maendFaktor: 4.137, kvinderFaktor: 4.199 },
  ],
  D: [
    { alder: 57, maendFaktor: 4.985, kvinderFaktor: 5.067 },
    { alder: 58, maendFaktor: 4.425, kvinderFaktor: 4.492 },
    { alder: 59, maendFaktor: 3.862, kvinderFaktor: 3.914 },
  ],
  E: [
    { alder: 58, maendFaktor: 4.154, kvinderFaktor: 4.211 },
    { alder: 59, maendFaktor: 3.587, kvinderFaktor: 3.63 },
    { alder: 60, maendFaktor: 3.014, kvinderFaktor: 3.044 },
    { alder: 61, maendFaktor: 2.436, kvinderFaktor: 2.454 },
    { alder: 62, maendFaktor: 1.849, kvinderFaktor: 1.857 },
  ],
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
  F: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.11, 3.726, 4.34, 4.952, 5.561, 6.169] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.11, 3.726, 4.339, 4.951, 5.56, 6.167] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.11, 3.725, 4.339, 4.95, 5.559, 6.166] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.109, 3.725, 4.338, 4.949, 5.558, 6.164] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.491, 3.109, 3.724, 4.337, 4.948, 5.556, 6.162] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.491, 3.109, 3.724, 4.336, 4.947, 5.555, 6.16] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.491, 3.108, 3.723, 4.335, 4.945, 5.553, 6.158] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.491, 3.108, 3.722, 4.334, 4.944, 5.551, 6.156] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.49, 3.107, 3.721, 4.333, 4.942, 5.549, 6.153] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.49, 3.106, 3.72, 4.332, 4.941, 5.547, 6.15] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.489, 3.106, 3.719, 4.331, 4.939, 5.545, 6.147] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.718, 4.329, 4.937, 5.542, 6.144] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.104, 3.717, 4.327, 4.935, 5.539, 6.14] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.103, 3.716, 4.326, 4.932, 5.536, 6.136] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.487, 3.103, 3.715, 4.324, 4.93, 5.533, 6.132] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.101, 3.713, 4.322, 4.927, 5.529, 6.127] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.486, 3.1, 3.712, 4.319, 4.924, 5.525, 6.122] },
    { alder: 35, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.485, 3.099, 3.71, 4.317, 4.921, 5.521, 6.117] },
    { alder: 36, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.485, 3.098, 3.708, 4.314, 4.917, 5.516, 6.111] },
    { alder: 37, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.484, 3.096, 3.706, 4.311, 4.913, 5.511, 6.104] },
    { alder: 38, faktorerPraHeleAar: [0.626, 1.248, 1.867, 2.483, 3.095, 3.703, 4.308, 4.909, 5.505, 6.097] },
    { alder: 39, faktorerPraHeleAar: [0.626, 1.248, 1.867, 2.482, 3.093, 3.701, 4.304, 4.904, 5.499, 6.089] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.247, 1.866, 2.481, 3.091, 3.698, 4.301, 4.899, 5.492, 6.08] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.296, 4.893, 5.485, 6.071] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.087, 3.692, 4.292, 4.887, 5.477, 6.061] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.476, 3.085, 3.688, 4.287, 4.88, 5.468, 6.05] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.082, 3.684, 4.281, 4.873, 5.458, 6.038] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.473, 3.079, 3.68, 4.276, 4.865, 5.448, 6.025] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.471, 3.076, 3.676, 4.269, 4.856, 5.437, 6.011] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.469, 3.073, 3.671, 4.262, 4.847, 5.425, 5.995] },
    { alder: 48, faktorerPraHeleAar: [0.625, 1.244, 1.858, 2.467, 3.069, 3.665, 4.254, 4.837, 5.411, 5.978] },
    { alder: 49, faktorerPraHeleAar: [0.625, 1.244, 1.857, 2.464, 3.065, 3.659, 4.246, 4.826, 5.397, 5.96] },
    { alder: 50, faktorerPraHeleAar: [0.624, 1.243, 1.856, 2.462, 3.061, 3.653, 4.237, 4.813, 5.381, 5.94] },
    { alder: 51, faktorerPraHeleAar: [0.624, 1.242, 1.854, 2.459, 3.056, 3.646, 4.227, 4.8, 5.364, 5.918] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.242, 1.852, 2.455, 3.051, 3.638, 4.217, 4.786, 5.346, 5.895] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.241, 1.85, 2.452, 3.045, 3.63, 4.205, 4.77, 5.325, 5.87] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.24, 1.848, 2.448, 3.039, 3.621, 4.192, 4.753, 5.304, 5.842] },
    { alder: 55, faktorerPraHeleAar: [0.623, 1.239, 1.846, 2.444, 3.032, 3.611, 4.179, 4.735, 5.28, 5.812] },
    { alder: 56, faktorerPraHeleAar: [0.623, 1.238, 1.843, 2.439, 3.025, 3.6, 4.164, 4.715, 5.254, 5.78] },
    { alder: 57, faktorerPraHeleAar: [0.623, 1.237, 1.841, 2.434, 3.017, 3.588, 4.147, 4.694, 5.226, 5.745] },
    { alder: 58, faktorerPraHeleAar: [0.623, 1.235, 1.838, 2.429, 3.008, 3.576, 4.13, 4.67] },
    { alder: 59, faktorerPraHeleAar: [0.622, 1.234, 1.834, 2.423, 2.999, 3.562] },
    { alder: 60, faktorerPraHeleAar: [0.622, 1.232, 1.831, 2.417, 2.989] },
    { alder: 61, faktorerPraHeleAar: [0.622, 1.231, 1.827, 2.41] },
    { alder: 62, faktorerPraHeleAar: [0.621, 1.229, 1.823] },
    { alder: 63, faktorerPraHeleAar: [0.621, 1.227] },
    { alder: 64, faktorerPraHeleAar: [0.62] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
  G: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.25, 1.873, 2.493, 3.111, 3.728, 4.342, 4.954, 5.565, 6.173] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.25, 1.873, 2.493, 3.111, 3.727, 4.342, 4.954, 5.564, 6.172] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.493, 3.111, 3.727, 4.341, 4.953, 5.563, 6.171] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.111, 3.727, 4.341, 4.952, 5.562, 6.17] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.11, 3.726, 4.34, 4.952, 5.561, 6.169] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.11, 3.726, 4.339, 4.951, 5.56, 6.167] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.11, 3.725, 4.339, 4.95, 5.559, 6.166] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.492, 3.109, 3.725, 4.338, 4.949, 5.558, 6.164] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.491, 3.109, 3.724, 4.337, 4.948, 5.556, 6.162] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.491, 3.109, 3.724, 4.336, 4.947, 5.555, 6.16] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.25, 1.872, 2.491, 3.108, 3.723, 4.335, 4.945, 5.553, 6.158] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.491, 3.108, 3.722, 4.334, 4.944, 5.551, 6.156] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.49, 3.107, 3.721, 4.333, 4.942, 5.549, 6.153] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.49, 3.106, 3.72, 4.332, 4.941, 5.547, 6.15] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.25, 1.871, 2.489, 3.106, 3.719, 4.331, 4.939, 5.545, 6.147] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.105, 3.718, 4.329, 4.937, 5.542, 6.144] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.489, 3.104, 3.717, 4.327, 4.935, 5.539, 6.14] },
    { alder: 35, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.488, 3.103, 3.716, 4.326, 4.932, 5.536, 6.136] },
    { alder: 36, faktorerPraHeleAar: [0.626, 1.249, 1.87, 2.487, 3.103, 3.715, 4.324, 4.93, 5.533, 6.132] },
    { alder: 37, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.487, 3.101, 3.713, 4.322, 4.927, 5.529, 6.127] },
    { alder: 38, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.486, 3.1, 3.712, 4.319, 4.924, 5.525, 6.122] },
    { alder: 39, faktorerPraHeleAar: [0.626, 1.249, 1.869, 2.485, 3.099, 3.71, 4.317, 4.921, 5.521, 6.117] },
    { alder: 40, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.485, 3.098, 3.708, 4.314, 4.917, 5.516, 6.111] },
    { alder: 41, faktorerPraHeleAar: [0.626, 1.248, 1.868, 2.484, 3.096, 3.706, 4.311, 4.913, 5.511, 6.104] },
    { alder: 42, faktorerPraHeleAar: [0.626, 1.248, 1.867, 2.483, 3.095, 3.703, 4.308, 4.909, 5.505, 6.097] },
    { alder: 43, faktorerPraHeleAar: [0.626, 1.248, 1.867, 2.482, 3.093, 3.701, 4.304, 4.904, 5.499, 6.089] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.247, 1.866, 2.481, 3.091, 3.698, 4.301, 4.899, 5.492, 6.08] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.247, 1.865, 2.479, 3.089, 3.695, 4.296, 4.893, 5.485, 6.071] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.478, 3.087, 3.692, 4.292, 4.887, 5.477, 6.061] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.247, 1.864, 2.476, 3.085, 3.688, 4.287, 4.88, 5.468, 6.05] },
    { alder: 48, faktorerPraHeleAar: [0.625, 1.246, 1.863, 2.475, 3.082, 3.684, 4.281, 4.873, 5.458, 6.038] },
    { alder: 49, faktorerPraHeleAar: [0.625, 1.246, 1.862, 2.473, 3.079, 3.68, 4.276, 4.865, 5.448, 6.025] },
    { alder: 50, faktorerPraHeleAar: [0.625, 1.245, 1.861, 2.471, 3.076, 3.676, 4.269, 4.856, 5.437, 6.011] },
    { alder: 51, faktorerPraHeleAar: [0.625, 1.245, 1.86, 2.469, 3.073, 3.671, 4.262, 4.847, 5.425, 5.995] },
    { alder: 52, faktorerPraHeleAar: [0.625, 1.244, 1.858, 2.467, 3.069, 3.665, 4.254, 4.837, 5.411, 5.978] },
    { alder: 53, faktorerPraHeleAar: [0.625, 1.244, 1.857, 2.464, 3.065, 3.659, 4.246, 4.826, 5.397, 5.96] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.243, 1.856, 2.462, 3.061, 3.653, 4.237, 4.813, 5.381, 5.94] },
    { alder: 55, faktorerPraHeleAar: [0.624, 1.242, 1.854, 2.459, 3.056, 3.646, 4.227, 4.8, 5.364, 5.918] },
    { alder: 56, faktorerPraHeleAar: [0.624, 1.242, 1.852, 2.455, 3.051, 3.638, 4.217, 4.786, 5.346, 5.895] },
    { alder: 57, faktorerPraHeleAar: [0.624, 1.241, 1.85, 2.452, 3.045, 3.63, 4.205, 4.77, 5.325, 5.87] },
    { alder: 58, faktorerPraHeleAar: [0.624, 1.24, 1.848, 2.448, 3.039, 3.621, 4.192, 4.753] },
    { alder: 59, faktorerPraHeleAar: [0.623, 1.239, 1.846, 2.444, 3.032, 3.611] },
    { alder: 60, faktorerPraHeleAar: [0.623, 1.238, 1.843, 2.439, 3.025] },
    { alder: 61, faktorerPraHeleAar: [0.623, 1.237, 1.841, 2.434] },
    { alder: 62, faktorerPraHeleAar: [0.623, 1.235, 1.838] },
    { alder: 63, faktorerPraHeleAar: [0.622, 1.234] },
    { alder: 64, faktorerPraHeleAar: [0.622] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;
