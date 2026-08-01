import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '9921/2019' as const;
export const kapitaliseringsType = 'vejl' as const;
export const kapitaliseringsFuldeNavn =
  'Vejledning om omsætning af løbende erstatninger til kapitalbeløb efter lov om arbejdsskadesikring i 2020' as const;
export const kapitaliseringsDatering = '15/10/2019' as const;
export const gyldigFra = toISODateString('2020-01-01');
export const gyldigTil = toISODateString('2020-12-30');
// 31-12-2020 håndteres særskilt af VEJ 9870/2020.
// Det bevidste 1-dags-split styres deterministisk via kapitaliseringsbekendtgoerelser.ts.

// Udtrukket fra VEJ nr 9921 af 15/10/2019.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.
// Kilden angiver ikke eksplicit EET-tabelvalg for ældre ordninger, forsørgertab-tabelvalg
// eller særfaktor ved ≤2 år til folkepension. Disse felter udfyldes derfor ikke.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     tabel
  ['2011-01-01',     '1963-01-01',     'A'],
  ['2011-01-01',     '1955-07-01',     'B'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    tabel,
  })
);

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 5, faktor: 42.388 },
    { alder: 6, faktor: 41.601 },
    { alder: 7, faktor: 40.818 },
    { alder: 8, faktor: 40.038 },
    { alder: 9, faktor: 39.262 },
    { alder: 10, faktor: 38.49 },
    { alder: 11, faktor: 37.721 },
    { alder: 12, faktor: 36.955 },
    { alder: 13, faktor: 36.193 },
    { alder: 14, faktor: 35.434 },
    { alder: 15, faktor: 34.679 },
    { alder: 16, faktor: 33.928 },
    { alder: 17, faktor: 33.18 },
    { alder: 18, faktor: 32.436 },
    { alder: 19, faktor: 31.695 },
    { alder: 20, faktor: 30.958 },
    { alder: 21, faktor: 30.225 },
    { alder: 22, faktor: 29.495 },
    { alder: 23, faktor: 28.769 },
    { alder: 24, faktor: 28.047 },
    { alder: 25, faktor: 27.329 },
    { alder: 26, faktor: 26.615 },
    { alder: 27, faktor: 25.904 },
    { alder: 28, faktor: 25.197 },
    { alder: 29, faktor: 24.495 },
    { alder: 30, faktor: 23.796 },
    { alder: 31, faktor: 23.101 },
    { alder: 32, faktor: 22.411 },
    { alder: 33, faktor: 21.724 },
    { alder: 34, faktor: 21.042 },
    { alder: 35, faktor: 20.364 },
    { alder: 36, faktor: 19.69 },
    { alder: 37, faktor: 19.02 },
    { alder: 38, faktor: 18.355 },
    { alder: 39, faktor: 17.694 },
    { alder: 40, faktor: 17.037 },
    { alder: 41, faktor: 16.385 },
    { alder: 42, faktor: 15.737 },
    { alder: 43, faktor: 15.094 },
    { alder: 44, faktor: 14.455 },
    { alder: 45, faktor: 13.821 },
    { alder: 46, faktor: 13.191 },
    { alder: 47, faktor: 12.565 },
    { alder: 48, faktor: 11.944 },
    { alder: 49, faktor: 11.327 },
    { alder: 50, faktor: 10.714 },
    { alder: 51, faktor: 10.106 },
    { alder: 52, faktor: 9.501 },
    { alder: 53, faktor: 8.901 },
    { alder: 54, faktor: 8.303 },
    { alder: 55, faktor: 7.71 },
    { alder: 56, faktor: 7.119 },
    { alder: 57, faktor: 6.531 },
    { alder: 58, faktor: 5.944 },
  ],
  B: [
    { alder: 57, faktor: 5.977 },
    { alder: 58, faktor: 5.387 },
    { alder: 59, faktor: 4.799 },
    { alder: 60, faktor: 4.211 },
    { alder: 61, faktor: 3.623 },
    { alder: 62, faktor: 3.034 },
    { alder: 63, faktor: 2.442 },
    { alder: 64, faktor: 1.846 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {
} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  C: [
    { alder: 18, faktorerPraHeleAar: [0.624, 1.25, 1.878, 2.508, 3.141, 3.776, 4.413, 5.053, 5.694, 6.338] },
    { alder: 19, faktorerPraHeleAar: [0.624, 1.25, 1.878, 2.508, 3.141, 3.776, 4.413, 5.052, 5.693, 6.337] },
    { alder: 20, faktorerPraHeleAar: [0.624, 1.25, 1.878, 2.508, 3.141, 3.775, 4.412, 5.051, 5.692, 6.335] },
    { alder: 21, faktorerPraHeleAar: [0.624, 1.249, 1.878, 2.508, 3.14, 3.775, 4.411, 5.05, 5.691, 6.334] },
    { alder: 22, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.508, 3.14, 3.774, 4.411, 5.049, 5.69, 6.332] },
    { alder: 23, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.507, 3.14, 3.774, 4.41, 5.048, 5.688, 6.331] },
    { alder: 24, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.507, 3.139, 3.773, 4.409, 5.047, 5.687, 6.329] },
    { alder: 25, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.507, 3.139, 3.773, 4.408, 5.046, 5.685, 6.327] },
    { alder: 26, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.507, 3.138, 3.772, 4.407, 5.045, 5.684, 6.324] },
    { alder: 27, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.506, 3.138, 3.771, 4.406, 5.043, 5.682, 6.322] },
    { alder: 28, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.506, 3.137, 3.77, 4.405, 5.041, 5.68, 6.319] },
    { alder: 29, faktorerPraHeleAar: [0.624, 1.249, 1.876, 2.506, 3.137, 3.769, 4.404, 5.04, 5.677, 6.316] },
    { alder: 30, faktorerPraHeleAar: [0.623, 1.249, 1.876, 2.505, 3.136, 3.768, 4.402, 5.038, 5.675, 6.313] },
    { alder: 31, faktorerPraHeleAar: [0.623, 1.249, 1.876, 2.505, 3.135, 3.767, 4.401, 5.036, 5.672, 6.309] },
    { alder: 32, faktorerPraHeleAar: [0.623, 1.249, 1.876, 2.504, 3.134, 3.766, 4.399, 5.033, 5.669, 6.306] },
    { alder: 33, faktorerPraHeleAar: [0.623, 1.249, 1.875, 2.504, 3.133, 3.765, 4.397, 5.031, 5.666, 6.301] },
    { alder: 34, faktorerPraHeleAar: [0.623, 1.248, 1.875, 2.503, 3.133, 3.763, 4.395, 5.028, 5.662, 6.297] },
    { alder: 35, faktorerPraHeleAar: [0.623, 1.248, 1.875, 2.502, 3.131, 3.762, 4.393, 5.025, 5.658, 6.292] },
    { alder: 36, faktorerPraHeleAar: [0.623, 1.248, 1.874, 2.502, 3.13, 3.76, 4.391, 5.022, 5.654, 6.287] },
    { alder: 37, faktorerPraHeleAar: [0.623, 1.248, 1.874, 2.501, 3.129, 3.758, 4.388, 5.019, 5.649, 6.281] },
    { alder: 38, faktorerPraHeleAar: [0.623, 1.248, 1.873, 2.5, 3.128, 3.756, 4.385, 5.015, 5.644, 6.274] },
    { alder: 39, faktorerPraHeleAar: [0.623, 1.248, 1.873, 2.499, 3.126, 3.754, 4.382, 5.011, 5.639, 6.267] },
    { alder: 40, faktorerPraHeleAar: [0.623, 1.247, 1.872, 2.498, 3.125, 3.752, 4.379, 5.006, 5.633, 6.26] },
    { alder: 41, faktorerPraHeleAar: [0.623, 1.247, 1.872, 2.497, 3.123, 3.749, 4.375, 5.001, 5.626, 6.251] },
    { alder: 42, faktorerPraHeleAar: [0.623, 1.247, 1.871, 2.496, 3.121, 3.746, 4.371, 4.996, 5.619, 6.242] },
    { alder: 43, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.495, 3.119, 3.743, 4.367, 4.99, 5.612, 6.232] },
    { alder: 44, faktorerPraHeleAar: [0.623, 1.246, 1.87, 2.493, 3.117, 3.74, 4.362, 4.983, 5.603, 6.222] },
    { alder: 45, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.492, 3.114, 3.736, 4.357, 4.976, 5.594, 6.21] },
    { alder: 46, faktorerPraHeleAar: [0.623, 1.245, 1.868, 2.49, 3.112, 3.732, 4.351, 4.969, 5.584, 6.197] },
    { alder: 47, faktorerPraHeleAar: [0.623, 1.245, 1.867, 2.488, 3.109, 3.728, 4.345, 4.96, 5.573, 6.183] },
    { alder: 48, faktorerPraHeleAar: [0.622, 1.245, 1.866, 2.486, 3.105, 3.723, 4.338, 4.951, 5.562, 6.168] },
    { alder: 49, faktorerPraHeleAar: [0.622, 1.244, 1.865, 2.484, 3.102, 3.718, 4.331, 4.941, 5.549, 6.152] },
    { alder: 50, faktorerPraHeleAar: [0.622, 1.243, 1.863, 2.482, 3.098, 3.712, 4.323, 4.931, 5.535, 6.134] },
    { alder: 51, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.479, 3.094, 3.706, 4.314, 4.919, 5.52, 6.115] },
    { alder: 52, faktorerPraHeleAar: [0.622, 1.242, 1.861, 2.476, 3.089, 3.699, 4.305, 4.906, 5.503, 6.094] },
    { alder: 53, faktorerPraHeleAar: [0.622, 1.242, 1.859, 2.473, 3.085, 3.692, 4.295, 4.893, 5.485, 6.071] },
    { alder: 54, faktorerPraHeleAar: [0.622, 1.241, 1.857, 2.47, 3.079, 3.684, 4.284, 4.878, 5.466, 6.046] },
    { alder: 55, faktorerPraHeleAar: [0.621, 1.24, 1.855, 2.466, 3.073, 3.675, 4.272, 4.861, 5.444, 6.02] },
    { alder: 56, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.462, 3.067, 3.666, 4.258, 4.844, 5.422, 5.991] },
    { alder: 57, faktorerPraHeleAar: [0.621, 1.238, 1.851, 2.458, 3.06, 3.656, 4.244, 4.825, 5.397, 5.959] },
    { alder: 58, faktorerPraHeleAar: [0.621, 1.237, 1.848, 2.454, 3.053, 3.645, 4.229, 4.804, 5.37] },
    { alder: 59, faktorerPraHeleAar: [0.62, 1.236, 1.845, 2.448, 3.044, 3.632, 4.212, 4.781] },
    { alder: 60, faktorerPraHeleAar: [0.62, 1.234, 1.842, 2.443, 3.036, 3.619, 4.193] },
    { alder: 61, faktorerPraHeleAar: [0.62, 1.233, 1.839, 2.437, 3.026, 3.605] },
    { alder: 62, faktorerPraHeleAar: [0.619, 1.232, 1.835, 2.43, 3.015] },
    { alder: 63, faktorerPraHeleAar: [0.619, 1.23, 1.832, 2.423] },
    { alder: 64, faktorerPraHeleAar: [0.619, 1.228, 1.827] },
    { alder: 65, faktorerPraHeleAar: [0.618, 1.226] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;
