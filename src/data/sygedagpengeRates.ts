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

export type SygedagpengeObligatoriskPensionSats = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  /** Procentsats for obligatorisk pension (fx 0.3 for 0,3 pct.). */
  procent: number;
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

/**
 * Kanonisk oversigt over satser for obligatorisk pension (OP) for sygedagpenge,
 * jf. § 67 a i bekendtgørelse om sygedagpenge.
 *
 * OP-bidraget beregnes med den angivne procentsats på grundlag af sygedagpengene
 * efter fradrag for dagpengemodtagerens eget ATP-bidrag (§ 67, stk. 2), og bidraget
 * for 1 uge afrundes til nærmeste hele kronebeløb.
 *
 * Ikrafttrædelsestidspunkterne følger dagpenge-satsåret (samme uge-grænser som
 * `sygedagpengeRates` og `sygedagpengeAtpPrincipper`), så hvert satssegment har
 * præcis én OP-procentsats. Før 6. januar 2020 fandtes ordningen ikke (0 pct.);
 * `resolveObligatoriskPensionProcent` returnerer derfor 0 for datoer før første sats.
 */
export const sygedagpengeObligatoriskPensionSatser: readonly SygedagpengeObligatoriskPensionSats[] = [
  { fraDato: iso('2020-01-06'), tilDato: iso('2021-01-03'), procent: 0.3 },
  { fraDato: iso('2021-01-04'), tilDato: iso('2022-01-02'), procent: 0.6 },
  { fraDato: iso('2022-01-03'), tilDato: iso('2023-01-01'), procent: 0.9 },
  { fraDato: iso('2023-01-02'), tilDato: iso('2023-12-31'), procent: 1.2 },
  { fraDato: iso('2024-01-01'), tilDato: iso('2025-01-05'), procent: 1.5 },
  { fraDato: iso('2025-01-06'), tilDato: iso('2026-01-04'), procent: 1.8 },
  { fraDato: iso('2026-01-05'), tilDato: iso('2027-01-03'), procent: 2.1 },
  { fraDato: iso('2027-01-04'), tilDato: iso('2028-01-02'), procent: 2.4 },
  { fraDato: iso('2028-01-03'), tilDato: iso('2028-12-31'), procent: 2.7 },
  { fraDato: iso('2029-01-01'), tilDato: iso('2030-01-06'), procent: 3.0 },
  { fraDato: iso('2030-01-07'), tilDato: iso('2030-12-31'), procent: 3.3 },
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
const firstObligatoriskPensionSats = sygedagpengeObligatoriskPensionSatser[0];
const lastObligatoriskPensionSats =
  sygedagpengeObligatoriskPensionSatser[sygedagpengeObligatoriskPensionSatser.length - 1];

if (
  !firstSygedagpengeRate ||
  !lastSygedagpengeRate ||
  !firstSygedagpengeAtpPrincip ||
  !lastSygedagpengeAtpPrincip ||
  !firstObligatoriskPensionSats ||
  !lastObligatoriskPensionSats
) {
  throw new Error('CRITICAL: Ingen sygedagpengesatser er defineret');
}

export const SYGEDAGPENGE_RATE_MIN_DATE: ISODateString = firstSygedagpengeRate.fraDato;
export const SYGEDAGPENGE_RATE_MAX_DATE: ISODateString = lastSygedagpengeRate.tilDato;
export const SYGEDAGPENGE_ATP_MIN_DATE: ISODateString = firstSygedagpengeAtpPrincip.fraDato;
export const SYGEDAGPENGE_ATP_MAX_DATE: ISODateString = lastSygedagpengeAtpPrincip.tilDato;
/** Første dag hvor obligatorisk pension trådte i kraft (6. januar 2020). */
export const SYGEDAGPENGE_OP_MIN_DATE: ISODateString = firstObligatoriskPensionSats.fraDato;
/** Sidste dag dækket af en defineret OP-procentsats. */
export const SYGEDAGPENGE_OP_MAX_DATE: ISODateString = lastObligatoriskPensionSats.tilDato;
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

/**
 * Resolver OP-procentsatsen for et sygedagpenge-satssegment.
 *
 * Forudsætter at OP-grænserne følger dagpenge-satsåret, så et helt rate-segment
 * ligger inden for præcis én OP-periode. Returnerer 0 hvis segmentet ligger helt
 * før første OP-sats (ordningen fandtes ikke før 6. januar 2020).
 */
export const resolveObligatoriskPensionProcent = (rate: DatedSygedagpengeRate): number => {
  if (rate.tilDato < sygedagpengeObligatoriskPensionSatser[0]!.fraDato) {
    return 0;
  }
  const sats = sygedagpengeObligatoriskPensionSatser.find(
    (entry) => entry.fraDato <= rate.fraDato && entry.tilDato >= rate.tilDato
  );
  if (!sats) {
    throw new Error(
      `CRITICAL: Ukendt OP-procentsats for sygedagpenge-perioden ${rate.fraDato} - ${rate.tilDato}. ` +
        'OP-grænserne skal følge dagpenge-satsåret, så hvert rate-segment ligger inden for præcis én OP-periode.'
    );
  }
  return sats.procent;
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
