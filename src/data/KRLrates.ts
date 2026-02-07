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

type KRLSatsTableRow = readonly [fraDato: string, reguleringsPct: number];

const vaerdierFromTable = (
  rows: ReadonlyArray<KRLSatsTableRow>
): ReadonlyArray<KRLSatsVaerdi> =>
  rows.map(([fraDatoStr, reguleringsPct]) => ({
    fraDato: d(fraDatoStr),
    reguleringsPct,
  }));

// ===== KRL SATSTABEL DATA =====

export const krlSatstabeller: ReadonlyArray<KRLSatstabel> = [
  // KTO (kommuner)
  {
    id: 'KTO (kommuner)',
    navn: 'KTO (kommuner)',
    vaerdier: vaerdierFromTable([
      // fraDato          │ Reg.pct
      ['01-11-2025',          61.4627 ],
      ['01-10-2025',          60.2921 ],
      ['01-04-2025',          59.8159 ],
      ['01-01-2025',          59.8159 ],
      ['01-10-2024',          59.8159 ],
      ['01-04-2024',          57.7650 ],
      ['01-10-2023',          51.6971 ],
      ['01-04-2023',          49.8304 ],
      ['01-01-2023',          49.4018 ],
      ['01-10-2022',          49.4018 ],
      ['01-04-2022',          45.6933 ],
      ['01-10-2021',          45.6933 ],
      ['01-04-2021',          44.2796 ],
      ['01-10-2020',          42.8511 ],
      ['01-04-2020',          41.7798 ],
      ['01-01-2020',          41.2411 ],
      ['01-10-2019',          39.0861 ],
      ['01-04-2019',          37.7253 ],
      ['01-10-2018',          37.7253 ],
      ['01-04-2018',          36.1675 ],
      ['01-10-2017',          34.6860 ],
      ['01-01-2017',          34.4646 ],
      ['01-10-2016',          32.9131 ],
      ['01-01-2016',          31.7798 ],
      ['01-10-2015',          31.1333 ],
      ['01-04-2015',          30.5367 ],
      ['01-10-2014',          29.2955 ],
      ['01-01-2014',          28.4900 ],
      ['01-10-2013',          27.8546 ],
      ['01-04-2013',          27.7089 ],
      ['01-10-2012',          27.0735 ],
      ['01-01-2012',          26.8904 ],
      ['01-04-2010',          24.8812 ],
      ['01-10-2009',          24.6995 ],
      ['01-04-2009',          23.3114 ],
      ['01-10-2008',          23.0783 ],
      ['01-04-2008',          21.2953 ],
      ['01-01-2008',          16.5293 ],
      ['01-10-2007',          16.5293 ],
      ['01-04-2007',          16.0535 ],
      ['01-10-2006',          15.1539 ],
      ['01-01-2006',          14.0138 ],
      ['01-04-2005',          12.4454 ],
      ['01-10-2004',          12.4454 ],
      ['01-08-2004',          12.0038 ],
      ['01-04-2004',          10.9523 ],
      ['01-10-2003',           9.2675 ],
      ['01-08-2003',           8.8680 ],
      ['01-04-2003',           8.3422 ],
      ['01-04-2002',           6.1566 ],
      ['01-10-2001',           5.1157 ],
      ['01-04-2001',           4.0662 ],
    ]),
  },

  // SHK (kommuner)
  {
    id: 'SHK (kommuner)',
    navn: 'SHK (kommuner)',
    vaerdier: vaerdierFromTable([
      // fraDato          │ Reg.pct
      ['01-11-2025',          41.6167 ],
      ['01-10-2025',          40.5900 ],
      ['01-04-2025',          40.1724 ],
      ['01-01-2025',          40.1724 ],
      ['01-10-2024',          40.1724 ],
      ['01-04-2024',          38.3735 ],
      ['01-10-2023',          33.0514 ],
      ['01-04-2023',          31.4141 ],
      ['01-01-2023',          31.0382 ],
      ['01-10-2022',          31.0382 ],
      ['01-04-2022',          27.7855 ],
      ['01-10-2021',          27.7855 ],
      ['01-04-2021',          26.5456 ],
      ['01-10-2020',          25.2927 ],
      ['01-04-2020',          24.3531 ],
      ['01-01-2020',          23.8806 ],
      ['01-10-2019',          21.9905 ],
      ['01-04-2019',          20.7970 ],
      ['01-10-2018',          20.7970 ],
      ['01-04-2018',          19.4307 ],
      ['01-10-2017',          18.1313 ],
      ['01-01-2017',          17.9372 ],
      ['01-10-2016',          16.5764 ],
      ['01-01-2016',          15.5825 ],
      ['01-10-2015',          15.0155 ],
      ['01-04-2015',          14.4922 ],
      ['01-10-2014',          13.4035 ],
      ['01-01-2014',          12.6970 ],
      ['01-10-2013',          12.1397 ],
      ['01-04-2013',          12.0119 ],
      ['01-10-2012',          11.4546 ],
      ['01-01-2012',          11.2940 ],
      ['01-04-2010',           9.5317 ],
      ['01-10-2009',           9.3723 ],
      ['01-04-2009',           8.1548 ],
      ['01-10-2008',           7.9504 ],
      ['01-04-2008',           6.3865 ],
      ['01-01-2008',           2.2063 ],
    ]),
  },

  // KTO (regioner)
  {
    id: 'KTO (regioner)',
    navn: 'KTO (regioner)',
    vaerdier: vaerdierFromTable([
      // fraDato          │ Reg.pct
      ['01-11-2025',          16.9930 ],
      ['01-10-2025',          16.1800 ],
      ['01-04-2025',          15.6970 ],
      ['01-01-2025',          15.6970 ],
      ['01-10-2024',          15.6970 ],
      ['01-04-2024',          14.1109 ],
      ['01-10-2023',           9.7220 ],
      ['01-04-2023',           9.1976 ],
      ['01-01-2023',           9.1976 ],
      ['01-10-2022',           8.3866 ],
      ['01-04-2022',           6.4474 ],
      ['01-10-2021',           6.4474 ],
      ['01-04-2021',           6.1123 ],
      ['01-10-2020',           5.3224 ],
      ['01-04-2020',           4.9075 ],
      ['01-01-2020',           4.5075 ],
      ['01-10-2019',           2.8075 ],
      ['01-04-2019',           2.0238 ],
      ['01-10-2018',           2.0238 ],
      ['01-04-2018',          35.8890 ],
      ['01-10-2017',          34.4105 ],
      ['01-01-2017',          34.0239 ],
      ['01-10-2016',          32.4715 ],
      ['01-01-2016',          31.5364 ],
      ['01-10-2015',          30.8896 ],
      ['01-04-2015',          30.6072 ],
      ['01-10-2014',          29.3653 ],
      ['01-01-2014',          28.4442 ],
      ['01-10-2013',          27.8092 ],
      ['01-04-2013',          27.6378 ],
      ['01-10-2012',          27.0028 ],
      ['01-01-2012',          26.8328 ],
      ['01-04-2010',          24.8979 ],
      ['01-10-2009',          24.8979 ],
      ['01-04-2009',          23.3114 ],
      ['01-10-2008',          23.0783 ],
      ['01-04-2008',          21.2953 ],
      ['01-01-2008',          16.5293 ],
      ['01-10-2007',          16.5293 ],
      ['01-04-2007',          16.0535 ],
      ['01-10-2006',          15.1539 ],
      ['01-01-2006',          14.0138 ],
      ['01-04-2005',          12.4454 ],
      ['01-10-2004',          12.4454 ],
      ['01-08-2004',          12.0038 ],
      ['01-04-2004',          10.9523 ],
      ['01-10-2003',           9.2675 ],
      ['01-08-2003',           8.8680 ],
      ['01-04-2003',           8.3422 ],
      ['01-04-2002',           6.1566 ],
      ['01-10-2001',           5.1157 ],
      ['01-04-2001',           4.0662 ],
    ]),
  },

  // SHK (regioner)
  {
    id: 'SHK (regioner)',
    navn: 'SHK (regioner)',
    vaerdier: vaerdierFromTable([
      // fraDato          │ Reg.pct
      ['01-11-2025',          16.9930 ],
      ['01-10-2025',          16.1800 ],
      ['01-04-2025',          15.6970 ],
      ['01-01-2025',          15.6970 ],
      ['01-10-2024',          15.6970 ],
      ['01-04-2024',          14.1109 ],
      ['01-10-2023',           9.7220 ],
      ['01-04-2023',           9.1976 ],
      ['01-01-2023',           9.1976 ],
      ['01-10-2022',           8.3866 ],
      ['01-04-2022',           6.4474 ],
      ['01-10-2021',           6.4474 ],
      ['01-04-2021',           6.1123 ],
      ['01-10-2020',           5.3224 ],
      ['01-04-2020',           4.9075 ],
      ['01-01-2020',           4.5075 ],
      ['01-10-2019',           2.8075 ],
      ['01-04-2019',           2.0238 ],
      ['01-10-2018',           2.0238 ],
      ['01-04-2018',          19.5827 ],
      ['01-10-2017',          18.2816 ],
      ['01-01-2017',          17.9414 ],
      ['01-10-2016',          16.5753 ],
      ['01-01-2016',          15.7525 ],
      ['01-10-2015',          15.1833 ],
      ['01-04-2015',          14.9348 ],
      ['01-10-2014',          13.8419 ],
      ['01-01-2014',          13.0199 ],
      ['01-10-2013',          12.4612 ],
      ['01-04-2013',          12.2993 ],
      ['01-10-2012',          11.7406 ],
      ['01-01-2012',          11.5793 ],
      ['01-04-2010',           9.5358 ],
      ['01-10-2009',           9.5358 ],
      ['01-04-2009',           8.1444 ],
      ['01-10-2008',           7.9400 ],
      ['01-04-2008',           6.3763 ],
      ['01-01-2008',           2.2063 ],
    ]),
  },
];

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
