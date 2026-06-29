import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';

/**
 * Kanonisk, samlet oversigt over sygedagpenge pr. satsår.
 *
 * Hvert satsår løber fra den første mandag i året til dagen før den første mandag i næste
 * år, og hver række samler ALT for det år, så tabellen opdateres ét sted én gang om året:
 * - `sygedagpengePrDagMax`: maksimal sygedagpengesats pr. dag.
 * - `egetAtpPrKalenderuge` / `kommunaltAtpPrKalenderuge`: ATP-bidrag for en fuld
 *   kalenderuge (ATP beregnes ikke pr. dag). Ved delvise uger fordeles den fulde uges
 *   eget-andel forholdsmæssigt efter antallet af sygedagpenge-arbejdsdage og afrundes til
 *   hele kroner; den kommunale andel er altid dobbelt af den afrundede eget-andel. ATP
 *   ændres sjældent, men gentages bevidst på hver række, så satsåret er fuldt selvindeholdt.
 * - `obligatoriskPensionProcent`: OP-procentsats (§ 67 a), fx 0.3 for 0,3 pct. OP beregnes
 *   på grundlag af sygedagpengene efter fradrag for dagpengemodtagerens eget ATP-bidrag
 *   (§ 67, stk. 2) og afrundes til hele kroner pr. uge. Før ordningens ikrafttræden er den 0
 *   (ordningen fandtes ikke før det satsår, der starter 6. januar 2020).
 *
 * Sådan opdateres tabellen årligt: tilføj én række med årets fra-/til-dato, sygedagpengesats,
 * ATP (videreført eller ny) og OP-procent. Insert-vinduet for "Indsæt maksimal sygedagpengesats"
 * følger automatisk første/sidste række.
 */
export type DatedSygedagpengeRate = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  sygedagpengePrDagMax: number;
  egetAtpPrKalenderuge: number;
  kommunaltAtpPrKalenderuge: number;
  /** OP-procentsats (fx 0.3 for 0,3 pct.); 0 før ordningens ikrafttræden 6. januar 2020. */
  obligatoriskPensionProcent: number;
}>;

const iso = (value: string): ISODateString => toISODateString(value);

export const sygedagpengeRates: readonly DatedSygedagpengeRate[] = [
  { fraDato: iso('2005-01-03'), tilDato: iso('2006-01-01'), sygedagpengePrDagMax: 655, egetAtpPrKalenderuge: 40, kommunaltAtpPrKalenderuge: 80, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2006-01-02'), tilDato: iso('2006-12-31'), sygedagpengePrDagMax: 665, egetAtpPrKalenderuge: 43, kommunaltAtpPrKalenderuge: 86, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2007-01-01'), tilDato: iso('2008-01-06'), sygedagpengePrDagMax: 678, egetAtpPrKalenderuge: 43, kommunaltAtpPrKalenderuge: 86, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2008-01-07'), tilDato: iso('2009-01-04'), sygedagpengePrDagMax: 703, egetAtpPrKalenderuge: 43, kommunaltAtpPrKalenderuge: 86, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2009-01-05'), tilDato: iso('2010-01-03'), sygedagpengePrDagMax: 725, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2010-01-04'), tilDato: iso('2011-01-02'), sygedagpengePrDagMax: 738, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2011-01-03'), tilDato: iso('2012-01-01'), sygedagpengePrDagMax: 752, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2012-01-02'), tilDato: iso('2013-01-06'), sygedagpengePrDagMax: 768, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2013-01-07'), tilDato: iso('2014-01-05'), sygedagpengePrDagMax: 788, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2014-01-06'), tilDato: iso('2015-01-04'), sygedagpengePrDagMax: 807, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2015-01-05'), tilDato: iso('2016-01-03'), sygedagpengePrDagMax: 827, egetAtpPrKalenderuge: 47, kommunaltAtpPrKalenderuge: 94, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2016-01-04'), tilDato: iso('2017-01-01'), sygedagpengePrDagMax: 836, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2017-01-02'), tilDato: iso('2017-12-31'), sygedagpengePrDagMax: 847, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2018-01-01'), tilDato: iso('2019-01-06'), sygedagpengePrDagMax: 860, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2019-01-07'), tilDato: iso('2020-01-05'), sygedagpengePrDagMax: 875, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2020-01-06'), tilDato: iso('2021-01-03'), sygedagpengePrDagMax: 881, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0.3 },
  { fraDato: iso('2021-01-04'), tilDato: iso('2022-01-02'), sygedagpengePrDagMax: 892, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0.6 },
  { fraDato: iso('2022-01-03'), tilDato: iso('2023-01-01'), sygedagpengePrDagMax: 893, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 0.9 },
  { fraDato: iso('2023-01-02'), tilDato: iso('2023-12-31'), sygedagpengePrDagMax: 910, egetAtpPrKalenderuge: 50, kommunaltAtpPrKalenderuge: 100, obligatoriskPensionProcent: 1.2 },
  { fraDato: iso('2024-01-01'), tilDato: iso('2025-01-05'), sygedagpengePrDagMax: 939, egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106, obligatoriskPensionProcent: 1.5 },
  { fraDato: iso('2025-01-06'), tilDato: iso('2026-01-04'), sygedagpengePrDagMax: 973, egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106, obligatoriskPensionProcent: 1.8 },
  { fraDato: iso('2026-01-05'), tilDato: iso('2027-01-03'), sygedagpengePrDagMax: 1017, egetAtpPrKalenderuge: 53, kommunaltAtpPrKalenderuge: 106, obligatoriskPensionProcent: 2.1 },
] as const;

const firstSygedagpengeRate = sygedagpengeRates[0];
const lastSygedagpengeRate = sygedagpengeRates[sygedagpengeRates.length - 1];

if (!firstSygedagpengeRate || !lastSygedagpengeRate) {
  throw new Error('CRITICAL: Ingen sygedagpengesatser er defineret');
}

export const SYGEDAGPENGE_RATE_MIN_DATE: ISODateString = firstSygedagpengeRate.fraDato;
export const SYGEDAGPENGE_RATE_MAX_DATE: ISODateString = lastSygedagpengeRate.tilDato;
// Insert-vinduet for "Indsæt maksimal sygedagpengesats" er hele satsdækningen. ATP og OP
// er nu kolonner på hver satsrække, så et nyt satsår dækker automatisk alle tre led.
export const SYGEDAGPENGE_INSERT_MIN_DATE: ISODateString = SYGEDAGPENGE_RATE_MIN_DATE;
export const SYGEDAGPENGE_INSERT_MAX_DATE: ISODateString = SYGEDAGPENGE_RATE_MAX_DATE;

/** Dagpengemodtagerens ugentlige ATP-bidrag for satsåret. */
export const resolveEgetAtpBidragPrKalenderuge = (rate: DatedSygedagpengeRate): number =>
  rate.egetAtpPrKalenderuge;

/** OP-procentsatsen for satsåret (0 før ordningens ikrafttræden 6. januar 2020). */
export const resolveObligatoriskPensionProcent = (rate: DatedSygedagpengeRate): number =>
  rate.obligatoriskPensionProcent;

/**
 * Kommunens ugentlige ATP-bidrag for satsåret. Håndhæver fail-closed invarianten om, at det
 * kommunale bidrag altid er præcis dobbelt af dagpengemodtagerens eget bidrag.
 */
export const resolveKommunaltAtpBidragPrKalenderuge = (rate: DatedSygedagpengeRate): number => {
  const expectedKommunaltBidragPrKalenderuge = rate.egetAtpPrKalenderuge * 2;
  if (rate.kommunaltAtpPrKalenderuge !== expectedKommunaltBidragPrKalenderuge) {
    throw new Error(
      'CRITICAL: Sygedagpenge-rater forventer at kommunalt ATP-bidrag for fuld kalenderuge altid er dobbelt af eget ATP-bidrag.'
    );
  }
  return expectedKommunaltBidragPrKalenderuge;
};
