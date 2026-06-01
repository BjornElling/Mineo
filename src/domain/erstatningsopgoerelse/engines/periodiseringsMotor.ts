import type { FerieperiodeRow } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import { dateToISO, parseISODate } from '../../../types/branded';
import { addDays } from '../../../utils/dateUtils';
import { countInclusiveUtcDays } from '../../../utils/utcDayMath';
import { iterateDatesInclusive, iterateIsoDatesInclusive } from '../../../utils/isoDateHelpers';
import type { Periodisering } from '../../../data/ydelsestyper';
import { buildDatoSetInclusiveFromDates, buildFerieDageSet, buildShDageSet, isWeekdayUtc, placeLoseFeriedage } from './tafDaySets';
import { TAF_ARBEJDSDAG_TIL_MAANED_FAKTOR } from '../helpers/tafBeregningsenhed';
import { SYGEDAGPENGE_SH_CUTOFF } from '../helpers/eoConstants';
import { beregnSHDageForDatoSet } from '../../dates/shDageBeregning';
import { roundByMethod } from '../../../utils/rounding';
import { type DateInterval, type IsoRange } from '../../../utils/isoDateHelpers';
import { toNonNegativeInt } from '../../../utils/numberParsing';
import { assertNever } from '../../../utils/assertNever';

/**
 * CENTRAL PERIODISERINGSMOTOR (normativ)
 *
 * Denne motor er den fælles kilde til sandhed for:
 * 1) Beløbsperiodisering for måneder
 * 2) Beløbsperiodisering for arbejdsdage
 * 3) Optælling af måneder
 * 4) Optælling af arbejdsdage
 *
 * Beregningsprincipper:
 * - Lønindkomst:
 *   - Når TAF beregnes som måneder: periodiseres på kalenderdage (man-søn), inkl. ferie- og SH-dage.
 *   - Når TAF beregnes som arbejdsdage: periodiseres på arbejdsdage (man-fre), ekskl. ferie- og SH-dage.
 *   - Løse ferie-/fraværsdage er ikke del af lønperiodiseringsgrundlaget.
 * - Offentlige ydelser:
 *   - Periodiseres efter den centralt definerede ydelsestype-regel.
 *   - Særregel: sygedagpenge før 2. juli 2012 periodiseres uden SH-fradrag.
 * - Månedsoptælling:
 *   - Hver kalenderdag tæller som 1/x af måned (x = dage i måneden), uden ferie/SH-fradrag.
 *   - Øvrigt fravær i beregningsperioden fratrækkes med 4,8% måned pr. dag.
 * - Arbejdsdagsoptælling:
 *   - Baseres på hverdage ekskl. ferie- og SH-dage.
 *   - Derefter fratrækkes løse feriedage og øvrigt fravær efter kontekst.
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

const countOverlapCalendarDays = (interval: DateInterval, ranges: readonly IsoRange[]): number => {
  if (ranges.length === 0) return 0;
  let total = 0;
  for (const range of ranges) {
    const rangeStart = parseISODate(range.fra);
    const rangeEnd = parseISODate(range.til);
    if (!rangeStart || !rangeEnd) continue;
    const start = interval.start > rangeStart ? interval.start : rangeStart;
    const end = interval.end < rangeEnd ? interval.end : rangeEnd;
    if (start > end) continue;
    const days = countInclusiveUtcDays(start, end);
    if (days) total += days;
  }
  return total;
};

const isDateInRanges = (iso: ISODateString, ranges: readonly IsoRange[]): boolean =>
  ranges.some((range) => iso >= range.fra && iso <= range.til);

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

export const periodiserBeloebForMaaneder = (args: {
  totalBeloeb: number;
  interval: DateInterval;
  ranges: readonly IsoRange[];
}): number => {
  const { totalBeloeb, interval, ranges } = args;
  const totalDays = countInclusiveUtcDays(interval.start, interval.end);
  if (!totalDays || totalDays <= 0) return 0;
  const overlapDays = countOverlapCalendarDays(interval, ranges);
  if (overlapDays <= 0) return 0;
  return totalBeloeb * (overlapDays / totalDays);
};

export const periodiserBeloebForArbejdsdage = (args: {
  totalBeloeb: number;
  interval: DateInterval;
  ranges: readonly IsoRange[];
  arbejdsdageSet: ReadonlySet<ISODateString>;
}): number => {
  const { totalBeloeb, interval, ranges, arbejdsdageSet } = args;
  const totalDays = countInclusiveUtcDays(interval.start, interval.end);
  if (!totalDays || totalDays <= 0) return 0;

  let totalArbejdsdage = 0;
  let overlapArbejdsdage = 0;
  iterateDatesInclusive(interval.start, interval.end, (date) => {
    const iso = dateToISO(date);
    if (!iso) return;
    if (!arbejdsdageSet.has(iso)) return;
    totalArbejdsdage += 1;
    if (isDateInRanges(iso, ranges)) {
      overlapArbejdsdage += 1;
    }
  });
  if (totalArbejdsdage <= 0 || overlapArbejdsdage <= 0) return 0;
  return totalBeloeb * (overlapArbejdsdage / totalArbejdsdage);
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
  const {
    totalBeloeb,
    interval,
    range,
    periodisering,
    ydelsestypeKey,
    shDays,
    sygedagpengeShCutoff,
  } = args;
  const totalDays = countInclusiveUtcDays(interval.start, interval.end);
  if (!totalDays || totalDays <= 0) return 0;
  const rowTilISO = dateToISO(interval.end);
  if (!rowTilISO) return 0;

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
  if (periodiseringsDage <= 0) return 0;

  let overlapDage = 0;
  const rangeFraDate = parseISODate(range.fra);
  const rangeTilDate = parseISODate(range.til);
  if (!rangeFraDate || !rangeTilDate) return 0;
  const overlapStart = interval.start > rangeFraDate ? interval.start : rangeFraDate;
  const overlapEnd = interval.end < rangeTilDate ? interval.end : rangeTilDate;
  if (overlapStart > overlapEnd) return 0;
  const overlapDaysInclusive = countInclusiveUtcDays(overlapStart, overlapEnd);
  if (!overlapDaysInclusive || overlapDaysInclusive <= 0) return 0;
  iterateDatesInclusive(overlapStart, overlapEnd, (date) => {
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
    overlapDage += 1;
  });
  if (overlapDage <= 0) return 0;
  return totalBeloeb * (overlapDage / periodiseringsDage);
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

  const datoSet = buildDatoSetInclusiveFromDates(fraDate, tilDate);
  const shDays = buildShDageSet(fraDate, tilDate, datoSet);
  let count = 0;
  for (const iso of datoSet) {
    const dateObj = parseISODate(iso);
    if (!dateObj) continue;
    if (!isOffentligYdelseDatoMedregnet({
      iso,
      dateObj,
      shDays,
      periodisering,
      ydelsestypeKey,
      rowTilISO: til,
      sygedagpengeShCutoff,
    })) {
      continue;
    }
    count += 1;
  }
  return count;
};

export const buildSygedagpengeArbejdsdagePrKalenderuge = (
  fraDato: ISODateString,
  tilDato: ISODateString,
  options?: Readonly<{ sygedagpengeShCutoff?: ISODateString }>
): readonly KalenderugeArbejdsdage[] => {
  const fra = parseISODate(fraDato);
  const til = parseISODate(tilDato);
  if (!fra || !til || fra > til) return [];

  const uger = new Map<ISODateString, Set<ISODateString>>();
  iterateDatesInclusive(fra, til, (current) => {
    const weekday = current.getUTCDay();
    if (weekday >= 1 && weekday <= 5) {
      const weekdayOffset = (weekday + 6) % 7;
      const ugeStart = dateToISO(addDays(current, -weekdayOffset));
      const iso = dateToISO(current);
      if (ugeStart && iso) {
        const datoer = uger.get(ugeStart) ?? new Set<ISODateString>();
        datoer.add(iso);
        uger.set(ugeStart, datoer);
      }
    }
  });

  const fratraekSH = tilDato >= (options?.sygedagpengeShCutoff ?? SYGEDAGPENGE_SH_CUTOFF);

  const result: KalenderugeArbejdsdage[] = [];
  for (const [ugeStart, datoer] of uger) {
    const hverdage = datoer.size;
    const arbejdsdage = fratraekSH ? hverdage - beregnSHDageForDatoSet(datoer) : hverdage;
    if (arbejdsdage > 0) {
      result.push({ ugeStart, arbejdsdage });
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
}

/**
 * Summen af måneds-brøker for et interval: hver kalenderdag tæller som 1/x af sin måned
 * (x = antal dage i den pågældende måned). Returnerer 0 ved ugyldigt interval.
 *
 * Kanonisk kilde til "antal måneder ud fra dage"-princippet — genbruges af både
 * {@link optaelMaanederPraecis} og indkomst-på-skadestidspunkt-mellemregningen, så de to
 * tidligere parallelle implementeringer ikke kan drive fra hinanden. Grupperer pr. måned og
 * dividerer én gang pr. måned (frem for at summere 1/x pr. dag); resultatet er identisk efter
 * den 2-decimal-afrunding begge kaldere anvender.
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
};;

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
