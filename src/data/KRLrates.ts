/**
 * KRL Satstabeller – Kommunernes og Regionernes Løndatakontor
 *
 * Indeholder reguleringsprocenter for fire lønudviklingsmodeller:
 * - KTO (kommuner)
 * - SHK (kommuner)
 * - KTO (regioner)
 * - SHK (regioner)
 *
 * Bruges til fremskrivning af løn baseret på KRL's reguleringssatser.
 * Alle værdier er reguleringsprocenter (fx 61.4627 = 61,4627 %).
 *
 * Data er organiseret i én samlet tabel med fem kolonner:
 * fraDato │ KTO (kommuner) │ SHK (kommuner) │ KTO (regioner) │ SHK (regioner)
 *
 * Tomme felter (null) angiver at satsen ikke er defineret for den pågældende dato.
 */

import { toDanishDateString, type DanishDateString } from '../types/branded';
import { addDays, addMonths, formatDanishDate, parseDanishDate } from '../utils/dateUtils';

// ===== TYPE DEFINITIONER =====

export type KRLSatstabelId =
  | 'KTO (kommuner)'
  | 'SHK (kommuner)'
  | 'KTO (regioner)'
  | 'SHK (regioner)';

export interface KRLSatsVaerdi {
  readonly fraDato: DanishDateString;
  readonly reguleringsPct: number; // Reguleringsprocent, fx 61.4627
}

export interface KRLSatstabel {
  readonly id: KRLSatstabelId;
  readonly navn: string;
  readonly vaerdier: ReadonlyArray<KRLSatsVaerdi>; // Nyeste først
}

export type KRLReguleringsDatoInterval = Readonly<{
  fraDato: DanishDateString;
  tilDato: DanishDateString;
}>;

// ===== HELPER FUNKTIONER =====

const d = (dateStr: string): DanishDateString => toDanishDateString(dateStr);

/**
 * Samlet tabelrække:
 * [fraDato, KTO kommuner, SHK kommuner, KTO regioner, SHK regioner]
 *
 * null = satsen er ikke defineret for den pågældende dato.
 */
type KRLCombinedRow = readonly [
  fraDato: string,
  ktoKommuner: number | null,
  shkKommuner: number | null,
  ktoRegioner: number | null,
  shkRegioner: number | null,
];

// ===== KRL SATSTABEL DATA =====

/**
 * Samlet tabel med alle fire KRL satstabeller.
 * Sorteret nyeste først.
 *
 * Kolonner:
 *   fraDato         │ KTO (kom.)  │ SHK (kom.)  │ KTO (reg.)  │ SHK (reg.)
 */
const krlCombinedData: ReadonlyArray<KRLCombinedRow> = [
  // fraDato            │ KTO (kom.)    │ SHK (kom.)    │ KTO (reg.)    │ SHK (reg.)
  ['01-11-2025',             61.4627,        41.6167,        16.9930,        16.9930 ],
  ['01-10-2025',             60.2921,        40.5900,        16.1800,        16.1800 ],
  ['01-04-2025',             59.8159,        40.1724,        15.6970,        15.6970 ],
  ['01-01-2025',             59.8159,        40.1724,        15.6970,        15.6970 ],
  ['01-10-2024',             59.8159,        40.1724,        15.6970,        15.6970 ],
  ['01-04-2024',             57.7650,        38.3735,        14.1109,        14.1109 ],
  ['01-10-2023',             51.6971,        33.0514,         9.7220,         9.7220 ],
  ['01-04-2023',             49.8304,        31.4141,         9.1976,         9.1976 ],
  ['01-01-2023',             49.4018,        31.0382,         9.1976,         9.1976 ],
  ['01-10-2022',             49.4018,        31.0382,         8.3866,         8.3866 ],
  ['01-04-2022',             45.6933,        27.7855,         6.4474,         6.4474 ],
  ['01-10-2021',             45.6933,        27.7855,         6.4474,         6.4474 ],
  ['01-04-2021',             44.2796,        26.5456,         6.1123,         6.1123 ],
  ['01-10-2020',             42.8511,        25.2927,         5.3224,         5.3224 ],
  ['01-04-2020',             41.7798,        24.3531,         4.9075,         4.9075 ],
  ['01-01-2020',             41.2411,        23.8806,         4.5075,         4.5075 ],
  ['01-10-2019',             39.0861,        21.9905,         2.8075,         2.8075 ],
  ['01-04-2019',             37.7253,        20.7970,         2.0238,         2.0238 ],
  ['01-10-2018',             37.7253,        20.7970,         2.0238,         2.0238 ],
  ['01-04-2018',             36.1675,        19.4307,        35.8890,        19.5827 ],
  ['01-10-2017',             34.6860,        18.1313,        34.4105,        18.2816 ],
  ['01-01-2017',             34.4646,        17.9372,        34.0239,        17.9414 ],
  ['01-10-2016',             32.9131,        16.5764,        32.4715,        16.5753 ],
  ['01-01-2016',             31.7798,        15.5825,        31.5364,        15.7525 ],
  ['01-10-2015',             31.1333,        15.0155,        30.8896,        15.1833 ],
  ['01-04-2015',             30.5367,        14.4922,        30.6072,        14.9348 ],
  ['01-10-2014',             29.2955,        13.4035,        29.3653,        13.8419 ],
  ['01-01-2014',             28.4900,        12.6970,        28.4442,        13.0199 ],
  ['01-10-2013',             27.8546,        12.1397,        27.8092,        12.4612 ],
  ['01-04-2013',             27.7089,        12.0119,        27.6378,        12.2993 ],
  ['01-10-2012',             27.0735,        11.4546,        27.0028,        11.7406 ],
  ['01-01-2012',             26.8904,        11.2940,        26.8328,        11.5793 ],
  ['01-04-2010',             24.8812,         9.5317,        24.8979,         9.5358 ],
  ['01-10-2009',             24.6995,         9.3723,        24.8979,         9.5358 ],
  ['01-04-2009',             23.3114,         8.1548,        23.3114,         8.1444 ],
  ['01-10-2008',             23.0783,         7.9504,        23.0783,         7.9400 ],
  ['01-04-2008',             21.2953,         6.3865,        21.2953,         6.3763 ],
  ['01-01-2008',             16.5293,         2.2063,        16.5293,         2.2063 ],
  ['01-10-2007',             16.5293,          null,         16.5293,          null  ],
  ['01-04-2007',             16.0535,          null,         16.0535,          null  ],
  ['01-10-2006',             15.1539,          null,         15.1539,          null  ],
  ['01-01-2006',             14.0138,          null,         14.0138,          null  ],
  ['01-04-2005',             12.4454,          null,         12.4454,          null  ],
  ['01-10-2004',             12.4454,          null,         12.4454,          null  ],
  ['01-08-2004',             12.0038,          null,         12.0038,          null  ],
  ['01-04-2004',             10.9523,          null,         10.9523,          null  ],
  ['01-10-2003',              9.2675,          null,          9.2675,          null  ],
  ['01-08-2003',              8.8680,          null,          8.8680,          null  ],
  ['01-04-2003',              8.3422,          null,          8.3422,          null  ],
  ['01-04-2002',              6.1566,          null,          6.1566,          null  ],
  ['01-10-2001',              5.1157,          null,          5.1157,          null  ],
  ['01-04-2001',              4.0662,          null,          4.0662,          null  ],
];

// ===== SATSTABELLER FRA SAMLET DATA =====

const KRL_IDS: ReadonlyArray<{ id: KRLSatstabelId; colIndex: 1 | 2 | 3 | 4 }> = [
  { id: 'KTO (kommuner)', colIndex: 1 },
  { id: 'SHK (kommuner)', colIndex: 2 },
  { id: 'KTO (regioner)', colIndex: 3 },
  { id: 'SHK (regioner)', colIndex: 4 },
];

const buildSatstabelFromCombined = (
  id: KRLSatstabelId,
  colIndex: 1 | 2 | 3 | 4
): KRLSatstabel => {
  const vaerdier: KRLSatsVaerdi[] = [];
  for (const row of krlCombinedData) {
    const pct = row[colIndex];
    if (pct !== null) {
      vaerdier.push({ fraDato: d(row[0]), reguleringsPct: pct });
    }
  }
  return { id, navn: id, vaerdier };
};

export const krlSatstabeller: ReadonlyArray<KRLSatstabel> =
  KRL_IDS.map(({ id, colIndex }) => buildSatstabelFromCombined(id, colIndex));

// ===== LOOKUP MAP =====

const krlSatstabelById = new Map<KRLSatstabelId, KRLSatstabel>();
for (const tabel of krlSatstabeller) {
  if (krlSatstabelById.has(tabel.id)) {
    throw new Error(`Duplicate KRL satstabel-ID: "${tabel.id}"`);
  }
  krlSatstabelById.set(tabel.id, tabel);
}

// ===== OPSLAGS-FUNKTIONER =====

export const getKRLSatstabel = (id: KRLSatstabelId): KRLSatstabel | undefined => {
  return krlSatstabelById.get(id);
};

export const getAlleKRLSatstabelIds = (): ReadonlyArray<KRLSatstabelId> => {
  return krlSatstabeller.map((t) => t.id);
};

/**
 * Returnerer dato-intervallet for en given KRL satstabel.
 *
 * fraDato = ældste regulerings-startdato
 * tilDato = nyeste regulerings-startdato + 6 måneder − 1 dag
 *           (KRL-satser gælder i 6 måneder fra startdatoen)
 */
export const getReguleringsDatoIntervalForKRL = (
  id: KRLSatstabelId
): KRLReguleringsDatoInterval | undefined => {
  const tabel = krlSatstabelById.get(id);
  if (!tabel || tabel.vaerdier.length === 0) return undefined;

  // Værdier er sorteret nyeste først
  const nyeste = tabel.vaerdier[0];
  const aeldste = tabel.vaerdier[tabel.vaerdier.length - 1];

  const nyesteDate = parseDanishDate(nyeste.fraDato);
  if (!nyesteDate) return undefined;

  const tilDato = formatDanishDate(addDays(addMonths(nyesteDate, 6), -1));

  return {
    fraDato: aeldste.fraDato,
    tilDato,
  };
};
