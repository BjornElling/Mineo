import { toISODateString } from '../../../types/branded';
import type { AldersFaktorRaekke, AldersKoensopdeltFaktorRaekke, ForsoergertabMatrixRaekke } from '.';

export const kapitaliseringsId = '198/2015' as const;
export const kapitaliseringsType = 'bkg' as const;
export const kapitaliseringsFuldeNavn =
  'Bekendtgørelse om omsætning af løbende ydelser til kapitalbeløb for arbejdsskader før den 1. januar 2011' as const;
export const kapitaliseringsDatering = '25/02/2015' as const;
export const gyldigFra = toISODateString('2015-03-01');
export const gyldigTil = toISODateString('2015-12-28');

// Udtrukket maskinelt fra Bkg. 198 2015.pdf.
// Kun tabeller for erhvervsevnetab og forsørgertab er medtaget.
// Tabeller for varigt mén og behandlingsudgifter er bevidst udeladt.

const ERHVERVSEVNETAB_TABELVALG_DATA = [
  // skadedatoFra     foedselsdatoFra     foedselsdatoTil     tabel
  ['2007-07-01',     '1955-07-01',     null,     'A'],
  ['2007-07-01',     '1955-01-01',     '1955-06-30',     'B'],
  ['2007-07-01',     '1954-07-01',     '1954-12-31',     'C'],
  ['2007-07-01',     '1954-01-01',     '1954-06-30',     'D'],
  ['2007-07-01',     '1900-01-01',     '1953-12-31',     'E'],
  ['2004-01-01',     '1955-07-01',     null,     'G'],
  ['2004-01-01',     '1955-01-01',     '1955-06-30',     'H'],
  ['2004-01-01',     '1954-07-01',     '1954-12-31',     'I'],
  ['2004-01-01',     '1954-01-01',     '1954-06-30',     'J'],
  ['2004-01-01',     '1900-01-01',     '1953-12-31',     'K'],
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
    { alder: 5, faktor: 33.142 },
    { alder: 6, faktor: 32.611 },
    { alder: 7, faktor: 32.079 },
    { alder: 8, faktor: 31.546 },
    { alder: 9, faktor: 31.014 },
    { alder: 10, faktor: 30.48 },
    { alder: 11, faktor: 29.946 },
    { alder: 12, faktor: 29.412 },
    { alder: 13, faktor: 28.877 },
    { alder: 14, faktor: 28.342 },
    { alder: 15, faktor: 27.806 },
    { alder: 16, faktor: 27.27 },
    { alder: 17, faktor: 26.734 },
    { alder: 18, faktor: 26.197 },
    { alder: 19, faktor: 25.661 },
    { alder: 20, faktor: 25.124 },
    { alder: 21, faktor: 24.586 },
    { alder: 22, faktor: 24.049 },
    { alder: 23, faktor: 23.511 },
    { alder: 24, faktor: 22.974 },
    { alder: 25, faktor: 22.436 },
    { alder: 26, faktor: 21.899 },
    { alder: 27, faktor: 21.361 },
    { alder: 28, faktor: 20.824 },
    { alder: 29, faktor: 20.287 },
    { alder: 30, faktor: 19.75 },
    { alder: 31, faktor: 19.213 },
    { alder: 32, faktor: 18.676 },
    { alder: 33, faktor: 18.14 },
    { alder: 34, faktor: 17.605 },
    { alder: 35, faktor: 17.069 },
    { alder: 36, faktor: 16.535 },
    { alder: 37, faktor: 16 },
    { alder: 38, faktor: 15.467 },
    { alder: 39, faktor: 14.934 },
    { alder: 40, faktor: 14.402 },
    { alder: 41, faktor: 13.871 },
    { alder: 42, faktor: 13.34 },
    { alder: 43, faktor: 12.81 },
    { alder: 44, faktor: 12.281 },
    { alder: 45, faktor: 11.753 },
    { alder: 46, faktor: 11.226 },
    { alder: 47, faktor: 10.7 },
    { alder: 48, faktor: 10.174 },
    { alder: 49, faktor: 9.65 },
    { alder: 50, faktor: 9.125 },
    { alder: 51, faktor: 8.602 },
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
  B: [
    { alder: 59, faktor: 4.155 },
    { alder: 60, faktor: 3.623 },
    { alder: 61, faktor: 3.086 },
    { alder: 62, faktor: 2.546 },
    { alder: 63, faktor: 1.999 },
    { alder: 64, faktor: 1.446 }
  ],
  C: [
    { alder: 60, faktor: 3.362 },
    { alder: 61, faktor: 2.822 },
    { alder: 62, faktor: 2.277 },
    { alder: 63, faktor: 1.726 }
  ],
  D: [
    { alder: 60, faktor: 3.096 },
    { alder: 61, faktor: 2.552 },
    { alder: 62, faktor: 2.003 },
    { alder: 63, faktor: 1.447 }
  ],
  E: [
    { alder: 61, faktor: 2.282 },
    { alder: 62, faktor: 1.728 }
  ],
  G: [
    { alder: 5, faktor: 10.453 },
    { alder: 6, faktor: 10.448 },
    { alder: 7, faktor: 10.443 },
    { alder: 8, faktor: 10.437 },
    { alder: 9, faktor: 10.431 },
    { alder: 10, faktor: 10.424 },
    { alder: 11, faktor: 10.416 },
    { alder: 12, faktor: 10.408 },
    { alder: 13, faktor: 10.4 },
    { alder: 14, faktor: 10.39 },
    { alder: 15, faktor: 10.38 },
    { alder: 16, faktor: 10.369 },
    { alder: 17, faktor: 10.356 },
    { alder: 18, faktor: 10.343 },
    { alder: 19, faktor: 10.329 },
    { alder: 20, faktor: 10.313 },
    { alder: 21, faktor: 10.296 },
    { alder: 22, faktor: 10.277 },
    { alder: 23, faktor: 10.257 },
    { alder: 24, faktor: 10.235 },
    { alder: 25, faktor: 10.211 },
    { alder: 26, faktor: 10.185 },
    { alder: 27, faktor: 10.157 },
    { alder: 28, faktor: 10.127 },
    { alder: 29, faktor: 10.094 },
    { alder: 30, faktor: 10.058 },
    { alder: 31, faktor: 10.019 },
    { alder: 32, faktor: 9.976 },
    { alder: 33, faktor: 9.93 },
    { alder: 34, faktor: 9.88 },
    { alder: 35, faktor: 9.826 },
    { alder: 36, faktor: 9.767 },
    { alder: 37, faktor: 9.703 },
    { alder: 38, faktor: 9.634 },
    { alder: 39, faktor: 9.558 },
    { alder: 40, faktor: 9.477 },
    { alder: 41, faktor: 9.388 },
    { alder: 42, faktor: 9.292 },
    { alder: 43, faktor: 9.187 },
    { alder: 44, faktor: 9.074 },
    { alder: 45, faktor: 8.951 },
    { alder: 46, faktor: 8.817 },
    { alder: 47, faktor: 8.672 },
    { alder: 48, faktor: 8.514 },
    { alder: 49, faktor: 8.343 },
    { alder: 50, faktor: 8.156 },
    { alder: 51, faktor: 7.953 },
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
  H: [
    { alder: 59, faktor: 5.287 },
    { alder: 60, faktor: 4.813 },
    { alder: 61, faktor: 4.291 },
    { alder: 62, faktor: 3.714 },
    { alder: 63, faktor: 3.077 },
    { alder: 64, faktor: 2.371 }
  ],
  I: [
    { alder: 60, faktor: 4.572 },
    { alder: 61, faktor: 4.023 },
    { alder: 62, faktor: 3.416 },
    { alder: 63, faktor: 2.745 }
  ],
  J: [
    { alder: 60, faktor: 4.302 },
    { alder: 61, faktor: 3.722 },
    { alder: 62, faktor: 3.082 },
    { alder: 63, faktor: 2.372 }
  ],
  K: [
    { alder: 61, faktor: 3.422 },
    { alder: 62, faktor: 2.748 }
  ],
} as const satisfies Record<string, readonly AldersFaktorRaekke[]>;

export const erhvervsevnetabKoensopdelteTabeller = {} as const satisfies Record<string, readonly AldersKoensopdeltFaktorRaekke[]>;

export const forsoergertabTabeller = 
{
  F: [
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
    { alder: 28, faktorerPraHeleAar: [0.584, 1.166, 1.746, 2.326, 2.904, 3.48, 4.055, 4.628, 5.199, 5.769] },
    { alder: 29, faktorerPraHeleAar: [0.583, 1.166, 1.746, 2.325, 2.903, 3.479, 4.053, 4.626, 5.197, 5.766] },
    { alder: 30, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.478, 4.052, 4.624, 5.195, 5.763] },
    { alder: 31, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.325, 2.902, 3.477, 4.051, 4.622, 5.192, 5.76] },
    { alder: 32, faktorerPraHeleAar: [0.583, 1.165, 1.746, 2.324, 2.901, 3.476, 4.049, 4.62, 5.189, 5.756] },
    { alder: 33, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.324, 2.9, 3.475, 4.047, 4.618, 5.186, 5.753] },
    { alder: 34, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.323, 2.899, 3.474, 4.046, 4.616, 5.183, 5.748] },
    { alder: 35, faktorerPraHeleAar: [0.583, 1.165, 1.745, 2.322, 2.898, 3.472, 4.044, 4.613, 5.18, 5.744] },
    { alder: 36, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.322, 2.897, 3.471, 4.041, 4.61, 5.176, 5.739] },
    { alder: 37, faktorerPraHeleAar: [0.583, 1.165, 1.744, 2.321, 2.896, 3.469, 4.039, 4.607, 5.172, 5.734] },
    { alder: 38, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.32, 2.895, 3.467, 4.036, 4.603, 5.167, 5.728] },
    { alder: 39, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.32, 2.894, 3.465, 4.034, 4.599, 5.162, 5.722] },
    { alder: 40, faktorerPraHeleAar: [0.583, 1.164, 1.743, 2.319, 2.892, 3.463, 4.031, 4.595, 5.157, 5.715] },
    { alder: 41, faktorerPraHeleAar: [0.583, 1.164, 1.742, 2.318, 2.89, 3.46, 4.027, 4.591, 5.151, 5.707] },
    { alder: 42, faktorerPraHeleAar: [0.583, 1.164, 1.741, 2.317, 2.889, 3.458, 4.024, 4.586, 5.144, 5.699] },
    { alder: 43, faktorerPraHeleAar: [0.583, 1.163, 1.741, 2.315, 2.887, 3.455, 4.02, 4.581, 5.138, 5.69] },
    { alder: 44, faktorerPraHeleAar: [0.583, 1.163, 1.74, 2.314, 2.885, 3.452, 4.015, 4.575, 5.13, 5.681] },
    { alder: 45, faktorerPraHeleAar: [0.583, 1.163, 1.739, 2.313, 2.882, 3.448, 4.01, 4.568, 5.122, 5.67] },
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
    { alder: 58, faktorerPraHeleAar: [0.581, 1.154, 1.72, 2.277, 2.826, 3.365, 3.893, 4.411, 4.918] },
    { alder: 59, faktorerPraHeleAar: [0.581, 1.153, 1.717, 2.273, 2.818, 3.353, 3.878, 4.391] },
    { alder: 60, faktorerPraHeleAar: [0.58, 1.152, 1.715, 2.267, 2.81, 3.341, 3.861] },
    { alder: 61, faktorerPraHeleAar: [0.58, 1.151, 1.712, 2.262, 2.801, 3.328] },
    { alder: 62, faktorerPraHeleAar: [0.58, 1.149, 1.708, 2.256, 2.791] },
    { alder: 63, faktorerPraHeleAar: [0.579, 1.148, 1.705, 2.249] },
    { alder: 64, faktorerPraHeleAar: [0.579, 1.146, 1.701] },
    { alder: 65, faktorerPraHeleAar: [0.578, 1.144] },
    { alder: 66, faktorerPraHeleAar: [0.578] }
  ],
} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerMaend = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;

export const forsoergertabTabellerKvinder = {} as const satisfies Record<string, readonly ForsoergertabMatrixRaekke[]>;
