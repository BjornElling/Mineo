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

export const kapitaliseringsId = '1068/2003' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb' as const;
export const kapitaliseringsDatering = '11/12/2003' as const;
export const gyldigFra = toISODateString('2004-01-01');
export const gyldigTil = toISODateString('2009-06-30');

// Udtrukket maskinelt fra Bkg. 1068 2003.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['1978-04-01',     '1900-01-01',     null,     '65',     'A'],
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
  B: [
    { alder: 5, maendFaktor: 10.453, kvinderFaktor: 10.463 },
    { alder: 6, maendFaktor: 10.448, kvinderFaktor: 10.459 },
    { alder: 7, maendFaktor: 10.443, kvinderFaktor: 10.455 },
    { alder: 8, maendFaktor: 10.438, kvinderFaktor: 10.451 },
    { alder: 9, maendFaktor: 10.432, kvinderFaktor: 10.446 },
    { alder: 10, maendFaktor: 10.425, kvinderFaktor: 10.44 },
    { alder: 11, maendFaktor: 10.418, kvinderFaktor: 10.434 },
    { alder: 12, maendFaktor: 10.411, kvinderFaktor: 10.428 },
    { alder: 13, maendFaktor: 10.402, kvinderFaktor: 10.421 },
    { alder: 14, maendFaktor: 10.393, kvinderFaktor: 10.413 },
    { alder: 15, maendFaktor: 10.383, kvinderFaktor: 10.405 },
    { alder: 16, maendFaktor: 10.373, kvinderFaktor: 10.396 },
    { alder: 17, maendFaktor: 10.361, kvinderFaktor: 10.386 },
    { alder: 18, maendFaktor: 10.349, kvinderFaktor: 10.375 },
    { alder: 19, maendFaktor: 10.335, kvinderFaktor: 10.364 },
    { alder: 20, maendFaktor: 10.321, kvinderFaktor: 10.351 },
    { alder: 21, maendFaktor: 10.305, kvinderFaktor: 10.338 },
    { alder: 22, maendFaktor: 10.288, kvinderFaktor: 10.323 },
    { alder: 23, maendFaktor: 10.269, kvinderFaktor: 10.307 },
    { alder: 24, maendFaktor: 10.249, kvinderFaktor: 10.289 },
    { alder: 25, maendFaktor: 10.227, kvinderFaktor: 10.27 },
    { alder: 26, maendFaktor: 10.204, kvinderFaktor: 10.249 },
    { alder: 27, maendFaktor: 10.178, kvinderFaktor: 10.227 },
    { alder: 28, maendFaktor: 10.151, kvinderFaktor: 10.203 },
    { alder: 29, maendFaktor: 10.121, kvinderFaktor: 10.176 },
    { alder: 30, maendFaktor: 10.089, kvinderFaktor: 10.147 },
    { alder: 31, maendFaktor: 10.054, kvinderFaktor: 10.116 },
    { alder: 32, maendFaktor: 10.016, kvinderFaktor: 10.082 },
    { alder: 33, maendFaktor: 9.975, kvinderFaktor: 10.046 },
    { alder: 34, maendFaktor: 9.932, kvinderFaktor: 10.006 },
    { alder: 35, maendFaktor: 9.884, kvinderFaktor: 9.963 },
    { alder: 36, maendFaktor: 9.833, kvinderFaktor: 9.916 },
    { alder: 37, maendFaktor: 9.778, kvinderFaktor: 9.865 },
    { alder: 38, maendFaktor: 9.718, kvinderFaktor: 9.81 },
    { alder: 39, maendFaktor: 9.654, kvinderFaktor: 9.75 },
    { alder: 40, maendFaktor: 9.584, kvinderFaktor: 9.686 },
    { alder: 41, maendFaktor: 9.51, kvinderFaktor: 9.615 },
    { alder: 42, maendFaktor: 9.429, kvinderFaktor: 9.539 },
    { alder: 43, maendFaktor: 9.342, kvinderFaktor: 9.457 },
    { alder: 44, maendFaktor: 9.248, kvinderFaktor: 9.367 },
    { alder: 45, maendFaktor: 9.147, kvinderFaktor: 9.27 },
    { alder: 46, maendFaktor: 9.038, kvinderFaktor: 9.165 },
    { alder: 47, maendFaktor: 8.92, kvinderFaktor: 9.051 },
    { alder: 48, maendFaktor: 8.793, kvinderFaktor: 8.927 },
    { alder: 49, maendFaktor: 8.656, kvinderFaktor: 8.792 },
    { alder: 50, maendFaktor: 8.508, kvinderFaktor: 8.647 },
    { alder: 51, maendFaktor: 8.349, kvinderFaktor: 8.488 },
    { alder: 52, maendFaktor: 8.176, kvinderFaktor: 8.316 },
    { alder: 53, maendFaktor: 7.99, kvinderFaktor: 8.13 },
    { alder: 54, maendFaktor: 7.789, kvinderFaktor: 7.927 },
    { alder: 55, maendFaktor: 7.571, kvinderFaktor: 7.706 },
    { alder: 56, maendFaktor: 7.335, kvinderFaktor: 7.466 },
    { alder: 57, maendFaktor: 7.08, kvinderFaktor: 7.204 },
    { alder: 58, maendFaktor: 6.802, kvinderFaktor: 6.918 },
    { alder: 59, maendFaktor: 6.501, kvinderFaktor: 6.607 },
    { alder: 60, maendFaktor: 6.172, kvinderFaktor: 6.266 },
    { alder: 61, maendFaktor: 5.814, kvinderFaktor: 5.894 },
    { alder: 62, maendFaktor: 5.422, kvinderFaktor: 5.485 },
    { alder: 63, maendFaktor: 4.993, kvinderFaktor: 5.037 },
    { alder: 64, maendFaktor: 4.521, kvinderFaktor: 4.544 }
  ],
  C: [
    { alder: 5, maendFaktor: 10.451, kvinderFaktor: 10.462 },
    { alder: 6, maendFaktor: 10.447, kvinderFaktor: 10.458 },
    { alder: 7, maendFaktor: 10.441, kvinderFaktor: 10.453 },
    { alder: 8, maendFaktor: 10.436, kvinderFaktor: 10.448 },
    { alder: 9, maendFaktor: 10.429, kvinderFaktor: 10.443 },
    { alder: 10, maendFaktor: 10.423, kvinderFaktor: 10.437 },
    { alder: 11, maendFaktor: 10.415, kvinderFaktor: 10.431 },
    { alder: 12, maendFaktor: 10.407, kvinderFaktor: 10.425 },
    { alder: 13, maendFaktor: 10.399, kvinderFaktor: 10.417 },
    { alder: 14, maendFaktor: 10.389, kvinderFaktor: 10.409 },
    { alder: 15, maendFaktor: 10.379, kvinderFaktor: 10.401 },
    { alder: 16, maendFaktor: 10.368, kvinderFaktor: 10.391 },
    { alder: 17, maendFaktor: 10.356, kvinderFaktor: 10.381 },
    { alder: 18, maendFaktor: 10.343, kvinderFaktor: 10.37 },
    { alder: 19, maendFaktor: 10.329, kvinderFaktor: 10.358 },
    { alder: 20, maendFaktor: 10.314, kvinderFaktor: 10.344 },
    { alder: 21, maendFaktor: 10.297, kvinderFaktor: 10.33 },
    { alder: 22, maendFaktor: 10.279, kvinderFaktor: 10.314 },
    { alder: 23, maendFaktor: 10.26, kvinderFaktor: 10.297 },
    { alder: 24, maendFaktor: 10.239, kvinderFaktor: 10.279 },
    { alder: 25, maendFaktor: 10.216, kvinderFaktor: 10.259 },
    { alder: 26, maendFaktor: 10.191, kvinderFaktor: 10.237 },
    { alder: 27, maendFaktor: 10.165, kvinderFaktor: 10.213 },
    { alder: 28, maendFaktor: 10.136, kvinderFaktor: 10.188 },
    { alder: 29, maendFaktor: 10.104, kvinderFaktor: 10.16 },
    { alder: 30, maendFaktor: 10.07, kvinderFaktor: 10.129 },
    { alder: 31, maendFaktor: 10.034, kvinderFaktor: 10.096 },
    { alder: 32, maendFaktor: 9.994, kvinderFaktor: 10.06 },
    { alder: 33, maendFaktor: 9.951, kvinderFaktor: 10.021 },
    { alder: 34, maendFaktor: 9.905, kvinderFaktor: 9.979 },
    { alder: 35, maendFaktor: 9.855, kvinderFaktor: 9.933 },
    { alder: 36, maendFaktor: 9.801, kvinderFaktor: 9.883 },
    { alder: 37, maendFaktor: 9.742, kvinderFaktor: 9.829 },
    { alder: 38, maendFaktor: 9.679, kvinderFaktor: 9.771 },
    { alder: 39, maendFaktor: 9.611, kvinderFaktor: 9.707 },
    { alder: 40, maendFaktor: 9.537, kvinderFaktor: 9.638 },
    { alder: 41, maendFaktor: 9.457, kvinderFaktor: 9.563 },
    { alder: 42, maendFaktor: 9.371, kvinderFaktor: 9.481 },
    { alder: 43, maendFaktor: 9.278, kvinderFaktor: 9.393 },
    { alder: 44, maendFaktor: 9.177, kvinderFaktor: 9.297 },
    { alder: 45, maendFaktor: 9.069, kvinderFaktor: 9.192 },
    { alder: 46, maendFaktor: 8.952, kvinderFaktor: 9.079 },
    { alder: 47, maendFaktor: 8.825, kvinderFaktor: 8.956 },
    { alder: 48, maendFaktor: 8.688, kvinderFaktor: 8.823 },
    { alder: 49, maendFaktor: 8.54, kvinderFaktor: 8.677 },
    { alder: 50, maendFaktor: 8.381, kvinderFaktor: 8.52 },
    { alder: 51, maendFaktor: 8.208, kvinderFaktor: 8.348 },
    { alder: 52, maendFaktor: 8.02, kvinderFaktor: 8.162 },
    { alder: 53, maendFaktor: 7.818, kvinderFaktor: 7.959 },
    { alder: 54, maendFaktor: 7.598, kvinderFaktor: 7.738 },
    { alder: 55, maendFaktor: 7.36, kvinderFaktor: 7.497 },
    { alder: 56, maendFaktor: 7.101, kvinderFaktor: 7.235 },
    { alder: 57, maendFaktor: 6.82, kvinderFaktor: 6.948 },
    { alder: 58, maendFaktor: 6.513, kvinderFaktor: 6.636 },
    { alder: 59, maendFaktor: 6.18, kvinderFaktor: 6.294 },
    { alder: 60, maendFaktor: 5.815, kvinderFaktor: 5.919 },
    { alder: 61, maendFaktor: 5.416, kvinderFaktor: 5.508 },
    { alder: 62, maendFaktor: 4.978, kvinderFaktor: 5.057 },
    { alder: 63, maendFaktor: 4.497, kvinderFaktor: 4.561 },
    { alder: 64, maendFaktor: 3.966, kvinderFaktor: 4.015 },
    { alder: 65, maendFaktor: 3.379, kvinderFaktor: 3.411 },
    { alder: 66, maendFaktor: 2.727, kvinderFaktor: 2.742 }
  ]
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = 
{
  D: [
    { alder: 18, faktorerPraHeleAar: [0.957, 1.827, 2.618, 3.336, 3.989, 4.582, 5.12, 5.61, 6.054, 6.458] },
    { alder: 20, faktorerPraHeleAar: [0.957, 1.827, 2.618, 3.336, 3.988, 4.581, 5.12, 5.609, 6.053, 6.457] },
    { alder: 25, faktorerPraHeleAar: [0.957, 1.827, 2.617, 3.335, 3.987, 4.579, 5.117, 5.605, 6.048, 6.451] },
    { alder: 30, faktorerPraHeleAar: [0.957, 1.827, 2.616, 3.333, 3.984, 4.575, 5.112, 5.599, 6.041, 6.442] },
    { alder: 35, faktorerPraHeleAar: [0.957, 1.826, 2.615, 3.33, 3.98, 4.569, 5.104, 5.589, 6.029, 6.427] },
    { alder: 40, faktorerPraHeleAar: [0.957, 1.825, 2.612, 3.326, 3.973, 4.56, 5.091, 5.573, 6.009, 6.404] },
    { alder: 45, faktorerPraHeleAar: [0.956, 1.823, 2.608, 3.319, 3.962, 4.544, 5.071, 5.547, 5.977, 6.366] },
    { alder: 50, faktorerPraHeleAar: [0.956, 1.82, 2.061, 3.307, 3.944, 4.52, 5.038, 5.506, 5.927, 6.305] },
    { alder: 51, faktorerPraHeleAar: [0.955, 1.819, 2.599, 3.304, 3.94, 4.513, 5.03, 5.495, 5.913, 6.289] },
    { alder: 52, faktorerPraHeleAar: [0.955, 1.818, 2.597, 3.301, 3.935, 4.506, 5.02, 5.483, 5.899, 6.271] },
    { alder: 53, faktorerPraHeleAar: [0.955, 1.817, 2.595, 3.297, 3.929, 4.498, 5.01, 5.47, 5.882, 6.252] },
    { alder: 54, faktorerPraHeleAar: [0.955, 1.816, 2.593, 3.293, 3.923, 4.49, 4.999, 5.455, 5.865, 6.231] },
    { alder: 55, faktorerPraHeleAar: [0.954, 1.815, 2.59, 3.288, 3.916, 4.48, 4.986, 5.44, 5.846, 6.208] },
    { alder: 56, faktorerPraHeleAar: [0.954, 1.814, 2.587, 3.283, 3.909, 4.47, 4.972, 5.422, 5.824, 6.183] },
    { alder: 57, faktorerPraHeleAar: [0.954, 1.812, 2.584, 3.278, 3.9, 4.458, 4.957, 5.403, 5.801, 6.155] },
    { alder: 58, faktorerPraHeleAar: [0.953, 1.811, 2.581, 3.272, 3.891, 4.446, 4.941, 5.383, 5.776] },
    { alder: 59, faktorerPraHeleAar: [0.953, 1.809, 2.577, 3.265, 3.881, 4.432, 4.923, 5.36] },
    { alder: 60, faktorerPraHeleAar: [0.952, 1.807, 2.573, 3.258, 3.871, 4.417, 4.903] },
    { alder: 61, faktorerPraHeleAar: [0.952, 1.805, 2.568, 3.25, 3.859, 4.4] },
    { alder: 62, faktorerPraHeleAar: [0.951, 1.803, 2.563, 3.242, 3.846] },
    { alder: 63, faktorerPraHeleAar: [0.951, 1.8, 2.558, 3.232] },
    { alder: 64, faktorerPraHeleAar: [0.95, 1.797, 2.552] },
    { alder: 65, faktorerPraHeleAar: [0.949, 1.794] },
    { alder: 66, faktorerPraHeleAar: [0.948] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = 
{
  E: [
    { alder: 18, faktorerPraHeleAar: [0.957, 1.828, 2.619, 3.337, 3.989, 4.583, 5.122, 5.611, 6.056, 6.461] },
    { alder: 20, faktorerPraHeleAar: [0.957, 1.828, 2.618, 3.336, 3.989, 4.582, 5.121, 5.611, 6.056, 6.46] },
    { alder: 25, faktorerPraHeleAar: [0.957, 1.827, 2.618, 3.336, 3.988, 4.581, 5.119, 5.608, 6.052, 6.456] },
    { alder: 30, faktorerPraHeleAar: [0.957, 1.827, 2.617, 3.335, 3.986, 4.578, 5.116, 5.604, 6.047, 6.45] },
    { alder: 35, faktorerPraHeleAar: [0.957, 1.826, 2.616, 3.333, 3.983, 4.574, 5.111, 5.597, 6.039, 6.44] },
    { alder: 40, faktorerPraHeleAar: [0.957, 1.826, 2.614, 3.33, 3.979, 4.568, 5.102, 5.586, 6.026, 6.424] },
    { alder: 45, faktorerPraHeleAar: [0.957, 1.824, 2.611, 3.325, 3.971, 4.557, 5.088, 5.569, 6.004, 6.398] },
    { alder: 50, faktorerPraHeleAar: [0.956, 1.822, 2.607, 3.317, 3.959, 4.54, 5.066, 5.54, 5.969, 6.356] },
    { alder: 51, faktorerPraHeleAar: [0.956, 1.822, 2.606, 3.315, 3.956, 4.536, 5.06, 5.533, 5.96, 6.345] },
    { alder: 52, faktorerPraHeleAar: [0.956, 1.821, 2.604, 3.312, 3.953, 4.531, 5.053, 5.525, 5.95, 6.333] },
    { alder: 53, faktorerPraHeleAar: [0.956, 1.821, 2.603, 3.31, 3.949, 4.526, 5.046, 5.516, 5.939, 6.319] },
    { alder: 54, faktorerPraHeleAar: [0.956, 1.82, 2.601, 3.307, 3.944, 4.52, 5.038, 5.506, 5.927, 6.305] },
    { alder: 55, faktorerPraHeleAar: [0.955, 1.819, 2.599, 3.304, 3.94, 4.513, 5.03, 5.495, 5.913, 6.289] },
    { alder: 56, faktorerPraHeleAar: [0.955, 1.818, 2.597, 3.301, 3.935, 4.506, 5.02, 5.483, 5.899, 6.271] },
    { alder: 57, faktorerPraHeleAar: [0.955, 1.817, 2.595, 3.297, 3.929, 4.498, 5.01, 5.47, 5.882, 6.252] },
    { alder: 58, faktorerPraHeleAar: [0.955, 1.816, 2.593, 3.293, 3.923, 4.49, 4.999, 5.455, 5.865] },
    { alder: 59, faktorerPraHeleAar: [0.954, 1.815, 2.59, 3.288, 3.916, 4.48, 4.986, 5.44] },
    { alder: 60, faktorerPraHeleAar: [0.954, 1.814, 2.587, 3.283, 3.909, 4.47, 4.972] },
    { alder: 61, faktorerPraHeleAar: [0.954, 1.812, 2.584, 3.278, 3.9, 4.458] },
    { alder: 62, faktorerPraHeleAar: [0.953, 1.811, 2.581, 3.272, 3.891] },
    { alder: 63, faktorerPraHeleAar: [0.953, 1.809, 2.577, 3.265] },
    { alder: 64, faktorerPraHeleAar: [0.952, 1.807, 2.573] },
    { alder: 65, faktorerPraHeleAar: [0.952, 1.805] },
    { alder: 66, faktorerPraHeleAar: [0.951] }
  ]
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

// Undtagelse: Kilden angiver kun kønsopdelte afløsningstabeller.
// Risiko: Data går tabt ved sammenfletning til kønsneutral struktur.
// Revurder hvis en fælles canonical model for kønsopdelt afløsning indføres.
export const forsoergertabAfloesningsTabellerKoensopdelt = 
{
  F: [
    { alder: 55, maendFaktor: 1.363, kvinderFaktor: 1.417 },
    { alder: 56, maendFaktor: 1.511, kvinderFaktor: 1.567 },
    { alder: 57, maendFaktor: 1.677, kvinderFaktor: 1.734 },
    { alder: 58, maendFaktor: 1.861, kvinderFaktor: 1.919 },
    { alder: 59, maendFaktor: 2.069, kvinderFaktor: 2.127 },
    { alder: 60, maendFaktor: 2.301, kvinderFaktor: 2.357 },
    { alder: 61, maendFaktor: 2.564, kvinderFaktor: 2.616 },
    { alder: 62, maendFaktor: 2.859, kvinderFaktor: 2.904 },
    { alder: 63, maendFaktor: 3.193, kvinderFaktor: 3.228 },
    { alder: 64, maendFaktor: 3.571, kvinderFaktor: 3.592 }
  ],
  G: [
    { alder: 57, maendFaktor: 0.664, kvinderFaktor: 0.696 },
    { alder: 58, maendFaktor: 0.738, kvinderFaktor: 0.771 },
    { alder: 59, maendFaktor: 0.82, kvinderFaktor: 0.854 },
    { alder: 60, maendFaktor: 0.912, kvinderFaktor: 0.947 },
    { alder: 61, maendFaktor: 1.016, kvinderFaktor: 1.05 },
    { alder: 62, maendFaktor: 1.133, kvinderFaktor: 1.166 },
    { alder: 63, maendFaktor: 1.265, kvinderFaktor: 1.296 },
    { alder: 64, maendFaktor: 1.415, kvinderFaktor: 1.442 },
    { alder: 65, maendFaktor: 1.585, kvinderFaktor: 1.606 },
    { alder: 66, maendFaktor: 1.778, kvinderFaktor: 1.791 }
  ]
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;
