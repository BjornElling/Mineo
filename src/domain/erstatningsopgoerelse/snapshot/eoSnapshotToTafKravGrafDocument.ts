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
import { asciiSlug } from '../../../utils/asciiSlug';
import { roundByMethod } from '../../../utils/rounding';
import { beregnArbejdsdageOgMaaneder } from '../engines/arbejdsdageMaaneder';
import { buildDatoSetInclusive, buildFerieDageSet, isWeekdayUtc } from '../engines/tafDaySets';
import type { FerieperiodeRow } from '../../../schemas/formSchemas';
import { TAF_BEREGNES_SOM } from '../helpers/tafBeregningsenhed';
import {
  buildIncomeCalculationContext,
  buildIncomeForRanges,
  buildIncomeInputRanges,
  buildIncomeSourceRanges,
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
import type { EoModel } from '../shared/eoTypes';
import { moneyOre, type MoneyOre } from '../../money/money';

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
  // Ferieperioder uden indtastet indkomst af mindst 3 sammenhængende arbejdsdages
  // varighed (weekend/SH bryder ikke sammenhængen). Markeres med et tonet bånd, og
  // der bygges bevidst IKKE bro over dem (jf. bridgeZeroWorkdayGaps) – dykket vises.
  ferieAbsenceMarkers: readonly TafKravGrafTimeWindow[];
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
  asciiSlug(label, { fallback: 'indtaegtskilde' });

const roundOre = (value: number): MoneyOre =>
  moneyOre(roundByMethod(value, 0, 'halfAwayFromZero'));

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

const splitRangeByGraphSamples = (
  range: TafKravGrafTimeWindow,
  incomeSourceRanges: readonly TafKravGrafTimeWindow[]
): TafKravGrafTimeWindow[] => {
  const boundaries = new Set<ISODateString>([range.fra]);
  const dayAfterRange = getDayAfterIso(range.til);
  if (dayAfterRange) boundaries.add(dayAfterRange);

  for (const month of splitRangeByCalendarMonths(range)) {
    boundaries.add(month.fra);
    const afterMonth = getDayAfterIso(month.til);
    if (afterMonth) boundaries.add(afterMonth);
  }

  for (const source of incomeSourceRanges) {
    const fra = maxISO(source.fra, range.fra);
    const til = minISO(source.til, range.til);
    if (fra > til) continue;
    boundaries.add(fra);
    const afterSource = getDayAfterIso(til);
    if (afterSource) boundaries.add(afterSource);
  }

  const sorted = [...boundaries].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const result: TafKravGrafTimeWindow[] = [];
  for (let index = 0; index < sorted.length; index += 1) {
    const fra = sorted[index];
    const next = sorted[index + 1];
    if (!fra) continue;
    const til = next ? getDayBeforeIso(next) : range.til;
    if (!til || fra > til || fra > range.til || til < range.fra) continue;
    result.push({ fra: maxISO(fra, range.fra), til: minISO(til, range.til) });
  }
  return result;
};

const countArbejdsdageInRange = (
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
    return countArbejdsdageInRange(range, context);
  }
  return beregnArbejdsdageOgMaaneder(range.fra, range.til, new Set(), new Set()).maaneder;
};

// Bygger bro over interne huller mellem to på hinanden følgende segmenter, når
// hullet UDELUKKENDE består af ikke-arbejdsdage (weekend/helligdag/ferie/fravær).
// Dagslønnen er en rate pr. arbejdsdag og er per definition uændret af en sådan dag,
// så et hul ville være et falsk visuelt dyk – det gælder både en hel ferie-måned og
// en enkelt søndag, der isoleres som et dag-fragment på en måneds-/segmentgrænse.
// Den foregående periodes rate holdes hen over hullet.
//
// Kun for arbejdsdags-grundlaget: månedsløn har aldrig nul-divisor. Et ægte
// indkomsthul (dage MED arbejdsdage, men uden ansættelse) har arbejdsdage > 0 og
// bygges der bevidst IKKE bro over – det er et reelt dyk. Broen begrænses til ét
// tidsvindue ad gangen, så akse-brud aldrig overskrides, og strækker sig aldrig før
// første eller efter sidste segment (kun mellem to faktiske segmenter).
const bridgeZeroWorkdayGaps = (
  series: TafKravGrafSeries,
  timeWindows: readonly TafKravGrafTimeWindow[],
  workdaysInRange: (range: TafKravGrafTimeWindow) => number,
  protectedRanges: readonly TafKravGrafTimeWindow[]
): TafKravGrafSeries => {
  const sorted = [...series.segments].sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
  const bridged: TafKravGrafSeriesSegment[] = [];
  for (let index = 0; index + 1 < sorted.length; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    const gapFra = getDayAfterIso(current.til);
    const gapTil = getDayBeforeIso(next.fra);
    // Tilstødende eller overlappende segmenter har intet hul at bygge bro over.
    if (!gapFra || !gapTil || gapFra > gapTil) continue;
    // Hullet skal ligge helt inden for ét tidsvindue, så en bro aldrig krydser et akse-brud.
    if (!timeWindows.some((window) => window.fra <= gapFra && gapTil <= window.til)) continue;
    // Reelt indkomsthul (mindst én arbejdsdag uden ansættelse) bevares som et ægte dyk.
    if (workdaysInRange({ fra: gapFra, til: gapTil }) > 0) continue;
    // Markeret ferie uden løn skal vises som et dyk, ikke fyldes ud.
    if (protectedRanges.some((range) => gapFra <= range.til && gapTil >= range.fra)) continue;
    bridged.push({ fra: gapFra, til: gapTil, amountOre: current.amountOre });
  }
  if (bridged.length === 0) return series;
  return {
    ...series,
    segments: [...series.segments, ...bridged].sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0)),
  };
};

// Finder ferieperioder uden indtastet indkomst, der varer mindst 3 sammenhængende
// arbejdsdage. "Sammenhængende" brydes ikke af weekend- eller SH-dage, men nok af en
// mellemliggende arbejds-/ledig hverdag. Sådanne ferier markeres visuelt og fyldes IKKE
// ud i grafen (jf. protectedRanges i bridgeZeroWorkdayGaps). Fuld løn under ferie giver
// indkomst på dagene og udelukker dem derfor (intet hul at markere).
// Kun relevant for arbejdsdags-grundlag: ved månedsløn periodiseres ferie på kalenderdage,
// så der opstår intet ferie-hul.
const FERIE_MIN_ARBEJDSDAGE = 3;

const buildFerieAbsenceMarkers = (
  ferieperioder: readonly FerieperiodeRow[],
  timeWindows: readonly TafKravGrafTimeWindow[],
  incomeSegments: readonly TafKravGrafSeriesSegment[],
  shDays: ReadonlySet<ISODateString>
): TafKravGrafTimeWindow[] => {
  if (ferieperioder.length === 0) return [];

  // Ferie-hverdage (ekskl. weekend og SH) inden for tidsvinduerne.
  const ferieWeekdays = new Set<ISODateString>();
  for (const window of timeWindows) {
    const datoSet = buildDatoSetInclusive(window.fra, window.til);
    for (const iso of buildFerieDageSet(ferieperioder, datoSet)) ferieWeekdays.add(iso);
  }

  const hasIncomeOn = (iso: ISODateString): boolean =>
    incomeSegments.some((segment) => segment.fra <= iso && segment.til >= iso);
  // Kun ferie uden indtastet indkomst tæller med.
  const candidates = [...ferieWeekdays].filter((iso) => !hasIncomeOn(iso)).sort();
  if (candidates.length === 0) return [];

  const isWeekdayNonSh = (iso: ISODateString): boolean => {
    const date = parseISODate(iso);
    return date ? isWeekdayUtc(date) && !shDays.has(iso) : false;
  };
  // To ferie-hverdage hører til samme ferie, hvis der kun ligger weekend-/SH-dage imellem.
  const isConnected = (earlier: ISODateString, later: ISODateString): boolean => {
    const from = getDayAfterIso(earlier);
    const to = getDayBeforeIso(later);
    if (!from || !to || from > to) return true;
    // En enkelt mellemliggende arbejds-/ledig hverdag bryder sammenhængen.
    let broken = false;
    iterateIsoDatesInclusive(from, to, (iso) => {
      if (isWeekdayNonSh(iso)) broken = true;
    });
    return !broken;
  };

  // En tilstødende dag hører med i båndet, hvis den er en weekend- eller SH-dag uden
  // indkomst – så dykket markeres fra arbejdsophør til arbejdets genoptagelse. En
  // arbejdsdag (med eller uden indkomst) eller en indkomstdag stopper udvidelsen.
  const isWeekendOrShWithoutIncome = (iso: ISODateString): boolean => {
    const date = parseISODate(iso);
    if (!date) return false;
    return (!isWeekdayUtc(date) || shDays.has(iso)) && !hasIncomeOn(iso);
  };
  const windowFor = (iso: ISODateString): TafKravGrafTimeWindow | undefined =>
    timeWindows.find((window) => window.fra <= iso && iso <= window.til);

  const markers: TafKravGrafTimeWindow[] = [];
  let runStart = candidates[0];
  let runEnd = candidates[0];
  let runCount = 1;
  const flush = (): void => {
    if (runCount < FERIE_MIN_ARBEJDSDAGE) return;
    const window = windowFor(runStart);
    let fra = runStart;
    let til = runEnd;
    if (window) {
      for (let prev = getDayBeforeIso(fra); prev && prev >= window.fra && isWeekendOrShWithoutIncome(prev); prev = getDayBeforeIso(fra)) {
        fra = prev;
      }
      for (let next = getDayAfterIso(til); next && next <= window.til && isWeekendOrShWithoutIncome(next); next = getDayAfterIso(til)) {
        til = next;
      }
    }
    markers.push({ fra, til });
  };
  for (let index = 1; index < candidates.length; index += 1) {
    const day = candidates[index];
    if (isConnected(runEnd, day)) {
      runEnd = day;
      runCount += 1;
    } else {
      flush();
      runStart = day;
      runEnd = day;
      runCount = 1;
    }
  }
  flush();
  return markers;
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

const hasShDay = (
  segment: TafKravGrafSeriesSegment,
  context: IncomeCalculationContext | null
): boolean => {
  if (!context) return false;
  let found = false;
  iterateIsoDatesInclusive(segment.fra, segment.til, (iso) => {
    if (context.shDaysForYdelser.has(iso)) {
      found = true;
    }
  });
  return found;
};

const areAdjacentOrOverlapping = (
  left: TafKravGrafSeriesSegment,
  right: TafKravGrafSeriesSegment
): boolean => {
  const dayAfterLeft = getDayAfterIso(left.til);
  return Boolean(dayAfterLeft && right.fra <= dayAfterLeft);
};

const stabilizeSygedagpengeShDips = (
  series: TafKravGrafSeries,
  context: IncomeCalculationContext | null
): TafKravGrafSeries => {
  const segments = [...series.segments].sort((a, b) => (a.fra < b.fra ? -1 : a.fra > b.fra ? 1 : 0));
  let changed = false;
  const normalized = segments.map((segment, index) => {
    const previous = segments[index - 1];
    const next = segments[index + 1];
    if (!previous || !next) return segment;
    if (!areAdjacentOrOverlapping(previous, segment) || !areAdjacentOrOverlapping(segment, next)) return segment;
    if (!hasShDay(segment, context)) return segment;
    const neighborFloor = Math.min(previous.amountOre, next.amountOre);
    if (segment.amountOre >= neighborFloor * 0.9) return segment;

    changed = true;
    return {
      ...segment,
      // Visuel graf: et isoleret SH-dyk i en ellers aktiv sygedagpenge-række må ikke
      // ligne et reelt indkomstfald. De autoritative TAF-/fradragstal beregnes fortsat
      // i indkomstmotoren; kun grafens niveau udfyldes med nabogennemsnittet.
      amountOre: roundOre((previous.amountOre + next.amountOre) / 2),
    };
  });

  return changed ? { ...series, segments: normalized } : series;
};

export const eoSnapshotToTafKravGrafDocument = (
  snapshot: EoSnapshot
): TafKravGrafDocumentProjection => {
  // Bevidst delt gate: Visuel graf over indtægtsniveau visualiserer netop TAF-per-år-dataene, så den
  // deler blokerings-target med taf_per_year_pdf – er TAF ikke kan fordeles på år, kan grafen heller
  // ikke genereres. Derfor intet særskilt 'taf_krav_graf_pdf'-target (jf. eo-snapshot-contract.md).
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
    // Skeln årsagen: uden TAF-perioder beregnes der slet ingen tabt arbejdsfortjeneste, hvilket er
    // en anden (og hyppigere) situation end at en faktisk TAF-beregning ikke kan fordeles på år.
    const message = engines.tafNetto.harTafPerioder
      ? 'Visuel graf over indtægtsniveau kan ikke genereres, fordi TAF ikke kan fordeles på år.'
      : 'Dokumentet kan ikke genereres, fordi der ikke beregnes tabt arbejdsfortjeneste i erstatningsperioden.';
    return { kind: 'blocked', message, invariants: [] };
  }

  const beregningsperiode = validateIsoRange(
    model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.periodeTilBeregning?.fra,
    model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.periodeTilBeregning?.til
  ) ?? null;
  const tafRanges = model.tafRanges.map((range) => ({ fra: range.fra, til: range.til }));
  const skadeIso = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt?.skadedato ?? null;
  const incomeSourceRanges = buildIncomeSourceRanges(snapshot.input.erstatningsopgoerelse);
  const incomeRanges = buildIncomeInputRanges(snapshot.input.erstatningsopgoerelse);
  const timeWindows = buildTimeWindows([...tafRanges, ...incomeRanges], beregningsperiode, skadeIso);
  if (timeWindows.length === 0) {
    return { kind: 'blocked', message: 'Visuel graf over indtægtsniveau kan ikke genereres, fordi der ikke er en TAF-periode.', invariants: [] };
  }

  const unit = model.tabtArbejdsfortjeneste.tafBeregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE
    ? 'arbejdsdag'
    : 'maaned';
  const sourceRanges = timeWindows;
  const incomeContext = buildIncomeCalculationContext(snapshot.input.erstatningsopgoerelse, sourceRanges);
  const useWholeKronerForMidlertidigtEet = snapshot.input.erstatningsopgoerelse.midlertidigtEetFraEetSiden === 'Ja';
  const seriesByLabel = new Map<string, SeriesAccumulator>();
  const benefitRankByLabel = new Map<string, number>();

  for (const sourceRange of sourceRanges) {
    for (const sampleRange of splitRangeByGraphSamples(sourceRange, incomeSourceRanges)) {
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
        const label = `Løn (${resolveArbejdsstedDisplayName(employer.name, employer.index)})`;
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
  // Ferie uden løn (≥3 sammenhængende arbejdsdage) udledes af de rå indkomstsegmenter
  // FØR bro-bygningen, så markeringen afspejler de faktisk indtastede indkomster.
  const ferieAbsenceMarkers = unit === 'arbejdsdag'
    ? buildFerieAbsenceMarkers(
      snapshot.input.erstatningsopgoerelse.ferieperioder ?? [],
      timeWindows,
      [...seriesByLabel.values()].flatMap((accumulator) => accumulator.segments),
      incomeContext?.shDaysForYdelser ?? new Set<ISODateString>()
    )
    : [];

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
      const bridged = unit === 'arbejdsdag'
        ? bridgeZeroWorkdayGaps(base, timeWindows, (range) => countArbejdsdageInRange(range, incomeContext), ferieAbsenceMarkers)
        : base;
      return label === 'Sygedagpenge'
        ? stabilizeSygedagpengeShDips(bridged, incomeContext)
        : bridged;
    });

  if (series.length === 0) {
    return { kind: 'blocked', message: 'Visuel graf over indtægtsniveau kan ikke genereres, fordi der ikke er indkomstsegmenter i TAF-perioden.', invariants: [] };
  }

  const firstWindow = timeWindows[0];
  const lastWindow = timeWindows.at(-1);
  const skadeMarker = skadeIso && firstWindow && lastWindow && skadeIso >= firstWindow.fra && skadeIso <= lastWindow.til
    // Navnet er FÆRDIGT på modellen (§3.2a) – det må ikke genskabes ved at læse `skadestypeLinje`s prosa.
    ? { date: skadeIso, label: model.skadedatoLabel }
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
      ferieAbsenceMarkers,
    },
  };
};
