import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';

export interface AldersFaktorRaekke {
  alder: number;
  faktor: number;
}

export interface ForsoergertabMatrixRaekke {
  alder: number;
  faktorerPraHeleAar: readonly number[];
}

export const kapitaliseringsId = '9741/2020' as const;
export const kapitaliseringsType = 'vejl' as const;
export const kapitaliseringsFuldeNavn =
  'Vejledning om omsætning af løbende erstatninger til kapitalbeløb efter lov om arbejdsskadesikring i 2021 for skader fra 1. januar 2011' as const;
export const kapitaliseringsDatering = '30/10/2020' as const;
export const gyldigFra = toISODateString('2021-01-01');
export const gyldigTil = toISODateString('2021-12-31');

// Udtrukket fra VEJ nr 9741 af 30/10/2020.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Denne vejledningstype indeholder kun tabeller A-H (ingen afløsningstabeller).
// Kilden afgrænser tabelvalg til skadesdatoer fra 2011-01-01 og frem.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadesdatoFra     foedselsdatoFra     folkepensionsalderAar     tabel
  ['2021-01-01',     '1967-01-01',     69,     'A'],
  ['2021-01-01',     '1963-01-01',     68,     'B'],
  ['2021-01-01',     '1955-07-01',     67,     'C'],
  ['2011-01-01',     '1967-01-01',     69,     'E'],
  ['2011-01-01',     '1963-01-01',     68,     'F'],
  ['2011-01-01',     '1955-07-01',     67,     'G'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadesdatoFra, foedselsdatoFra, folkepensionsalderAar, tabel]) => ({
    skadesdatoFra: toISODateString(skadesdatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    folkepensionsalderAar,
    tabel,
  })
);

const FORSOERGERTAB_TABELVALG_DATA = [
  // skadesdatoFra     tabel
  ['2021-01-01',     'D'],
  ['2011-01-01',     'H'],
] as const;

export const forsoergertabTabelvalg = FORSOERGERTAB_TABELVALG_DATA.map(
  ([skadesdatoFra, tabel]) => ({
    skadesdatoFra: toISODateString(skadesdatoFra),
    tabel,
  })
);

// Vejledningen angiver særfaktor eksplicit for disse intervaller.
// Der er ikke indsat antagelser for intervaller uden eksplicit angivet særfaktor.
const SAERFAKTOR_UNDER_TO_AAR_DATA = [
  // skadesdatoFra     faktor
  ['2021-01-01',     1.245],
  ['2011-01-01',     1.245],
] as const;

export const saerfaktorUnderToAarTilFpPerSkadesinterval: ReadonlyArray<{
  skadesdatoFra: ISODateString;
  faktor: number;
}> = SAERFAKTOR_UNDER_TO_AAR_DATA.map(([skadesdatoFra, faktor]) => ({
  skadesdatoFra: toISODateString(skadesdatoFra),
  faktor,
}));

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 5, faktor: 51.936 },
    { alder: 6, faktor: 50.888 },
    { alder: 7, faktor: 49.847 },
    { alder: 8, faktor: 48.815 },
    { alder: 9, faktor: 47.791 },
    { alder: 10, faktor: 46.775 },
    { alder: 11, faktor: 45.767 },
    { alder: 12, faktor: 44.767 },
    { alder: 13, faktor: 43.775 },
    { alder: 14, faktor: 42.792 },
    { alder: 15, faktor: 41.817 },
    { alder: 16, faktor: 40.852 },
    { alder: 17, faktor: 39.895 },
    { alder: 18, faktor: 38.948 },
    { alder: 19, faktor: 38.009 },
    { alder: 20, faktor: 37.078 },
    { alder: 21, faktor: 36.154 },
    { alder: 22, faktor: 35.238 },
    { alder: 23, faktor: 34.329 },
    { alder: 24, faktor: 33.428 },
    { alder: 25, faktor: 32.533 },
    { alder: 26, faktor: 31.645 },
    { alder: 27, faktor: 30.764 },
    { alder: 28, faktor: 29.889 },
    { alder: 29, faktor: 29.021 },
    { alder: 30, faktor: 28.161 },
    { alder: 31, faktor: 27.308 },
    { alder: 32, faktor: 26.462 },
    { alder: 33, faktor: 25.624 },
    { alder: 34, faktor: 24.792 },
    { alder: 35, faktor: 23.967 },
    { alder: 36, faktor: 23.149 },
    { alder: 37, faktor: 22.338 },
    { alder: 38, faktor: 21.534 },
    { alder: 39, faktor: 20.737 },
    { alder: 40, faktor: 19.948 },
    { alder: 41, faktor: 19.165 },
    { alder: 42, faktor: 18.388 },
    { alder: 43, faktor: 17.619 },
    { alder: 44, faktor: 16.856 },
    { alder: 45, faktor: 16.101 },
    { alder: 46, faktor: 15.353 },
    { alder: 47, faktor: 14.612 },
    { alder: 48, faktor: 13.879 },
    { alder: 49, faktor: 13.153 },
    { alder: 50, faktor: 12.435 },
    { alder: 51, faktor: 11.724 },
    { alder: 52, faktor: 11.021 },
    { alder: 53, faktor: 10.325 },
    { alder: 54, faktor: 9.636 },
    { alder: 55, faktor: 8.955 },
  ],
  B: [
    { alder: 54, faktor: 8.982 },
    { alder: 55, faktor: 8.306 },
    { alder: 56, faktor: 7.636 },
    { alder: 57, faktor: 6.973 },
    { alder: 58, faktor: 6.317 },
    { alder: 59, faktor: 5.667 },
  ],
  C: [
    { alder: 58, faktor: 5.68 },
    { alder: 59, faktor: 5.033 },
    { alder: 60, faktor: 4.392 },
    { alder: 61, faktor: 3.756 },
    { alder: 62, faktor: 3.123 },
    { alder: 63, faktor: 2.495 },
    { alder: 64, faktor: 1.869 },
  ],
  E: [
    { alder: 5, faktor: 48.415 },
    { alder: 6, faktor: 47.432 },
    { alder: 7, faktor: 46.456 },
    { alder: 8, faktor: 45.489 },
    { alder: 9, faktor: 44.529 },
    { alder: 10, faktor: 43.576 },
    { alder: 11, faktor: 42.632 },
    { alder: 12, faktor: 41.695 },
    { alder: 13, faktor: 40.766 },
    { alder: 14, faktor: 39.844 },
    { alder: 15, faktor: 38.93 },
    { alder: 16, faktor: 38.024 },
    { alder: 17, faktor: 37.125 },
    { alder: 18, faktor: 36.233 },
    { alder: 19, faktor: 35.349 },
    { alder: 20, faktor: 34.472 },
    { alder: 21, faktor: 33.603 },
    { alder: 22, faktor: 32.742 },
    { alder: 23, faktor: 31.888 },
    { alder: 24, faktor: 31.041 },
    { alder: 25, faktor: 30.201 },
    { alder: 26, faktor: 29.369 },
    { alder: 27, faktor: 28.545 },
    { alder: 28, faktor: 27.728 },
    { alder: 29, faktor: 26.918 },
    { alder: 30, faktor: 26.116 },
    { alder: 31, faktor: 25.321 },
    { alder: 32, faktor: 24.534 },
    { alder: 33, faktor: 23.754 },
    { alder: 34, faktor: 22.981 },
    { alder: 35, faktor: 22.216 },
    { alder: 36, faktor: 21.458 },
    { alder: 37, faktor: 20.708 },
    { alder: 38, faktor: 19.965 },
    { alder: 39, faktor: 19.23 },
    { alder: 40, faktor: 18.502 },
    { alder: 41, faktor: 17.782 },
    { alder: 42, faktor: 17.069 },
    { alder: 43, faktor: 16.363 },
    { alder: 44, faktor: 15.665 },
    { alder: 45, faktor: 14.974 },
    { alder: 46, faktor: 14.29 },
    { alder: 47, faktor: 13.614 },
    { alder: 48, faktor: 12.945 },
    { alder: 49, faktor: 12.283 },
    { alder: 50, faktor: 11.628 },
    { alder: 51, faktor: 10.979 },
    { alder: 52, faktor: 10.338 },
    { alder: 53, faktor: 9.703 },
    { alder: 54, faktor: 9.074 },
    { alder: 55, faktor: 8.451 },
  ],
  F: [
    { alder: 54, faktor: 8.509 },
    { alder: 55, faktor: 7.886 },
    { alder: 56, faktor: 7.269 },
    { alder: 57, faktor: 6.656 },
    { alder: 58, faktor: 6.048 },
    { alder: 59, faktor: 5.443 },
  ],
  G: [
    { alder: 58, faktor: 5.471 },
    { alder: 59, faktor: 4.864 },
    { alder: 60, faktor: 4.261 },
    { alder: 61, faktor: 3.658 },
    { alder: 62, faktor: 3.057 },
    { alder: 63, faktor: 2.455 },
    { alder: 64, faktor: 1.852 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  D: [
    { alder: 18, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 19, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 20, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 21, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 22, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 23, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 24, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.142, 5.807, 6.479] },
    { alder: 25, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.142, 5.807, 6.479] },
    { alder: 26, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.479] },
    { alder: 27, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.481, 5.141, 5.807, 6.478] },
    { alder: 28, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.48, 5.141, 5.807, 6.478] },
    { alder: 29, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.48, 5.141, 5.806, 6.477] },
    { alder: 30, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.48, 5.14, 5.806, 6.477] },
    { alder: 31, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.825, 4.48, 5.14, 5.805, 6.476] },
    { alder: 32, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.174, 3.824, 4.479, 5.14, 5.805, 6.475] },
    { alder: 33, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.529, 3.174, 3.824, 4.479, 5.139, 5.804, 6.475] },
    { alder: 34, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.529, 3.174, 3.824, 4.479, 5.139, 5.804, 6.474] },
    { alder: 35, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.529, 3.174, 3.824, 4.478, 5.138, 5.803, 6.473] },
    { alder: 36, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.529, 3.174, 3.823, 4.478, 5.137, 5.802, 6.472] },
    { alder: 37, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.529, 3.173, 3.823, 4.477, 5.137, 5.801, 6.471] },
    { alder: 38, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.529, 3.173, 3.822, 4.477, 5.136, 5.8, 6.47] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.529, 3.173, 3.822, 4.476, 5.135, 5.799, 6.468] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.528, 3.173, 3.822, 4.476, 5.134, 5.798, 6.466] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.528, 3.172, 3.821, 4.475, 5.133, 5.796, 6.464] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.254, 1.889, 2.528, 3.172, 3.82, 4.474, 5.132, 5.795, 6.462] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.254, 1.889, 2.528, 3.171, 3.82, 4.473, 5.13, 5.792, 6.459] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.527, 3.171, 3.819, 4.471, 5.128, 5.79, 6.455] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.527, 3.17, 3.817, 4.469, 5.126, 5.786, 6.451] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.169, 3.816, 4.467, 5.123, 5.783, 6.446] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.525, 3.168, 3.814, 4.465, 5.12, 5.778, 6.441] },
    { alder: 48, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.167, 3.812, 4.462, 5.116, 5.773, 6.434] },
    { alder: 49, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.524, 3.165, 3.81, 4.459, 5.112, 5.768, 6.427] },
    { alder: 50, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.523, 3.164, 3.808, 4.456, 5.107, 5.762, 6.419] },
    { alder: 51, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.522, 3.162, 3.805, 4.452, 5.102, 5.755, 6.41] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.253, 1.885, 2.521, 3.16, 3.802, 4.448, 5.096, 5.747, 6.4] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.252, 1.884, 2.519, 3.157, 3.799, 4.443, 5.089, 5.738, 6.389] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.252, 1.883, 2.518, 3.155, 3.795, 4.437, 5.082, 5.728, 6.377] },
    { alder: 55, faktorerPraHeleAar: [0.624, 1.252, 1.882, 2.516, 3.152, 3.79, 4.431, 5.074, 5.718, 6.364] },
    { alder: 56, faktorerPraHeleAar: [0.624, 1.251, 1.881, 2.514, 3.149, 3.786, 4.424, 5.065, 5.707, 6.349] },
    { alder: 57, faktorerPraHeleAar: [0.624, 1.251, 1.88, 2.512, 3.145, 3.781, 4.417, 5.055, 5.694, 6.334] },
    { alder: 58, faktorerPraHeleAar: [0.624, 1.25, 1.879, 2.509, 3.141, 3.775, 4.41, 5.045, 5.682, 6.318] },
    { alder: 59, faktorerPraHeleAar: [0.624, 1.25, 1.877, 2.507, 3.137, 3.769, 4.402, 5.035] },
    { alder: 60, faktorerPraHeleAar: [0.624, 1.249, 1.876, 2.504, 3.133, 3.763, 4.393] },
    { alder: 61, faktorerPraHeleAar: [0.623, 1.248, 1.874, 2.501, 3.129, 3.756] },
    { alder: 62, faktorerPraHeleAar: [0.623, 1.248, 1.873, 2.498, 3.124] },
    { alder: 63, faktorerPraHeleAar: [0.623, 1.247, 1.871, 2.495] },
    { alder: 64, faktorerPraHeleAar: [0.623, 1.246, 1.869] },
    { alder: 65, faktorerPraHeleAar: [0.623, 1.245] },
    { alder: 66, faktorerPraHeleAar: [0.622] },
  ],
  H: [
    { alder: 18, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.527, 3.17, 3.818, 4.47, 5.127, 5.789, 6.455] },
    { alder: 19, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.17, 3.817, 4.469, 5.126, 5.788, 6.454] },
    { alder: 20, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.169, 3.817, 4.469, 5.125, 5.787, 6.452] },
    { alder: 21, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.169, 3.816, 4.468, 5.125, 5.785, 6.451] },
    { alder: 22, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.169, 3.816, 4.467, 5.124, 5.784, 6.449] },
    { alder: 23, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.168, 3.815, 4.467, 5.123, 5.783, 6.447] },
    { alder: 24, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.168, 3.815, 4.466, 5.121, 5.781, 6.445] },
    { alder: 25, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.167, 3.814, 4.465, 5.12, 5.78, 6.443] },
    { alder: 26, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.167, 3.813, 4.464, 5.119, 5.778, 6.441] },
    { alder: 27, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.166, 3.812, 4.463, 5.117, 5.776, 6.438] },
    { alder: 28, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.524, 3.166, 3.812, 4.462, 5.116, 5.774, 6.436] },
    { alder: 29, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.524, 3.165, 3.811, 4.46, 5.114, 5.771, 6.433] },
    { alder: 30, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.523, 3.165, 3.81, 4.459, 5.112, 5.769, 6.429] },
    { alder: 31, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.523, 3.164, 3.809, 4.457, 5.11, 5.766, 6.426] },
    { alder: 32, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.522, 3.163, 3.807, 4.456, 5.107, 5.763, 6.422] },
    { alder: 33, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.522, 3.162, 3.806, 4.454, 5.105, 5.759, 6.417] },
    { alder: 34, faktorerPraHeleAar: [0.625, 1.253, 1.885, 2.521, 3.161, 3.805, 4.452, 5.102, 5.756, 6.413] },
    { alder: 35, faktorerPraHeleAar: [0.624, 1.253, 1.885, 2.521, 3.16, 3.803, 4.449, 5.099, 5.752, 6.408] },
    { alder: 36, faktorerPraHeleAar: [0.624, 1.253, 1.885, 2.52, 3.159, 3.801, 4.447, 5.096, 5.748, 6.402] },
    { alder: 37, faktorerPraHeleAar: [0.624, 1.252, 1.884, 2.519, 3.158, 3.799, 4.444, 5.092, 5.743, 6.396] },
    { alder: 38, faktorerPraHeleAar: [0.624, 1.252, 1.884, 2.518, 3.156, 3.797, 4.441, 5.088, 5.738, 6.39] },
    { alder: 39, faktorerPraHeleAar: [0.624, 1.252, 1.883, 2.517, 3.155, 3.795, 4.438, 5.084, 5.732, 6.382] },
    { alder: 40, faktorerPraHeleAar: [0.624, 1.252, 1.883, 2.516, 3.153, 3.793, 4.435, 5.079, 5.726, 6.375] },
    { alder: 41, faktorerPraHeleAar: [0.624, 1.252, 1.882, 2.515, 3.151, 3.79, 4.431, 5.074, 5.719, 6.366] },
    { alder: 42, faktorerPraHeleAar: [0.624, 1.251, 1.881, 2.514, 3.15, 3.787, 4.427, 5.069, 5.712, 6.357] },
    { alder: 43, faktorerPraHeleAar: [0.624, 1.251, 1.881, 2.513, 3.147, 3.784, 4.423, 5.063, 5.704, 6.347] },
    { alder: 44, faktorerPraHeleAar: [0.624, 1.251, 1.88, 2.511, 3.145, 3.781, 4.418, 5.056, 5.696, 6.336] },
    { alder: 45, faktorerPraHeleAar: [0.624, 1.25, 1.879, 2.51, 3.143, 3.777, 4.412, 5.049, 5.686, 6.324] },
    { alder: 46, faktorerPraHeleAar: [0.624, 1.25, 1.878, 2.508, 3.14, 3.773, 4.407, 5.041, 5.676, 6.311] },
    { alder: 47, faktorerPraHeleAar: [0.624, 1.25, 1.877, 2.506, 3.137, 3.768, 4.4, 5.033, 5.665, 6.296] },
    { alder: 48, faktorerPraHeleAar: [0.624, 1.249, 1.876, 2.504, 3.134, 3.764, 4.394, 5.024, 5.653, 6.281] },
    { alder: 49, faktorerPraHeleAar: [0.623, 1.249, 1.875, 2.502, 3.13, 3.758, 4.386, 5.014, 5.64, 6.264] },
    { alder: 50, faktorerPraHeleAar: [0.623, 1.248, 1.874, 2.5, 3.126, 3.753, 4.378, 5.003, 5.625, 6.246] },
    { alder: 51, faktorerPraHeleAar: [0.623, 1.247, 1.872, 2.497, 3.122, 3.746, 4.369, 4.991, 5.61, 6.226] },
    { alder: 52, faktorerPraHeleAar: [0.623, 1.247, 1.871, 2.494, 3.118, 3.739, 4.36, 4.978, 5.593, 6.205] },
    { alder: 53, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.491, 3.113, 3.732, 4.349, 4.964, 5.575, 6.181] },
    { alder: 54, faktorerPraHeleAar: [0.623, 1.245, 1.867, 2.488, 3.107, 3.724, 4.338, 4.949, 5.555, 6.156] },
    { alder: 55, faktorerPraHeleAar: [0.623, 1.244, 1.865, 2.484, 3.101, 3.715, 4.326, 4.932, 5.533, 6.129] },
    { alder: 56, faktorerPraHeleAar: [0.622, 1.244, 1.863, 2.48, 3.095, 3.706, 4.312, 4.914, 5.51, 6.099] },
    { alder: 57, faktorerPraHeleAar: [0.622, 1.243, 1.861, 2.476, 3.088, 3.695, 4.298, 4.894, 5.484, 6.066] },
    { alder: 58, faktorerPraHeleAar: [0.622, 1.241, 1.858, 2.471, 3.08, 3.684, 4.282, 4.873, 5.457, 6.031] },
    { alder: 59, faktorerPraHeleAar: [0.622, 1.24, 1.855, 2.466, 3.072, 3.672, 4.265, 4.85] },
    { alder: 60, faktorerPraHeleAar: [0.621, 1.239, 1.852, 2.461, 3.063, 3.659, 4.246] },
    { alder: 61, faktorerPraHeleAar: [0.621, 1.238, 1.849, 2.455, 3.053, 3.644] },
    { alder: 62, faktorerPraHeleAar: [0.621, 1.236, 1.845, 2.448, 3.043] },
    { alder: 63, faktorerPraHeleAar: [0.62, 1.234, 1.842, 2.441] },
    { alder: 64, faktorerPraHeleAar: [0.62, 1.232, 1.837] },
    { alder: 65, faktorerPraHeleAar: [0.619, 1.231] },
    { alder: 66, faktorerPraHeleAar: [0.619] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
