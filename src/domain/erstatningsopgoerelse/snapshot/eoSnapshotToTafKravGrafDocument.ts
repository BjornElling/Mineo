import type { ISODateString } from '../../../types/branded';
import { createDate, dateToISO, parseISODate } from '../../../types/branded';
import {
  getDayAfterIso,
  getDayBeforeIso,
  iterateIsoDatesInclusive,
  maxISO,
  minISO,
  validateIsoRange,
} from '../../../utils/isoDateHelpers';
import { diffUtcDays } from '../../../utils/utcDayMath';
import { roundByMethod } from '../../../utils/rounding';
import { beregnArbejdsdageOgMaaneder } from '../engines/arbejdsdageMaaneder';
import { TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import {
  buildIncomeCalculationContext,
  buildIncomeForRanges,
  type IncomeCalculationContext,
  resolveArbejdsstedDisplayName,
  roundIncomeBenefitAmountKroner,
} from '../helpers/indtaegtPerioder';
import { hasEoSnapshotData, type EoSnapshot } from './eoSnapshot';
import type { EoInvariant } from './eoSnapshotInvariants';
import {
  buildBlockingMessageForOutput,
  getBlockingInvariantsForOutput,
} from './eoSnapshotInvariants';
import type { EoModel, MoneyOre } from '../shared/eoTypes';

const FAR_MELLEMLIGGENDE_PERIODE_DAGE = 180;

export type TafKravGrafSeriesSegment = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  amountOre: MoneyOre;
}>;

export type TafKravGrafSeries = Readonly<{
  id: string;
  label: string;
  color: string;
  segments: readonly TafKravGrafSeriesSegment[];
}>;

export type TafKravGrafTimeWindow = Readonly<{
  fra: ISODateString;
  til: ISODateString;
}>;

export type TafKravGrafMarker = Readonly<{
  date: ISODateString;
  label: string;
}>;

export type TafKravGrafDocument = Readonly<{
  model: EoModel;
  unit: 'maaned' | 'arbejdsdag';
  series: readonly TafKravGrafSeries[];
  timeWindows: readonly TafKravGrafTimeWindow[];
  beregningsperiode: TafKravGrafTimeWindow | null;
  skadeMarker: TafKravGrafMarker | null;
}>;

export type TafKravGrafDocumentProjection =
  | Readonly<{ kind: 'ok'; document: TafKravGrafDocument }>
  | Readonly<{ kind: 'blocked'; message: string; invariants: readonly EoInvariant[] }>;

const SERIES_COLORS = [
  '#2F6B9A',
  '#4F8A5B',
  '#B07A2D',
  '#8A5E9E',
  '#C75C4A',
  '#3D8B8B',
  '#7A7D32',
  '#5F6FA8',
] as const;

const seriesIdFromLabel = (label: string): string =>
  label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'indtaegtskilde';

const roundOre = (value: number): MoneyOre =>
  roundByMethod(value, 0, 'halfAwayFromZero') as MoneyOre;

const mergeRanges = (ranges: readonly TafKravGrafTimeWindow[]): TafKravGrafTimeWindow[] => {
  const sorted = [...ranges].sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
  const merged: TafKravGrafTimeWindow[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous) {
      merged.push(range);
      continue;
    }
    const dayAfterPrevious = getDayAfterIso(previous.til);
    if (dayAfterPrevious && range.fra <= dayAfterPrevious) {
      merged[merged.length - 1] = { fra: previous.fra, til: maxISO(previous.til, range.til) };
      continue;
    }
    merged.push(range);
  }
  return merged;
};

const shouldBridgeGap = (left: TafKravGrafTimeWindow, right: TafKravGrafTimeWindow): boolean => {
  const leftEnd = parseISODate(left.til);
  const rightStart = parseISODate(right.fra);
  if (!leftEnd || !rightStart) return false;
  return diffUtcDays(leftEnd, rightStart) <= FAR_MELLEMLIGGENDE_PERIODE_DAGE;
};

const buildTimeWindows = (
  tafRanges: readonly TafKravGrafTimeWindow[],
  beregningsperiode: TafKravGrafTimeWindow | null,
  skadeDato: ISODateString | null
): TafKravGrafTimeWindow[] => {
  const skadeRange = skadeDato ? [{ fra: skadeDato, til: skadeDato }] : [];
  const initialRanges = beregningsperiode ? [beregningsperiode, ...skadeRange, ...tafRanges] : [...skadeRange, ...tafRanges];
  const merged = mergeRanges(initialRanges);
  if (merged.length <= 1) return merged;

  const result: TafKravGrafTimeWindow[] = [];
  for (const range of merged) {
    const previous = result.at(-1);
    if (!previous || !shouldBridgeGap(previous, range)) {
      result.push(range);
      continue;
    }
    result[result.length - 1] = { fra: previous.fra, til: range.til };
  }
  return result;
};

const clampSegmentToWindows = (
  segment: TafKravGrafSeriesSegment,
  windows: readonly TafKravGrafTimeWindow[]
): TafKravGrafSeriesSegment[] =>
  windows.flatMap((window) => {
    const fra = maxISO(segment.fra, window.fra);
    const til = minISO(segment.til, window.til);
    if (fra > til) return [];
    return [{ ...segment, fra, til }];
  });

const splitRangeByCalendarMonths = (range: TafKravGrafTimeWindow): TafKravGrafTimeWindow[] => {
  const result: TafKravGrafTimeWindow[] = [];
  let cursor = range.fra;
  while (cursor <= range.til) {
    const parsed = parseISODate(cursor);
    if (!parsed) break;
    const monthIndex = parsed.getUTCMonth();
    const nextMonthYear = monthIndex === 11 ? parsed.getUTCFullYear() + 1 : parsed.getUTCFullYear();
    const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
    // `createDate` fastholder eksplicit årstal; måned 12 kan derfor ikke bruges som implicit rollover.
    const nextMonthFirst = dateToISO(createDate(nextMonthYear, nextMonthIndex, 1));
    const monthEnd = nextMonthFirst ? getDayBeforeIso(nextMonthFirst) : undefined;
    const til = monthEnd && monthEnd < range.til ? monthEnd : range.til;
    result.push({ fra: cursor, til });
    const nextCursor = getDayAfterIso(til);
    if (!nextCursor || nextCursor <= cursor) break;
    cursor = nextCursor;
  }
  return result;
};

const countArbejsdageInRange = (
  range: TafKravGrafTimeWindow,
  context: IncomeCalculationContext | null
): number => {
  if (!context) return 0;
  let count = 0;
  iterateIsoDatesInclusive(range.fra, range.til, (iso) => {
    if (context.arbejdsdageSet.has(iso)) {
      count += 1;
    }
  });
  return count;
};

const resolveUnitDivisor = (
  range: TafKravGrafTimeWindow,
  unit: TafKravGrafDocument['unit'],
  context: IncomeCalculationContext | null
): number => {
  if (unit === 'arbejdsdag') {
    return countArbejsdageInRange(range, context);
  }
  return beregnArbejdsdageOgMaaneder(range.fra, range.til, new Set(), new Set()).maaneder;
};

// Bygger bro over kalendermåneder der kun mangler et segment, fordi de IKKE har
// nogen arbejdsdage (hele måneden er ferie/SH/fravær). Dagslønnen er en rate pr.
// arbejdsdag og er per definition uændret af en sådan måned, så et hul ville være
// et falsk visuelt dyk. Den foregående måneds rate holdes hen over hullet.
//
// Kun for arbejdsdags-grundlaget: månedsløn har aldrig nul-divisor. Et ægte
// indkomsthul (måned MED arbejdsdage, men uden ansættelse) har arbejdsdage > 0 og
// bygges der bevidst IKKE bro over — det er et reelt dyk. Broen begrænses til ét
// tidsvindue ad gangen, så akse-brud aldrig overskrides.
const bridgeZeroWorkdayMonths = (
  series: TafKravGrafSeries,
  timeWindows: readonly TafKravGrafTimeWindow[],
  workdaysInRange: (range: TafKravGrafTimeWindow) => number
): TafKravGrafSeries => {
  const segmentInMonth = (month: TafKravGrafTimeWindow): TafKravGrafSeriesSegment | undefined =>
    series.segments.find((segment) => segment.fra <= month.til && segment.til >= month.fra);

  const bridged: TafKravGrafSeriesSegment[] = [];
  for (const window of timeWindows) {
    const months = splitRangeByCalendarMonths(window);
    const lastCoveredIndex = months.reduce((acc, month, index) => (segmentInMonth(month) ? index : acc), -1);
    if (lastCoveredIndex < 0) continue;
    let lastAmountOre: MoneyOre | null = null;
    for (let index = 0; index <= lastCoveredIndex; index += 1) {
      const existing = segmentInMonth(months[index]);
      if (existing) {
        lastAmountOre = existing.amountOre;
        continue;
      }
      // Indre måned uden segment: byg kun bro hvis den mangler pga. nul arbejdsdage.
      if (lastAmountOre === null) continue;
      if (workdaysInRange(months[index]) > 0) continue;
      bridged.push({ fra: months[index].fra, til: months[index].til, amountOre: lastAmountOre });
    }
  }
  if (bridged.length === 0) return series;
  return {
    ...series,
    segments: [...series.segments, ...bridged].sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0)),
  };
};

// Sorteringsrang afgør seriernes rækkefølge (og dermed farve + stak-lagdeling):
// ét ansættelsesforhold pr. serie (efter employer.index), derefter offentlige ydelser.
const BENEFIT_RANK_BASE = 1_000_000;

type SeriesAccumulator = { segments: TafKravGrafSeriesSegment[]; rank: number };

const appendIncomeSegment = (
  seriesByLabel: Map<string, SeriesAccumulator>,
  label: string,
  rank: number,
  segment: TafKravGrafSeriesSegment
): void => {
  if (segment.amountOre <= 0) return;
  const existing = seriesByLabel.get(label);
  if (existing) {
    existing.segments.push(segment);
    return;
  }
  seriesByLabel.set(label, { segments: [segment], rank });
};

export const eoSnapshotToTafKravGrafDocument = (
  snapshot: EoSnapshot
): TafKravGrafDocumentProjection => {
  const blockingInvariants = getBlockingInvariantsForOutput(snapshot.invariants, 'taf_per_year_pdf');
  const blockedMessage = buildBlockingMessageForOutput(
    snapshot.invariants,
    'taf_per_year_pdf',
    'Visuel graf over indtægtsniveau kan ikke genereres for den aktuelle sag.'
  );
  if (!hasEoSnapshotData(snapshot) || blockingInvariants.length > 0) {
    return { kind: 'blocked', message: blockedMessage, invariants: blockingInvariants };
  }

  const { pdfModel: model, engines } = snapshot.data;
  const presentation = engines.tafPerYear;
  if (!presentation || presentation.years.length === 0) {
    return { kind: 'blocked', message: 'Visuel graf over indtægtsniveau kan ikke genereres, fordi TAF ikke kan fordeles på år.', invariants: [] };
  }

  const beregningsperiode = validateIsoRange(
    model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.periodeTilBeregning?.fra,
    model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.periodeTilBeregning?.til
  ) ?? null;
  const tafRanges = model.tafRanges.map((range) => ({ fra: range.fra, til: range.til }));
  const skadeIso = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.skadedato ?? null;
  const timeWindows = buildTimeWindows(tafRanges, beregningsperiode, skadeIso);
  if (timeWindows.length === 0) {
    return { kind: 'blocked', message: 'Visuel graf over indtægtsniveau kan ikke genereres, fordi der ikke er en TAF-periode.', invariants: [] };
  }

  const unit = model.tabtArbejdsfortjeneste.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? 'arbejdsdag'
    : 'maaned';
  const sourceRanges = beregningsperiode ? [beregningsperiode, ...tafRanges] : tafRanges;
  const incomeContext = buildIncomeCalculationContext(snapshot.input.erstatningsopgoerelse, sourceRanges);
  const useWholeKronerForMidlertidigtEet = snapshot.input.erstatningsopgoerelse.midlertidigtEetFraEetSiden === 'Ja';
  const seriesByLabel = new Map<string, SeriesAccumulator>();
  const benefitRankByLabel = new Map<string, number>();

  for (const sourceRange of sourceRanges) {
    for (const sampleRange of splitRangeByCalendarMonths(sourceRange)) {
      const divisor = resolveUnitDivisor(sampleRange, unit, incomeContext);
      if (divisor <= 0) continue;
      const income = buildIncomeForRanges(
        snapshot.input.erstatningsopgoerelse,
        [sampleRange],
        incomeContext,
        snapshot.input.stamdata.skadedato
      );
      // Hvert ansættelsesforhold er sin egen serie (ingen sammenlægning af lønindkomst).
      for (const employer of income.employers) {
        const label = resolveArbejdsstedDisplayName(employer.name, employer.index);
        for (const segment of clampSegmentToWindows({
          fra: sampleRange.fra,
          til: sampleRange.til,
          amountOre: roundOre((employer.amount * 100) / divisor),
        }, timeWindows)) {
          appendIncomeSegment(seriesByLabel, label, employer.index, segment);
        }
      }
      for (const benefit of income.benefits) {
        const benefitKroner = roundIncomeBenefitAmountKroner(
          benefit.typeKey,
          benefit.amount,
          useWholeKronerForMidlertidigtEet
        );
        let benefitRank = benefitRankByLabel.get(benefit.label);
        if (benefitRank === undefined) {
          benefitRank = BENEFIT_RANK_BASE + benefitRankByLabel.size;
          benefitRankByLabel.set(benefit.label, benefitRank);
        }
        for (const segment of clampSegmentToWindows({
          fra: sampleRange.fra,
          til: sampleRange.til,
          amountOre: roundOre((benefitKroner * 100) / divisor),
        }, timeWindows)) {
          appendIncomeSegment(seriesByLabel, benefit.label, benefitRank, segment);
        }
      }
    }
  }
  const series = [...seriesByLabel.entries()]
    .sort(([, a], [, b]) => a.rank - b.rank)
    .map(([label, accumulator], index): TafKravGrafSeries => {
      const base: TafKravGrafSeries = {
        id: seriesIdFromLabel(label),
        label,
        color: SERIES_COLORS[index % SERIES_COLORS.length],
        segments: accumulator.segments,
      };
      // Kun arbejdsdags-grundlaget kan få nul-arbejdsdags-huller (månedsløn har
      // altid positiv divisor); månedsløns-grafen er derved urørt af ferie/SH.
      return unit === 'arbejdsdag'
        ? bridgeZeroWorkdayMonths(base, timeWindows, (range) => countArbejsdageInRange(range, incomeContext))
        : base;
    });

  if (series.length === 0) {
    return { kind: 'blocked', message: 'Visuel graf over indtægtsniveau kan ikke genereres, fordi der ikke er indkomstsegmenter i TAF-perioden.', invariants: [] };
  }

  const firstWindow = timeWindows[0];
  const lastWindow = timeWindows.at(-1);
  const skadeMarker = skadeIso && firstWindow && lastWindow && skadeIso >= firstWindow.fra && skadeIso <= lastWindow.til
    ? { date: skadeIso, label: model.skadestypeLinje?.startsWith('Erhvervssygdom') ? 'Anmeldelsesdato' : 'Skadedato' }
    : null;

  return {
    kind: 'ok',
    document: {
      model,
      unit,
      series,
      timeWindows,
      beregningsperiode,
      skadeMarker,
    },
  };
};
