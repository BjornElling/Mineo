import type {
  AldersFaktorRaekke,
  AldersKoensopdeltFaktorRaekke,
  ForsoergertabMatrixRaekke,
  RaaErhvervsevnetabTabelvalg,
  RaaForsoergertabTabelvalg,
  RaaSaerfaktor,
  UdeladelsesGrund,
} from '.';

export const kapitaliseringsId = '1202/2013' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb i 2014 efter lov om arbejdsskadesikring for ulykker indtrådt og for erhvervssygdomme anmeldt den 1. januar 2011 eller senere' as const;
export const kapitaliseringsDatering = '10/10/2013' as const;
export const gyldigFra = '2014-01-01';
export const gyldigTil = '2014-12-31';
export const supplerendeKildePdfFiler = ['Bkg. 1339 2013.pdf'] as const;

// Udtrukket maskinelt fra Bkg. 1202 2013.pdf og Bkg. 1339 2013.pdf og kontrolleret tal for tal mod kilden.
// Registret rummer præcis de tabeller, et tabelvalg kan pege på; kildens øvrige tabeller står i
// `udeladteKildetabeller` med begrundelse, så ingen udeladelse er tavs.
// Bilag 1 er affattet på ny ved BEK nr. 1339 af 28/11/2013 (i kraft 1/1-2014), der tilføjer
// forsørgertabstabellerne F og G; tabel A-E er uændrede. F og G er udtrukket fra den PDF.
// Særfaktoren står med fire decimaler («1,2514») og registreres som skrevet (udviklerens afgørelse
// 2026-11-12). BEK nr. 229 af 12/03/2014 retter den til 1,251 fra 15/3-2014 – se 229-2014.ts.

export const kildetabeller = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

export const udeladteKildetabeller = {} as const satisfies Readonly<Record<string, UdeladelsesGrund>>;

export const erhvervsevnetabTabelvalg = [
  { skadedatoFra: '2011-01-01', foedselsdatoFra: '1955-07-01', foedselsdatoTil: null, tabel: 'A' },
  { skadedatoFra: '2011-01-01', foedselsdatoFra: '1955-01-01', foedselsdatoTil: '1955-06-30', tabel: 'B' },
  { skadedatoFra: '2011-01-01', foedselsdatoFra: '1954-07-01', foedselsdatoTil: '1954-12-31', tabel: 'C' },
  { skadedatoFra: '2011-01-01', foedselsdatoFra: '1954-01-01', foedselsdatoTil: '1954-06-30', tabel: 'D' },
  { skadedatoFra: '2011-01-01', foedselsdatoFra: '1900-01-01', foedselsdatoTil: '1953-12-31', tabel: 'E' },
] as const satisfies readonly RaaErhvervsevnetabTabelvalg[];

export const forsoergertabTabelvalg = [
  { skadedatoFra: '2011-01-01', tabelMaend: 'F', tabelKvinder: 'G' },
] as const satisfies readonly RaaForsoergertabTabelvalg[];

// Faktoren for tilskadekomne, der er 2 år eller mindre fra folkepensionsalderen eller har nået den.
export const saerfaktorUnderToAarTilFp = [
  { skadedatoFra: '2011-01-01', faktor: 1.2514 },
] as const satisfies readonly RaaSaerfaktor[];

export const erhvervsevnetabTabeller = {} as const satisfies Readonly<Record<string, readonly AldersFaktorRaekke[]>>;

export const erhvervsevnetabKoensopdelteTabeller = {
  A: [
    { alder: 5, maendFaktor: 30.547, kvinderFaktor: 30.939 },
    { alder: 6, maendFaktor: 30.122, kvinderFaktor: 30.516 },
    { alder: 7, maendFaktor: 29.694, kvinderFaktor: 30.089 },
    { alder: 8, maendFaktor: 29.264, kvinderFaktor: 29.661 },
    { alder: 9, maendFaktor: 28.831, kvinderFaktor: 29.229 },
    { alder: 10, maendFaktor: 28.396, kvinderFaktor: 28.795 },
    { alder: 11, maendFaktor: 27.959, kvinderFaktor: 28.359 },
    { alder: 12, maendFaktor: 27.519, kvinderFaktor: 27.92 },
    { alder: 13, maendFaktor: 27.076, kvinderFaktor: 27.478 },
    { alder: 14, maendFaktor: 26.631, kvinderFaktor: 27.034 },
    { alder: 15, maendFaktor: 26.184, kvinderFaktor: 26.587 },
    { alder: 16, maendFaktor: 25.734, kvinderFaktor: 26.138 },
    { alder: 17, maendFaktor: 25.282, kvinderFaktor: 25.686 },
    { alder: 18, maendFaktor: 24.828, kvinderFaktor: 25.232 },
    { alder: 19, maendFaktor: 24.371, kvinderFaktor: 24.775 },
    { alder: 20, maendFaktor: 23.912, kvinderFaktor: 24.316 },
    { alder: 21, maendFaktor: 23.451, kvinderFaktor: 23.854 },
    { alder: 22, maendFaktor: 22.987, kvinderFaktor: 23.39 },
    { alder: 23, maendFaktor: 22.522, kvinderFaktor: 22.924 },
    { alder: 24, maendFaktor: 22.054, kvinderFaktor: 22.455 },
    { alder: 25, maendFaktor: 21.584, kvinderFaktor: 21.983 },
    { alder: 26, maendFaktor: 21.112, kvinderFaktor: 21.509 },
    { alder: 27, maendFaktor: 20.638, kvinderFaktor: 21.033 },
    { alder: 28, maendFaktor: 20.161, kvinderFaktor: 20.555 },
    { alder: 29, maendFaktor: 19.683, kvinderFaktor: 20.074 },
    { alder: 30, maendFaktor: 19.203, kvinderFaktor: 19.591 },
    { alder: 31, maendFaktor: 18.721, kvinderFaktor: 19.106 },
    { alder: 32, maendFaktor: 18.237, kvinderFaktor: 18.618 },
    { alder: 33, maendFaktor: 17.752, kvinderFaktor: 18.129 },
    { alder: 34, maendFaktor: 17.265, kvinderFaktor: 17.637 },
    { alder: 35, maendFaktor: 16.776, kvinderFaktor: 17.143 },
    { alder: 36, maendFaktor: 16.285, kvinderFaktor: 16.647 },
    { alder: 37, maendFaktor: 15.793, kvinderFaktor: 16.149 },
    { alder: 38, maendFaktor: 15.3, kvinderFaktor: 15.649 },
    { alder: 39, maendFaktor: 14.805, kvinderFaktor: 15.147 },
    { alder: 40, maendFaktor: 14.309, kvinderFaktor: 14.644 },
    { alder: 41, maendFaktor: 13.811, kvinderFaktor: 14.138 },
    { alder: 42, maendFaktor: 13.312, kvinderFaktor: 13.63 },
    { alder: 43, maendFaktor: 12.812, kvinderFaktor: 13.121 },
    { alder: 44, maendFaktor: 12.311, kvinderFaktor: 12.609 },
    { alder: 45, maendFaktor: 11.808, kvinderFaktor: 12.096 },
    { alder: 46, maendFaktor: 11.304, kvinderFaktor: 11.581 },
    { alder: 47, maendFaktor: 10.799, kvinderFaktor: 11.064 },
    { alder: 48, maendFaktor: 10.293, kvinderFaktor: 10.546 },
    { alder: 49, maendFaktor: 9.786, kvinderFaktor: 10.025 },
    { alder: 50, maendFaktor: 9.277, kvinderFaktor: 9.502 },
    { alder: 51, maendFaktor: 8.766, kvinderFaktor: 8.977 },
    { alder: 52, maendFaktor: 8.254, kvinderFaktor: 8.45 },
    { alder: 53, maendFaktor: 7.74, kvinderFaktor: 7.921 },
    { alder: 54, maendFaktor: 7.224, kvinderFaktor: 7.389 },
    { alder: 55, maendFaktor: 6.706, kvinderFaktor: 6.854 },
    { alder: 56, maendFaktor: 6.184, kvinderFaktor: 6.317 },
    { alder: 57, maendFaktor: 5.66, kvinderFaktor: 5.775 },
    { alder: 58, maendFaktor: 5.132, kvinderFaktor: 5.23 },
    { alder: 59, maendFaktor: 4.599, kvinderFaktor: 4.681 },
    { alder: 60, maendFaktor: 4.061, kvinderFaktor: 4.126 },
  ],
  B: [
    { alder: 58, maendFaktor: 4.877, kvinderFaktor: 4.964 },
    { alder: 59, maendFaktor: 4.339, kvinderFaktor: 4.41 },
    { alder: 60, maendFaktor: 3.796, kvinderFaktor: 3.851 },
  ],
  C: [
    { alder: 59, maendFaktor: 4.079, kvinderFaktor: 4.14 },
    { alder: 60, maendFaktor: 3.531, kvinderFaktor: 3.576 },
    { alder: 61, maendFaktor: 2.975, kvinderFaktor: 3.007 },
  ],
  D: [
    { alder: 59, maendFaktor: 3.811, kvinderFaktor: 3.863 },
    { alder: 60, maendFaktor: 3.257, kvinderFaktor: 3.295 },
    { alder: 61, maendFaktor: 2.696, kvinderFaktor: 2.721 },
  ],
  E: [
    { alder: 60, maendFaktor: 2.984, kvinderFaktor: 3.013 },
    { alder: 61, maendFaktor: 2.416, kvinderFaktor: 2.434 },
    { alder: 62, maendFaktor: 1.839, kvinderFaktor: 1.847 },
  ],
} as const satisfies Readonly<Record<string, readonly AldersKoensopdeltFaktorRaekke[]>>;

export const forsoergertabTabeller = {} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;

export const forsoergertabTabellerMaend = {
  F: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.243, 1.857, 2.468, 3.075, 3.677, 4.274, 4.868, 5.457, 6.042] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.243, 1.857, 2.468, 3.074, 3.676, 4.274, 4.867, 5.456, 6.041] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.243, 1.857, 2.468, 3.074, 3.676, 4.273, 4.866, 5.455, 6.04] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.468, 3.074, 3.675, 4.272, 4.865, 5.454, 6.038] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.467, 3.073, 3.675, 4.272, 4.864, 5.453, 6.036] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.467, 3.073, 3.674, 4.271, 4.863, 5.451, 6.034] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.467, 3.072, 3.673, 4.27, 4.862, 5.449, 6.032] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.466, 3.072, 3.673, 4.269, 4.861, 5.448, 6.03] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.466, 3.071, 3.672, 4.268, 4.859, 5.446, 6.027] },
    { alder: 27, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.466, 3.071, 3.671, 4.267, 4.857, 5.443, 6.025] },
    { alder: 28, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.465, 3.07, 3.67, 4.265, 4.856, 5.441, 6.022] },
    { alder: 29, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.465, 3.069, 3.669, 4.264, 4.854, 5.439, 6.019] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.242, 1.855, 2.464, 3.069, 3.668, 4.262, 4.852, 5.436, 6.015] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.242, 1.855, 2.464, 3.068, 3.667, 4.26, 4.849, 5.433, 6.011] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.241, 1.855, 2.463, 3.067, 3.665, 4.259, 4.847, 5.429, 6.007] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.241, 1.855, 2.463, 3.066, 3.664, 4.256, 4.844, 5.426, 6.002] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.241, 1.854, 2.462, 3.065, 3.662, 4.254, 4.841, 5.422, 5.997] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.241, 1.854, 2.461, 3.064, 3.66, 4.252, 4.838, 5.418, 5.992] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.062, 3.659, 4.249, 4.834, 5.413, 5.986] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.656, 4.246, 4.83, 5.408, 5.98] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.059, 3.654, 4.243, 4.826, 5.402, 5.973] },
    { alder: 39, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.058, 3.652, 4.24, 4.821, 5.396, 5.965] },
    { alder: 40, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.056, 3.649, 4.236, 4.816, 5.39, 5.957] },
    { alder: 41, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.455, 3.054, 3.646, 4.232, 4.811, 5.383, 5.948] },
    { alder: 42, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.052, 3.643, 4.227, 4.805, 5.375, 5.938] },
    { alder: 43, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.452, 3.049, 3.639, 4.222, 4.798, 5.366, 5.927] },
    { alder: 44, faktorerPraHeleAar: [0.623, 1.239, 1.848, 2.451, 3.047, 3.636, 4.217, 4.791, 5.357, 5.915] },
    { alder: 45, faktorerPraHeleAar: [0.622, 1.238, 1.847, 2.449, 3.044, 3.631, 4.211, 4.783, 5.347, 5.903] },
    { alder: 46, faktorerPraHeleAar: [0.622, 1.238, 1.846, 2.447, 3.041, 3.627, 4.205, 4.775, 5.336, 5.889] },
    { alder: 47, faktorerPraHeleAar: [0.622, 1.237, 1.845, 2.445, 3.038, 3.622, 4.198, 4.766, 5.324, 5.874] },
    { alder: 48, faktorerPraHeleAar: [0.622, 1.237, 1.844, 2.443, 3.034, 3.617, 4.191, 4.756, 5.311, 5.857] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.236, 1.842, 2.44, 3.03, 3.611, 4.182, 4.745, 5.297, 5.839] },
    { alder: 50, faktorerPraHeleAar: [0.622, 1.236, 1.841, 2.438, 3.026, 3.604, 4.174, 4.733, 5.282, 5.82] },
    { alder: 51, faktorerPraHeleAar: [0.622, 1.235, 1.839, 2.435, 3.021, 3.597, 4.164, 4.72, 5.265, 5.799] },
    { alder: 52, faktorerPraHeleAar: [0.621, 1.234, 1.838, 2.432, 3.016, 3.59, 4.153, 4.706, 5.247, 5.776] },
    { alder: 53, faktorerPraHeleAar: [0.621, 1.233, 1.836, 2.428, 3.01, 3.582, 4.142, 4.691, 5.227, 5.752] },
    { alder: 54, faktorerPraHeleAar: [0.621, 1.232, 1.834, 2.424, 3.004, 3.573, 4.13, 4.674, 5.206, 5.725] },
    { alder: 55, faktorerPraHeleAar: [0.621, 1.231, 1.831, 2.42, 2.998, 3.563, 4.116, 4.656, 5.183, 5.696] },
    { alder: 56, faktorerPraHeleAar: [0.621, 1.23, 1.829, 2.416, 2.99, 3.553, 4.102, 4.637, 5.158, 5.664] },
    { alder: 57, faktorerPraHeleAar: [0.62, 1.229, 1.826, 2.411, 2.983, 3.541, 4.086, 4.616, 5.131, 5.63] },
    { alder: 58, faktorerPraHeleAar: [0.62, 1.228, 1.823, 2.406, 2.974, 3.529, 4.068, 4.593, 5.101] },
    { alder: 59, faktorerPraHeleAar: [0.62, 1.227, 1.82, 2.4, 2.965, 3.515, 4.05, 4.568] },
    { alder: 60, faktorerPraHeleAar: [0.619, 1.225, 1.817, 2.393, 2.955, 3.501] },
    { alder: 61, faktorerPraHeleAar: [0.619, 1.223, 1.813, 2.387] },
    { alder: 62, faktorerPraHeleAar: [0.619, 1.222, 1.809] },
    { alder: 63, faktorerPraHeleAar: [0.618, 1.22] },
    { alder: 64, faktorerPraHeleAar: [0.618] },
  ],
} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;

export const forsoergertabTabellerKvinder = {
  G: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.243, 1.858, 2.469, 3.075, 3.678, 4.276, 4.871, 5.461, 6.047] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.243, 1.858, 2.469, 3.075, 3.678, 4.276, 4.87, 5.46, 6.046] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.243, 1.858, 2.468, 3.075, 3.677, 4.276, 4.869, 5.459, 6.045] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.243, 1.858, 2.468, 3.075, 3.677, 4.275, 4.869, 5.458, 6.044] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.243, 1.857, 2.468, 3.075, 3.677, 4.274, 4.868, 5.457, 6.042] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.243, 1.857, 2.468, 3.074, 3.676, 4.274, 4.867, 5.456, 6.041] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.243, 1.857, 2.468, 3.074, 3.676, 4.273, 4.866, 5.455, 6.04] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.468, 3.074, 3.675, 4.272, 4.865, 5.454, 6.038] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.467, 3.073, 3.675, 4.272, 4.864, 5.453, 6.036] },
    { alder: 27, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.467, 3.073, 3.674, 4.271, 4.863, 5.451, 6.034] },
    { alder: 28, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.467, 3.072, 3.673, 4.27, 4.862, 5.449, 6.032] },
    { alder: 29, faktorerPraHeleAar: [0.623, 1.242, 1.857, 2.466, 3.072, 3.673, 4.269, 4.861, 5.448, 6.03] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.466, 3.071, 3.672, 4.268, 4.859, 5.446, 6.027] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.466, 3.071, 3.671, 4.267, 4.857, 5.443, 6.025] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.465, 3.07, 3.67, 4.265, 4.856, 5.441, 6.022] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.242, 1.856, 2.465, 3.069, 3.669, 4.264, 4.854, 5.439, 6.019] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.242, 1.855, 2.464, 3.069, 3.668, 4.262, 4.852, 5.436, 6.015] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.242, 1.855, 2.464, 3.068, 3.667, 4.26, 4.849, 5.433, 6.011] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.241, 1.855, 2.463, 3.067, 3.665, 4.259, 4.847, 5.429, 6.007] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.241, 1.855, 2.463, 3.066, 3.664, 4.256, 4.844, 5.426, 6.002] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.241, 1.854, 2.462, 3.065, 3.662, 4.254, 4.841, 5.422, 5.997] },
    { alder: 39, faktorerPraHeleAar: [0.623, 1.241, 1.854, 2.461, 3.064, 3.66, 4.252, 4.838, 5.418, 5.992] },
    { alder: 40, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.461, 3.062, 3.659, 4.249, 4.834, 5.413, 5.986] },
    { alder: 41, faktorerPraHeleAar: [0.623, 1.241, 1.853, 2.46, 3.061, 3.656, 4.246, 4.83, 5.408, 5.98] },
    { alder: 42, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.459, 3.059, 3.654, 4.243, 4.826, 5.402, 5.973] },
    { alder: 43, faktorerPraHeleAar: [0.623, 1.24, 1.852, 2.458, 3.058, 3.652, 4.24, 4.821, 5.396, 5.965] },
    { alder: 44, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.457, 3.056, 3.649, 4.236, 4.816, 5.39, 5.957] },
    { alder: 45, faktorerPraHeleAar: [0.623, 1.24, 1.851, 2.455, 3.054, 3.646, 4.232, 4.811, 5.383, 5.948] },
    { alder: 46, faktorerPraHeleAar: [0.623, 1.239, 1.85, 2.454, 3.052, 3.643, 4.227, 4.805, 5.375, 5.938] },
    { alder: 47, faktorerPraHeleAar: [0.623, 1.239, 1.849, 2.452, 3.049, 3.639, 4.222, 4.798, 5.366, 5.927] },
    { alder: 48, faktorerPraHeleAar: [0.623, 1.239, 1.848, 2.451, 3.047, 3.636, 4.217, 4.791, 5.357, 5.915] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.238, 1.847, 2.449, 3.044, 3.631, 4.211, 4.783, 5.347, 5.903] },
    { alder: 50, faktorerPraHeleAar: [0.622, 1.238, 1.846, 2.447, 3.041, 3.627, 4.205, 4.775, 5.336, 5.889] },
    { alder: 51, faktorerPraHeleAar: [0.622, 1.237, 1.845, 2.445, 3.038, 3.622, 4.198, 4.766, 5.324, 5.874] },
    { alder: 52, faktorerPraHeleAar: [0.622, 1.237, 1.844, 2.443, 3.034, 3.617, 4.191, 4.756, 5.311, 5.857] },
    { alder: 53, faktorerPraHeleAar: [0.622, 1.236, 1.842, 2.44, 3.03, 3.611, 4.182, 4.745, 5.297, 5.839] },
    { alder: 54, faktorerPraHeleAar: [0.622, 1.236, 1.841, 2.438, 3.026, 3.604, 4.174, 4.733, 5.282, 5.82] },
    { alder: 55, faktorerPraHeleAar: [0.622, 1.235, 1.839, 2.435, 3.021, 3.597, 4.164, 4.72, 5.265, 5.799] },
    { alder: 56, faktorerPraHeleAar: [0.621, 1.234, 1.838, 2.432, 3.016, 3.59, 4.153, 4.706, 5.247, 5.776] },
    { alder: 57, faktorerPraHeleAar: [0.621, 1.233, 1.836, 2.428, 3.01, 3.582, 4.142, 4.691, 5.227, 5.752] },
    { alder: 58, faktorerPraHeleAar: [0.621, 1.232, 1.834, 2.424, 3.004, 3.573, 4.13, 4.674, 5.206] },
    { alder: 59, faktorerPraHeleAar: [0.621, 1.231, 1.831, 2.42, 2.998, 3.563, 4.116, 4.656] },
    { alder: 60, faktorerPraHeleAar: [0.621, 1.23, 1.829, 2.416, 2.99, 3.553] },
    { alder: 61, faktorerPraHeleAar: [0.62, 1.229, 1.826, 2.411] },
    { alder: 62, faktorerPraHeleAar: [0.62, 1.228, 1.823] },
    { alder: 63, faktorerPraHeleAar: [0.62, 1.227] },
    { alder: 64, faktorerPraHeleAar: [0.619] },
  ],
} as const satisfies Readonly<Record<string, readonly ForsoergertabMatrixRaekke[]>>;
