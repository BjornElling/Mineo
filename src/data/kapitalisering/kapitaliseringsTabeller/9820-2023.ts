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

export const kapitaliseringsId = '9820/2023' as const;
export const kapitaliseringsType = 'vejl' as const;
export const kapitaliseringsFuldeNavn =
  'Vejledning om omsætning af løbende erstatninger til kapitalbeløb efter lov om arbejdsskadesikring i 2024 for skader fra 1. januar 2011' as const;
export const kapitaliseringsDatering = '30/10/2023' as const;
export const gyldigFra = toISODateString('2024-01-01');
export const gyldigTil = toISODateString('2024-12-31');
// Fra 01-07-2024 erstattes denne vejledning i opslagsstyringen af VEJ 9376/2024.
// Overlap i filernes gyldighed håndteres deterministisk i kapitaliseringsbekendtgoerelser.ts.

// Udtrukket fra VEJ nr 9820 af 30/10/2023.
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
    { alder: 5, faktor: 59.392 },
    { alder: 6, faktor: 58.057 },
    { alder: 7, faktor: 56.737 },
    { alder: 8, faktor: 55.433 },
    { alder: 9, faktor: 54.143 },
    { alder: 10, faktor: 52.869 },
    { alder: 11, faktor: 51.61 },
    { alder: 12, faktor: 50.366 },
    { alder: 13, faktor: 49.137 },
    { alder: 14, faktor: 47.923 },
    { alder: 15, faktor: 46.723 },
    { alder: 16, faktor: 45.538 },
    { alder: 17, faktor: 44.369 },
    { alder: 18, faktor: 43.214 },
    { alder: 19, faktor: 42.075 },
    { alder: 20, faktor: 40.951 },
    { alder: 21, faktor: 39.841 },
    { alder: 22, faktor: 38.746 },
    { alder: 23, faktor: 37.663 },
    { alder: 24, faktor: 36.593 },
    { alder: 25, faktor: 35.535 },
    { alder: 26, faktor: 34.489 },
    { alder: 27, faktor: 33.454 },
    { alder: 28, faktor: 32.431 },
    { alder: 29, faktor: 31.419 },
    { alder: 30, faktor: 30.42 },
    { alder: 31, faktor: 29.432 },
    { alder: 32, faktor: 28.456 },
    { alder: 33, faktor: 27.492 },
    { alder: 34, faktor: 26.54 },
    { alder: 35, faktor: 25.6 },
    { alder: 36, faktor: 24.672 },
    { alder: 37, faktor: 23.755 },
    { alder: 38, faktor: 22.85 },
    { alder: 39, faktor: 21.956 },
    { alder: 40, faktor: 21.074 },
    { alder: 41, faktor: 20.204 },
    { alder: 42, faktor: 19.345 },
    { alder: 43, faktor: 18.498 },
    { alder: 44, faktor: 17.662 },
    { alder: 45, faktor: 16.836 },
    { alder: 46, faktor: 16.021 },
    { alder: 47, faktor: 15.217 },
    { alder: 48, faktor: 14.423 },
    { alder: 49, faktor: 13.641 },
    { alder: 50, faktor: 12.87 },
    { alder: 51, faktor: 12.11 },
    { alder: 52, faktor: 11.36 },
    { alder: 53, faktor: 10.621 },
    { alder: 54, faktor: 9.892 },
    { alder: 55, faktor: 9.173 },
    { alder: 56, faktor: 8.465 },
    { alder: 57, faktor: 7.767 },
    { alder: 58, faktor: 7.079 },
  ],
  B: [
    { alder: 57, faktor: 7.102 },
    { alder: 58, faktor: 6.421 },
    { alder: 59, faktor: 5.748 },
    { alder: 60, faktor: 5.084 },
    { alder: 61, faktor: 4.428 },
    { alder: 62, faktor: 3.78 },
  ],
  C: [
    { alder: 61, faktor: 3.788 },
    { alder: 62, faktor: 3.144 },
    { alder: 63, faktor: 2.506 },
    { alder: 64, faktor: 1.873 },
  ],
  E: [
    { alder: 5, faktor: 55.154 },
    { alder: 6, faktor: 53.912 },
    { alder: 7, faktor: 52.684 },
    { alder: 8, faktor: 51.471 },
    { alder: 9, faktor: 50.272 },
    { alder: 10, faktor: 49.087 },
    { alder: 11, faktor: 47.916 },
    { alder: 12, faktor: 46.759 },
    { alder: 13, faktor: 45.616 },
    { alder: 14, faktor: 44.487 },
    { alder: 15, faktor: 43.371 },
    { alder: 16, faktor: 42.268 },
    { alder: 17, faktor: 41.178 },
    { alder: 18, faktor: 40.102 },
    { alder: 19, faktor: 39.039 },
    { alder: 20, faktor: 37.988 },
    { alder: 21, faktor: 36.951 },
    { alder: 22, faktor: 35.926 },
    { alder: 23, faktor: 34.914 },
    { alder: 24, faktor: 33.914 },
    { alder: 25, faktor: 32.927 },
    { alder: 26, faktor: 31.952 },
    { alder: 27, faktor: 30.989 },
    { alder: 28, faktor: 30.039 },
    { alder: 29, faktor: 29.1 },
    { alder: 30, faktor: 28.174 },
    { alder: 31, faktor: 27.26 },
    { alder: 32, faktor: 26.357 },
    { alder: 33, faktor: 25.466 },
    { alder: 34, faktor: 24.587 },
    { alder: 35, faktor: 23.72 },
    { alder: 36, faktor: 22.864 },
    { alder: 37, faktor: 22.019 },
    { alder: 38, faktor: 21.186 },
    { alder: 39, faktor: 20.365 },
    { alder: 40, faktor: 19.554 },
    { alder: 41, faktor: 18.755 },
    { alder: 42, faktor: 17.967 },
    { alder: 43, faktor: 17.19 },
    { alder: 44, faktor: 16.424 },
    { alder: 45, faktor: 15.668 },
    { alder: 46, faktor: 14.923 },
    { alder: 47, faktor: 14.189 },
    { alder: 48, faktor: 13.465 },
    { alder: 49, faktor: 12.751 },
    { alder: 50, faktor: 12.047 },
    { alder: 51, faktor: 11.354 },
    { alder: 52, faktor: 10.669 },
    { alder: 53, faktor: 9.994 },
    { alder: 54, faktor: 9.328 },
    { alder: 55, faktor: 8.671 },
    { alder: 56, faktor: 8.022 },
    { alder: 57, faktor: 7.381 },
    { alder: 58, faktor: 6.747 },
  ],
  F: [
    { alder: 57, faktor: 6.79 },
    { alder: 58, faktor: 6.157 },
    { alder: 59, faktor: 5.531 },
    { alder: 60, faktor: 4.91 },
    { alder: 61, faktor: 4.294 },
    { alder: 62, faktor: 3.681 },
  ],
  G: [
    { alder: 61, faktor: 3.695 },
    { alder: 62, faktor: 3.081 },
    { alder: 63, faktor: 2.469 },
    { alder: 64, faktor: 1.858 },
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const forsoergertabTabeller = {
  // Kolonne 1: Fyldt alder
  // Kolonne 2: Resterende erstatningsperiode, antal hele år
  D: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.549, 3.205, 3.868, 4.54, 5.22, 5.907, 6.603] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.54, 5.219, 5.907, 6.603] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.54, 5.219, 5.907, 6.602] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.539, 5.219, 5.907, 6.602] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.54, 5.219, 5.907, 6.602] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.54, 5.219, 5.907, 6.603] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.54, 5.22, 5.907, 6.603] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.549, 3.205, 3.868, 4.54, 5.22, 5.907, 6.603] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.549, 3.205, 3.869, 4.54, 5.22, 5.907, 6.603] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.549, 3.205, 3.869, 4.54, 5.22, 5.907, 6.603] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.549, 3.205, 3.868, 4.54, 5.22, 5.907, 6.603] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.549, 3.205, 3.868, 4.54, 5.219, 5.907, 6.602] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.54, 5.219, 5.906, 6.601] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.539, 5.218, 5.905, 6.601] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.868, 4.539, 5.218, 5.905, 6.599] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.867, 4.538, 5.217, 5.904, 6.598] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.204, 3.867, 4.538, 5.216, 5.903, 6.597] },
    { alder: 35, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.203, 3.866, 4.537, 5.215, 5.902, 6.596] },
    { alder: 36, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.548, 3.203, 3.866, 4.536, 5.214, 5.9, 6.594] },
    { alder: 37, faktorerPraHeleAar: [0.626, 1.259, 1.9, 2.547, 3.203, 3.865, 4.536, 5.213, 5.899, 6.592] },
    { alder: 38, faktorerPraHeleAar: [0.626, 1.259, 1.899, 2.547, 3.202, 3.865, 4.535, 5.212, 5.897, 6.59] },
    { alder: 39, faktorerPraHeleAar: [0.626, 1.259, 1.899, 2.547, 3.202, 3.864, 4.534, 5.211, 5.896, 6.588] },
    { alder: 40, faktorerPraHeleAar: [0.626, 1.259, 1.899, 2.546, 3.201, 3.863, 4.532, 5.209, 5.894, 6.586] },
    { alder: 41, faktorerPraHeleAar: [0.626, 1.259, 1.899, 2.546, 3.2, 3.862, 4.531, 5.208, 5.892, 6.583] },
    { alder: 42, faktorerPraHeleAar: [0.626, 1.259, 1.899, 2.546, 3.2, 3.861, 4.53, 5.206, 5.89, 6.581] },
    { alder: 43, faktorerPraHeleAar: [0.626, 1.259, 1.898, 2.545, 3.199, 3.861, 4.529, 5.205, 5.888, 6.578] },
    { alder: 44, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.199, 3.86, 4.528, 5.203, 5.885, 6.574] },
    { alder: 45, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.526, 5.201, 5.882, 6.571] },
    { alder: 46, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.197, 3.857, 4.524, 5.198, 5.879, 6.566] },
    { alder: 47, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.196, 3.856, 4.522, 5.195, 5.875, 6.561] },
    { alder: 48, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.195, 3.854, 4.519, 5.191, 5.87, 6.555] },
    { alder: 49, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.542, 3.193, 3.852, 4.516, 5.187, 5.864, 6.548] },
    { alder: 50, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.192, 3.85, 4.513, 5.183, 5.858, 6.54] },
    { alder: 51, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.54, 3.19, 3.847, 4.51, 5.178, 5.852, 6.531] },
    { alder: 52, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.189, 3.844, 4.505, 5.172, 5.844, 6.52] },
    { alder: 53, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.537, 3.186, 3.841, 4.5, 5.165, 5.834, 6.508] },
    { alder: 54, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.536, 3.184, 3.836, 4.494, 5.157, 5.824, 6.495] },
    { alder: 55, faktorerPraHeleAar: [0.625, 1.256, 1.892, 2.534, 3.18, 3.832, 4.488, 5.148, 5.812, 6.48] },
    { alder: 56, faktorerPraHeleAar: [0.625, 1.256, 1.891, 2.532, 3.177, 3.827, 4.48, 5.138, 5.799, 6.463] },
    { alder: 57, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.529, 3.173, 3.821, 4.472, 5.127, 5.785, 6.445] },
    { alder: 58, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.527, 3.169, 3.815, 4.464, 5.115, 5.769, 6.425] },
    { alder: 59, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.524, 3.164, 3.808, 4.454, 5.102, 5.752] },
    { alder: 60, faktorerPraHeleAar: [0.625, 1.253, 1.885, 2.521, 3.159, 3.8, 4.443, 5.088] },
    { alder: 61, faktorerPraHeleAar: [0.624, 1.252, 1.883, 2.517, 3.154, 3.792, 4.432] },
    { alder: 62, faktorerPraHeleAar: [0.624, 1.251, 1.881, 2.513, 3.147] },
    { alder: 63, faktorerPraHeleAar: [0.624, 1.25, 1.879, 2.509] },
    { alder: 64, faktorerPraHeleAar: [0.624, 1.249, 1.876] },
    { alder: 65, faktorerPraHeleAar: [0.623, 1.248] },
    { alder: 66, faktorerPraHeleAar: [0.623] },
  ],
  H: [
    { alder: 18, faktorerPraHeleAar: [0.626, 1.259, 1.898, 2.545, 3.2, 3.861, 4.53, 5.206, 5.889, 6.58] },
    { alder: 19, faktorerPraHeleAar: [0.626, 1.259, 1.898, 2.545, 3.199, 3.861, 4.529, 5.205, 5.888, 6.578] },
    { alder: 20, faktorerPraHeleAar: [0.626, 1.259, 1.898, 2.545, 3.199, 3.86, 4.528, 5.204, 5.887, 6.577] },
    { alder: 21, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.199, 3.86, 4.528, 5.203, 5.886, 6.575] },
    { alder: 22, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.545, 3.198, 3.859, 4.527, 5.202, 5.884, 6.574] },
    { alder: 23, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.859, 4.526, 5.201, 5.883, 6.572] },
    { alder: 24, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.198, 3.858, 4.525, 5.2, 5.881, 6.57] },
    { alder: 25, faktorerPraHeleAar: [0.626, 1.258, 1.898, 2.544, 3.197, 3.857, 4.524, 5.199, 5.88, 6.568] },
    { alder: 26, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.544, 3.197, 3.857, 4.523, 5.197, 5.878, 6.565] },
    { alder: 27, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.196, 3.856, 4.522, 5.196, 5.876, 6.563] },
    { alder: 28, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.196, 3.855, 4.521, 5.194, 5.874, 6.56] },
    { alder: 29, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.543, 3.195, 3.854, 4.52, 5.192, 5.871, 6.557] },
    { alder: 30, faktorerPraHeleAar: [0.626, 1.258, 1.897, 2.542, 3.194, 3.853, 4.518, 5.19, 5.869, 6.553] },
    { alder: 31, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.542, 3.193, 3.852, 4.517, 5.188, 5.866, 6.55] },
    { alder: 32, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.193, 3.851, 4.515, 5.186, 5.863, 6.546] },
    { alder: 33, faktorerPraHeleAar: [0.626, 1.258, 1.896, 2.541, 3.192, 3.849, 4.513, 5.183, 5.859, 6.541] },
    { alder: 34, faktorerPraHeleAar: [0.626, 1.257, 1.896, 2.54, 3.191, 3.848, 4.511, 5.18, 5.855, 6.537] },
    { alder: 35, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.19, 3.846, 4.509, 5.177, 5.851, 6.531] },
    { alder: 36, faktorerPraHeleAar: [0.625, 1.257, 1.895, 2.539, 3.189, 3.844, 4.506, 5.174, 5.847, 6.526] },
    { alder: 37, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.538, 3.187, 3.843, 4.503, 5.17, 5.842, 6.519] },
    { alder: 38, faktorerPraHeleAar: [0.625, 1.257, 1.894, 2.537, 3.186, 3.84, 4.501, 5.166, 5.837, 6.513] },
    { alder: 39, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.536, 3.184, 3.838, 4.497, 5.162, 5.831, 6.505] },
    { alder: 40, faktorerPraHeleAar: [0.625, 1.256, 1.893, 2.535, 3.183, 3.836, 4.494, 5.157, 5.825, 6.497] },
    { alder: 41, faktorerPraHeleAar: [0.625, 1.256, 1.892, 2.534, 3.181, 3.833, 4.49, 5.152, 5.818, 6.489] },
    { alder: 42, faktorerPraHeleAar: [0.625, 1.256, 1.892, 2.533, 3.179, 3.83, 4.486, 5.146, 5.811, 6.479] },
    { alder: 43, faktorerPraHeleAar: [0.625, 1.255, 1.891, 2.532, 3.177, 3.827, 4.481, 5.14, 5.803, 6.469] },
    { alder: 44, faktorerPraHeleAar: [0.625, 1.255, 1.89, 2.53, 3.175, 3.823, 4.476, 5.133, 5.794, 6.457] },
    { alder: 45, faktorerPraHeleAar: [0.625, 1.255, 1.889, 2.529, 3.172, 3.82, 4.471, 5.126, 5.784, 6.445] },
    { alder: 46, faktorerPraHeleAar: [0.625, 1.254, 1.888, 2.527, 3.169, 3.816, 4.465, 5.118, 5.774, 6.432] },
    { alder: 47, faktorerPraHeleAar: [0.625, 1.254, 1.887, 2.525, 3.166, 3.811, 4.459, 5.109, 5.762, 6.417] },
    { alder: 48, faktorerPraHeleAar: [0.625, 1.253, 1.886, 2.523, 3.163, 3.806, 4.452, 5.1, 5.75, 6.401] },
    { alder: 49, faktorerPraHeleAar: [0.624, 1.253, 1.885, 2.521, 3.159, 3.801, 4.444, 5.09, 5.737, 6.384] },
    { alder: 50, faktorerPraHeleAar: [0.624, 1.252, 1.884, 2.518, 3.155, 3.795, 4.436, 5.079, 5.722, 6.365] },
    { alder: 51, faktorerPraHeleAar: [0.624, 1.252, 1.882, 2.516, 3.151, 3.789, 4.427, 5.067, 5.706, 6.345] },
    { alder: 52, faktorerPraHeleAar: [0.624, 1.251, 1.881, 2.513, 3.147, 3.782, 4.417, 5.053, 5.689, 6.323] },
    { alder: 53, faktorerPraHeleAar: [0.624, 1.25, 1.879, 2.51, 3.142, 3.774, 4.407, 5.039, 5.67, 6.299] },
    { alder: 54, faktorerPraHeleAar: [0.624, 1.25, 1.877, 2.506, 3.136, 3.766, 4.395, 5.023, 5.65, 6.273] },
    { alder: 55, faktorerPraHeleAar: [0.624, 1.249, 1.875, 2.503, 3.13, 3.757, 4.383, 5.006, 5.627, 6.245] },
    { alder: 56, faktorerPraHeleAar: [0.623, 1.248, 1.873, 2.499, 3.124, 3.747, 4.369, 4.988, 5.603, 6.214] },
    { alder: 57, faktorerPraHeleAar: [0.623, 1.247, 1.871, 2.494, 3.117, 3.737, 4.354, 4.968, 5.577, 6.181] },
    { alder: 58, faktorerPraHeleAar: [0.623, 1.246, 1.868, 2.49, 3.109, 3.725, 4.338, 4.946, 5.549, 6.145] },
    { alder: 59, faktorerPraHeleAar: [0.623, 1.245, 1.865, 2.484, 3.1, 3.713, 4.321, 4.923, 5.519] },
    { alder: 60, faktorerPraHeleAar: [0.622, 1.243, 1.862, 2.479, 3.091, 3.699, 4.302, 4.898] },
    { alder: 61, faktorerPraHeleAar: [0.622, 1.242, 1.859, 2.473, 3.081, 3.685, 4.281] },
    { alder: 62, faktorerPraHeleAar: [0.622, 1.24, 1.855, 2.466, 3.071] },
    { alder: 63, faktorerPraHeleAar: [0.621, 1.239, 1.851, 2.459] },
    { alder: 64, faktorerPraHeleAar: [0.621, 1.237, 1.847] },
    { alder: 65, faktorerPraHeleAar: [0.62, 1.235] },
    { alder: 66, faktorerPraHeleAar: [0.62] },
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabAfloesningsTabeller = {} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;
