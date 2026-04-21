import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';

export type DatedSygedagpengeRate = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  sygedagpengePrDagMax: number;
  egetAtpPrKalenderuge: number;
  kommunaltAtpPrKalenderuge: number;
}>;

export type SygedagpengeAtpPrincip = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  egetAtpPrKalenderuge: number;
  kommunaltAtpPrKalenderuge: number;
}>;

const iso = (value: string): ISODateString => toISODateString(value);

/**
 * Kanonisk oversigt over ATP-principper for sygedagpenge.
 *
 * ATP beregnes ikke pr. dag. Den autoritative model er:
 * - dagpengemodtagerens andel for en fuld kalenderuge (`egetAtpPrKalenderuge`)
 * - kommunens andel for en fuld kalenderuge (`kommunaltAtpPrKalenderuge`)
 *
 * Ved delvise uger fordeles den fulde kalenderuges eget-andel forholdsmæssigt efter
 * antallet af sygedagpenge-arbejdsdage i ugen, hvorefter der afrundes til hele kroner.
 * Den kommunale andel er altid dobbelt af den afrundede eget-andel.
 */
export const sygedagpengeAtpPrincipper: readonly SygedagpengeAtpPrincip[] = [
  { fraDato: iso('2005-01-03'), tilDato: iso('2008-01-06'), egetAtpPrKalenderuge: 38, kommunaltAtpPrKalenderuge: 76 },
  { fraDato: iso('2008-01-07'), tilDato: iso('2020-01-05'), egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2020-01-06'), tilDato: iso('2023-12-31'), egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
  { fraDato: iso('2024-01-01'), tilDato: iso('2027-01-03'), egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106 },
] as const;

export const sygedagpengeRates: readonly DatedSygedagpengeRate[] = [
  { fraDato: iso('2005-01-03'), tilDato: iso('2006-01-01'), sygedagpengePrDagMax: 655, egetAtpPrKalenderuge: 38, kommunaltAtpPrKalenderuge: 76 },
  { fraDato: iso('2006-01-02'), tilDato: iso('2006-12-31'), sygedagpengePrDagMax: 665, egetAtpPrKalenderuge: 38, kommunaltAtpPrKalenderuge: 76 },
  { fraDato: iso('2007-01-01'), tilDato: iso('2008-01-06'), sygedagpengePrDagMax: 678, egetAtpPrKalenderuge: 38, kommunaltAtpPrKalenderuge: 76 },
  { fraDato: iso('2008-01-07'), tilDato: iso('2009-01-04'), sygedagpengePrDagMax: 703, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2009-01-05'), tilDato: iso('2010-01-03'), sygedagpengePrDagMax: 725, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2010-01-04'), tilDato: iso('2011-01-02'), sygedagpengePrDagMax: 738, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2011-01-03'), tilDato: iso('2012-01-01'), sygedagpengePrDagMax: 752, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2012-01-02'), tilDato: iso('2013-01-06'), sygedagpengePrDagMax: 768, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2013-01-07'), tilDato: iso('2014-01-05'), sygedagpengePrDagMax: 788, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2014-01-06'), tilDato: iso('2015-01-04'), sygedagpengePrDagMax: 807, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2015-01-05'), tilDato: iso('2016-01-03'), sygedagpengePrDagMax: 827, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2016-01-04'), tilDato: iso('2017-01-01'), sygedagpengePrDagMax: 836, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2017-01-02'), tilDato: iso('2017-12-31'), sygedagpengePrDagMax: 847, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2018-01-01'), tilDato: iso('2019-01-06'), sygedagpengePrDagMax: 860, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2019-01-07'), tilDato: iso('2020-01-05'), sygedagpengePrDagMax: 875, egetAtpPrKalenderuge: 44, kommunaltAtpPrKalenderuge: 88 },
  { fraDato: iso('2020-01-06'), tilDato: iso('2021-01-03'), sygedagpengePrDagMax: 881, egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
  { fraDato: iso('2021-01-04'), tilDato: iso('2022-01-02'), sygedagpengePrDagMax: 892, egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
  { fraDato: iso('2022-01-03'), tilDato: iso('2023-01-01'), sygedagpengePrDagMax: 893, egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
  { fraDato: iso('2023-01-02'), tilDato: iso('2023-12-31'), sygedagpengePrDagMax: 910, egetAtpPrKalenderuge: 48, kommunaltAtpPrKalenderuge: 96 },
  { fraDato: iso('2024-01-01'), tilDato: iso('2025-01-05'), sygedagpengePrDagMax: 939, egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106 },
  { fraDato: iso('2025-01-06'), tilDato: iso('2026-01-04'), sygedagpengePrDagMax: 973, egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106 },
  { fraDato: iso('2026-01-05'), tilDato: iso('2027-01-03'), sygedagpengePrDagMax: 1017, egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106 },
] as const;

const firstSygedagpengeRate = sygedagpengeRates[0];
const lastSygedagpengeRate = sygedagpengeRates[sygedagpengeRates.length - 1];
const firstSygedagpengeAtpPrincip = sygedagpengeAtpPrincipper[0];
const lastSygedagpengeAtpPrincip = sygedagpengeAtpPrincipper[sygedagpengeAtpPrincipper.length - 1];

if (!firstSygedagpengeRate || !lastSygedagpengeRate || !firstSygedagpengeAtpPrincip || !lastSygedagpengeAtpPrincip) {
  throw new Error('CRITICAL: Ingen sygedagpengesatser er defineret');
}

export const SYGEDAGPENGE_RATE_MIN_DATE: ISODateString = firstSygedagpengeRate.fraDato;
export const SYGEDAGPENGE_RATE_MAX_DATE: ISODateString = lastSygedagpengeRate.tilDato;
export const SYGEDAGPENGE_ATP_MIN_DATE: ISODateString = firstSygedagpengeAtpPrincip.fraDato;
export const SYGEDAGPENGE_ATP_MAX_DATE: ISODateString = lastSygedagpengeAtpPrincip.tilDato;
export const SYGEDAGPENGE_INSERT_MIN_DATE: ISODateString =
  SYGEDAGPENGE_RATE_MIN_DATE > SYGEDAGPENGE_ATP_MIN_DATE ? SYGEDAGPENGE_RATE_MIN_DATE : SYGEDAGPENGE_ATP_MIN_DATE;
export const SYGEDAGPENGE_INSERT_MAX_DATE: ISODateString =
  SYGEDAGPENGE_RATE_MAX_DATE < SYGEDAGPENGE_ATP_MAX_DATE ? SYGEDAGPENGE_RATE_MAX_DATE : SYGEDAGPENGE_ATP_MAX_DATE;

export const resolveEgetAtpBidragPrKalenderuge = (rate: DatedSygedagpengeRate): number => {
  const princip = sygedagpengeAtpPrincipper.find(
    (entry) =>
      entry.egetAtpPrKalenderuge === rate.egetAtpPrKalenderuge &&
      entry.kommunaltAtpPrKalenderuge === rate.kommunaltAtpPrKalenderuge &&
      entry.fraDato <= rate.fraDato &&
      entry.tilDato >= rate.tilDato
  );
  if (!princip) {
    throw new Error(
      `CRITICAL: Ukendt ATP-princip for sygedagpenge-perioden ${rate.fraDato} - ${rate.tilDato} med ugentlig ATP ${rate.egetAtpPrKalenderuge}/${rate.kommunaltAtpPrKalenderuge}`
    );
  }
  return princip.egetAtpPrKalenderuge;
};

export const resolveKommunaltAtpBidragPrKalenderuge = (rate: DatedSygedagpengeRate): number => {
  const expectedKommunaltBidragPrKalenderuge = rate.egetAtpPrKalenderuge * 2;
  if (rate.kommunaltAtpPrKalenderuge !== expectedKommunaltBidragPrKalenderuge) {
    throw new Error(
      'CRITICAL: Sygedagpenge-rater forventer at kommunalt ATP-bidrag for fuld kalenderuge altid er dobbelt af eget ATP-bidrag.'
    );
  }
  return expectedKommunaltBidragPrKalenderuge;
};
