import type { FerieperiodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { dateToISO, parseISODate } from '../../../types/branded';
import { addDays } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { iterateDatesInclusive, iterateIsoDatesInclusive } from '../../../utils/isoDateHelpers';
import type { Periodisering } from '../../../data/ydelsestyper';
import { resolveSygedagpengeTimerForUtcWeekday } from '../../../data/sygedagpengeRates';
import { buildDatoSetInclusiveFromDates, buildFerieDageSet, buildShDageSet, isWeekdayUtc, placeLoseFeriedage } from './tafDaySets';
import { TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR } from '../helpers/tafBeregningsenhed';
import { SYGEDAGPENGE_SH_CUTOFF } from '../helpers/eoConstants';
import { buildSHDageSetForIsoRange } from '../../dates/shDageBeregning';
import { roundByMethod } from '../../../utils/rounding';
import { type DateInterval, type IsoRange } from '../../../utils/isoDateHelpers';
import { toNonNegativeInt } from '../../../utils/numberParsing';
import { assertNever } from '../../../utils/assertNever';

/**
 * CENTRAL PERIODISERINGSMOTOR (normativ)
 *
 * Denne motor er den fælles kilde til sandhed for:
 * 1) Beløbsperiodisering for offentlige ydelser (kalenderdage/arbejdsdage pr. ydelsestype-regel)
 * 2) Lønindkomstens arbejdsdage-sæt (grundlag for lønperiodisering i indtaegtPerioder.ts)
 * 3) Optælling af måneder
 * 4) Optælling af arbejdsdage
 *
 * Beregningsprincipper:
 * - Lønindkomst:
 *   - Når TAF beregnes som måneder: periodiseres på kalenderdage (man-søn), inkl. ferie- og SH-dage.
 *   - Når TAF beregnes som arbejdsdage: periodiseres på arbejdsdage (man-fre), ekskl. ferie- og SH-dage.
 *     Motoren leverer arbejdsdage-sættet via buildLoenArbejdsdageSet; selve overlaps-periodiseringen
 *     af lønbeløb sker i den kanoniske forbruger indtaegtPerioder.ts.
 *   - Løse ferie-/fraværsdage er ikke del af lønperiodiseringsgrundlaget.
 * - Offentlige ydelser:
 *   - Periodiseres efter den centralt definerede ydelsestype-regel.
 *   - Særregel: sygedagpenge før 2. juli 2012 periodiseres uden SH-fradrag.
 *   - Sygedagpenge-indsættelsen bruger samme centrale datoudvælgelse til kalenderugers
 *     timegrundlag: mandag-torsdag 8 timer, fredag 5 timer, weekend 0 timer.
 * - Månedsoptælling:
 *   - Hver kalenderdag tæller som 1/x af måned (x = dage i måneden), uden ferie/SH-fradrag.
 *   - Øvrigt fravær i beregningsperioden fratrækkes med 4,8% måned pr. dag.
 * - Arbejdsdagsoptælling:
 *   - Baseres på hverdage ekskl. ferie- og SH-dage.
 *   - Derefter fratrækkes løse feriedage og øvrigt fravær efter kontekst.
 * - Fald-tilbage når en indkomstpost ingen periodiseringsdage har (jf. periodisering-contract.md §3A):
 *   - En indkomstpost (løn på arbejdsdags-sporet eller en arbejdsdags-periodiseret offentlig ydelse),
 *     hvis periode udelukkende består af feriedage — eller for ydelser en ren weekend-/helligdagsperiode —
 *     har intet naturligt periodiseringsdag-sæt. Indkomsten må ALDRIG bare forsvinde.
 *   - I det tilfælde fordeles beløbet på fald-tilbage-dage via {@link buildFallbackAllocationDaysForInterval}:
 *     periodens hverdage (man-fre) minus helligdage ("som om ferien ikke var markeret"); er der ingen
 *     hverdage, alle kalenderdage. Beløbet medregnes dermed i indkomsten.
 *   - Fald-tilbage-dagene bruges KUN til beløbsfordeling. De tælles ALDRIG som arbejdsdage:
 *     dagtællingen (optaelArbejdsdageBreakdown m.fl.) er uændret, og dagene forbliver feriedage i
 *     alle andre sammenhænge (nævneren i "løn før skaden" forøges ikke).
 *
 * KRAV TIL FREMTIDIGE ÆNDRINGER:
 * - Ved enhver ændring af beregningsprincipperne SKAL denne kommentarblok opdateres i samme commit,
 *   så teksten altid 1:1 afspejler den implementerede beregningslogik.
 */

export type { IsoRange, DateInterval } from '../../../utils/isoDateHelpers';

export { SYGEDAGPENGE_SH_CUTOFF, TAF_MIDLERTIDIG_EET_SKAERINGSDATO } from '../helpers/eoConstants';

export type KalenderugeArbejdsdage = Readonly<{
  ugeStart: ISODateString;
  arbejdsdage: number;
}>;

export type KalenderugeSygedagpengeGrundlag = Readonly<{
  ugeStart: ISODateString;
  arbejdsdage: number;
  timer: number;
}>;

export const buildLoenArbejdsdageSet = (
  bounds: IsoRange,
  ferieperioder: readonly FerieperiodeRow[]
): ReadonlySet<ISODateString> => {
  const fraDate = parseISODate(bounds.fra);
  const tilDate = parseISODate(bounds.til);
  if (!fraDate || !tilDate || fraDate > tilDate) return new Set<ISODateString>();

  const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
  const ferieDageSet = buildFerieDageSet(ferieperioder, datoSet);
  const shDageSet = buildShDageSet(fraDate, tilDate, datoSet);
  const arbejdsdage = new Set<ISODateString>();
  for (const isoStr of datoSet) {
    const date = parseISODate(isoStr);
    if (!date) continue;
    if (!isWeekdayUtc(date)) continue;
    if (ferieDageSet.has(isoStr)) continue;
    if (shDageSet.has(isoStr)) continue;
    arbejdsdage.add(isoStr);
  }
  return arbejdsdage;
};

/**
 * Fald-tilbage-fordelingsdage for en indkomstpost, hvis naturlige periodiseringsdag-sæt er tomt
 * (jf. periodisering-contract.md §3A). Reglen er ufravigelig:
 *   1) periodens hverdage (man-fre) minus helligdage — "som om ferien ikke var markeret"
 *   2) er der ingen hverdage (fx en ren weekend- eller helligdagsperiode): alle kalenderdage
 *
 * VIGTIGT: Sættet bruges UDELUKKENDE til at fordele et beløb, så indkomsten fanges. Dagene må
 * aldrig tælles som arbejdsdage og indgår ikke i nogen dagtælling (dagtællingen er uændret).
 * Returnerer tomt sæt ved ugyldigt interval.
 */
export const buildFallbackAllocationDaysForInterval = (
  bounds: IsoRange
): ReadonlySet<ISODateString> => {
  const fraDate = parseISODate(bounds.fra);
  const tilDate = parseISODate(bounds.til);
  if (!fraDate || !tilDate || fraDate > tilDate) return new Set<ISODateString>();

  const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
  const shDageSet = buildShDageSet(fraDate, tilDate, datoSet);
  const hverdageMinusSH = new Set<ISODateString>();
  for (const iso of datoSet) {
    const date = parseISODate(iso);
    if (!date) continue;
    if (!isWeekdayUtc(date)) continue;
    if (shDageSet.has(iso)) continue;
    hverdageMinusSH.add(iso);
  }
  return hverdageMinusSH.size > 0 ? hverdageMinusSH : datoSet;
};

/**
 * Fælles beslutning: brug det naturlige periodiseringsdag-sæt hvis det ikke er tomt, ellers
 * fald-tilbage-sættet (jf. {@link buildFallbackAllocationDaysForInterval}). `usedFallback`
 * afslører, at posten kun kunne fordeles via fald-tilbage (bruges til advarsler).
 */
export const resolveIncomeAllocationDays = (
  bounds: IsoRange,
  naturalDays: ReadonlySet<ISODateString>
): Readonly<{ days: ReadonlySet<ISODateString>; usedFallback: boolean }> => {
  if (naturalDays.size > 0) return { days: naturalDays, usedFallback: false };
  return { days: buildFallbackAllocationDaysForInterval(bounds), usedFallback: true };
};

export const isOffentligYdelseDatoMedregnet = (args: {
  iso: ISODateString;
  dateObj: Date;
  shDays: ReadonlySet<ISODateString>;
  periodisering: Periodisering;
  ydelsestypeKey: string;
  rowTilISO: ISODateString;
  sygedagpengeShCutoff?: ISODateString;
}): boolean => {
  const {
    iso,
    dateObj,
    shDays,
    periodisering,
    ydelsestypeKey,
    rowTilISO,
    sygedagpengeShCutoff = SYGEDAGPENGE_SH_CUTOFF,
  } = args;
  if (periodisering === 'kalenderdage') return true;
  const dow = dateObj.getUTCDay();
  const erHverdag = dow >= 1 && dow <= 5;
  if (!erHverdag) return false;

  if (ydelsestypeKey === 'sygedagpenge' && rowTilISO < sygedagpengeShCutoff) {
    return true;
  }
  return !shDays.has(iso);
};

export const periodiserBeloebForOffentligYdelse = (args: {
  totalBeloeb: number;
  interval: DateInterval;
  range: IsoRange;
  periodisering: Periodisering;
  ydelsestypeKey: string;
  shDays: ReadonlySet<ISODateString>;
  sygedagpengeShCutoff?: ISODateString;
}): number => {
  const { totalBeloeb, range } = args;
  const grundlag = buildOffentligYdelsePeriodiseringsGrundlag(args);
  return grundlag
    ? periodiserBeloebForOffentligYdelseMedGrundlag({ totalBeloeb, range, grundlag })
    : 0;
};

export type OffentligYdelsePeriodiseringsGrundlag = Readonly<{
  interval: DateInterval;
  periodisering: Periodisering;
  ydelsestypeKey: string;
  shDays: ReadonlySet<ISODateString>;
  sygedagpengeShCutoff?: ISODateString;
  rowTilISO: ISODateString;
  totalDays: number;
  periodiseringsDage: number;
  /**
   * Sat KUN når en arbejdsdags-periodiseret ydelse ellers ikke havde nogen periodiseringsdage
   * (ren weekend-/helligdagsperiode) og beløbet i stedet fordeles på fald-tilbage-dage, så
   * indkomsten ikke forsvinder (jf. {@link buildFallbackAllocationDaysForInterval}). Når sat,
   * afgør dette sæt hvilke dage der tæller ved beløbsfordelingen — ikke datoprædikatet.
   */
  fallbackAllocationDays?: ReadonlySet<ISODateString>;
}>;

export const buildOffentligYdelsePeriodiseringsGrundlag = (args: {
  interval: DateInterval;
  periodisering: Periodisering;
  ydelsestypeKey: string;
  shDays: ReadonlySet<ISODateString>;
  sygedagpengeShCutoff?: ISODateString;
}): OffentligYdelsePeriodiseringsGrundlag | null => {
  const { interval, periodisering, ydelsestypeKey, shDays, sygedagpengeShCutoff } = args;
  const totalDays = countInclusiveUtcDays(interval.start, interval.end);
  if (!totalDays || totalDays <= 0) return null;
  const rowTilISO = dateToISO(interval.end);
  if (!rowTilISO) return null;

  if (periodisering === 'kalenderdage') {
    return {
      interval,
      periodisering,
      ydelsestypeKey,
      shDays,
      sygedagpengeShCutoff,
      rowTilISO,
      totalDays,
      periodiseringsDage: totalDays,
    };
  }

  let periodiseringsDage = 0;
  iterateDatesInclusive(interval.start, interval.end, (date) => {
    const iso = dateToISO(date);
    if (!iso) return;
    if (!isOffentligYdelseDatoMedregnet({
      iso,
      dateObj: date,
      shDays,
      periodisering,
      ydelsestypeKey,
      rowTilISO,
      sygedagpengeShCutoff,
    })) {
      return;
    }
    periodiseringsDage += 1;
  });

  if (periodiseringsDage <= 0) {
    // Fald-tilbage: en arbejdsdags-periodiseret ydelse i en periode uden arbejdsdage (ren
    // weekend-/helligdagsperiode) må ikke få beløbet til at forsvinde. Fordel i stedet på
    // fald-tilbage-dage, så indkomsten fanges (jf. buildFallbackAllocationDaysForInterval).
    const fraISO = dateToISO(interval.start);
    if (!fraISO) return null;
    const fallbackAllocationDays = buildFallbackAllocationDaysForInterval({ fra: fraISO, til: rowTilISO });
    if (fallbackAllocationDays.size <= 0) return null;
    return {
      interval,
      periodisering,
      ydelsestypeKey,
      shDays,
      sygedagpengeShCutoff,
      rowTilISO,
      totalDays,
      periodiseringsDage: fallbackAllocationDays.size,
      fallbackAllocationDays,
    };
  }

  return {
    interval,
    periodisering,
    ydelsestypeKey,
    shDays,
    sygedagpengeShCutoff,
    rowTilISO,
    totalDays,
    periodiseringsDage,
  };
};

export const periodiserBeloebForOffentligYdelseMedGrundlag = (args: {
  totalBeloeb: number;
  range: IsoRange;
  grundlag: OffentligYdelsePeriodiseringsGrundlag;
}): number => {
  const { totalBeloeb, range, grundlag } = args;

  let overlapDage = 0;
  const rangeFraDate = parseISODate(range.fra);
  const rangeTilDate = parseISODate(range.til);
  if (!rangeFraDate || !rangeTilDate) return 0;
  const overlapStart = grundlag.interval.start > rangeFraDate ? grundlag.interval.start : rangeFraDate;
  const overlapEnd = grundlag.interval.end < rangeTilDate ? grundlag.interval.end : rangeTilDate;
  if (overlapStart > overlapEnd) return 0;
  const overlapDaysInclusive = countInclusiveUtcDays(overlapStart, overlapEnd);
  if (!overlapDaysInclusive || overlapDaysInclusive <= 0) return 0;

  if (grundlag.periodisering === 'kalenderdage') {
    return totalBeloeb * (overlapDaysInclusive / grundlag.totalDays);
  }

  const fallbackAllocationDays = grundlag.fallbackAllocationDays;
  iterateDatesInclusive(overlapStart, overlapEnd, (date) => {
    const iso = dateToISO(date);
    if (!iso) return;
    if (fallbackAllocationDays) {
      // Fald-tilbage-tilstand: kun de på forhånd valgte fald-tilbage-dage tæller ved fordelingen
      // (datoprædikatet ville udelukke alle dage her, da perioden ingen arbejdsdage har).
      if (!fallbackAllocationDays.has(iso)) return;
    } else if (!isOffentligYdelseDatoMedregnet({
      iso,
      dateObj: date,
      shDays: grundlag.shDays,
      periodisering: grundlag.periodisering,
      ydelsestypeKey: grundlag.ydelsestypeKey,
      rowTilISO: grundlag.rowTilISO,
      sygedagpengeShCutoff: grundlag.sygedagpengeShCutoff,
    })) {
      return;
    }
    overlapDage += 1;
  });
  if (overlapDage <= 0) return 0;
  return totalBeloeb * (overlapDage / grundlag.periodiseringsDage);
};

export const countOffentligYdelsePeriodiseringsdage = (args: {
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
  periodisering: Periodisering;
  ydelsestypeKey: string;
  sygedagpengeShCutoff?: ISODateString;
}): number | null => {
  const { fra, til, periodisering, ydelsestypeKey, sygedagpengeShCutoff } = args;
  if (!fra || !til) return null;
  if (fra > til) return null;
  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  if (periodisering === 'kalenderdage') {
    return countInclusiveUtcDays(fraDate, tilDate) ?? 0;
  }

  const shDays = buildSHDageSetForIsoRange(fra, til);
  let count = 0;
  iterateDatesInclusive(fraDate, tilDate, (dateObj) => {
    const iso = dateToISO(dateObj);
    if (!iso) return;
    if (!isOffentligYdelseDatoMedregnet({
      iso,
      dateObj,
      shDays,
      periodisering,
      ydelsestypeKey,
      rowTilISO: til,
      sygedagpengeShCutoff,
    })) {
      return;
    }
    count += 1;
  });
  return count;
};

export const buildSygedagpengeArbejdsdagePrKalenderuge = (
  fraDato: ISODateString,
  tilDato: ISODateString,
  options?: Readonly<{ sygedagpengeShCutoff?: ISODateString }>
): readonly KalenderugeArbejdsdage[] => {
  return buildSygedagpengeGrundlagPrKalenderuge(fraDato, tilDato, options).map(({ ugeStart, arbejdsdage }) => ({
    ugeStart,
    arbejdsdage,
  }));
};

export const buildSygedagpengeGrundlagPrKalenderuge = (
  fraDato: ISODateString,
  tilDato: ISODateString,
  options?: Readonly<{ sygedagpengeShCutoff?: ISODateString }>
): readonly KalenderugeSygedagpengeGrundlag[] => {
  const fra = parseISODate(fraDato);
  const til = parseISODate(tilDato);
  if (!fra || !til || fra > til) return [];

  const fratraekSH = tilDato >= (options?.sygedagpengeShCutoff ?? SYGEDAGPENGE_SH_CUTOFF);
  const shDage = fratraekSH ? buildSHDageSetForIsoRange(fraDato, tilDato) : new Set<ISODateString>();
  const uger = new Map<ISODateString, { arbejdsdage: number; timer: number }>();
  iterateDatesInclusive(fra, til, (current) => {
    const weekday = current.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      const weekdayOffset = (weekday + 6) % 7;
      const ugeStart = dateToISO(addDays(current, -weekdayOffset));
      const iso = dateToISO(current);
      if (ugeStart && iso) {
        if (shDage.has(iso)) return;
        const uge = uger.get(ugeStart) ?? { arbejdsdage: 0, timer: 0 };
        uge.arbejdsdage += 1;
        uge.timer += resolveSygedagpengeTimerForUtcWeekday(weekday);
        uger.set(ugeStart, uge);
      }
    }
  });

  const result: KalenderugeSygedagpengeGrundlag[] = [];
  for (const [ugeStart, uge] of uger) {
    if (uge.arbejdsdage > 0 && uge.timer > 0) {
      result.push({ ugeStart, arbejdsdage: uge.arbejdsdage, timer: uge.timer });
    }
  }
  return result;
};

export const optaelMaanederPraecis = (args: {
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
  oevrigeFravaersdage?: number;
}): number | null => {
  const { fra, til, oevrigeFravaersdage = 0 } = args;
  if (!fra || !til) return null;
  if (fra > til) return null;
  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  const antalMaaneder = sumMaanedsbroekForInterval(fra, til);

  const fravaersdageFradrag = toNonNegativeInt(oevrigeFravaersdage) * TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR;
  return Math.max(0, antalMaaneder - fravaersdageFradrag);
};

/**
 * Summen af måneds-brøker for et interval: hver kalenderdag tæller som 1/x af sin måned
 * (x = antal dage i den pågældende måned). Returnerer 0 ved ugyldigt interval.
 *
 * Kanonisk kilde til "antal måneder ud fra dage"-princippet — genbruges af både
 * {@link optaelMaanederPraecis} og indkomst-på-skadestidspunkt-mellemregningen, så de to
 * tidligere parallelle implementeringer ikke kan drive fra hinanden. Grupperer pr. måned og
 * dividerer én gang pr. måned, så hele måneder giver præcist heltal i rå forbrugere.
 */
export const sumMaanedsbroekForInterval = (
  fra: ISODateString | undefined,
  til: ISODateString | undefined
): number => {
  if (!fra || !til || fra > til) return 0;

  const monthCounts = new Map<string, number>();
  iterateIsoDatesInclusive(fra, til, (iso) => {
    const monthKey = iso.slice(0, 7);
    monthCounts.set(monthKey, (monthCounts.get(monthKey) ?? 0) + 1);
  });

  let antalMaaneder = 0;
  for (const [monthKey, count] of monthCounts) {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = Number.parseInt(yearStr ?? '', 10);
    const month = Number.parseInt(monthStr ?? '', 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) continue;
    const dageIMaaned = new Date(Date.UTC(year, month, 0)).getUTCDate();
    antalMaaneder += count / dageIMaaned;
  }
  return antalMaaneder;
};

export const optaelMaanederAfrundet = (args: {
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
  oevrigeFravaersdage?: number;
}): number | null => {
  const praecis = optaelMaanederPraecis(args);
  if (praecis === null) return null;
  return roundByMethod(praecis, 2, 'halfAwayFromZero');
};

export type ArbejdsdageBeregningskontekst =
  | Readonly<{ kind: 'beregningsgrundlag'; oevrigeFravaersdage: number }>
  | Readonly<{ kind: 'taf' }>;

export type ArbejdsdageBreakdown = Readonly<{
  arbejdsdage: number;
  shDage: number;
  arbejdsdageMinusSH: number;
  feriedage: number;
  loseFeriedage: number;
  oevrigeFravaersdage: number;
  tafDage: number;
}>;

export const optaelArbejdsdageBreakdown = (args: {
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
  ferieperioder: readonly FerieperiodeRow[];
  loseFeriedage: number;
  context: ArbejdsdageBeregningskontekst;
}): ArbejdsdageBreakdown | null => {
  const { fra, til, ferieperioder, loseFeriedage, context } = args;
  if (!fra || !til) return null;
  if (fra > til) return null;
  const fraDate = parseISODate(fra);
  const tilDate = parseISODate(til);
  if (!fraDate || !tilDate) return null;

  const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
  let antalHverdage = 0;
  for (const isoStr of datoSet) {
    const date = parseISODate(isoStr);
    if (!date) continue;
    if (isWeekdayUtc(date)) antalHverdage += 1;
  }

  const ferieDageSet = buildFerieDageSet(ferieperioder, datoSet);
  const shDageSet = buildShDageSet(fraDate, tilDate, datoSet);
  let antalSHDage = 0;
  for (const isoStr of shDageSet) {
    if (!ferieDageSet.has(isoStr)) {
      antalSHDage += 1;
    }
  }

  const blockedLoseFerie = new Set<ISODateString>([...ferieDageSet, ...shDageSet]);
  const placedLoseFeriedage = placeLoseFeriedage(fra, til, loseFeriedage, blockedLoseFerie);

  const arbejdsdageMinusSH = antalHverdage - antalSHDage;
  let fravaersdage = 0;
  switch (context.kind) {
    case 'taf':
      fravaersdage = 0;
      break;
    case 'beregningsgrundlag':
      fravaersdage = toNonNegativeInt(context.oevrigeFravaersdage);
      break;
    default:
      assertNever(context);
  }

  const loseFeriedageFradrag = placedLoseFeriedage.size;
  const tafDage = Math.max(0, arbejdsdageMinusSH - ferieDageSet.size - loseFeriedageFradrag - fravaersdage);
  return {
    arbejdsdage: antalHverdage,
    shDage: antalSHDage,
    arbejdsdageMinusSH,
    feriedage: ferieDageSet.size,
    loseFeriedage: loseFeriedageFradrag,
    oevrigeFravaersdage: fravaersdage,
    tafDage,
  };
};

export const optaelArbejdsdage = (args: {
  fra: ISODateString | undefined;
  til: ISODateString | undefined;
  ferieperioder: readonly FerieperiodeRow[];
  loseFeriedage: number;
  context: ArbejdsdageBeregningskontekst;
}): number | null => {
  const breakdown = optaelArbejdsdageBreakdown(args);
  return breakdown ? breakdown.tafDage : null;
};
