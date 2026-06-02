/**
 * Filen eksporterer to datasæt:
 * - referenceRates: Nationalbankens udlånsrente (nyeste først)
 * - surchargeRates: Tillægssats jf. renteloven
 */

import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';

/**
 * Interface for rentesats-objekt
 *
 * `effectiveDate` er ISO (åååå-mm-dd) som alt øvrigt lager og beregning i domænet.
 * Rå-tabellerne nedenfor skrives i dansk dd-mm-åååå (læsevenligt for vedligehold) og
 * konverteres til ISO ved indlæsning via `parseRateTableDate`.
 */
export interface RateEntry {
  effectiveDate: ISODateString;
  /** Rentesats i procentpoint (fx 2.75 = 2,75 %) */
  ratePct: number;
}

const referenceRatesTable: ReadonlyArray<readonly [effectiveDate: string, ratePct: number]> = [
  // dato              │ Rentesats
  ['01-01-2026',            1.75],
  ['01-07-2025',            1.75],
  ['01-01-2025',            2.75],
  ['01-07-2024',            3.5 ],
  ['01-01-2024',            3.75],
  ['01-07-2023',            3.25],
  ['01-01-2023',            1.9 ],
  ['01-07-2022',           -0.45],
  ['01-01-2022',           -0.45],
  ['01-07-2021',           -0.35],
  ['01-01-2021',            0.05],
  ['01-07-2020',            0.05],
  ['01-01-2020',            0.05],
  ['01-07-2019',            0.05],
  ['01-01-2019',            0.05],
  ['01-07-2018',            0.05],
  ['01-01-2018',            0.05],
  ['01-07-2017',            0.05],
  ['01-01-2017',            0.05],
  ['01-07-2016',            0.05],
  ['01-01-2016',            0.05],
  ['01-07-2015',            0.05],
  ['01-01-2015',            0.2 ],
  ['01-07-2014',            0.2 ],
  ['01-01-2014',            0.2 ],
  ['01-07-2013',            0.2 ],
  ['01-01-2013',            0.2 ],
  ['01-07-2012',            0.45],
  ['01-01-2012',            0.7 ],
  ['01-07-2011',            1.3 ],
  ['01-01-2011',            1.05],
  ['01-07-2010',            1.05],
  ['01-01-2010',            1.2 ],
  ['01-07-2009',            1.55],
  ['01-01-2009',            3.75],
  ['01-07-2008',            4.35],
  ['01-01-2008',            4.25],
  ['01-07-2007',            4.25],
  ['01-01-2007',            3.75],
  ['01-07-2006',            3.0 ],
  ['01-01-2006',            2.4 ],
  ['01-07-2005',            2.15],
  ['01-01-2005',            2.15],
];

const surchargeRatesTable: ReadonlyArray<readonly [effectiveDate: string, ratePct: number]> = [
  // dato              │ Tillægssats
  ['01-03-2013',            8.0 ],
  ['01-08-2002',            7.0 ],
];

const parseRateTableDate = (raw: string, label: string): ISODateString => {
  const parts = raw.split('-');
  if (parts.length !== 3) {
    throw new Error(`Ugyldig ${label}: "${raw}"`);
  }

  const [day, month, year] = parts;
  if (!day || !month || !year) {
    throw new Error(`Ugyldig ${label}: "${raw}"`);
  }

  return toISODateString(`${year}-${month}-${day}`);
};

// Tidligste dato i referencesatserne — udledt af det ældste element i referenceRatesTable.
// Tabellen er sorteret nyeste-først, så det sidste element har den tidligste dato.
const _minRaw = referenceRatesTable[referenceRatesTable.length - 1]?.[0];
if (!_minRaw) {
  throw new Error('CRITICAL: Ingen referencesatser er defineret');
}
export const MIN_INTEREST_DATE: ISODateString = parseRateTableDate(_minRaw, 'tidligste referencesats-dato');

const _minSurchargeRaw = surchargeRatesTable[surchargeRatesTable.length - 1]?.[0];
if (!_minSurchargeRaw) {
  throw new Error('CRITICAL: Ingen tillægssatser er defineret');
}
export const MIN_SURCHARGE_DATE: ISODateString = parseRateTableDate(_minSurchargeRaw, 'tidligste tillægssats-dato');

export const referenceRates: RateEntry[] = referenceRatesTable.map(([effectiveDate, ratePct]) => ({
  effectiveDate: parseRateTableDate(effectiveDate, 'referencesats-dato'),
  ratePct,
}));

export const surchargeRates: RateEntry[] = surchargeRatesTable.map(([effectiveDate, ratePct]) => ({
  effectiveDate: parseRateTableDate(effectiveDate, 'tillægssats-dato'),
  ratePct,
}));
