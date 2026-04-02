/**
 * Central konfiguration af faste reguleringsrelaterede konstanter
 *
 * Scope:
 * - Faste procentsatser og faktorer der bruges på tværs af EO/PDF/debug
 * - Ikke årsafhængige satstabeller (de hører hjemme i src/data/lovbestemteRates.ts)
 */

import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';

// Tillæg for afskaffelsen af Store Bededag (angivet i procentpoint)
export const STORE_BEDEDAG_PCT = 0.45;

// Standardfaktor til konvertering mellem time- og månedssats
export const TIMER_TIL_MAANED_FAKTOR = 160.33;

export type DatedSygedagpengeRate = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  sygedagpengePrDagMax: number;
  egetAtpPrDag: number;
  kommunaltAtpPrDag: number;
}>;

const iso = (value: string): ISODateString => toISODateString(value);

export const sygedagpengeRates: readonly DatedSygedagpengeRate[] = [
  { fraDato: iso('2005-01-03'), tilDato: iso('2006-01-01'), sygedagpengePrDagMax: 655, egetAtpPrDag: 8, kommunaltAtpPrDag: 16 },
  { fraDato: iso('2006-01-02'), tilDato: iso('2006-12-31'), sygedagpengePrDagMax: 665, egetAtpPrDag: 8, kommunaltAtpPrDag: 16 },
  { fraDato: iso('2007-01-01'), tilDato: iso('2008-01-06'), sygedagpengePrDagMax: 678, egetAtpPrDag: 8, kommunaltAtpPrDag: 16 },
  { fraDato: iso('2008-01-07'), tilDato: iso('2009-01-04'), sygedagpengePrDagMax: 703, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2009-01-05'), tilDato: iso('2010-01-03'), sygedagpengePrDagMax: 725, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2010-01-04'), tilDato: iso('2011-01-02'), sygedagpengePrDagMax: 738, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2011-01-03'), tilDato: iso('2012-01-01'), sygedagpengePrDagMax: 752, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2012-01-02'), tilDato: iso('2013-01-06'), sygedagpengePrDagMax: 768, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2013-01-07'), tilDato: iso('2014-01-05'), sygedagpengePrDagMax: 788, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2014-01-06'), tilDato: iso('2015-01-04'), sygedagpengePrDagMax: 807, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2015-01-05'), tilDato: iso('2016-01-03'), sygedagpengePrDagMax: 827, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2016-01-04'), tilDato: iso('2017-01-01'), sygedagpengePrDagMax: 836, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2017-01-02'), tilDato: iso('2017-12-31'), sygedagpengePrDagMax: 847, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2018-01-01'), tilDato: iso('2019-01-06'), sygedagpengePrDagMax: 860, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2019-01-07'), tilDato: iso('2020-01-05'), sygedagpengePrDagMax: 875, egetAtpPrDag: 9, kommunaltAtpPrDag: 18 },
  { fraDato: iso('2020-01-06'), tilDato: iso('2021-01-03'), sygedagpengePrDagMax: 881, egetAtpPrDag: 10, kommunaltAtpPrDag: 20 },
  { fraDato: iso('2021-01-04'), tilDato: iso('2022-01-02'), sygedagpengePrDagMax: 892, egetAtpPrDag: 10, kommunaltAtpPrDag: 20 },
  { fraDato: iso('2022-01-03'), tilDato: iso('2023-01-01'), sygedagpengePrDagMax: 893, egetAtpPrDag: 10, kommunaltAtpPrDag: 20 },
  { fraDato: iso('2023-01-02'), tilDato: iso('2023-12-31'), sygedagpengePrDagMax: 910, egetAtpPrDag: 10, kommunaltAtpPrDag: 20 },
  { fraDato: iso('2024-01-01'), tilDato: iso('2025-01-05'), sygedagpengePrDagMax: 939, egetAtpPrDag: 11, kommunaltAtpPrDag: 22 },
  { fraDato: iso('2025-01-06'), tilDato: iso('2026-01-04'), sygedagpengePrDagMax: 973, egetAtpPrDag: 11, kommunaltAtpPrDag: 22 },
  { fraDato: iso('2026-01-05'), tilDato: iso('2027-01-03'), sygedagpengePrDagMax: 1017, egetAtpPrDag: 11, kommunaltAtpPrDag: 22 },
] as const;

const firstSygedagpengeRate = sygedagpengeRates[0];
const lastSygedagpengeRate = sygedagpengeRates[sygedagpengeRates.length - 1];

if (!firstSygedagpengeRate || !lastSygedagpengeRate) {
  throw new Error('CRITICAL: Ingen sygedagpengesatser er defineret');
}

export const SYGEDAGPENGE_RATE_MIN_DATE: ISODateString = firstSygedagpengeRate.fraDato;
export const SYGEDAGPENGE_RATE_MAX_DATE: ISODateString = lastSygedagpengeRate.tilDato;
