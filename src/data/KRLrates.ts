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
import { formatDanishDate, getInclusivePeriodEndByMonths, parseDanishDate } from '../utils/dateUtils';

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
  ['01-04-2018',             36.1675,        19.4307,           null,          null  ],
  ['01-10-2017',             34.6860,        18.1313,           null,          null  ],
  ['01-01-2017',             34.4646,        17.9372,           null,          null  ],
  ['01-10-2016',             32.9131,        16.5764,           null,          null  ],
  ['01-01-2016',             31.7798,        15.5825,           null,          null  ],
  ['01-10-2015',             31.1333,        15.0155,           null,          null  ],
  ['01-04-2015',             30.5367,        14.4922,           null,          null  ],
  ['01-10-2014',             29.2955,        13.4035,           null,          null  ],
  ['01-01-2014',             28.4900,        12.6970,           null,          null  ],
  ['01-10-2013',             27.8546,        12.1397,           null,          null  ],
  ['01-04-2013',             27.7089,        12.0119,           null,          null  ],
  ['01-10-2012',             27.0735,        11.4546,           null,          null  ],
  ['01-04-2010',             24.8812,         9.5317,           null,          null  ],
  ['01-10-2009',             24.6995,         9.3723,           null,          null  ],
  ['01-04-2009',             23.3114,         8.1548,           null,          null  ],
  ['01-10-2008',             23.0783,         7.9504,           null,          null  ],
  ['01-04-2008',             21.2953,         6.3865,           null,          null  ],
  ['01-01-2008',             16.5293,         2.2063,           null,          null  ],
  ['01-10-2007',             16.5293,          null,            null,          null  ],
  ['01-04-2007',             16.0535,          null,            null,          null  ],
  ['01-10-2006',             15.1539,          null,            null,          null  ],
  ['01-01-2006',             14.0138,          null,            null,          null  ],
  ['01-04-2005',             12.4454,          null,            null,          null  ],
  ['01-10-2004',             12.4454,          null,            null,          null  ],
  ['01-08-2004',             12.0038,          null,            null,          null  ],
  ['01-04-2004',             10.9523,          null,            null,          null  ],
  ['01-10-2003',              9.2675,          null,            null,          null  ],
  ['01-08-2003',              8.8680,          null,            null,          null  ],
  ['01-04-2003',              8.3422,          null,            null,          null  ],
  ['01-04-2002',              6.1566,          null,            null,          null  ],
  ['01-10-2001',              5.1157,          null,            null,          null  ],
  ['01-04-2001',              4.0662,          null,            null,          null  ],
];

// ===== SATSTABELLER FRA SAMLET DATA =====

const KRL_IDS: ReadonlyArray<{ id: KRLSatstabelId; colIndex: 1 | 2 | 3 | 4 }> = [
  { id: 'KTO (kommuner)', colIndex: 1 },
  { id: 'SHK (kommuner)', colIndex: 2 },
  { id: 'KTO (regioner)', colIndex: 3 },
  { id: 'SHK (regioner)', colIndex: 4 },
];

export const isKRLSatstabelId = (value: string | undefined): value is KRLSatstabelId => {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  return KRL_IDS.some((entry) => entry.id === trimmed);
};

export const formatKRLSatstabelDisplay = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return '-';
  // Formatér som "KRL-satstabel (KTO, kommuner)"
  const parts = trimmed.split(' ');
  if (parts.length === 2) {
    const [type, org] = parts;
    const orgFormatted = org.replace(/[()]/g, ''); // Fjern parenteser fra "(kommuner)"
    return `KRL-satstabel (${type}, ${orgFormatted})`;
  }
  return `KRL-satstabel (${trimmed})`;
};

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

/**
 * Returnerer dato-intervallet for en given KRL satstabel.
 *
 * fraDato = ældste regulerings-startdato
 * tilDato = nyeste regulerings-startdato + 6 måneder − 1 dag
 *           (KRL-satser behandles som 6-måneders perioder i Mineo)
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

  const tilDato = formatDanishDate(getInclusivePeriodEndByMonths(nyesteDate, 6));

  return {
    fraDato: aeldste.fraDato,
    tilDato,
  };
};
