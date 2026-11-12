import type {
  AldersFaktorRaekke,
  AldersKoensopdeltFaktorRaekke,
  ForsoergertabMatrixRaekke,
  RaaErhvervsevnetabTabelvalg,
  RaaForsoergertabTabelvalg,
  RaaSaerfaktor,
  UdeladelsesGrund,
} from '.';

export const kapitaliseringsId = '1068/2003' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb' as const;
export const kapitaliseringsDatering = '11/12/2003' as const;
export const gyldigFra = '2004-01-01';
export const gyldigTil = '2009-06-30';
export const supplerendeKildePdfFiler = [] as const;

// Udtrukket maskinelt fra Bkg. 1068 2003.pdf og kontrolleret tal for tal mod kilden.
// Registret rummer præcis de tabeller, et tabelvalg kan pege på; kildens øvrige tabeller står i
// `udeladteKildetabeller` med begrundelse, så ingen udeladelse er tavs.
// Tabel A gælder løbende ydelser efter lov om arbejdsskadesikring (skader fra 1. januar 2004).
// Tabel D og E angiver kun udvalgte aldre (18, 20, 25, ..., 50-66); § 3 foreskriver mellemliggende faktorer.
// Tabel D, alder 50, 3 år står i kilden som 2,061 (naboerne 2,608 og 2,599) – en åbenlys slåfejl for 2,601.
// Udviklerbeslutning 2026-11-12: værdien er rettet til 2,601. Rettelsen meddeles ikke i brugerfladen
// eller i de genererede dokumenter.

export const kildetabeller = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

export const udeladteKildetabeller = {
  B: 'skader-foer-2004', // lov om sikring mod følger af arbejdsskade (skader før 2004)
  C: 'skader-foer-2004', // lov om sikring mod følger af arbejdsskade (skader før 2004)
  F: 'afloesningsbeloeb', // afløsningsbeløb efter lov om sikring mod følger af arbejdsskade
  G: 'afloesningsbeloeb', // afløsningsbeløb efter lov om sikring mod følger af arbejdsskade
  H: 'varigt-men', // varigt mén
} as const satisfies Readonly<Record<string, UdeladelsesGrund>>;

export const erhvervsevnetabTabelvalg = [
  { skadedatoFra: '2004-01-01', foedselsdatoFra: '1900-01-01', foedselsdatoTil: null, tabel: 'A' },
] as const satisfies readonly RaaErhvervsevnetabTabelvalg[];

export const forsoergertabTabelvalg = [
  { skadedatoFra: '2004-01-01', tabelMaend: 'D', tabelKvinder: 'E' },
] as const satisfies readonly RaaForsoergertabTabelvalg[];

// Kilden angiver ingen særfaktor; den findes først for skader fra 1. juli 2007.
export const saerfaktorUnderToAarTilFp = [
] as const satisfies readonly RaaSaerfaktor[];

export const erhvervsevnetabTabeller = {} as const satisfies Readonly<Record<string, readonly AldersFaktorRaekke[]>>;

export const erhvervsevnetabKoensopdelteTabeller = {
  A: [
    { alder: 5, maendFaktor: 10.443, kvinderFaktor: 10.453 },
    { alder: 6, maendFaktor: 10.437, kvinderFaktor: 10.448 },
    { alder: 7, maendFaktor: 10.431, kvinderFaktor: 10.442 },
    { alder: 8, maendFaktor: 10.425, kvinderFaktor: 10.436 },
    { alder: 9, maendFaktor: 10.417, kvinderFaktor: 10.43 },
    { alder: 10, maendFaktor: 10.409, kvinderFaktor: 10.423 },
    { alder: 11, maendFaktor: 10.401, kvinderFaktor: 10.415 },
    { alder: 12, maendFaktor: 10.391, kvinderFaktor: 10.407 },
    { alder: 13, maendFaktor: 10.381, kvinderFaktor: 10.398 },
    { alder: 14, maendFaktor: 10.37, kvinderFaktor: 10.388 },
    { alder: 15, maendFaktor: 10.357, kvinderFaktor: 10.377 },
    { alder: 16, maendFaktor: 10.344, kvinderFaktor: 10.365 },
    { alder: 17, maendFaktor: 10.33, kvinderFaktor: 10.352 },
    { alder: 18, maendFaktor: 10.314, kvinderFaktor: 10.338 },
    { alder: 19, maendFaktor: 10.297, kvinderFaktor: 10.323 },
    { alder: 20, maendFaktor: 10.279, kvinderFaktor: 10.306 },
    { alder: 21, maendFaktor: 10.259, kvinderFaktor: 10.288 },
    { alder: 22, maendFaktor: 10.237, kvinderFaktor: 10.269 },
    { alder: 23, maendFaktor: 10.213, kvinderFaktor: 10.247 },
    { alder: 24, maendFaktor: 10.187, kvinderFaktor: 10.223 },
    { alder: 25, maendFaktor: 10.159, kvinderFaktor: 10.198 },
    { alder: 26, maendFaktor: 10.129, kvinderFaktor: 10.17 },
    { alder: 27, maendFaktor: 10.096, kvinderFaktor: 10.139 },
    { alder: 28, maendFaktor: 10.06, kvinderFaktor: 10.106 },
    { alder: 29, maendFaktor: 10.021, kvinderFaktor: 10.07 },
    { alder: 30, maendFaktor: 9.979, kvinderFaktor: 10.031 },
    { alder: 31, maendFaktor: 9.933, kvinderFaktor: 9.988 },
    { alder: 32, maendFaktor: 9.883, kvinderFaktor: 9.941 },
    { alder: 33, maendFaktor: 9.829, kvinderFaktor: 9.89 },
    { alder: 34, maendFaktor: 9.771, kvinderFaktor: 9.834 },
    { alder: 35, maendFaktor: 9.707, kvinderFaktor: 9.774 },
    { alder: 36, maendFaktor: 9.638, kvinderFaktor: 9.708 },
    { alder: 37, maendFaktor: 9.563, kvinderFaktor: 9.636 },
    { alder: 38, maendFaktor: 9.481, kvinderFaktor: 9.558 },
    { alder: 39, maendFaktor: 9.393, kvinderFaktor: 9.473 },
    { alder: 40, maendFaktor: 9.297, kvinderFaktor: 9.38 },
    { alder: 41, maendFaktor: 9.192, kvinderFaktor: 9.278 },
    { alder: 42, maendFaktor: 9.079, kvinderFaktor: 9.168 },
    { alder: 43, maendFaktor: 8.956, kvinderFaktor: 9.047 },
    { alder: 44, maendFaktor: 8.823, kvinderFaktor: 8.916 },
    { alder: 45, maendFaktor: 8.677, kvinderFaktor: 8.773 },
    { alder: 46, maendFaktor: 8.52, kvinderFaktor: 8.617 },
    { alder: 47, maendFaktor: 8.348, kvinderFaktor: 8.447 },
    { alder: 48, maendFaktor: 8.162, kvinderFaktor: 8.261 },
    { alder: 49, maendFaktor: 7.959, kvinderFaktor: 8.058 },
    { alder: 50, maendFaktor: 7.738, kvinderFaktor: 7.836 },
    { alder: 51, maendFaktor: 7.497, kvinderFaktor: 7.593 },
    { alder: 52, maendFaktor: 7.235, kvinderFaktor: 7.328 },
    { alder: 53, maendFaktor: 6.948, kvinderFaktor: 7.038 },
    { alder: 54, maendFaktor: 6.636, kvinderFaktor: 6.721 },
    { alder: 55, maendFaktor: 6.294, kvinderFaktor: 6.373 },
    { alder: 56, maendFaktor: 5.919, kvinderFaktor: 5.991 },
    { alder: 57, maendFaktor: 5.508, kvinderFaktor: 5.572 },
    { alder: 58, maendFaktor: 5.057, kvinderFaktor: 5.112 },
    { alder: 59, maendFaktor: 4.561, kvinderFaktor: 4.606 },
    { alder: 60, maendFaktor: 4.015, kvinderFaktor: 4.048 },
    { alder: 61, maendFaktor: 3.411, kvinderFaktor: 3.433 },
    { alder: 62, maendFaktor: 2.742, kvinderFaktor: 2.753 },
  ],
} as const satisfies Readonly<Record<string, readonly AldersKoensopdeltFaktorRaekke[]>>;

export const forsoergertabTabeller = {} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;

export const forsoergertabTabellerMaend = {
  D: [
    { alder: 18, faktorerPraHeleAar: [0.957, 1.827, 2.618, 3.336, 3.989, 4.582, 5.12, 5.61, 6.054, 6.458] },
    { alder: 20, faktorerPraHeleAar: [0.957, 1.827, 2.618, 3.336, 3.988, 4.581, 5.12, 5.609, 6.053, 6.457] },
    { alder: 25, faktorerPraHeleAar: [0.957, 1.827, 2.617, 3.335, 3.987, 4.579, 5.117, 5.605, 6.048, 6.451] },
    { alder: 30, faktorerPraHeleAar: [0.957, 1.827, 2.616, 3.333, 3.984, 4.575, 5.112, 5.599, 6.041, 6.442] },
    { alder: 35, faktorerPraHeleAar: [0.957, 1.826, 2.615, 3.33, 3.98, 4.569, 5.104, 5.589, 6.029, 6.427] },
    { alder: 40, faktorerPraHeleAar: [0.957, 1.825, 2.612, 3.326, 3.973, 4.56, 5.091, 5.573, 6.009, 6.404] },
    { alder: 45, faktorerPraHeleAar: [0.956, 1.823, 2.608, 3.319, 3.962, 4.544, 5.071, 5.547, 5.977, 6.366] },
    { alder: 50, faktorerPraHeleAar: [0.956, 1.82, 2.601, 3.307, 3.944, 4.52, 5.038, 5.506, 5.927, 6.305] },
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
    { alder: 66, faktorerPraHeleAar: [0.948] },
  ],
} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;

export const forsoergertabTabellerKvinder = {
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
    { alder: 66, faktorerPraHeleAar: [0.951] },
  ],
} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
