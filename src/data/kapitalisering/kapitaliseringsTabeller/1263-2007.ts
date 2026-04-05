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

export const kapitaliseringsId = '1263/2007' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb' as const;
export const kapitaliseringsDatering = '26/10/2007' as const;
export const gyldigFra = toISODateString('2008-01-01');
export const gyldigTil = toISODateString('2008-12-31');

// Udtrukket maskinelt fra Bkg. 1263 2007.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2007-07-01',     '1900-01-01',     null,     '65',     'A'],
] as const;

export const erhvervsevnetabTabelvalg =
  ERHVERVSEVNETAB_TABELVALG_DATA.map(
    ([skadedatoFra, foedselsdatoFra, foedselsdatoTil, ophoersalderAarLabel, tabel]) => ({
      skadedatoFra: toISODateString(skadedatoFra),
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
    { alder: 5, maendFaktor: 28.453, kvinderFaktor: 28.78 },
    { alder: 6, maendFaktor: 28.034, kvinderFaktor: 28.362 },
    { alder: 7, maendFaktor: 27.614, kvinderFaktor: 27.943 },
    { alder: 8, maendFaktor: 27.191, kvinderFaktor: 27.521 },
    { alder: 9, maendFaktor: 26.767, kvinderFaktor: 27.097 },
    { alder: 10, maendFaktor: 26.34, kvinderFaktor: 26.671 },
    { alder: 11, maendFaktor: 25.911, kvinderFaktor: 26.242 },
    { alder: 12, maendFaktor: 25.48, kvinderFaktor: 25.812 },
    { alder: 13, maendFaktor: 25.047, kvinderFaktor: 25.379 },
    { alder: 14, maendFaktor: 24.612, kvinderFaktor: 24.944 },
    { alder: 15, maendFaktor: 24.175, kvinderFaktor: 24.507 },
    { alder: 16, maendFaktor: 23.736, kvinderFaktor: 24.068 },
    { alder: 17, maendFaktor: 23.295, kvinderFaktor: 23.627 },
    { alder: 18, maendFaktor: 22.852, kvinderFaktor: 23.183 },
    { alder: 19, maendFaktor: 22.407, kvinderFaktor: 22.738 },
    { alder: 20, maendFaktor: 21.96, kvinderFaktor: 22.29 },
    { alder: 21, maendFaktor: 21.511, kvinderFaktor: 21.84 },
    { alder: 22, maendFaktor: 21.061, kvinderFaktor: 21.388 },
    { alder: 23, maendFaktor: 20.608, kvinderFaktor: 20.934 },
    { alder: 24, maendFaktor: 20.154, kvinderFaktor: 20.479 },
    { alder: 25, maendFaktor: 19.698, kvinderFaktor: 20.021 },
    { alder: 26, maendFaktor: 19.24, kvinderFaktor: 19.561 },
    { alder: 27, maendFaktor: 18.78, kvinderFaktor: 19.099 },
    { alder: 28, maendFaktor: 18.319, kvinderFaktor: 18.635 },
    { alder: 29, maendFaktor: 17.856, kvinderFaktor: 18.169 },
    { alder: 30, maendFaktor: 17.392, kvinderFaktor: 17.701 },
    { alder: 31, maendFaktor: 16.926, kvinderFaktor: 17.232 },
    { alder: 32, maendFaktor: 16.458, kvinderFaktor: 16.76 },
    { alder: 33, maendFaktor: 15.989, kvinderFaktor: 16.287 },
    { alder: 34, maendFaktor: 15.519, kvinderFaktor: 15.812 },
    { alder: 35, maendFaktor: 15.047, kvinderFaktor: 15.335 },
    { alder: 36, maendFaktor: 14.574, kvinderFaktor: 14.857 },
    { alder: 37, maendFaktor: 14.1, kvinderFaktor: 14.377 },
    { alder: 38, maendFaktor: 13.624, kvinderFaktor: 13.895 },
    { alder: 39, maendFaktor: 13.147, kvinderFaktor: 13.411 },
    { alder: 40, maendFaktor: 12.669, kvinderFaktor: 12.926 },
    { alder: 41, maendFaktor: 12.19, kvinderFaktor: 12.439 },
    { alder: 42, maendFaktor: 11.71, kvinderFaktor: 11.951 },
    { alder: 43, maendFaktor: 11.229, kvinderFaktor: 11.461 },
    { alder: 44, maendFaktor: 10.746, kvinderFaktor: 10.969 },
    { alder: 45, maendFaktor: 10.263, kvinderFaktor: 10.476 },
    { alder: 46, maendFaktor: 9.778, kvinderFaktor: 9.981 },
    { alder: 47, maendFaktor: 9.292, kvinderFaktor: 9.484 },
    { alder: 48, maendFaktor: 8.805, kvinderFaktor: 8.986 },
    { alder: 49, maendFaktor: 8.316, kvinderFaktor: 8.486 },
    { alder: 50, maendFaktor: 7.826, kvinderFaktor: 7.983 },
    { alder: 51, maendFaktor: 7.334, kvinderFaktor: 7.479 },
    { alder: 52, maendFaktor: 6.841, kvinderFaktor: 6.973 },
    { alder: 53, maendFaktor: 6.345, kvinderFaktor: 6.464 },
    { alder: 54, maendFaktor: 5.847, kvinderFaktor: 5.953 },
    { alder: 55, maendFaktor: 5.347, kvinderFaktor: 5.438 },
    { alder: 56, maendFaktor: 4.843, kvinderFaktor: 4.921 },
    { alder: 57, maendFaktor: 4.335, kvinderFaktor: 4.4 },
    { alder: 58, maendFaktor: 3.823, kvinderFaktor: 3.875 },
    { alder: 59, maendFaktor: 3.306, kvinderFaktor: 3.345 },
    { alder: 60, maendFaktor: 2.782, kvinderFaktor: 2.81 },
    { alder: 61, maendFaktor: 2.252, kvinderFaktor: 2.269 },
    { alder: 62, maendFaktor: 1.713, kvinderFaktor: 1.721 }
  ]
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = 
{
  B: [
    { alder: 18, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.868, 3.431, 3.99, 4.546, 5.098, 5.647] },
    { alder: 19, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.867, 3.43, 3.99, 4.545, 5.097, 5.646] },
    { alder: 20, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.867, 3.43, 3.989, 4.544, 5.096, 5.644] },
    { alder: 21, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.867, 3.429, 3.988, 4.543, 5.095, 5.643] },
    { alder: 22, faktorerPraHeleAar: [0.581, 1.157, 1.731, 2.3, 2.866, 3.429, 3.987, 4.542, 5.094, 5.641] },
    { alder: 23, faktorerPraHeleAar: [0.581, 1.157, 1.731, 2.3, 2.866, 3.428, 3.987, 4.541, 5.092, 5.639] },
    { alder: 24, faktorerPraHeleAar: [0.581, 1.157, 1.73, 2.3, 2.866, 3.428, 3.986, 4.54, 5.091, 5.637] },
    { alder: 25, faktorerPraHeleAar: [0.581, 1.157, 1.73, 2.3, 2.865, 3.427, 3.985, 4.539, 5.089, 5.635] },
    { alder: 26, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.299, 2.865, 3.426, 3.984, 4.538, 5.087, 5.633] },
    { alder: 27, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.299, 2.864, 3.425, 3.983, 4.536, 5.085, 5.63] },
    { alder: 28, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.299, 2.864, 3.424, 3.981, 4.534, 5.083, 5.628] },
    { alder: 29, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.298, 2.863, 3.424, 3.98, 4.532, 5.081, 5.625] },
    { alder: 30, faktorerPraHeleAar: [0.58, 1.157, 1.729, 2.298, 2.862, 3.422, 3.979, 4.53, 5.078, 5.621] },
    { alder: 31, faktorerPraHeleAar: [0.58, 1.157, 1.729, 2.297, 2.861, 3.421, 3.977, 4.528, 5.075, 5.618] },
    { alder: 32, faktorerPraHeleAar: [0.58, 1.157, 1.729, 2.297, 2.861, 3.42, 3.975, 4.526, 5.072, 5.614] },
    { alder: 33, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.296, 2.86, 3.419, 3.973, 4.523, 5.069, 5.61] },
    { alder: 34, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.296, 2.859, 3.417, 3.971, 4.521, 5.065, 5.605] },
    { alder: 35, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.295, 2.858, 3.416, 3.969, 4.517, 5.061, 5.6] },
    { alder: 36, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.414, 3.966, 4.514, 5.057, 5.594] },
    { alder: 37, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.293, 2.855, 3.412, 3.964, 4.51, 5.052, 5.588] },
    { alder: 38, faktorerPraHeleAar: [0.58, 1.156, 1.726, 2.292, 2.854, 3.41, 3.961, 4.506, 5.047, 5.582] },
    { alder: 39, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.291, 2.852, 3.407, 3.957, 4.502, 5.041, 5.575] },
    { alder: 40, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.29, 2.85, 3.405, 3.954, 4.497, 5.035, 5.567] },
    { alder: 41, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.289, 2.848, 3.402, 3.95, 4.492, 5.028, 5.558] },
    { alder: 42, faktorerPraHeleAar: [0.58, 1.155, 1.724, 2.288, 2.846, 3.399, 3.946, 4.487, 5.021, 5.549] },
    { alder: 43, faktorerPraHeleAar: [0.58, 1.154, 1.723, 2.287, 2.844, 3.396, 3.941, 4.481, 5.013, 5.539] },
    { alder: 44, faktorerPraHeleAar: [0.58, 1.154, 1.722, 2.285, 2.842, 3.392, 3.936, 4.474, 5.005, 5.528] },
    { alder: 45, faktorerPraHeleAar: [0.58, 1.154, 1.722, 2.283, 2.839, 3.388, 3.931, 4.467, 4.995, 5.516] },
    { alder: 46, faktorerPraHeleAar: [0.58, 1.153, 1.721, 2.282, 2.836, 3.384, 3.925, 4.459, 4.985, 5.503] },
    { alder: 47, faktorerPraHeleAar: [0.579, 1.153, 1.72, 2.28, 2.833, 3.38, 3.919, 4.45, 4.974, 5.489] },
    { alder: 48, faktorerPraHeleAar: [0.579, 1.152, 1.718, 2.278, 2.83, 3.375, 3.912, 4.441, 4.962, 5.474] },
    { alder: 49, faktorerPraHeleAar: [0.579, 1.152, 1.717, 2.275, 2.826, 3.369, 3.904, 4.431, 4.948, 5.457] },
    { alder: 50, faktorerPraHeleAar: [0.579, 1.151, 1.716, 2.273, 2.822, 3.363, 3.896, 4.42, 4.934, 5.439] },
    { alder: 51, faktorerPraHeleAar: [0.579, 1.15, 1.714, 2.27, 2.818, 3.357, 3.887, 4.408, 4.918, 5.419] },
    { alder: 52, faktorerPraHeleAar: [0.579, 1.15, 1.713, 2.267, 2.813, 3.35, 3.877, 4.394, 4.902, 5.398] },
    { alder: 53, faktorerPraHeleAar: [0.579, 1.149, 1.711, 2.264, 2.808, 3.342, 3.866, 4.38, 4.883, 5.375] },
    { alder: 54, faktorerPraHeleAar: [0.578, 1.148, 1.709, 2.26, 2.802, 3.334, 3.855, 4.365, 4.863, 5.35] },
    { alder: 55, faktorerPraHeleAar: [0.578, 1.147, 1.707, 2.257, 2.796, 3.325, 3.842, 4.348, 4.842, 5.323] },
    { alder: 56, faktorerPraHeleAar: [0.578, 1.146, 1.704, 2.252, 2.789, 3.315, 3.829, 4.33, 4.818] },
    { alder: 57, faktorerPraHeleAar: [0.578, 1.145, 1.702, 2.248, 2.782, 3.304, 3.814, 4.31] },
    { alder: 58, faktorerPraHeleAar: [0.577, 1.144, 1.699, 2.243, 2.774, 3.293, 3.798] },
    { alder: 59, faktorerPraHeleAar: [0.577, 1.143, 1.696, 2.237, 2.765, 3.28] },
    { alder: 60, faktorerPraHeleAar: [0.577, 1.141, 1.693, 2.232, 2.756] },
    { alder: 61, faktorerPraHeleAar: [0.576, 1.14, 1.69, 2.225] },
    { alder: 62, faktorerPraHeleAar: [0.576, 1.138, 1.686] },
    { alder: 63, faktorerPraHeleAar: [0.576, 1.136] },
    { alder: 64, faktorerPraHeleAar: [0.575] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = 
{
  C: [
    { alder: 18, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.302, 2.869, 3.432, 3.992, 4.548, 5.101, 5.651] },
    { alder: 19, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.302, 2.868, 3.432, 3.992, 4.548, 5.101, 5.65] },
    { alder: 20, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.302, 2.868, 3.431, 3.991, 4.547, 5.1, 5.649] },
    { alder: 21, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.868, 3.431, 3.991, 4.547, 5.099, 5.648] },
    { alder: 22, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.868, 3.431, 3.99, 4.546, 5.098, 5.647] },
    { alder: 23, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.867, 3.43, 3.99, 4.545, 5.097, 5.646] },
    { alder: 24, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.867, 3.43, 3.989, 4.544, 5.096, 5.644] },
    { alder: 25, faktorerPraHeleAar: [0.581, 1.158, 1.731, 2.301, 2.867, 3.429, 3.988, 4.543, 5.095, 5.643] },
    { alder: 26, faktorerPraHeleAar: [0.581, 1.157, 1.731, 2.3, 2.866, 3.429, 3.987, 4.542, 5.094, 5.641] },
    { alder: 27, faktorerPraHeleAar: [0.581, 1.157, 1.731, 2.3, 2.866, 3.428, 3.987, 4.541, 5.092, 5.639] },
    { alder: 28, faktorerPraHeleAar: [0.581, 1.157, 1.73, 2.3, 2.866, 3.428, 3.986, 4.54, 5.091, 5.637] },
    { alder: 29, faktorerPraHeleAar: [0.581, 1.157, 1.73, 2.3, 2.865, 3.427, 3.985, 4.539, 5.089, 5.635] },
    { alder: 30, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.299, 2.865, 3.426, 3.984, 4.538, 5.087, 5.633] },
    { alder: 31, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.299, 2.864, 3.425, 3.983, 4.536, 5.085, 5.63] },
    { alder: 32, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.299, 2.864, 3.424, 3.981, 4.534, 5.083, 5.628] },
    { alder: 33, faktorerPraHeleAar: [0.58, 1.157, 1.73, 2.298, 2.863, 3.424, 3.98, 4.532, 5.081, 5.625] },
    { alder: 34, faktorerPraHeleAar: [0.58, 1.157, 1.729, 2.298, 2.862, 3.422, 3.979, 4.53, 5.078, 5.621] },
    { alder: 35, faktorerPraHeleAar: [0.58, 1.157, 1.729, 2.297, 2.861, 3.421, 3.977, 4.528, 5.075, 5.618] },
    { alder: 36, faktorerPraHeleAar: [0.58, 1.157, 1.729, 2.297, 2.861, 3.42, 3.975, 4.526, 5.072, 5.614] },
    { alder: 37, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.296, 2.86, 3.419, 3.973, 4.523, 5.069, 5.61] },
    { alder: 38, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.296, 2.859, 3.417, 3.971, 4.521, 5.065, 5.605] },
    { alder: 39, faktorerPraHeleAar: [0.58, 1.156, 1.728, 2.295, 2.858, 3.416, 3.969, 4.517, 5.061, 5.6] },
    { alder: 40, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.294, 2.856, 3.414, 3.966, 4.514, 5.057, 5.594] },
    { alder: 41, faktorerPraHeleAar: [0.58, 1.156, 1.727, 2.293, 2.855, 3.412, 3.964, 4.51, 5.052, 5.588] },
    { alder: 42, faktorerPraHeleAar: [0.58, 1.156, 1.726, 2.292, 2.854, 3.41, 3.961, 4.506, 5.047, 5.582] },
    { alder: 43, faktorerPraHeleAar: [0.58, 1.155, 1.726, 2.291, 2.852, 3.407, 3.957, 4.502, 5.041, 5.575] },
    { alder: 44, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.29, 2.85, 3.405, 3.954, 4.497, 5.035, 5.567] },
    { alder: 45, faktorerPraHeleAar: [0.58, 1.155, 1.725, 2.289, 2.848, 3.402, 3.95, 4.492, 5.028, 5.558] },
    { alder: 46, faktorerPraHeleAar: [0.58, 1.155, 1.724, 2.288, 2.846, 3.399, 3.946, 4.487, 5.021, 5.549] },
    { alder: 47, faktorerPraHeleAar: [0.58, 1.154, 1.723, 2.287, 2.844, 3.396, 3.941, 4.481, 5.013, 5.539] },
    { alder: 48, faktorerPraHeleAar: [0.58, 1.154, 1.722, 2.285, 2.842, 3.392, 3.936, 4.474, 5.005, 5.528] },
    { alder: 49, faktorerPraHeleAar: [0.58, 1.154, 1.722, 2.283, 2.839, 3.388, 3.931, 4.467, 4.995, 5.516] },
    { alder: 50, faktorerPraHeleAar: [0.58, 1.153, 1.721, 2.282, 2.836, 3.384, 3.925, 4.459, 4.985, 5.503] },
    { alder: 51, faktorerPraHeleAar: [0.579, 1.153, 1.72, 2.28, 2.833, 3.38, 3.919, 4.45, 4.974, 5.489] },
    { alder: 52, faktorerPraHeleAar: [0.579, 1.152, 1.718, 2.278, 2.83, 3.375, 3.912, 4.441, 4.962, 5.474] },
    { alder: 53, faktorerPraHeleAar: [0.579, 1.152, 1.717, 2.275, 2.826, 3.369, 3.904, 4.431, 4.948, 5.457] },
    { alder: 54, faktorerPraHeleAar: [0.579, 1.151, 1.716, 2.273, 2.822, 3.363, 3.896, 4.42, 4.934, 5.439] },
    { alder: 55, faktorerPraHeleAar: [0.579, 1.15, 1.714, 2.27, 2.818, 3.357, 3.887, 4.408, 4.918, 5.419] },
    { alder: 56, faktorerPraHeleAar: [0.579, 1.15, 1.713, 2.267, 2.813, 3.35, 3.877, 4.394, 4.902] },
    { alder: 57, faktorerPraHeleAar: [0.579, 1.149, 1.711, 2.264, 2.808, 3.342, 3.866, 4.38] },
    { alder: 58, faktorerPraHeleAar: [0.578, 1.148, 1.709, 2.26, 2.802, 3.334, 3.855] },
    { alder: 59, faktorerPraHeleAar: [0.578, 1.147, 1.707, 2.257, 2.796, 3.325] },
    { alder: 60, faktorerPraHeleAar: [0.578, 1.146, 1.704, 2.252, 2.789] },
    { alder: 61, faktorerPraHeleAar: [0.578, 1.145, 1.702, 2.248] },
    { alder: 62, faktorerPraHeleAar: [0.577, 1.144, 1.699] },
    { alder: 63, faktorerPraHeleAar: [0.577, 1.143] },
    { alder: 64, faktorerPraHeleAar: [0.577] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabAfloesningsTabellerKoensopdelt = {} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;
