import type { ISODateString } from '../types/branded';
import { toISODateString } from '../types/branded';
import { roundByMethod } from '../utils/rounding';
import { getDayAfterIso } from '../utils/isoDateHelpers';

/**
 * Kanonisk, samlet oversigt over sygedagpenge pr. satsår.
 *
 * Hvert satsår løber fra den første mandag i året til dagen før den første mandag i næste
 * år, og hver række samler ALT for det år, så tabellen opdateres ét sted én gang om året:
 * - `sygedagpengeTimesats`: maksimal sygedagpengesats pr. time.
 * - `atpTimebidrag`: samlet ATP-timebidrag ved kommunale sygedagpenge. Dagpengemodtagerens
 *   eget ATP-bidrag er 1/3 af timebidraget afrundet pr. uge, og kommunens bidrag er
 *   det dobbelte af den afrundede egenandel.
 * - `obligatoriskPensionProcent`: OP-procentsats (§ 67 a), fx 0.3 for 0,3 pct. OP beregnes
 *   på grundlag af sygedagpengene efter fradrag for dagpengemodtagerens eget ATP-bidrag
 *   (§ 67, stk. 2) og afrundes til hele kroner pr. uge. Før ordningens ikrafttræden er den 0
 *   (ordningen fandtes ikke før det satsår, der starter 6. januar 2020).
 *
 * Sygedagpenge-indsættelsen periodiserer en uge som 37 timer:
 * - mandag-torsdag: 8 timer pr. dag
 * - fredag: 5 timer
 * - lørdag-søndag: 0 timer
 *
 * Afrunding sker altid pr. kalenderuge (mandag-søndag), også når brugerens valgte periode
 * dækker flere uger eller kun dele af en uge:
 * - sygedagpenge for ugen = round(ugeTimer x sygedagpengeTimesats)
 * - eget ATP for ugen = round(ugeTimer x atpTimebidrag x 1/3)
 * - kommunalt ATP for ugen = eget ATP x 2
 * - OP for ugen = round((OP-procent / 100) x (ugesygedagpenge - eget ATP))
 *
 * Sådan opdateres tabellen årligt: tilføj én række med årets fra-/til-dato, timesats,
 * ATP-timebidrag (videreført eller ny) og OP-procent. Insert-vinduet for "Indsæt maksimal sygedagpengesats"
 * følger automatisk første/sidste række.
 */

export type DatedSygedagpengeRate = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  sygedagpengeTimesats: number;
  atpTimebidrag: number;
  /** OP-procentsats (fx 0.3 for 0,3 pct.); 0 før ordningens ikrafttræden 6. januar 2020. */
  obligatoriskPensionProcent: number;
}>;

const iso = (value: string): ISODateString => toISODateString(value);

export const SYGEDAGPENGE_TIMER_PR_FULD_UGE = 37;

export const resolveSygedagpengeTimerForUtcWeekday = (weekday: number): number => {
  switch (weekday) {
    case 1:
    case 2:
    case 3:
    case 4:
      return 8;
    case 5:
      return 5;
    default:
      return 0;
  }
};

export const beregnSygedagpengeForTimer = (rate: DatedSygedagpengeRate, timer: number): number =>
  roundByMethod(timer * rate.sygedagpengeTimesats, 0, 'halfAwayFromZero');

export const beregnEgetAtpBidragForTimer = (rate: DatedSygedagpengeRate, timer: number): number =>
  roundByMethod(timer * rate.atpTimebidrag * (1 / 3), 0, 'halfAwayFromZero');

export const beregnKommunaltAtpBidragForTimer = (rate: DatedSygedagpengeRate, timer: number): number =>
  beregnEgetAtpBidragForTimer(rate, timer) * 2;

export const sygedagpengeRates: readonly DatedSygedagpengeRate[] = [
  { fraDato: iso('2005-01-03'), tilDato: iso('2006-01-01'), sygedagpengeTimesats: 88.51, atpTimebidrag: 3.24, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2006-01-02'), tilDato: iso('2006-12-31'), sygedagpengeTimesats: 89.86, atpTimebidrag: 3.48, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2007-01-01'), tilDato: iso('2008-01-06'), sygedagpengeTimesats: 91.62, atpTimebidrag: 3.48, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2008-01-07'), tilDato: iso('2009-01-04'), sygedagpengeTimesats: 95.00, atpTimebidrag: 3.48, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2009-01-05'), tilDato: iso('2010-01-03'), sygedagpengeTimesats: 97.97, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2010-01-04'), tilDato: iso('2011-01-02'), sygedagpengeTimesats: 99.73, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2011-01-03'), tilDato: iso('2012-01-01'), sygedagpengeTimesats: 103.51, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2012-01-02'), tilDato: iso('2013-01-06'), sygedagpengeTimesats: 106.49, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2013-01-07'), tilDato: iso('2014-01-05'), sygedagpengeTimesats: 108.24, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2014-01-06'), tilDato: iso('2015-01-04'), sygedagpengeTimesats: 110.14, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2015-01-05'), tilDato: iso('2016-01-03'), sygedagpengeTimesats: 111.76, atpTimebidrag: 3.84, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2016-01-04'), tilDato: iso('2017-01-01'), sygedagpengeTimesats: 112.97, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2017-01-02'), tilDato: iso('2017-12-31'), sygedagpengeTimesats: 114.73, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2018-01-01'), tilDato: iso('2019-01-06'), sygedagpengeTimesats: 116.22, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2019-01-07'), tilDato: iso('2020-01-05'), sygedagpengeTimesats: 117.70, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0 },
  { fraDato: iso('2020-01-06'), tilDato: iso('2021-01-03'), sygedagpengeTimesats: 119.05, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0.3 },
  { fraDato: iso('2021-01-04'), tilDato: iso('2022-01-02'), sygedagpengeTimesats: 120.54, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0.6 },
  { fraDato: iso('2022-01-03'), tilDato: iso('2023-01-01'), sygedagpengeTimesats: 120.68, atpTimebidrag: 4.02, obligatoriskPensionProcent: 0.9 },
  { fraDato: iso('2023-01-02'), tilDato: iso('2023-12-31'), sygedagpengeTimesats: 122.97, atpTimebidrag: 4.02, obligatoriskPensionProcent: 1.2 },
  { fraDato: iso('2024-01-01'), tilDato: iso('2025-01-05'), sygedagpengeTimesats: 126.89, atpTimebidrag: 4.26, obligatoriskPensionProcent: 1.5 },
  { fraDato: iso('2025-01-06'), tilDato: iso('2026-01-04'), sygedagpengeTimesats: 131.49, atpTimebidrag: 4.26, obligatoriskPensionProcent: 1.8 },
  { fraDato: iso('2026-01-05'), tilDato: iso('2027-01-03'), sygedagpengeTimesats: 137.43, atpTimebidrag: 4.26, obligatoriskPensionProcent: 2.1 },
] as const;

const firstSygedagpengeRate = sygedagpengeRates[0];
const lastSygedagpengeRate = sygedagpengeRates[sygedagpengeRates.length - 1];

if (!firstSygedagpengeRate || !lastSygedagpengeRate) {
  throw new Error('CRITICAL: Ingen sygedagpengesatser er defineret');
}

/**
 * Integritets-guard for sygedagpenge-satstabellen (fail-closed ved ægte datafejl).
 *
 * Opslaget (`splitSygedagpengeRateSegments`) matcher en dato mod hver rækkes EGET
 * `[fraDato;tilDato]`-interval (ikke carry-forward), og hele perioden gates fail-closed
 * mod ydergrænserne (`assertSygedagpengeRangeFullyCovered`). Der er derfor ingen
 * carry-forward-staleness-risiko. Den eneste tavse fejlklasse er et INTERIORT hul eller
 * overlap mellem to satsår: et hul ville lade dage i hullet falde ud af segmenteringen
 * uden en fejl (tavs under-dækning), og et overlap ville dobbelttælle en dag.
 *
 * Kontinuitet + ikke-overlap var hidtil kun håndhævet af en unit-test. Denne guard
 * flytter håndhævelsen til modul-load, så et fremtidigt hul fanges uanset om testen
 * køres. Kravet er: rækkerne er sorteret stigende, hver `fraDato ≤ tilDato`, og hvert
 * satsår starter præcis dagen efter det forrige satsårs `tilDato` (ingen hul, intet
 * overlap). Tal-neutral for eksisterende data (tabellen er kontinuert i dag).
 */
export const assertSygedagpengeRatesIntegritet = (
  rates: readonly DatedSygedagpengeRate[]
): void => {
  if (rates.length === 0) {
    throw new Error('CRITICAL: Ingen sygedagpengesatser er defineret');
  }
  for (let i = 0; i < rates.length; i += 1) {
    const rate = rates[i]!;
    if (rate.fraDato > rate.tilDato) {
      throw new Error(
        `Sygedagpenge-satstabel: satsår med fraDato "${rate.fraDato}" > tilDato "${rate.tilDato}"`
      );
    }
    if (i === 0) continue;
    const forrige = rates[i - 1]!;
    const forventetFraDato = getDayAfterIso(forrige.tilDato);
    if (rate.fraDato !== forventetFraDato) {
      throw new Error(
        `Sygedagpenge-satstabel: hul eller overlap mellem satsår "${forrige.tilDato}" og ` +
          `"${rate.fraDato}" (forventet fraDato ${forventetFraDato}); ` +
          'et hul ville give tavs under-dækning, et overlap ville dobbelttælle en dag'
      );
    }
  }
};

assertSygedagpengeRatesIntegritet(sygedagpengeRates);

export const SYGEDAGPENGE_RATE_MIN_DATE: ISODateString = firstSygedagpengeRate.fraDato;
export const SYGEDAGPENGE_RATE_MAX_DATE: ISODateString = lastSygedagpengeRate.tilDato;
// Insert-vinduet for "Indsæt maksimal sygedagpengesats" er hele satsdækningen. ATP og OP
// er nu kolonner på hver satsrække, så et nyt satsår dækker automatisk alle tre led.
export const SYGEDAGPENGE_INSERT_MIN_DATE: ISODateString = SYGEDAGPENGE_RATE_MIN_DATE;
export const SYGEDAGPENGE_INSERT_MAX_DATE: ISODateString = SYGEDAGPENGE_RATE_MAX_DATE;

/** Dagpengemodtagerens ugentlige ATP-bidrag for satsåret. */
export const resolveEgetAtpBidragPrKalenderuge = (rate: DatedSygedagpengeRate): number =>
  beregnEgetAtpBidragForTimer(rate, SYGEDAGPENGE_TIMER_PR_FULD_UGE);

/** OP-procentsatsen for satsåret (0 før ordningens ikrafttræden 6. januar 2020). */
export const resolveObligatoriskPensionProcent = (rate: DatedSygedagpengeRate): number =>
  rate.obligatoriskPensionProcent;

/**
 * Kommunens ugentlige ATP-bidrag for satsåret. Det kommunale bidrag er altid præcis
 * dobbelt af dagpengemodtagerens afrundede eget-bidrag.
 */
export const resolveKommunaltAtpBidragPrKalenderuge = (rate: DatedSygedagpengeRate): number =>
  beregnKommunaltAtpBidragForTimer(rate, SYGEDAGPENGE_TIMER_PR_FULD_UGE);
