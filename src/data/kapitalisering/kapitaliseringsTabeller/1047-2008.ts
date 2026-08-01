import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '1047/2008' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb' as const;
export const kapitaliseringsDatering = '21/10/2008' as const;
export const gyldigFra = toISODateString('2009-01-01');
export const gyldigTil = toISODateString('2009-06-30');

// Udtrukket maskinelt fra Bkg. 1047 2008.pdf.
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
    { alder: 5, maendFaktor: 29.632, kvinderFaktor: 29.984 },
    { alder: 6, maendFaktor: 29.175, kvinderFaktor: 29.528 },
    { alder: 7, maendFaktor: 28.717, kvinderFaktor: 29.07 },
    { alder: 8, maendFaktor: 28.258, kvinderFaktor: 28.611 },
    { alder: 9, maendFaktor: 27.797, kvinderFaktor: 28.15 },
    { alder: 10, maendFaktor: 27.334, kvinderFaktor: 27.687 },
    { alder: 11, maendFaktor: 26.87, kvinderFaktor: 27.223 },
    { alder: 12, maendFaktor: 26.404, kvinderFaktor: 26.757 },
    { alder: 13, maendFaktor: 25.937, kvinderFaktor: 26.29 },
    { alder: 14, maendFaktor: 25.468, kvinderFaktor: 25.821 },
    { alder: 15, maendFaktor: 24.998, kvinderFaktor: 25.35 },
    { alder: 16, maendFaktor: 24.526, kvinderFaktor: 24.878 },
    { alder: 17, maendFaktor: 24.053, kvinderFaktor: 24.404 },
    { alder: 18, maendFaktor: 23.579, kvinderFaktor: 23.928 },
    { alder: 19, maendFaktor: 23.103, kvinderFaktor: 23.451 },
    { alder: 20, maendFaktor: 22.626, kvinderFaktor: 22.973 },
    { alder: 21, maendFaktor: 22.147, kvinderFaktor: 22.493 },
    { alder: 22, maendFaktor: 21.668, kvinderFaktor: 22.012 },
    { alder: 23, maendFaktor: 21.187, kvinderFaktor: 21.529 },
    { alder: 24, maendFaktor: 20.705, kvinderFaktor: 21.044 },
    { alder: 25, maendFaktor: 20.221, kvinderFaktor: 20.559 },
    { alder: 26, maendFaktor: 19.737, kvinderFaktor: 20.072 },
    { alder: 27, maendFaktor: 19.251, kvinderFaktor: 19.583 },
    { alder: 28, maendFaktor: 18.765, kvinderFaktor: 19.094 },
    { alder: 29, maendFaktor: 18.277, kvinderFaktor: 18.603 },
    { alder: 30, maendFaktor: 17.789, kvinderFaktor: 18.111 },
    { alder: 31, maendFaktor: 17.3, kvinderFaktor: 17.617 },
    { alder: 32, maendFaktor: 16.81, kvinderFaktor: 17.123 },
    { alder: 33, maendFaktor: 16.319, kvinderFaktor: 16.627 },
    { alder: 34, maendFaktor: 15.827, kvinderFaktor: 16.13 },
    { alder: 35, maendFaktor: 15.335, kvinderFaktor: 15.632 },
    { alder: 36, maendFaktor: 14.842, kvinderFaktor: 15.133 },
    { alder: 37, maendFaktor: 14.348, kvinderFaktor: 14.633 },
    { alder: 38, maendFaktor: 13.854, kvinderFaktor: 14.132 },
    { alder: 39, maendFaktor: 13.359, kvinderFaktor: 13.63 },
    { alder: 40, maendFaktor: 12.864, kvinderFaktor: 13.127 },
    { alder: 41, maendFaktor: 12.368, kvinderFaktor: 12.623 },
    { alder: 42, maendFaktor: 11.872, kvinderFaktor: 12.119 },
    { alder: 43, maendFaktor: 11.376, kvinderFaktor: 11.613 },
    { alder: 44, maendFaktor: 10.879, kvinderFaktor: 11.106 },
    { alder: 45, maendFaktor: 10.382, kvinderFaktor: 10.599 },
    { alder: 46, maendFaktor: 9.884, kvinderFaktor: 10.091 },
    { alder: 47, maendFaktor: 9.386, kvinderFaktor: 9.581 },
    { alder: 48, maendFaktor: 8.887, kvinderFaktor: 9.071 },
    { alder: 49, maendFaktor: 8.387, kvinderFaktor: 8.559 },
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
  B: [
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
  C: [
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
