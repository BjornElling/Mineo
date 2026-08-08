import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '1700/2015' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb for arbejdsskader før den 1. januar 2011' as const;
export const kapitaliseringsDatering = '15/12/2015' as const;
export const gyldigFra = toISODateString('2015-12-29');
export const gyldigTil = toISODateString('2020-12-30');

// Udtrukket maskinelt fra Bkg. 1700 2015.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     tabel
  ['2007-07-01',     '1963-01-01',     null,     'A'],
  ['2007-07-01',     '1955-07-01',     '1962-12-31',     'B'],
  ['2007-07-01',     '1955-01-01',     '1955-06-30',     'C'],
  ['2007-07-01',     '1954-07-01',     '1954-12-31',     'D'],
  ['2007-07-01',     '1954-01-01',     '1954-06-30',     'E'],
  ['2007-07-01',     '1900-01-01',     '1953-12-31',     'F'],
  ['2004-01-01',     '1963-01-01',     null,     'H'],
  ['2004-01-01',     '1955-07-01',     '1962-12-31',     'I'],
  ['2004-01-01',     '1955-01-01',     '1955-06-30',     'J'],
  ['2004-01-01',     '1954-07-01',     '1954-12-31',     'K'],
  ['2004-01-01',     '1954-01-01',     '1954-06-30',     'L'],
  ['2004-01-01',     '1900-01-01',     '1953-12-31',     'M'],
] as const;

export const erhvervsevnetabTabelvalg = ERHVERVSEVNETAB_TABELVALG_DATA.map(
  ([skadedatoFra, foedselsdatoFra, foedselsdatoTil, tabel]) => ({
    skadedatoFra: toISODateString(skadedatoFra),
    foedselsdatoFra: toISODateString(foedselsdatoFra),
    foedselsdatoTil: foedselsdatoTil ? toISODateString(foedselsdatoTil) : null,
    tabel,
  })
);

export const erhvervsevnetabTabeller = 
{
  A: [
    { alder: 5, faktor: 33.55 },
    { alder: 6, faktor: 33.019 },
    { alder: 7, faktor: 32.488 },
    { alder: 8, faktor: 31.956 },
    { alder: 9, faktor: 31.424 },
    { alder: 10, faktor: 30.891 },
    { alder: 11, faktor: 30.357 },
    { alder: 12, faktor: 29.824 },
    { alder: 13, faktor: 29.29 },
    { alder: 14, faktor: 28.755 },
    { alder: 15, faktor: 28.22 },
    { alder: 16, faktor: 27.685 },
    { alder: 17, faktor: 27.15 },
    { alder: 18, faktor: 26.614 },
    { alder: 19, faktor: 26.078 },
    { alder: 20, faktor: 25.541 },
    { alder: 21, faktor: 25.005 },
    { alder: 22, faktor: 24.468 },
    { alder: 23, faktor: 23.932 },
    { alder: 24, faktor: 23.395 },
    { alder: 25, faktor: 22.858 },
    { alder: 26, faktor: 22.322 },
    { alder: 27, faktor: 21.785 },
    { alder: 28, faktor: 21.249 },
    { alder: 29, faktor: 20.712 },
    { alder: 30, faktor: 20.176 },
    { alder: 31, faktor: 19.641 },
    { alder: 32, faktor: 19.105 },
    { alder: 33, faktor: 18.57 },
    { alder: 34, faktor: 18.036 },
    { alder: 35, faktor: 17.502 },
    { alder: 36, faktor: 16.968 },
    { alder: 37, faktor: 16.435 },
    { alder: 38, faktor: 15.903 },
    { alder: 39, faktor: 15.372 },
    { alder: 40, faktor: 14.841 },
    { alder: 41, faktor: 14.312 },
    { alder: 42, faktor: 13.783 },
    { alder: 43, faktor: 13.255 },
    { alder: 44, faktor: 12.728 },
    { alder: 45, faktor: 12.202 },
    { alder: 46, faktor: 11.677 },
    { alder: 47, faktor: 11.153 },
    { alder: 48, faktor: 10.63 },
    { alder: 49, faktor: 10.108 },
    { alder: 50, faktor: 9.587 },
    { alder: 51, faktor: 9.067 },
    { alder: 52, faktor: 8.547 },
    { alder: 53, faktor: 8.028 },
    { alder: 54, faktor: 7.51 },
    { alder: 55, faktor: 6.992 },
    { alder: 56, faktor: 6.473 },
    { alder: 57, faktor: 5.955 },
    { alder: 58, faktor: 5.435 },
    { alder: 59, faktor: 4.915 },
    { alder: 60, faktor: 4.392 },
    { alder: 61, faktor: 3.867 },
    { alder: 62, faktor: 3.338 },
    { alder: 63, faktor: 2.805 },
    { alder: 64, faktor: 2.267 },
    { alder: 65, faktor: 1.722 }
  ],
  B: [
    { alder: 52, faktor: 8.079 },
    { alder: 53, faktor: 7.557 },
    { alder: 54, faktor: 7.034 },
    { alder: 55, faktor: 6.511 },
    { alder: 56, faktor: 5.988 },
    { alder: 57, faktor: 5.465 },
    { alder: 58, faktor: 4.939 },
    { alder: 59, faktor: 4.413 },
    { alder: 60, faktor: 3.883 },
    { alder: 61, faktor: 3.351 },
    { alder: 62, faktor: 2.814 },
    { alder: 63, faktor: 2.272 },
    { alder: 64, faktor: 1.724 }
  ],
  C: [
    { alder: 60, faktor: 3.623 },
    { alder: 61, faktor: 3.086 },
    { alder: 62, faktor: 2.546 },
    { alder: 63, faktor: 1.999 },
    { alder: 64, faktor: 1.446 }
  ],
  D: [
    { alder: 60, faktor: 3.362 },
    { alder: 61, faktor: 2.822 },
    { alder: 62, faktor: 2.277 },
    { alder: 63, faktor: 1.726 }
  ],
  E: [
    { alder: 61, faktor: 2.552 },
    { alder: 62, faktor: 2.003 },
    { alder: 63, faktor: 1.447 }
  ],
  F: [
    { alder: 61, faktor: 2.282 },
    { alder: 62, faktor: 1.728 }
  ],
  H: [
    { alder: 5, faktor: 10.455 },
    { alder: 6, faktor: 10.45 },
    { alder: 7, faktor: 10.445 },
    { alder: 8, faktor: 10.44 },
    { alder: 9, faktor: 10.434 },
    { alder: 10, faktor: 10.427 },
    { alder: 11, faktor: 10.42 },
    { alder: 12, faktor: 10.412 },
    { alder: 13, faktor: 10.404 },
    { alder: 14, faktor: 10.395 },
    { alder: 15, faktor: 10.385 },
    { alder: 16, faktor: 10.374 },
    { alder: 17, faktor: 10.363 },
    { alder: 18, faktor: 10.35 },
    { alder: 19, faktor: 10.336 },
    { alder: 20, faktor: 10.321 },
    { alder: 21, faktor: 10.305 },
    { alder: 22, faktor: 10.288 },
    { alder: 23, faktor: 10.268 },
    { alder: 24, faktor: 10.248 },
    { alder: 25, faktor: 10.225 },
    { alder: 26, faktor: 10.201 },
    { alder: 27, faktor: 10.174 },
    { alder: 28, faktor: 10.145 },
    { alder: 29, faktor: 10.114 },
    { alder: 30, faktor: 10.08 },
    { alder: 31, faktor: 10.043 },
    { alder: 32, faktor: 10.003 },
    { alder: 33, faktor: 9.96 },
    { alder: 34, faktor: 9.913 },
    { alder: 35, faktor: 9.862 },
    { alder: 36, faktor: 9.806 },
    { alder: 37, faktor: 9.747 },
    { alder: 38, faktor: 9.682 },
    { alder: 39, faktor: 9.611 },
    { alder: 40, faktor: 9.535 },
    { alder: 41, faktor: 9.452 },
    { alder: 42, faktor: 9.363 },
    { alder: 43, faktor: 9.265 },
    { alder: 44, faktor: 9.16 },
    { alder: 45, faktor: 9.046 },
    { alder: 46, faktor: 8.922 },
    { alder: 47, faktor: 8.787 },
    { alder: 48, faktor: 8.642 },
    { alder: 49, faktor: 8.483 },
    { alder: 50, faktor: 8.311 },
    { alder: 51, faktor: 8.125 },
    { alder: 52, faktor: 7.922 },
    { alder: 53, faktor: 7.701 },
    { alder: 54, faktor: 7.461 },
    { alder: 55, faktor: 7.2 },
    { alder: 56, faktor: 6.915 },
    { alder: 57, faktor: 6.604 },
    { alder: 58, faktor: 6.264 },
    { alder: 59, faktor: 5.892 },
    { alder: 60, faktor: 5.484 },
    { alder: 61, faktor: 5.037 },
    { alder: 62, faktor: 4.545 },
    { alder: 63, faktor: 4.002 },
    { alder: 64, faktor: 3.403 },
    { alder: 65, faktor: 2.738 }
  ],
  I: [
    { alder: 52, faktor: 7.732 },
    { alder: 53, faktor: 7.492 },
    { alder: 54, faktor: 7.229 },
    { alder: 55, faktor: 6.943 },
    { alder: 56, faktor: 6.631 },
    { alder: 57, faktor: 6.289 },
    { alder: 58, faktor: 5.915 },
    { alder: 59, faktor: 5.505 },
    { alder: 60, faktor: 5.054 },
    { alder: 61, faktor: 4.559 },
    { alder: 62, faktor: 4.013 },
    { alder: 63, faktor: 3.41 },
    { alder: 64, faktor: 2.742 }
  ],
  J: [
    { alder: 60, faktor: 4.813 },
    { alder: 61, faktor: 4.291 },
    { alder: 62, faktor: 3.714 },
    { alder: 63, faktor: 3.077 },
    { alder: 64, faktor: 2.371 }
  ],
  K: [
    { alder: 60, faktor: 4.572 },
    { alder: 61, faktor: 4.023 },
    { alder: 62, faktor: 3.416 },
    { alder: 63, faktor: 2.745 }
  ],
  L: [
    { alder: 61, faktor: 3.722 },
    { alder: 62, faktor: 3.082 },
    { alder: 63, faktor: 2.372 }
  ],
  M: [
    { alder: 61, faktor: 3.422 },
    { alder: 62, faktor: 2.748 }
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = 
{
  G: [
    { alder: 18, faktorerPraHeleAar: [0.584, 1.166, 1.748, 2.328, 2.907, 3.485, 4.062, 4.638, 5.212, 5.786] },
    { alder: 19, faktorerPraHeleAar: [0.584, 1.166, 1.748, 2.328, 2.907, 3.485, 4.062, 4.637, 5.211, 5.784] },
    { alder: 20, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.328, 2.907, 3.485, 4.061, 4.636, 5.211, 5.783] },
    { alder: 21, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.484, 4.061, 4.636, 5.209, 5.782] },
    { alder: 22, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.484, 4.06, 4.635, 5.208, 5.78] },
    { alder: 23, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.906, 3.483, 4.059, 4.634, 5.207, 5.779] },
    { alder: 24, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.905, 3.483, 4.058, 4.633, 5.206, 5.777] },
    { alder: 25, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.327, 2.905, 3.482, 4.058, 4.632, 5.204, 5.775] },
    { alder: 26, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.326, 2.905, 3.481, 4.057, 4.63, 5.203, 5.773] },
    { alder: 27, faktorerPraHeleAar: [0.584, 1.166, 1.747, 2.326, 2.904, 3.481, 4.056, 4.629, 5.201, 5.771] },
    { alder: 28, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.326, 2.904, 3.48, 4.055, 4.628, 5.199, 5.769] },
    { alder: 29, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.325, 2.903, 3.479, 4.053, 4.626, 5.197, 5.766] },
    { alder: 30, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.478, 4.052, 4.624, 5.195, 5.763] },
    { alder: 31, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.477, 4.051, 4.622, 5.192, 5.76] },
    { alder: 32, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.324, 2.901, 3.476, 4.049, 4.62, 5.189, 5.756] },
    { alder: 33, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.324, 2.9, 3.475, 4.047, 4.618, 5.186, 5.753] },
    { alder: 34, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.323, 2.899, 3.474, 4.046, 4.616, 5.183, 5.748] },
    { alder: 35, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.322, 2.898, 3.472, 4.044, 4.613, 5.18, 5.744] },
    { alder: 36, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.322, 2.897, 3.471, 4.041, 4.61, 5.176, 5.739] },
    { alder: 37, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.321, 2.896, 3.469, 4.039, 4.607, 5.172, 5.734] },
    { alder: 38, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.32, 2.895, 3.467, 4.037, 4.603, 5.167, 5.728] },
    { alder: 39, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.32, 2.894, 3.465, 4.034, 4.599, 5.162, 5.722] },
    { alder: 40, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.319, 2.892, 3.463, 4.031, 4.595, 5.157, 5.715] },
    { alder: 41, faktorerPraHeleAar: [0.583, 1.164, 1.742, 2.318, 2.89, 3.46, 4.027, 4.591, 5.151, 5.707] },
    { alder: 42, faktorerPraHeleAar: [0.583, 1.164, 1.741, 2.317, 2.889, 3.458, 4.024, 4.586, 5.144, 5.699] },
    { alder: 43, faktorerPraHeleAar: [0.583, 1.163, 1.741, 2.315, 2.887, 3.455, 4.02, 4.581, 5.137, 5.69] },
    { alder: 44, faktorerPraHeleAar: [0.583, 1.163, 1.74, 2.314, 2.885, 3.452, 4.015, 4.575, 5.13, 5.681] },
    { alder: 45, faktorerPraHeleAar: [0.583, 1.163, 1.739, 2.313, 2.882, 3.448, 4.011, 4.568, 5.122, 5.67] },
    { alder: 46, faktorerPraHeleAar: [0.583, 1.162, 1.738, 2.311, 2.88, 3.445, 4.005, 4.561, 5.113, 5.659] },
    { alder: 47, faktorerPraHeleAar: [0.583, 1.162, 1.738, 2.309, 2.877, 3.441, 4, 4.554, 5.103, 5.646] },
    { alder: 48, faktorerPraHeleAar: [0.583, 1.161, 1.737, 2.308, 2.874, 3.436, 3.994, 4.546, 5.092, 5.632] },
    { alder: 49, faktorerPraHeleAar: [0.582, 1.161, 1.735, 2.306, 2.871, 3.432, 3.987, 4.537, 5.08, 5.618] },
    { alder: 50, faktorerPraHeleAar: [0.582, 1.16, 1.734, 2.303, 2.868, 3.426, 3.98, 4.527, 5.068, 5.602] },
    { alder: 51, faktorerPraHeleAar: [0.582, 1.16, 1.733, 2.301, 2.864, 3.421, 3.972, 4.516, 5.054, 5.584] },
    { alder: 52, faktorerPraHeleAar: [0.582, 1.159, 1.732, 2.298, 2.86, 3.415, 3.963, 4.505, 5.039, 5.565] },
    { alder: 53, faktorerPraHeleAar: [0.582, 1.159, 1.73, 2.296, 2.855, 3.408, 3.954, 4.492, 5.023, 5.545] },
    { alder: 54, faktorerPraHeleAar: [0.582, 1.158, 1.728, 2.293, 2.85, 3.401, 3.944, 4.479, 5.005, 5.522] },
    { alder: 55, faktorerPraHeleAar: [0.582, 1.157, 1.727, 2.289, 2.845, 3.393, 3.933, 4.464, 4.986, 5.498] },
    { alder: 56, faktorerPraHeleAar: [0.581, 1.156, 1.725, 2.286, 2.839, 3.384, 3.921, 4.448, 4.965, 5.472] },
    { alder: 57, faktorerPraHeleAar: [0.581, 1.155, 1.722, 2.282, 2.833, 3.375, 3.908, 4.43, 4.942, 5.443] },
    { alder: 58, faktorerPraHeleAar: [0.581, 1.154, 1.72, 2.277, 2.826, 3.365, 3.893, 4.411, 4.918, 5.413] },
    { alder: 59, faktorerPraHeleAar: [0.581, 1.153, 1.717, 2.273, 2.818, 3.353, 3.878, 4.391, 4.891] },
    { alder: 60, faktorerPraHeleAar: [0.58, 1.152, 1.715, 2.268, 2.81, 3.341, 3.861, 4.369] },
    { alder: 61, faktorerPraHeleAar: [0.58, 1.151, 1.712, 2.262, 2.801, 3.328, 3.843] },
    { alder: 62, faktorerPraHeleAar: [0.58, 1.149, 1.708, 2.256, 2.791, 3.314] },
    { alder: 63, faktorerPraHeleAar: [0.579, 1.148, 1.705, 2.249, 2.781] },
    { alder: 64, faktorerPraHeleAar: [0.579, 1.146, 1.701, 2.242] },
    { alder: 65, faktorerPraHeleAar: [0.578, 1.144, 1.696] },
    { alder: 66, faktorerPraHeleAar: [0.578, 1.142] },
    { alder: 67, faktorerPraHeleAar: [0.577] }
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;
