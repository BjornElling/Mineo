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

export const kapitaliseringsId = '1233/2018' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb efter lov om arbejdsskadesikring i 2019' as const;
export const kapitaliseringsDatering = '27/10/2018' as const;
export const gyldigFra = toISODateString('2019-01-01');
export const gyldigTil = toISODateString('2019-12-31');

// Udtrukket fra BEK nr 1233 af 27/10/2018.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     ophoersalderAarLabel     tabel
  ['2011-01-01',     '1963-01-01',     null,     '68',     'A'],
  ['2011-01-01',     '1955-07-01',     '1962-12-31',     '67',     'B'],
  ['2011-01-01',     '1955-01-01',     '1955-06-30',     '66.5',     'C'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, foedselsdatoTil, ophoersalderAarLabel, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    foedselsdatoTil: foedselsdatoTil ? toISODateString(foedselsdatoTil) : null,
    folkepensionsalderAar: null,
    ophoersalderAarLabel,
    tabel,
  })
);

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 5, faktor: 38.477 },
    { alder: 6, faktor: 37.824 },
    { alder: 7, faktor: 37.171 },
    { alder: 8, faktor: 36.52 },
    { alder: 9, faktor: 35.869 },
    { alder: 10, faktor: 35.22 },
    { alder: 11, faktor: 34.571 },
    { alder: 12, faktor: 33.924 },
    { alder: 13, faktor: 33.277 },
    { alder: 14, faktor: 32.632 },
    { alder: 15, faktor: 31.987 },
    { alder: 16, faktor: 31.344 },
    { alder: 17, faktor: 30.702 },
    { alder: 18, faktor: 30.061 },
    { alder: 19, faktor: 29.421 },
    { alder: 20, faktor: 28.782 },
    { alder: 21, faktor: 28.145 },
    { alder: 22, faktor: 27.509 },
    { alder: 23, faktor: 26.874 },
    { alder: 24, faktor: 26.241 },
    { alder: 25, faktor: 25.609 },
    { alder: 26, faktor: 24.978 },
    { alder: 27, faktor: 24.35 },
    { alder: 28, faktor: 23.722 },
    { alder: 29, faktor: 23.097 },
    { alder: 30, faktor: 22.473 },
    { alder: 31, faktor: 21.851 },
    { alder: 32, faktor: 21.231 },
    { alder: 33, faktor: 20.612 },
    { alder: 34, faktor: 19.996 },
    { alder: 35, faktor: 19.381 },
    { alder: 36, faktor: 18.769 },
    { alder: 37, faktor: 18.158 },
    { alder: 38, faktor: 17.55 },
    { alder: 39, faktor: 16.944 },
    { alder: 40, faktor: 16.34 },
    { alder: 41, faktor: 15.739 },
    { alder: 42, faktor: 15.14 },
    { alder: 43, faktor: 14.543 },
    { alder: 44, faktor: 13.949 },
    { alder: 45, faktor: 13.357 },
    { alder: 46, faktor: 12.768 },
    { alder: 47, faktor: 12.181 },
    { alder: 48, faktor: 11.596 },
    { alder: 49, faktor: 11.014 },
    { alder: 50, faktor: 10.434 },
    { alder: 51, faktor: 9.857 },
    { alder: 52, faktor: 9.281 },
    { alder: 53, faktor: 8.708 },
    { alder: 54, faktor: 8.136 },
    { alder: 55, faktor: 7.566 },
    { alder: 56, faktor: 6.997 },
    { alder: 57, faktor: 6.428 },
  ],
  B: [
    { alder: 56, faktor: 6.465 },
    { alder: 57, faktor: 5.892 },
    { alder: 58, faktor: 5.32 },
    { alder: 59, faktor: 4.746 },
    { alder: 60, faktor: 4.172 },
    { alder: 61, faktor: 3.595 },
    { alder: 62, faktor: 3.015 },
    { alder: 63, faktor: 2.432 },
    { alder: 64, faktor: 1.842 },
  ],
  C: [
    { alder: 63, faktor: 2.138 },
    { alder: 64, faktor: 1.544 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  D: [
    { alder: 18, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.494, 3.118, 3.743, 4.367, 4.992, 5.617, 6.243] },
    { alder: 19, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.494, 3.118, 3.742, 4.367, 4.992, 5.616, 6.241] },
    { alder: 20, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.494, 3.118, 3.742, 4.366, 4.991, 5.615, 6.24] },
    { alder: 21, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.493, 3.117, 3.741, 4.366, 4.99, 5.614, 6.239] },
    { alder: 22, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.493, 3.117, 3.741, 4.365, 4.989, 5.613, 6.237] },
    { alder: 23, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.493, 3.117, 3.74, 4.364, 4.988, 5.612, 6.235] },
    { alder: 24, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.493, 3.116, 3.74, 4.363, 4.987, 5.61, 6.234] },
    { alder: 25, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.492, 3.116, 3.739, 4.362, 4.986, 5.609, 6.232] },
    { alder: 26, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.492, 3.115, 3.738, 4.361, 4.984, 5.607, 6.229] },
    { alder: 27, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.492, 3.115, 3.738, 4.36, 4.983, 5.605, 6.227] },
    { alder: 28, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.491, 3.114, 3.737, 4.359, 4.981, 5.603, 6.224] },
    { alder: 29, faktorerPraHeleAar: [0.623, 1.246, 1.868, 2.491, 3.114, 3.736, 4.358, 4.98, 5.601, 6.221] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.246, 1.868, 2.491, 3.113, 3.735, 4.357, 4.978, 5.598, 6.218] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.245, 1.868, 2.49, 3.112, 3.734, 4.355, 4.976, 5.596, 6.215] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.245, 1.868, 2.49, 3.111, 3.733, 4.353, 4.973, 5.593, 6.211] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.245, 1.867, 2.489, 3.111, 3.731, 4.352, 4.971, 5.589, 6.207] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.245, 1.867, 2.489, 3.11, 3.73, 4.35, 4.968, 5.586, 6.202] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.245, 1.867, 2.488, 3.109, 3.728, 4.347, 4.965, 5.582, 6.198] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.245, 1.866, 2.487, 3.107, 3.727, 4.345, 4.962, 5.578, 6.192] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.245, 1.866, 2.487, 3.106, 3.725, 4.342, 4.959, 5.573, 6.187] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.244, 1.866, 2.486, 3.105, 3.723, 4.34, 4.955, 5.569, 6.18] },
    { alder: 39, faktorerPraHeleAar: [0.622, 1.244, 1.865, 2.485, 3.103, 3.721, 4.337, 4.951, 5.563, 6.173] },
    { alder: 40, faktorerPraHeleAar: [0.622, 1.244, 1.864, 2.484, 3.102, 3.718, 4.333, 4.946, 5.557, 6.166] },
    { alder: 41, faktorerPraHeleAar: [0.622, 1.244, 1.864, 2.483, 3.1, 3.716, 4.33, 4.941, 5.551, 6.158] },
    { alder: 42, faktorerPraHeleAar: [0.622, 1.243, 1.863, 2.482, 3.098, 3.713, 4.326, 4.936, 5.544, 6.149] },
    { alder: 43, faktorerPraHeleAar: [0.622, 1.243, 1.863, 2.48, 3.096, 3.71, 4.321, 4.93, 5.536, 6.139] },
    { alder: 44, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.479, 3.094, 3.707, 4.317, 4.924, 5.528, 6.129] },
    { alder: 45, faktorerPraHeleAar: [0.622, 1.242, 1.861, 2.477, 3.092, 3.703, 4.312, 4.917, 5.519, 6.117] },
    { alder: 46, faktorerPraHeleAar: [0.622, 1.242, 1.86, 2.476, 3.089, 3.699, 4.306, 4.91, 5.509, 6.105] },
    { alder: 47, faktorerPraHeleAar: [0.622, 1.242, 1.859, 2.474, 3.086, 3.695, 4.3, 4.902, 5.499, 6.091] },
    { alder: 48, faktorerPraHeleAar: [0.622, 1.241, 1.858, 2.472, 3.083, 3.69, 4.293, 4.893, 5.487, 6.077] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.241, 1.857, 2.47, 3.079, 3.685, 4.286, 4.883, 5.475, 6.061] },
    { alder: 50, faktorerPraHeleAar: [0.622, 1.24, 1.856, 2.468, 3.076, 3.679, 4.278, 4.872, 5.461, 6.043] },
    { alder: 51, faktorerPraHeleAar: [0.621, 1.24, 1.854, 2.465, 3.071, 3.673, 4.27, 4.861, 5.446, 6.024] },
    { alder: 52, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.462, 3.067, 3.667, 4.261, 4.849, 5.43, 6.004] },
    { alder: 53, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.459, 3.062, 3.659, 4.251, 4.835, 5.412, 5.981] },
    { alder: 54, faktorerPraHeleAar: [0.621, 1.237, 1.849, 2.456, 3.057, 3.652, 4.24, 4.82, 5.393, 5.957] },
    { alder: 55, faktorerPraHeleAar: [0.621, 1.237, 1.847, 2.452, 3.051, 3.643, 4.228, 4.804, 5.372, 5.931] },
    { alder: 56, faktorerPraHeleAar: [0.621, 1.236, 1.845, 2.448, 3.045, 3.634, 4.215, 4.787, 5.35, 5.903] },
    { alder: 57, faktorerPraHeleAar: [0.62, 1.235, 1.843, 2.444, 3.038, 3.624, 4.201, 4.768, 5.325, 5.872] },
    { alder: 58, faktorerPraHeleAar: [0.62, 1.234, 1.84, 2.44, 3.031, 3.613, 4.185, 4.748, 5.299] },
    { alder: 59, faktorerPraHeleAar: [0.62, 1.232, 1.838, 2.434, 3.022, 3.601, 4.169, 4.725] },
    { alder: 60, faktorerPraHeleAar: [0.619, 1.231, 1.835, 2.429, 3.014, 3.588, 4.151] },
    { alder: 61, faktorerPraHeleAar: [0.619, 1.23, 1.831, 2.423, 3.004, 3.574] },
    { alder: 62, faktorerPraHeleAar: [0.619, 1.228, 1.828, 2.417, 2.994] },
    { alder: 63, faktorerPraHeleAar: [0.618, 1.227, 1.824, 2.41] },
    { alder: 64, faktorerPraHeleAar: [0.618, 1.225, 1.82] },
    { alder: 65, faktorerPraHeleAar: [0.617] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
