import type { ISODateString } from '../../../types/branded';
import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '10141/2022' as const;
export const kapitaliseringsType = 'vejl' as const;
export const kapitaliseringsFuldeNavn =
  'Vejledning om omsætning af løbende erstatninger til kapitalbeløb efter lov om arbejdsskadesikring i 2023 for skader fra 1. januar 2011' as const;
export const kapitaliseringsDatering = '31/10/2022' as const;
export const gyldigFra = toISODateString('2023-01-01');
export const gyldigTil = toISODateString('2023-12-31');

// Udtrukket fra VEJ nr 10141 af 31/10/2022.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Denne vejledningstype indeholder kun tabeller A-H (ingen afløsningstabeller).
// Kilden afgrænser tabelvalg til skadedatoer fra 2011-01-01 og frem.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     tabel
  ['2021-01-01',     '1967-01-01',     'A'],
  ['2021-01-01',     '1963-01-01',     'B'],
  ['2021-01-01',     '1955-07-01',     'C'],
  ['2011-01-01',     '1967-01-01',     'E'],
  ['2011-01-01',     '1963-01-01',     'F'],
  ['2011-01-01',     '1955-07-01',     'G'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    tabel,
  })
);

const FORSOERGERTAB_TABELVALG_DATA = [
  // skadedatoFra     tabel
  ['2021-01-01',     'D'],
  ['2011-01-01',     'H'],
] as const;

export const forsoergertabTabelvalg = FORSOERGERTAB_TABELVALG_DATA.map(
  ([skadedatoFra, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    tabel,
  })
);

// Vejledningen angiver særfaktor eksplicit for disse intervaller.
// Der er ikke indsat antagelser for intervaller uden eksplicit angivet særfaktor.
const SAERFAKTOR_UNDER_TO_AAR_DATA = [
  // skadedatoFra     faktor
  ['2021-01-01',     1.245],
  ['2011-01-01',     1.245],
] as const;

export const saerfaktorUnderToAarTilFpPerSkadesinterval: ReadonlyArray<{
  skadedatoFra: ISODateString;
  faktor: number;
}> = SAERFAKTOR_UNDER_TO_AAR_DATA.map(([skadedatoFra, faktor]) => ({
  skadedatoFra: toISODateString(skadedatoFra),
  faktor,
}));

export const erhvervsevnetabTabeller = {
  A: [
    { alder: 5, faktor: 57.752 },
    { alder: 6, faktor: 56.484 },
    { alder: 7, faktor: 55.229 },
    { alder: 8, faktor: 53.989 },
    { alder: 9, faktor: 52.761 },
    { alder: 10, faktor: 51.547 },
    { alder: 11, faktor: 50.346 },
    { alder: 12, faktor: 49.159 },
    { alder: 13, faktor: 47.985 },
    { alder: 14, faktor: 46.824 },
    { alder: 15, faktor: 45.676 },
    { alder: 16, faktor: 44.541 },
    { alder: 17, faktor: 43.421 },
    { alder: 18, faktor: 42.314 },
    { alder: 19, faktor: 41.22 },
    { alder: 20, faktor: 40.14 },
    { alder: 21, faktor: 39.073 },
    { alder: 22, faktor: 38.018 },
    { alder: 23, faktor: 36.975 },
    { alder: 24, faktor: 35.943 },
    { alder: 25, faktor: 34.922 },
    { alder: 26, faktor: 33.911 },
    { alder: 27, faktor: 32.911 },
    { alder: 28, faktor: 31.921 },
    { alder: 29, faktor: 30.942 },
    { alder: 30, faktor: 29.973 },
    { alder: 31, faktor: 29.015 },
    { alder: 32, faktor: 28.068 },
    { alder: 33, faktor: 27.131 },
    { alder: 34, faktor: 26.206 },
    { alder: 35, faktor: 25.291 },
    { alder: 36, faktor: 24.387 },
    { alder: 37, faktor: 23.494 },
    { alder: 38, faktor: 22.611 },
    { alder: 39, faktor: 21.738 },
    { alder: 40, faktor: 20.876 },
    { alder: 41, faktor: 20.024 },
    { alder: 42, faktor: 19.183 },
    { alder: 43, faktor: 18.351 },
    { alder: 44, faktor: 17.53 },
    { alder: 45, faktor: 16.718 },
    { alder: 46, faktor: 15.917 },
    { alder: 47, faktor: 15.125 },
    { alder: 48, faktor: 14.343 },
    { alder: 49, faktor: 13.571 },
    { alder: 50, faktor: 12.81 },
    { alder: 51, faktor: 12.058 },
    { alder: 52, faktor: 11.316 },
    { alder: 53, faktor: 10.584 },
    { alder: 54, faktor: 9.862 },
    { alder: 55, faktor: 9.15 },
    { alder: 56, faktor: 8.447 },
    { alder: 57, faktor: 7.753 },
  ],
  B: [
    { alder: 56, faktor: 7.777 },
    { alder: 57, faktor: 7.09 },
    { alder: 58, faktor: 6.412 },
    { alder: 59, faktor: 5.742 },
    { alder: 60, faktor: 5.081 },
    { alder: 61, faktor: 4.426 },
  ],
  C: [
    { alder: 60, faktor: 4.435 },
    { alder: 61, faktor: 3.786 },
    { alder: 62, faktor: 3.143 },
    { alder: 63, faktor: 2.506 },
    { alder: 64, faktor: 1.873 },
  ],
  E: [
    { alder: 5, faktor: 53.636 },
    { alder: 6, faktor: 52.454 },
    { alder: 7, faktor: 51.284 },
    { alder: 8, faktor: 50.128 },
    { alder: 9, faktor: 48.984 },
    { alder: 10, faktor: 47.852 },
    { alder: 11, faktor: 46.733 },
    { alder: 12, faktor: 45.627 },
    { alder: 13, faktor: 44.533 },
    { alder: 14, faktor: 43.45 },
    { alder: 15, faktor: 42.38 },
    { alder: 16, faktor: 41.322 },
    { alder: 17, faktor: 40.276 },
    { alder: 18, faktor: 39.242 },
    { alder: 19, faktor: 38.219 },
    { alder: 20, faktor: 37.208 },
    { alder: 21, faktor: 36.209 },
    { alder: 22, faktor: 35.221 },
    { alder: 23, faktor: 34.244 },
    { alder: 24, faktor: 33.279 },
    { alder: 25, faktor: 32.325 },
    { alder: 26, faktor: 31.382 },
    { alder: 27, faktor: 30.451 },
    { alder: 28, faktor: 29.53 },
    { alder: 29, faktor: 28.621 },
    { alder: 30, faktor: 27.722 },
    { alder: 31, faktor: 26.834 },
    { alder: 32, faktor: 25.957 },
    { alder: 33, faktor: 25.091 },
    { alder: 34, faktor: 24.236 },
    { alder: 35, faktor: 23.391 },
    { alder: 36, faktor: 22.557 },
    { alder: 37, faktor: 21.733 },
    { alder: 38, faktor: 20.92 },
    { alder: 39, faktor: 20.118 },
    { alder: 40, faktor: 19.325 },
    { alder: 41, faktor: 18.543 },
    { alder: 42, faktor: 17.772 },
    { alder: 43, faktor: 17.01 },
    { alder: 44, faktor: 16.259 },
    { alder: 45, faktor: 15.518 },
    { alder: 46, faktor: 14.786 },
    { alder: 47, faktor: 14.064 },
    { alder: 48, faktor: 13.352 },
    { alder: 49, faktor: 12.65 },
    { alder: 50, faktor: 11.957 },
    { alder: 51, faktor: 11.273 },
    { alder: 52, faktor: 10.598 },
    { alder: 53, faktor: 9.931 },
    { alder: 54, faktor: 9.274 },
    { alder: 55, faktor: 8.624 },
    { alder: 56, faktor: 7.982 },
    { alder: 57, faktor: 7.347 },
  ],
  F: [
    { alder: 56, faktor: 7.395 },
    { alder: 57, faktor: 6.761 },
    { alder: 58, faktor: 6.134 },
    { alder: 59, faktor: 5.512 },
    { alder: 60, faktor: 4.895 },
    { alder: 61, faktor: 4.283 },
  ],
  G: [
    { alder: 60, faktor: 4.301 },
    { alder: 61, faktor: 3.687 },
    { alder: 62, faktor: 3.076 },
    { alder: 63, faktor: 2.466 },
    { alder: 64, faktor: 1.856 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  D: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.527, 5.203, 5.886, 6.577] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.527, 5.203, 5.886, 6.576] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.527, 5.203, 5.886, 6.576] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.527, 5.203, 5.886, 6.576] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.527, 5.203, 5.886, 6.576] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.527, 5.203, 5.886, 6.577] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.528, 5.203, 5.886, 6.577] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.528, 5.203, 5.887, 6.577] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.528, 5.204, 5.887, 6.577] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.86, 4.528, 5.203, 5.887, 6.577] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.528, 5.203, 5.886, 6.577] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.528, 5.203, 5.886, 6.576] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.527, 5.203, 5.886, 6.576] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.527, 5.202, 5.885, 6.575] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.527, 5.202, 5.884, 6.574] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.858, 4.526, 5.201, 5.883, 6.573] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.197, 3.858, 4.526, 5.2, 5.883, 6.572] },
    { alder: 35, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.197, 3.858, 4.525, 5.2, 5.882, 6.571] },
    { alder: 36, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.197, 3.857, 4.524, 5.199, 5.881, 6.57] },
    { alder: 37, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.544, 3.197, 3.857, 4.524, 5.198, 5.88, 6.568] },
    { alder: 38, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.196, 3.856, 4.523, 5.197, 5.878, 6.567] },
    { alder: 39, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.196, 3.856, 4.522, 5.196, 5.877, 6.565] },
    { alder: 40, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.196, 3.855, 4.522, 5.195, 5.876, 6.563] },
    { alder: 41, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.195, 3.854, 4.521, 5.194, 5.874, 6.561] },
    { alder: 42, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.542, 3.195, 3.854, 4.52, 5.193, 5.872, 6.559] },
    { alder: 43, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.542, 3.194, 3.853, 4.519, 5.191, 5.87, 6.556] },
    { alder: 44, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.542, 3.194, 3.852, 4.517, 5.189, 5.868, 6.553] },
    { alder: 45, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.193, 3.851, 4.516, 5.187, 5.865, 6.55] },
    { alder: 46, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.192, 3.85, 4.514, 5.185, 5.862, 6.546] },
    { alder: 47, faktorerPraHeleAar: [0.626, 1.257, 1.896, 2.54, 3.191, 3.849, 4.512, 5.182, 5.858, 6.541] },
    { alder: 48, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.54, 3.19, 3.847, 4.51, 5.179, 5.854, 6.535] },
    { alder: 49, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.189, 3.845, 4.507, 5.175, 5.849, 6.528] },
    { alder: 50, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.538, 3.187, 3.843, 4.504, 5.171, 5.843, 6.521] },
    { alder: 51, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.537, 3.186, 3.84, 4.5, 5.166, 5.836, 6.512] },
    { alder: 52, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.536, 3.184, 3.838, 4.496, 5.16, 5.829, 6.502] },
    { alder: 53, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.535, 3.182, 3.834, 4.492, 5.154, 5.82, 6.491] },
    { alder: 54, faktorerPraHeleAar: [0.625, 1.256, 1.892, 2.533, 3.179, 3.83, 4.486, 5.146, 5.811, 6.479] },
    { alder: 55, faktorerPraHeleAar: [0.625, 1.255, 1.891, 2.531, 3.176, 3.826, 4.48, 5.138, 5.8, 6.465] },
    { alder: 56, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.529, 3.173, 3.821, 4.473, 5.129, 5.788, 6.45] },
    { alder: 57, faktorerPraHeleAar: [0.625, 1.254, 1.889, 2.527, 3.17, 3.816, 4.466, 5.119, 5.775, 6.434] },
    { alder: 58, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.166, 3.81, 4.458, 5.108, 5.761, 6.416] },
    { alder: 59, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.522, 3.162, 3.804, 4.449, 5.097, 5.746] },
    { alder: 60, faktorerPraHeleAar: [0.624, 1.253, 1.884, 2.519, 3.157, 3.797, 4.44, 5.084] },
    { alder: 61, faktorerPraHeleAar: [0.624, 1.252, 1.883, 2.516, 3.152, 3.79] },
    { alder: 62, faktorerPraHeleAar: [0.624, 1.251, 1.881, 2.513, 3.147] },
    { alder: 63, faktorerPraHeleAar: [0.624, 1.25, 1.879, 2.509] },
    { alder: 64, faktorerPraHeleAar: [0.624, 1.249, 1.877] },
    { alder: 65, faktorerPraHeleAar: [0.623, 1.249] },
    { alder: 66, faktorerPraHeleAar: [0.623] },
  ],
  H: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.193, 3.852, 4.517, 5.189, 5.867, 6.553] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.193, 3.851, 4.516, 5.188, 5.866, 6.552] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.193, 3.851, 4.516, 5.187, 5.865, 6.55] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.257, 1.896, 2.541, 3.192, 3.85, 4.515, 5.186, 5.864, 6.549] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.257, 1.896, 2.541, 3.192, 3.85, 4.514, 5.185, 5.863, 6.547] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.257, 1.896, 2.54, 3.192, 3.849, 4.513, 5.184, 5.861, 6.545] },
    { alder: 24, faktorerPraHeleAar: [0.625, 1.257, 1.896, 2.54, 3.191, 3.849, 4.513, 5.183, 5.86, 6.543] },
    { alder: 25, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.54, 3.191, 3.848, 4.512, 5.182, 5.858, 6.541] },
    { alder: 26, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.54, 3.19, 3.847, 4.511, 5.18, 5.856, 6.539] },
    { alder: 27, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.19, 3.846, 4.509, 5.179, 5.854, 6.536] },
    { alder: 28, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.189, 3.846, 4.508, 5.177, 5.852, 6.533] },
    { alder: 29, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.189, 3.845, 4.507, 5.175, 5.85, 6.53] },
    { alder: 30, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.538, 3.188, 3.844, 4.505, 5.173, 5.847, 6.527] },
    { alder: 31, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.538, 3.187, 3.843, 4.504, 5.171, 5.844, 6.523] },
    { alder: 32, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.537, 3.186, 3.841, 4.502, 5.169, 5.841, 6.519] },
    { alder: 33, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.537, 3.185, 3.84, 4.5, 5.166, 5.838, 6.515] },
    { alder: 34, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.536, 3.184, 3.838, 4.498, 5.163, 5.834, 6.51] },
    { alder: 35, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.535, 3.183, 3.837, 4.496, 5.16, 5.83, 6.505] },
    { alder: 36, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.535, 3.182, 3.835, 4.493, 5.157, 5.826, 6.499] },
    { alder: 37, faktorerPraHeleAar: [0.625, 1.256, 1.892, 2.534, 3.181, 3.833, 4.491, 5.153, 5.821, 6.493] },
    { alder: 38, faktorerPraHeleAar: [0.625, 1.256, 1.892, 2.533, 3.18, 3.831, 4.488, 5.149, 5.816, 6.486] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.256, 1.891, 2.532, 3.178, 3.829, 4.485, 5.145, 5.81, 6.479] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.255, 1.891, 2.531, 3.176, 3.826, 4.481, 5.14, 5.804, 6.471] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.824, 4.477, 5.135, 5.797, 6.462] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.529, 3.173, 3.821, 4.473, 5.13, 5.789, 6.453] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.254, 1.889, 2.527, 3.171, 3.818, 4.469, 5.123, 5.781, 6.442] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.526, 3.168, 3.814, 4.464, 5.117, 5.773, 6.431] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.524, 3.166, 3.81, 4.458, 5.11, 5.763, 6.419] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.523, 3.163, 3.806, 4.453, 5.102, 5.753, 6.406] },
    { alder: 47, faktorerPraHeleAar: [0.624, 1.253, 1.885, 2.521, 3.16, 3.802, 4.446, 5.093, 5.741, 6.391] },
    { alder: 48, faktorerPraHeleAar: [0.624, 1.253, 1.884, 2.519, 3.157, 3.797, 4.439, 5.084, 5.729, 6.375] },
    { alder: 49, faktorerPraHeleAar: [0.624, 1.252, 1.883, 2.517, 3.153, 3.792, 4.432, 5.073, 5.716, 6.358] },
    { alder: 50, faktorerPraHeleAar: [0.624, 1.251, 1.882, 2.514, 3.149, 3.786, 4.424, 5.062, 5.701, 6.34] },
    { alder: 51, faktorerPraHeleAar: [0.624, 1.251, 1.88, 2.512, 3.145, 3.779, 4.415, 5.05, 5.685, 6.319] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.25, 1.879, 2.509, 3.14, 3.773, 4.405, 5.037, 5.668, 6.298] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.249, 1.877, 2.506, 3.135, 3.765, 4.394, 5.023, 5.649, 6.274] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.249, 1.875, 2.502, 3.13, 3.757, 4.383, 5.007, 5.629, 6.248] },
    { alder: 55, faktorerPraHeleAar: [0.623, 1.248, 1.873, 2.499, 3.124, 3.748, 4.37, 4.99, 5.607, 6.22] },
    { alder: 56, faktorerPraHeleAar: [0.623, 1.247, 1.871, 2.495, 3.117, 3.738, 4.357, 4.972, 5.583, 6.189] },
    { alder: 57, faktorerPraHeleAar: [0.623, 1.246, 1.869, 2.49, 3.11, 3.728, 4.342, 4.952, 5.557, 6.156] },
    { alder: 58, faktorerPraHeleAar: [0.623, 1.245, 1.866, 2.486, 3.103, 3.716, 4.326, 4.931, 5.529, 6.121] },
    { alder: 59, faktorerPraHeleAar: [0.622, 1.244, 1.863, 2.48, 3.094, 3.704, 4.309, 4.907, 5.499] },
    { alder: 60, faktorerPraHeleAar: [0.622, 1.242, 1.86, 2.475, 3.085, 3.691, 4.29, 4.882] },
    { alder: 61, faktorerPraHeleAar: [0.622, 1.241, 1.857, 2.469, 3.075, 3.676] },
    { alder: 62, faktorerPraHeleAar: [0.621, 1.239, 1.853, 2.462, 3.065] },
    { alder: 63, faktorerPraHeleAar: [0.621, 1.238, 1.849, 2.455] },
    { alder: 64, faktorerPraHeleAar: [0.621, 1.236, 1.845] },
    { alder: 65, faktorerPraHeleAar: [0.62, 1.234] },
    { alder: 66, faktorerPraHeleAar: [0.62] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;
