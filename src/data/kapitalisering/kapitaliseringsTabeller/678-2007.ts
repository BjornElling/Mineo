import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '678/2007' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb' as const;
export const kapitaliseringsDatering = '20/06/2007' as const;
export const gyldigFra = toISODateString('2007-07-01');
export const gyldigTil = toISODateString('2007-12-31');

// Udtrukket maskinelt fra Bkg. 678 2007.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     tabel
  ['2007-07-01',     '1900-01-01',     null,     'A'],
] as const;

export const erhvervsevnetabTabelvalg =
  ERHVERVSEVNETAB_TABELVALG_DATA.map(
    ([skadedatoFra, foedselsdatoFra, foedselsdatoTil, tabel]) => ({
      skadedatoFra: toISODateString(skadedatoFra),
      foedselsdatoFra: toISODateString(foedselsdatoFra),
      foedselsdatoTil: foedselsdatoTil ? toISODateString(foedselsdatoTil) : null,
      tabel,
    })
  );

export const erhvervsevnetabTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = 
{
  A: [
    { alder: 5, maendFaktor: 27.321, kvinderFaktor: 27.626 },
    { alder: 6, maendFaktor: 26.937, kvinderFaktor: 27.243 },
    { alder: 7, maendFaktor: 26.55, kvinderFaktor: 26.857 },
    { alder: 8, maendFaktor: 26.161, kvinderFaktor: 26.469 },
    { alder: 9, maendFaktor: 25.769, kvinderFaktor: 26.078 },
    { alder: 10, maendFaktor: 25.375, kvinderFaktor: 25.685 },
    { alder: 11, maendFaktor: 24.978, kvinderFaktor: 25.289 },
    { alder: 12, maendFaktor: 24.578, kvinderFaktor: 24.89 },
    { alder: 13, maendFaktor: 24.177, kvinderFaktor: 24.489 },
    { alder: 14, maendFaktor: 23.772, kvinderFaktor: 24.085 },
    { alder: 15, maendFaktor: 23.365, kvinderFaktor: 23.679 },
    { alder: 16, maendFaktor: 22.956, kvinderFaktor: 23.27 },
    { alder: 17, maendFaktor: 22.544, kvinderFaktor: 22.858 },
    { alder: 18, maendFaktor: 22.13, kvinderFaktor: 22.444 },
    { alder: 19, maendFaktor: 21.713, kvinderFaktor: 22.027 },
    { alder: 20, maendFaktor: 21.294, kvinderFaktor: 21.608 },
    { alder: 21, maendFaktor: 20.873, kvinderFaktor: 21.186 },
    { alder: 22, maendFaktor: 20.449, kvinderFaktor: 20.761 },
    { alder: 23, maendFaktor: 20.023, kvinderFaktor: 20.334 },
    { alder: 24, maendFaktor: 19.594, kvinderFaktor: 19.905 },
    { alder: 25, maendFaktor: 19.164, kvinderFaktor: 19.472 },
    { alder: 26, maendFaktor: 18.731, kvinderFaktor: 19.038 },
    { alder: 27, maendFaktor: 18.295, kvinderFaktor: 18.601 },
    { alder: 28, maendFaktor: 17.858, kvinderFaktor: 18.161 },
    { alder: 29, maendFaktor: 17.418, kvinderFaktor: 17.719 },
    { alder: 30, maendFaktor: 16.977, kvinderFaktor: 17.275 },
    { alder: 31, maendFaktor: 16.533, kvinderFaktor: 16.828 },
    { alder: 32, maendFaktor: 16.087, kvinderFaktor: 16.379 },
    { alder: 33, maendFaktor: 15.639, kvinderFaktor: 15.927 },
    { alder: 34, maendFaktor: 15.189, kvinderFaktor: 15.473 },
    { alder: 35, maendFaktor: 14.738, kvinderFaktor: 15.017 },
    { alder: 36, maendFaktor: 14.284, kvinderFaktor: 14.558 },
    { alder: 37, maendFaktor: 13.828, kvinderFaktor: 14.097 },
    { alder: 38, maendFaktor: 13.371, kvinderFaktor: 13.634 },
    { alder: 39, maendFaktor: 12.912, kvinderFaktor: 13.169 },
    { alder: 40, maendFaktor: 12.451, kvinderFaktor: 12.701 },
    { alder: 41, maendFaktor: 11.988, kvinderFaktor: 12.231 },
    { alder: 42, maendFaktor: 11.524, kvinderFaktor: 11.759 },
    { alder: 43, maendFaktor: 11.058, kvinderFaktor: 11.285 },
    { alder: 44, maendFaktor: 10.59, kvinderFaktor: 10.808 },
    { alder: 45, maendFaktor: 10.12, kvinderFaktor: 10.329 },
    { alder: 46, maendFaktor: 9.649, kvinderFaktor: 9.848 },
    { alder: 47, maendFaktor: 9.176, kvinderFaktor: 9.365 },
    { alder: 48, maendFaktor: 8.701, kvinderFaktor: 8.879 },
    { alder: 49, maendFaktor: 8.224, kvinderFaktor: 8.391 },
    { alder: 50, maendFaktor: 7.745, kvinderFaktor: 7.9 },
    { alder: 51, maendFaktor: 7.263, kvinderFaktor: 7.406 },
    { alder: 52, maendFaktor: 6.779, kvinderFaktor: 6.91 },
    { alder: 53, maendFaktor: 6.293, kvinderFaktor: 6.41 },
    { alder: 54, maendFaktor: 5.803, kvinderFaktor: 5.907 },
    { alder: 55, maendFaktor: 5.31, kvinderFaktor: 5.401 },
    { alder: 56, maendFaktor: 4.813, kvinderFaktor: 4.891 },
    { alder: 57, maendFaktor: 4.312, kvinderFaktor: 4.376 },
    { alder: 58, maendFaktor: 3.805, kvinderFaktor: 3.857 },
    { alder: 59, maendFaktor: 3.293, kvinderFaktor: 3.332 },
    { alder: 60, maendFaktor: 2.774, kvinderFaktor: 2.801 },
    { alder: 61, maendFaktor: 2.247, kvinderFaktor: 2.264 },
    { alder: 62, maendFaktor: 1.711, kvinderFaktor: 1.718 }
  ]
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = 
{
  B: [
    { alder: 18, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.295, 2.857, 3.416, 3.97, 4.519, 5.065, 5.606] },
    { alder: 19, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.857, 3.415, 3.969, 4.519, 5.064, 5.605] },
    { alder: 20, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.857, 3.415, 3.969, 4.518, 5.063, 5.603] },
    { alder: 21, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.414, 3.968, 4.517, 5.062, 5.602] },
    { alder: 22, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.414, 3.967, 4.516, 5.06, 5.6] },
    { alder: 23, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.413, 3.966, 4.515, 5.059, 5.598] },
    { alder: 24, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.293, 2.855, 3.413, 3.965, 4.514, 5.057, 5.596] },
    { alder: 25, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.293, 2.855, 3.412, 3.965, 4.512, 5.056, 5.594] },
    { alder: 26, faktorerPraHeleAar: [0.58, 1.156, 1.726, 2.293, 2.854, 3.411, 3.963, 4.511, 5.054, 5.592] },
    { alder: 27, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.292, 2.854, 3.41, 3.962, 4.51, 5.052, 5.59] },
    { alder: 28, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.292, 2.853, 3.41, 3.961, 4.508, 5.05, 5.587] },
    { alder: 29, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.292, 2.852, 3.409, 3.96, 4.506, 5.047, 5.584] },
    { alder: 30, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.291, 2.852, 3.408, 3.958, 4.504, 5.045, 5.581] },
    { alder: 31, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.291, 2.851, 3.406, 3.957, 4.502, 5.042, 5.577] },
    { alder: 32, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.29, 2.85, 3.405, 3.955, 4.5, 5.039, 5.573] },
    { alder: 33, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.29, 2.849, 3.404, 3.953, 4.497, 5.036, 5.569] },
    { alder: 34, faktorerPraHeleAar: [0.58, 1.155, 1.724, 2.289, 2.848, 3.402, 3.951, 4.494, 5.032, 5.564] },
    { alder: 35, faktorerPraHeleAar: [0.58, 1.155, 1.724, 2.288, 2.847, 3.401, 3.949, 4.491, 5.028, 5.559] },
    { alder: 36, faktorerPraHeleAar: [0.58, 1.154, 1.724, 2.287, 2.846, 3.399, 3.946, 4.488, 5.024, 5.554] },
    { alder: 37, faktorerPraHeleAar: [0.58, 1.154, 1.723, 2.287, 2.845, 3.397, 3.944, 4.484, 5.019, 5.548] },
    { alder: 38, faktorerPraHeleAar: [0.58, 1.154, 1.723, 2.286, 2.843, 3.395, 3.941, 4.48, 5.014, 5.541] },
    { alder: 39, faktorerPraHeleAar: [0.58, 1.154, 1.722, 2.285, 2.842, 3.393, 3.937, 4.476, 5.008, 5.534] },
    { alder: 40, faktorerPraHeleAar: [0.58, 1.153, 1.722, 2.284, 2.84, 3.39, 3.934, 4.471, 5.002, 5.526] },
    { alder: 41, faktorerPraHeleAar: [0.58, 1.153, 1.721, 2.283, 2.838, 3.387, 3.93, 4.466, 4.996, 5.518] },
    { alder: 42, faktorerPraHeleAar: [0.579, 1.153, 1.72, 2.281, 2.836, 3.384, 3.926, 4.461, 4.988, 5.509] },
    { alder: 43, faktorerPraHeleAar: [0.579, 1.153, 1.72, 2.28, 2.834, 3.381, 3.921, 4.455, 4.981, 5.499] },
    { alder: 44, faktorerPraHeleAar: [0.579, 1.152, 1.719, 2.279, 2.832, 3.378, 3.916, 4.448, 4.972, 5.488] },
    { alder: 45, faktorerPraHeleAar: [0.579, 1.152, 1.718, 2.277, 2.829, 3.374, 3.911, 4.441, 4.963, 5.476] },
    { alder: 46, faktorerPraHeleAar: [0.579, 1.151, 1.717, 2.275, 2.826, 3.37, 3.905, 4.433, 4.952, 5.463] },
    { alder: 47, faktorerPraHeleAar: [0.579, 1.151, 1.716, 2.273, 2.823, 3.365, 3.899, 4.424, 4.941, 5.45] },
    { alder: 48, faktorerPraHeleAar: [0.579, 1.151, 1.715, 2.271, 2.82, 3.36, 3.892, 4.415, 4.929, 5.434] },
    { alder: 49, faktorerPraHeleAar: [0.579, 1.15, 1.713, 2.269, 2.816, 3.355, 3.884, 4.405, 4.916, 5.418] },
    { alder: 50, faktorerPraHeleAar: [0.579, 1.149, 1.712, 2.266, 2.812, 3.349, 3.876, 4.394, 4.902, 5.4] },
    { alder: 51, faktorerPraHeleAar: [0.578, 1.149, 1.711, 2.264, 2.808, 3.342, 3.867, 4.382, 4.887, 5.38] },
    { alder: 52, faktorerPraHeleAar: [0.578, 1.148, 1.709, 2.261, 2.803, 3.335, 3.857, 4.369, 4.87, 5.359] },
    { alder: 53, faktorerPraHeleAar: [0.578, 1.147, 1.707, 2.257, 2.798, 3.328, 3.847, 4.355, 4.852, 5.336] },
    { alder: 54, faktorerPraHeleAar: [0.578, 1.146, 1.705, 2.254, 2.792, 3.319, 3.835, 4.34, 4.832, 5.312] },
    { alder: 55, faktorerPraHeleAar: [0.578, 1.146, 1.703, 2.25, 2.786, 3.31, 3.823, 4.323, 4.811, 5.285] },
    { alder: 56, faktorerPraHeleAar: [0.578, 1.145, 1.701, 2.246, 2.779, 3.301, 3.809, 4.305, 4.787] },
    { alder: 57, faktorerPraHeleAar: [0.577, 1.144, 1.698, 2.241, 2.772, 3.29, 3.795, 4.285] },
    { alder: 58, faktorerPraHeleAar: [0.577, 1.142, 1.696, 2.236, 2.764, 3.278, 3.779] },
    { alder: 59, faktorerPraHeleAar: [0.577, 1.141, 1.693, 2.231, 2.756, 3.266] },
    { alder: 60, faktorerPraHeleAar: [0.576, 1.14, 1.689, 2.225, 2.746] },
    { alder: 61, faktorerPraHeleAar: [0.576, 1.138, 1.686, 2.219] },
    { alder: 62, faktorerPraHeleAar: [0.576, 1.137, 1.682] },
    { alder: 63, faktorerPraHeleAar: [0.575, 1.135] },
    { alder: 64, faktorerPraHeleAar: [0.575] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = 
{
  C: [
    { alder: 18, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.295, 2.858, 3.417, 3.972, 4.522, 5.068, 5.61] },
    { alder: 19, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.295, 2.858, 3.417, 3.971, 4.521, 5.067, 5.609] },
    { alder: 20, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.295, 2.858, 3.416, 3.971, 4.521, 5.067, 5.608] },
    { alder: 21, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.295, 2.858, 3.416, 3.97, 4.52, 5.066, 5.607] },
    { alder: 22, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.295, 2.857, 3.416, 3.97, 4.519, 5.065, 5.606] },
    { alder: 23, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.857, 3.415, 3.969, 4.519, 5.064, 5.605] },
    { alder: 24, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.857, 3.415, 3.969, 4.518, 5.063, 5.603] },
    { alder: 25, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.414, 3.968, 4.517, 5.062, 5.602] },
    { alder: 26, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.414, 3.967, 4.516, 5.06, 5.6] },
    { alder: 27, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.413, 3.966, 4.515, 5.059, 5.598] },
    { alder: 28, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.293, 2.855, 3.413, 3.965, 4.514, 5.057, 5.596] },
    { alder: 29, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.293, 2.855, 3.412, 3.965, 4.512, 5.056, 5.594] },
    { alder: 30, faktorerPraHeleAar: [0.58, 1.156, 1.726, 2.293, 2.854, 3.411, 3.963, 4.511, 5.054, 5.592] },
    { alder: 31, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.292, 2.854, 3.41, 3.962, 4.51, 5.052, 5.59] },
    { alder: 32, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.292, 2.853, 3.41, 3.961, 4.508, 5.05, 5.587] },
    { alder: 33, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.292, 2.852, 3.409, 3.96, 4.506, 5.047, 5.584] },
    { alder: 34, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.291, 2.852, 3.408, 3.958, 4.504, 5.045, 5.581] },
    { alder: 35, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.291, 2.851, 3.406, 3.957, 4.502, 5.042, 5.577] },
    { alder: 36, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.29, 2.85, 3.405, 3.955, 4.5, 5.039, 5.573] },
    { alder: 37, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.29, 2.849, 3.404, 3.953, 4.497, 5.036, 5.569] },
    { alder: 38, faktorerPraHeleAar: [0.58, 1.155, 1.724, 2.289, 2.848, 3.402, 3.951, 4.494, 5.032, 5.564] },
    { alder: 39, faktorerPraHeleAar: [0.58, 1.155, 1.724, 2.288, 2.847, 3.401, 3.949, 4.491, 5.028, 5.559] },
    { alder: 40, faktorerPraHeleAar: [0.58, 1.154, 1.724, 2.287, 2.846, 3.399, 3.946, 4.488, 5.024, 5.554] },
    { alder: 41, faktorerPraHeleAar: [0.58, 1.154, 1.723, 2.287, 2.845, 3.397, 3.944, 4.484, 5.019, 5.548] },
    { alder: 42, faktorerPraHeleAar: [0.58, 1.154, 1.723, 2.286, 2.843, 3.395, 3.941, 4.48, 5.014, 5.541] },
    { alder: 43, faktorerPraHeleAar: [0.58, 1.154, 1.722, 2.285, 2.842, 3.393, 3.937, 4.476, 5.008, 5.534] },
    { alder: 44, faktorerPraHeleAar: [0.58, 1.153, 1.722, 2.284, 2.84, 3.39, 3.934, 4.471, 5.002, 5.526] },
    { alder: 45, faktorerPraHeleAar: [0.58, 1.153, 1.721, 2.283, 2.838, 3.387, 3.93, 4.466, 4.996, 5.518] },
    { alder: 46, faktorerPraHeleAar: [0.579, 1.153, 1.72, 2.281, 2.836, 3.384, 3.926, 4.461, 4.988, 5.509] },
    { alder: 47, faktorerPraHeleAar: [0.579, 1.153, 1.72, 2.28, 2.834, 3.381, 3.921, 4.455, 4.981, 5.499] },
    { alder: 48, faktorerPraHeleAar: [0.579, 1.152, 1.719, 2.279, 2.832, 3.378, 3.916, 4.448, 4.972, 5.488] },
    { alder: 49, faktorerPraHeleAar: [0.579, 1.152, 1.718, 2.277, 2.829, 3.374, 3.911, 4.441, 4.963, 5.476] },
    { alder: 50, faktorerPraHeleAar: [0.579, 1.151, 1.717, 2.275, 2.826, 3.37, 3.905, 4.433, 4.952, 5.463] },
    { alder: 51, faktorerPraHeleAar: [0.579, 1.151, 1.716, 2.273, 2.823, 3.365, 3.899, 4.424, 4.941, 5.45] },
    { alder: 52, faktorerPraHeleAar: [0.579, 1.151, 1.715, 2.271, 2.82, 3.36, 3.892, 4.415, 4.929, 5.434] },
    { alder: 53, faktorerPraHeleAar: [0.579, 1.15, 1.713, 2.269, 2.816, 3.355, 3.884, 4.405, 4.916, 5.418] },
    { alder: 54, faktorerPraHeleAar: [0.579, 1.149, 1.712, 2.266, 2.812, 3.349, 3.876, 4.394, 4.902, 5.4] },
    { alder: 55, faktorerPraHeleAar: [0.578, 1.149, 1.711, 2.264, 2.808, 3.342, 3.867, 4.382, 4.887, 5.38] },
    { alder: 56, faktorerPraHeleAar: [0.578, 1.148, 1.709, 2.261, 2.803, 3.335, 3.857, 4.369, 4.87] },
    { alder: 57, faktorerPraHeleAar: [0.578, 1.147, 1.707, 2.257, 2.798, 3.328, 3.847, 4.355] },
    { alder: 58, faktorerPraHeleAar: [0.578, 1.146, 1.705, 2.254, 2.792, 3.319, 3.835] },
    { alder: 59, faktorerPraHeleAar: [0.578, 1.146, 1.703, 2.25, 2.786, 3.31] },
    { alder: 60, faktorerPraHeleAar: [0.578, 1.145, 1.701, 2.246, 2.779] },
    { alder: 61, faktorerPraHeleAar: [0.577, 1.144, 1.698, 2.241] },
    { alder: 62, faktorerPraHeleAar: [0.577, 1.142, 1.696] },
    { alder: 63, faktorerPraHeleAar: [0.577, 1.141] },
    { alder: 64, faktorerPraHeleAar: [0.576] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabAfloesningsTabellerKoensopdelt = {} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;
