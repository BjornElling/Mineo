// Scene-modellen for "Visuel graf over indtægtsniveau".
//
// Modulet indeholder ALT det, der bestemmer hvordan grafen ser ud: layout, sampling,
// akse-ticks, kurve-interpolation, farver, skrifter, tekster og koordinater. Resultatet
// er en ren værdi — en ordnet liste af tegneprimitiver — uden nogen canvas-afhængighed.
//
// Grunden til opdelingen: canvas-tegningen kan ikke køres i test (jsdom har intet
// 2D-API), så al logik der bor sammen med `ctx`-kaldene er reelt utestbar. Ved at flytte
// beslutningerne herind bliver de dækket af et golden-net på scene-modellen
// (koordinater, farver, tekst), mens den tilbageværende renderer er et mekanisk
// oversætter-lag uden beslutninger.
//
// Tekstmåling er den ene ting scenen ikke selv kan afgøre (den afhænger af den konkrete
// font-motor). Den injiceres derfor som en `MeasureText`-funktion, så scenen kan træffe
// sine kollisions- og centreringsbeslutninger og stadig være ren.

import { createDate, dateToISO, parseISODate, type ISODateString } from '../../../types/branded';
import { diffUtcDays } from '../../../utils/utcDayMath';
import { getDayAfterIso, getDayBeforeIso, isoYear } from '../../../utils/isoDateHelpers';
import { formatISOToDanish } from '../../../utils/dateFormatting';
import { roundByMethod } from '../../../utils/rounding';
import { formatMoneyOreWithKrTrimmed } from '../../layout/documentFormatUtils';
import type {
  TafKravGrafDocument,
  TafKravGrafSeries,
  TafKravGrafTimeWindow,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import { moneyOre, type MoneyOre } from '../../../domain/money/money';

// ---------------------------------------------------------------------------
// Scene-primitiver
// ---------------------------------------------------------------------------

export type ScenePoint = Readonly<{ x: number; y: number }>;

/** Ét led i en sti: enten en ret linje eller et kubisk bezier-segment. */
export type ScenePathSegment =
  | Readonly<{ kind: 'lineTo'; x: number; y: number }>
  | Readonly<{
      kind: 'bezierTo';
      c1x: number;
      c1y: number;
      c2x: number;
      c2y: number;
      x: number;
      y: number;
    }>;

export type SceneTextAlign = 'left' | 'center' | 'right';
export type SceneTextBaseline = 'alphabetic' | 'middle';

/** Streg-udseende. `dash` tom = fuldt optrukket. */
export type SceneStroke = Readonly<{
  color: string;
  width: number;
  dash?: readonly number[];
}>;

export type SceneCommand =
  /** Udfyldt rektangel med skarpe hjørner. */
  | Readonly<{ kind: 'fillRect'; x: number; y: number; width: number; height: number; color: string }>
  /** Udfyldt rektangel med afrundede hjørner. */
  | Readonly<{
      kind: 'fillRoundRect';
      x: number;
      y: number;
      width: number;
      height: number;
      radius: number;
      color: string;
    }>
  /** Ramme om et rektangel med skarpe hjørner. */
  | Readonly<{
      kind: 'strokeRect';
      x: number;
      y: number;
      width: number;
      height: number;
      stroke: SceneStroke;
    }>
  /**
   * Én eller flere uafhængige linjestykker, hver med sin egen sti. Bruges hvor stregerne
   * ikke hænger sammen — fx tick-mærker og gridlinjer. For en stiplet streg er det
   * betydende: dash-mønsteret starter forfra på hvert stykke.
   */
  | Readonly<{ kind: 'strokeLines'; lines: readonly (readonly [ScenePoint, ScenePoint])[]; stroke: SceneStroke }>
  /**
   * Flere delstier i ÉN sti med ét `stroke`-kald. Bruges hvor stregerne udgør én figur
   * (aksernes vinkel) eller hvor et stiplet mønster bevidst løber videre fra den ene
   * delsti til den næste (periode-kanternes stipling).
   */
  | Readonly<{
      kind: 'strokeSubpaths';
      subpaths: readonly (readonly ScenePoint[])[];
      stroke: SceneStroke;
    }>
  /** Lukket polygon fyldt med én farve (bruges til skade-trekanten). */
  | Readonly<{ kind: 'fillPolygon'; points: readonly ScenePoint[]; color: string }>
  /** Lukket, udfyldt sti bygget af rette og buede led (de stablede bånd). */
  | Readonly<{ kind: 'fillPath'; start: ScenePoint; segments: readonly ScenePathSegment[]; color: string }>
  | Readonly<{
      kind: 'text';
      x: number;
      y: number;
      text: string;
      font: string;
      color: string;
      align: SceneTextAlign;
      baseline: SceneTextBaseline;
    }>
  /** Begrænser efterfølgende kommandoer til et afrundet rektangel indtil `restore`. */
  | Readonly<{
      kind: 'clipRoundRect';
      x: number;
      y: number;
      width: number;
      height: number;
      radius: number;
    }>
  /** Ophæver den seneste `clipRoundRect`. */
  | Readonly<{ kind: 'restore' }>;

export type TafKravGrafScene = Readonly<{
  width: number;
  height: number;
  /** Baggrundsfarve for hele lærredet, tegnet før alle kommandoer. */
  background: string;
  commands: readonly SceneCommand[];
}>;

/** Måler en tekstbredde i px med den angivne CSS-font-streng. */
export type MeasureText = (text: string, font: string) => number;

// ---------------------------------------------------------------------------
// Lærred, farver og skrifter
// ---------------------------------------------------------------------------

// Canvas-dimensioner. Forholdet matcher den landscape-A4-indlejring i tafKravGrafPdf
// (indholdsbredde 257 mm × maks. 142 mm), så billedet ikke strækkes ved indsættelse.
export const TAF_KRAV_GRAF_CANVAS = { width: 2570, height: 1420 } as const;
const CANVAS_WIDTH = TAF_KRAV_GRAF_CANVAS.width;
const CANVAS_HEIGHT = TAF_KRAV_GRAF_CANVAS.height;

const PLOT_LEFT = 196;
const PLOT_RIGHT = CANVAS_WIDTH - 90;
const PLOT_TOP = 150;
const PLOT_BOTTOM = 1118;
const PLOT_RADIUS = 16;
const BREAK_WIDTH = 60;

const COLOR_CANVAS_BG = '#FFFFFF';
const COLOR_TEXT = '#1F2733';
const COLOR_TEXT_MUTED = '#5A6473';
const COLOR_AXIS = '#3A4250';
const COLOR_GRID = '#E4E8EE';
const COLOR_PLOT_BG = '#FAFBFC';
const COLOR_BEREGNING_TINT = 'rgba(48, 99, 142, 0.07)';
const COLOR_BEREGNING_LABEL = '#30638E';
const COLOR_SKADE = '#9B2F2F';
const COLOR_FERIE_TINT = 'rgba(90, 100, 115, 0.13)';
const COLOR_FERIE_LABEL = '#5A6473';

const TITLE_FONT = '700 46px Arial, sans-serif';
const SUBTITLE_FONT = '400 30px Arial, sans-serif';
const LEGEND_FONT = '400 30px Arial, sans-serif';
const AXIS_LABEL_FONT = '400 28px Arial, sans-serif';

const MONTHS_DA = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'] as const;
const X_LABEL_MIN_GAP = 16;

const LEGEND_SWATCH = 26;
const LEGEND_TEXT_GAP = 18;
const LEGEND_SWATCH_EXTRA = 12;
const LEGEND_ITEM_GAP = 56;

type Point = ScenePoint;

type WindowSamples = Readonly<{
  window: TafKravGrafTimeWindow;
  // Pr. kolonne (kalendermåned-midtpunkt + evt. start/slut-ankre), sorteret efter x:
  // x-position + beløb pr. serie i samme rækkefølge som document.series.
  sampleX: readonly number[];
  leftX: number;
  rightX: number;
  valuesBySeries: readonly (readonly number[])[];
}>;

const daysBetween = (fra: ISODateString, til: ISODateString): number => {
  const start = parseISODate(fra);
  const end = parseISODate(til);
  if (!start || !end) return 0;
  return Math.max(0, diffUtcDays(start, end));
};

const windowContains = (window: TafKravGrafTimeWindow, iso: ISODateString): boolean =>
  iso >= window.fra && iso <= window.til;

const makeMonthStart = (year: number, monthIndex: number): ISODateString | null =>
  dateToISO(createDate(year, monthIndex, 1)) ?? null;

const formatMonthYear = (iso: ISODateString): string => {
  const parsed = parseISODate(iso);
  if (!parsed) return iso;
  return `${MONTHS_DA[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
};

// ---------------------------------------------------------------------------
// Akse-ticks
// ---------------------------------------------------------------------------

// Mindste "pæne" tal (1·2·2,5·5 × 10ⁿ) som er ≥ value. Bruges til at vælge skridtstørrelse.
const niceCeil = (value: number): number => {
  if (value <= 0) return 0;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
  return niceNormalized * magnitude;
};

// Y-aksens skridt vælges ud fra den størst mulige *samlede* indkomst (stak-toppen), så
// summen af serier aldrig overskrider aksen. Toppen holdes tæt på maks (lille headroom),
// men altid på et pænt, rundt tal frem for det nøjagtige maksimum.
const TARGET_TICK_INTERVALS = 5;
const Y_AXIS_HEADROOM = 1.02;

// Input er den rå (evt. ikke-heltallige) øre-sum til akseskalering; tick-værdierne afrundes og
// brandes som MoneyOre internt, så inputtet behøver ikke selv være branded.
const buildNiceMoneyTicks = (maxStackedOre: number): readonly MoneyOre[] => {
  const maxKr = Math.max(1, (maxStackedOre / 100) * Y_AXIS_HEADROOM);
  const stepKr = Math.max(1, niceCeil(maxKr / TARGET_TICK_INTERVALS));
  const tickCount = Math.max(1, Math.ceil(maxKr / stepKr));
  const ticks: MoneyOre[] = [];
  for (let i = 0; i <= tickCount; i += 1) {
    ticks.push(moneyOre(roundByMethod(i * stepKr * 100, 0, 'halfAwayFromZero')));
  }
  return ticks;
};

const buildDateTicks = (window: TafKravGrafTimeWindow): ISODateString[] => {
  const spanDays = daysBetween(window.fra, window.til);
  const monthStep = spanDays <= 200 ? 2 : spanDays <= 420 ? 3 : spanDays <= 900 ? 6 : 12;
  const dates: ISODateString[] = [];
  const startYear = isoYear(window.fra);
  const endYear = isoYear(window.til);
  // Anker tick-rækken til hele kvartaler/halvår, så labels lander pænt (jan/apr/jul/okt).
  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += monthStep) {
      const iso = makeMonthStart(year, month);
      if (iso && windowContains(window, iso)) dates.push(iso);
    }
  }
  return [...new Set(dates)].sort();
};

const canAppendTerminalDateLabel = (
  x: number,
  labelWidth: number,
  lastAutomaticLabelRight: number,
  canvasRight: number = CANVAS_WIDTH
): boolean => {
  const halfWidth = labelWidth / 2;
  return x - halfWidth >= lastAutomaticLabelRight + X_LABEL_MIN_GAP
    && x + halfWidth <= canvasRight;
};

// ---------------------------------------------------------------------------
// Vandret layout (tidsvinduer side om side med brud imellem)
// ---------------------------------------------------------------------------

const buildWindowLayout = (windows: readonly TafKravGrafTimeWindow[]) => {
  const plotWidth = PLOT_RIGHT - PLOT_LEFT;
  const breakCount = Math.max(0, windows.length - 1);
  const availableWidth = plotWidth - breakCount * BREAK_WIDTH;
  const spans = windows.map((window) => Math.max(1, daysBetween(window.fra, window.til)));
  const totalSpan = spans.reduce((sum, span) => sum + span, 0);
  let cursorX = PLOT_LEFT;
  return windows.map((window, index) => {
    const width = availableWidth * (spans[index] / totalSpan);
    const layout = { window, x: cursorX, width, span: spans[index] };
    cursorX += width + BREAK_WIDTH;
    return layout;
  });
};

type WindowLayout = ReturnType<typeof buildWindowLayout>;

const buildXMapper = (layout: WindowLayout) => (iso: ISODateString): number | null => {
  const entry = layout.find(({ window }) => windowContains(window, iso));
  if (!entry) return null;
  const offsetDays = daysBetween(entry.window.fra, iso);
  return entry.x + (offsetDays / entry.span) * entry.width;
};

// ---------------------------------------------------------------------------
// Datapunkter pr. vindue (én prøve pr. kalendermåned, midt i måneden)
// ---------------------------------------------------------------------------

const splitWindowByMonths = (window: TafKravGrafTimeWindow): TafKravGrafTimeWindow[] => {
  const result: TafKravGrafTimeWindow[] = [];
  let cursor = window.fra;
  while (cursor <= window.til) {
    const parsed = parseISODate(cursor);
    if (!parsed) break;
    const monthIndex = parsed.getUTCMonth();
    const nextYear = monthIndex === 11 ? parsed.getUTCFullYear() + 1 : parsed.getUTCFullYear();
    const nextMonth = monthIndex === 11 ? 0 : monthIndex + 1;
    const nextMonthFirst = makeMonthStart(nextYear, nextMonth);
    const monthEnd = nextMonthFirst ? getDayBeforeIso(nextMonthFirst) : undefined;
    const til = monthEnd && monthEnd < window.til ? monthEnd : window.til;
    result.push({ fra: cursor, til });
    const next = getDayAfterIso(til);
    if (!next || next <= cursor) break;
    cursor = next;
  }
  return result;
};

const amountAtIso = (series: TafKravGrafSeries, iso: ISODateString): number =>
  series.segments
    .filter((segment) => segment.fra <= iso && segment.til >= iso)
    .reduce((sum, segment) => sum + segment.amountOre, 0);

const midpointIso = (range: TafKravGrafTimeWindow): ISODateString => {
  const start = parseISODate(range.fra);
  if (!start) return range.fra;
  const result = new Date(start.getTime());
  result.setUTCDate(result.getUTCDate() + Math.floor(daysBetween(range.fra, range.til) / 2));
  return dateToISO(result) ?? range.fra;
};

type SampleColumn = { x: number; order: number; values: number[] };

const buildValuesAtIso = (document: TafKravGrafDocument, iso: ISODateString): number[] =>
  document.series.map((series) => amountAtIso(series, iso));

const buildWindowSamples = (
  document: TafKravGrafDocument,
  layout: WindowLayout,
  mapDate: (iso: ISODateString) => number | null
): WindowSamples[] =>
  layout.map((entry) => {
    const months = splitWindowByMonths(entry.window);
    const columns: SampleColumn[] = months.map((month, index) => {
      const x1 = mapDate(month.fra);
      const x2 = mapDate(month.til);
      return {
        x: x1 !== null && x2 !== null ? (x1 + x2) / 2 : entry.x,
        order: 1_000 + index,
        values: buildValuesAtIso(document, midpointIso(month)),
      };
    });

    // Segmentgrænser er autoritative for visuel tilstedeværelse. Måneds-midtpunkter
    // alene kan få en kort løn-/ydelsesperiode til at fylde hele måneden visuelt.
    // Derfor samples der ekstra på hver faktisk start og dagen efter hver faktisk
    // slutdato, så kurven rammer brugerens indtastede datoer.
    const transitionDates = new Set<ISODateString>([entry.window.fra]);
    for (const series of document.series) {
      for (const segment of series.segments) {
        if (segment.til < entry.window.fra || segment.fra > entry.window.til) continue;
        transitionDates.add(segment.fra < entry.window.fra ? entry.window.fra : segment.fra);
        const afterEnd = getDayAfterIso(segment.til);
        if (afterEnd && afterEnd >= entry.window.fra && afterEnd <= entry.window.til) {
          transitionDates.add(afterEnd);
        }
      }
    }
    let transitionOrder = 0;
    for (const iso of [...transitionDates].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
      const x = mapDate(iso);
      if (x === null) continue;
      const beforeIso = getDayBeforeIso(iso);
      const beforeValues = beforeIso && beforeIso >= entry.window.fra
        ? buildValuesAtIso(document, beforeIso)
        : null;
      // Vinduets start (intet "før") bæres af venstre-ankeret + måneds-midtpunkterne.
      if (!beforeValues) continue;
      const afterValues = buildValuesAtIso(document, iso);
      // Der tilføjes KUN en kolonne, hvor en serie starter (0→beløb) eller ophører
      // (beløb→0) — dét er de skarpe lodrette kanter, der skal bevares. Et rent
      // niveauskift (begge sider > 0) må IKKE give en kolonne på grænsedatoen: en
      // sådan grænse-kolonne har samme værdi som månedens midtpunkt og skabte et
      // fladt "plateau" pr. måned med kun afrundede skuldre. I stedet bæres
      // niveauskiftet nu af én blød bue mellem to måneds-midtpunkter.
      const edgeBySeries = afterValues.map(
        (after, index) => (beforeValues[index] === 0) !== (after === 0)
      );
      if (!edgeBySeries.some(Boolean)) continue;
      // Før-kolonnen giver kun den skarpe kant for kant-serierne; øvrige serier bærer
      // efter-værdien, så de ikke får en kunstig lodret kant.
      columns.push({
        x,
        order: transitionOrder,
        values: afterValues.map((after, index) => (edgeBySeries[index] ? beforeValues[index] : after)),
      });
      transitionOrder += 1;
      columns.push({ x, order: transitionOrder, values: afterValues });
      transitionOrder += 1;
    }
    columns.sort((a, b) => a.x - b.x || a.order - b.order);
    // Ingen udglatning af værdierne: hver serie tegnes med de faktiske niveauer, så
    // høje peaks og lave lavpunkter bevares i fuld højde. Afrundingen af overgangene
    // sker alene i kurve-interpolationen (buildSmoothCurveSegments), ikke ved at ændre tallene.
    const valuesBySeries = document.series.map((_, seriesIndex) =>
      columns.map((column) => column.values[seriesIndex] ?? 0)
    );

    return {
      window: entry.window,
      sampleX: columns.map((column) => column.x),
      leftX: entry.x,
      rightX: entry.x + entry.width,
      valuesBySeries,
    };
  });

const maxStackedTotalOre = (samples: readonly WindowSamples[]): number => {
  let max = 0;
  for (const sample of samples) {
    const count = sample.sampleX.length;
    for (let i = 0; i < count; i += 1) {
      let total = 0;
      for (const values of sample.valuesBySeries) total += values[i] ?? 0;
      if (total > max) max = total;
    }
  }
  return max;
};

// ---------------------------------------------------------------------------
// Blød kubisk interpolation (cardinal-/Catmull–Rom-spline)
// ---------------------------------------------------------------------------

// Kurven buer *igennem* datapunkterne frem for at følge den rette forbindelse tæt.
// Det giver runde buer ved ændringer i indtægtsgrundlaget i stedet for de spidse,
// abrupte savtakker, en monoton (overshoot-fri) kurve gav. Kurven rammer ALTID
// datapunkterne, så høje peaks og lave lavpunkter bevares i fuld højde — der
// udglattes ingen ekstremer. Nabopunkter bruges kun til at bestemme tangenternes
// retning, ikke til at ændre det enkelte punkts værdi.
//
// Et lodret spring (to på hinanden følgende punkter med samme x, forskellig y) er en
// skarp kant, hvor en ydelse starter eller ophører, og MÅ ikke afrundes. Sådanne
// spring bryder splinen i selvstændige strækninger, der forbindes med en ret,
// lodret linje — kanten forbliver dermed knivskarp.

// Overshoot tillades bevidst (det er dét, der giver den runde bue), men dæmpes, så et
// enkelt ekstremt udsving ikke får tangenten til at slå så voldsomt ud, at stablede
// bånd krydser hinanden. Grænsen er tangentens længde ift. den tilstødende sekant.
const CURVE_OVERSHOOT_LIMIT = 3;
// Vandret afstand (px) under hvilken to punkter regnes som samme x = en lodret kant.
const VERTICAL_BREAK_EPS = 0.5;

// Bygger én sammenhængende strækning [from, to] (uden interne lodrette spring) som en
// cardinal-spline. Tangenterne er centrerede nabo-differenser med nonuniform
// x-afstand, så forløbet er blødt selv ved uens punktafstand nær segment-/måneds-grænser.
const appendCardinalRun = (
  out: ScenePathSegment[],
  points: readonly Point[],
  from: number,
  to: number
): void => {
  if (to <= from) {
    if (to === from) out.push({ kind: 'lineTo', x: points[from].x, y: points[from].y });
    return;
  }
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = from; i < to; i += 1) {
    const h = points[i + 1].x - points[i].x;
    dx[i] = h;
    slope[i] = h === 0 ? 0 : (points[i + 1].y - points[i].y) / h;
  }
  const tangent: number[] = [];
  tangent[from] = slope[from];
  tangent[to] = slope[to - 1];
  for (let i = from + 1; i < to; i += 1) {
    const hPrev = dx[i - 1];
    const hNext = dx[i];
    tangent[i] = (hNext * slope[i - 1] + hPrev * slope[i]) / (hPrev + hNext);
  }
  for (let i = from; i < to; i += 1) {
    if (slope[i] === 0) {
      // Konstant niveau holdes vandret (ingen bue på en flad top eller et fladt dyk).
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > CURVE_OVERSHOOT_LIMIT) {
      const factor = CURVE_OVERSHOOT_LIMIT / h;
      tangent[i] = factor * a * slope[i];
      tangent[i + 1] = factor * b * slope[i];
    }
  }
  for (let i = from; i < to; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    out.push({
      kind: 'bezierTo',
      c1x: p1.x + dx[i] / 3,
      c1y: p1.y + (tangent[i] * dx[i]) / 3,
      c2x: p2.x - dx[i] / 3,
      c2y: p2.y - (tangent[i + 1] * dx[i]) / 3,
      x: p2.x,
      y: p2.y,
    });
  }
};

/**
 * Oversætter en punktrække til de sti-led, der tegner den bløde kurve. Første punkt
 * er stiens *udgangspunkt* og indgår ikke som led (kalderen har allerede flyttet dertil).
 */
export const buildSmoothCurveSegments = (points: readonly Point[]): ScenePathSegment[] => {
  const out: ScenePathSegment[] = [];
  const n = points.length;
  if (n === 0) return out;
  if (n === 1) {
    out.push({ kind: 'lineTo', x: points[0].x, y: points[0].y });
    return out;
  }
  let runStart = 0;
  for (let i = 1; i < n; i += 1) {
    if (Math.abs(points[i].x - points[i - 1].x) > VERTICAL_BREAK_EPS) continue;
    // Skarp lodret kant: afslut den bløde strækning og spring lodret til næste punkt.
    appendCardinalRun(out, points, runStart, i - 1);
    out.push({ kind: 'lineTo', x: points[i].x, y: points[i].y });
    runStart = i;
  }
  appendCardinalRun(out, points, runStart, n - 1);
  return out;
};

// ---------------------------------------------------------------------------
// Scene-byggere pr. grafelement
// ---------------------------------------------------------------------------

const buildSeriesPoints = (
  sample: WindowSamples,
  upToSeriesIndex: number,
  yForAmount: (amount: number) => number
): Point[] => {
  const count = sample.sampleX.length;
  if (count === 0) return [];
  const cumulativeAt = (i: number): number => {
    let total = 0;
    for (let s = 0; s <= upToSeriesIndex; s += 1) total += sample.valuesBySeries[s]?.[i] ?? 0;
    return total;
  };
  const points: Point[] = [];
  // Forankr ved vinduets venstre kant, så fyldet dækker hele vinduet.
  points.push({ x: sample.leftX, y: yForAmount(cumulativeAt(0)) });
  for (let i = 0; i < count; i += 1) {
    points.push({ x: sample.sampleX[i], y: yForAmount(cumulativeAt(i)) });
  }
  points.push({ x: sample.rightX, y: yForAmount(cumulativeAt(count - 1)) });
  return points;
};

const buildStackedBands = (
  document: TafKravGrafDocument,
  samples: readonly WindowSamples[],
  yForAmount: (amount: number) => number
): SceneCommand[] => {
  const commands: SceneCommand[] = [];
  const baselineY = yForAmount(0);
  for (const sample of samples) {
    if (sample.sampleX.length === 0) continue;
    for (let seriesIndex = 0; seriesIndex < document.series.length; seriesIndex += 1) {
      const upper = buildSeriesPoints(sample, seriesIndex, yForAmount);
      const lower = seriesIndex === 0
        ? null
        : buildSeriesPoints(sample, seriesIndex - 1, yForAmount);
      // Spring bånd over uden synlig højde (serie uden beløb i vinduet).
      const hasHeight = upper.some((point, i) => point.y < (lower ? lower[i].y : baselineY) - 0.5);
      if (!hasHeight) continue;

      const segments: ScenePathSegment[] = [...buildSmoothCurveSegments(upper)];
      if (lower) {
        const reversed = [...lower].reverse();
        segments.push({ kind: 'lineTo', x: reversed[0].x, y: reversed[0].y });
        segments.push(...buildSmoothCurveSegments(reversed));
      } else {
        segments.push({ kind: 'lineTo', x: upper.at(-1)!.x, y: baselineY });
        segments.push({ kind: 'lineTo', x: upper[0].x, y: baselineY });
      }
      commands.push({
        kind: 'fillPath',
        start: { x: upper[0].x, y: upper[0].y },
        segments,
        color: document.series[seriesIndex].color,
      });
    }
  }
  return commands;
};

const verticalLine = (x: number): readonly [ScenePoint, ScenePoint] => [
  { x, y: PLOT_TOP },
  { x, y: PLOT_BOTTOM },
];

const buildBeregningsperiode = (
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null
): SceneCommand[] => {
  if (!document.beregningsperiode) return [];
  const x1 = mapDate(document.beregningsperiode.fra);
  const x2 = mapDate(document.beregningsperiode.til);
  if (x1 === null || x2 === null) return [];
  const width = Math.max(3, x2 - x1);
  return [
    { kind: 'fillRect', x: x1, y: PLOT_TOP, width, height: PLOT_BOTTOM - PLOT_TOP, color: COLOR_BEREGNING_TINT },
    // Stiplede lodrette kanter markerer periodens start og slut. Begge er delstier i
    // samme sti, så stiplingen løber ubrudt fra den ene kant til den anden.
    {
      kind: 'strokeSubpaths',
      subpaths: [verticalLine(x1), verticalLine(x2)],
      stroke: { color: COLOR_BEREGNING_LABEL, width: 2.5, dash: [10, 8] },
    },
  ];
};

// Tonet bånd over ferieperioder uden indtastet løn (≥3 sammenhængende arbejdsdage).
// Båndet dækker [fra, dagen-efter-til], så det flugter med det dyk til nul, kurven
// allerede viser i perioden (der bygges bevidst ikke bro over disse huller).
const buildFerieMarkers = (
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null
): SceneCommand[] => {
  const commands: SceneCommand[] = [];
  for (const marker of document.ferieAbsenceMarkers ?? []) {
    const x1 = mapDate(marker.fra);
    const endIso = getDayAfterIso(marker.til);
    const x2 = (endIso ? mapDate(endIso) : null) ?? mapDate(marker.til);
    if (x1 === null || x2 === null) continue;
    const width = Math.max(3, x2 - x1);
    commands.push({
      kind: 'fillRect',
      x: x1,
      y: PLOT_TOP,
      width,
      height: PLOT_BOTTOM - PLOT_TOP,
      color: COLOR_FERIE_TINT,
    });
    commands.push({
      kind: 'strokeSubpaths',
      subpaths: [verticalLine(x1), verticalLine(x1 + width)],
      stroke: { color: COLOR_FERIE_LABEL, width: 2, dash: [8, 7] },
    });
  }
  return commands;
};

const buildSkadeMarker = (
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null
): SceneCommand[] => {
  if (!document.skadeMarker) return [];
  const x = mapDate(document.skadeMarker.date);
  if (x === null) return [];
  return [
    { kind: 'strokeLines', lines: [verticalLine(x)], stroke: { color: COLOR_SKADE, width: 3 } },
    // Lille trekant-anker i toppen markerer skadestidspunktet.
    {
      kind: 'fillPolygon',
      points: [
        { x: x - 11, y: PLOT_TOP - 2 },
        { x: x + 11, y: PLOT_TOP - 2 },
        { x, y: PLOT_TOP + 14 },
      ],
      color: COLOR_SKADE,
    },
  ];
};

const buildTimeBreaks = (layout: WindowLayout): SceneCommand[] => {
  const lines: (readonly [ScenePoint, ScenePoint])[] = [];
  for (let index = 0; index < layout.length - 1; index += 1) {
    const entry = layout[index];
    const centerX = entry.x + entry.width + BREAK_WIDTH / 2;
    const y = PLOT_BOTTOM;
    // To tynde parallelle skråstreger på aksen = klassisk "afbrudt akse".
    for (const offset of [-9, 9]) {
      lines.push([
        { x: centerX + offset - 9, y: y + 13 },
        { x: centerX + offset + 9, y: y - 13 },
      ]);
    }
  }
  if (lines.length === 0) return [];
  return [{ kind: 'strokeLines', lines, stroke: { color: COLOR_AXIS, width: 3 } }];
};

type LegendEntry = Readonly<{ label: string; swatch: (x: number, y: number) => SceneCommand[] }>;

const buildLegendRow = (
  entries: readonly LegendEntry[],
  y: number,
  measureText: MeasureText
): SceneCommand[] => {
  if (entries.length === 0) return [];
  const widths = entries.map(
    (entry) => LEGEND_SWATCH + LEGEND_SWATCH_EXTRA + LEGEND_TEXT_GAP + measureText(entry.label, LEGEND_FONT)
  );
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + LEGEND_ITEM_GAP * (entries.length - 1);
  let x = PLOT_LEFT + Math.max(0, (PLOT_RIGHT - PLOT_LEFT - totalWidth) / 2);

  const commands: SceneCommand[] = [];
  entries.forEach((entry, index) => {
    commands.push(...entry.swatch(x, y));
    commands.push({
      kind: 'text',
      x: x + LEGEND_SWATCH + LEGEND_SWATCH_EXTRA + LEGEND_TEXT_GAP,
      y,
      text: entry.label,
      font: LEGEND_FONT,
      color: COLOR_TEXT,
      align: 'left',
      baseline: 'alphabetic',
    });
    x += widths[index] + LEGEND_ITEM_GAP;
  });
  return commands;
};

/** Tonet firkant med stiplet ramme — signaturen for beregningsperiode og ferie. */
const tintedSwatch = (fill: string, border: string) => (x: number, y: number): SceneCommand[] => [
  {
    kind: 'fillRect',
    x,
    y: y - LEGEND_SWATCH + 4,
    width: LEGEND_SWATCH + 6,
    height: LEGEND_SWATCH,
    color: fill,
  },
  {
    kind: 'strokeRect',
    x,
    y: y - LEGEND_SWATCH + 4,
    width: LEGEND_SWATCH + 6,
    height: LEGEND_SWATCH,
    stroke: { color: border, width: 2, dash: [6, 5] },
  },
];

const buildLegend = (document: TafKravGrafDocument, measureText: MeasureText): SceneCommand[] => {
  const seriesEntries: LegendEntry[] = [];
  const markerEntries: LegendEntry[] = [];

  if (document.skadeMarker) {
    markerEntries.push({
      label: document.skadeMarker.label,
      swatch: (x, y) => [
        {
          kind: 'strokeLines',
          lines: [[
            { x: x + LEGEND_SWATCH / 2, y: y - LEGEND_SWATCH + 4 },
            { x: x + LEGEND_SWATCH / 2, y: y + 4 },
          ]],
          stroke: { color: COLOR_SKADE, width: 3 },
        },
      ],
    });
  }
  if (document.beregningsperiode) {
    markerEntries.push({
      label: 'Beregningsperiode',
      swatch: tintedSwatch(COLOR_BEREGNING_TINT, COLOR_BEREGNING_LABEL),
    });
  }
  if ((document.ferieAbsenceMarkers ?? []).length > 0) {
    markerEntries.push({
      label: 'Ferie uden løn',
      swatch: tintedSwatch(COLOR_FERIE_TINT, COLOR_FERIE_LABEL),
    });
  }
  for (const series of document.series) {
    seriesEntries.push({
      label: series.label,
      swatch: (x, y) => [
        {
          kind: 'fillRoundRect',
          x,
          y: y - LEGEND_SWATCH + 4,
          width: LEGEND_SWATCH,
          height: LEGEND_SWATCH,
          radius: 6,
          color: series.color,
        },
      ],
    });
  }

  if (markerEntries.length > 0) {
    return [
      ...buildLegendRow(markerEntries, CANVAS_HEIGHT - 118, measureText),
      ...buildLegendRow(seriesEntries, CANVAS_HEIGHT - 58, measureText),
    ];
  }
  return buildLegendRow(seriesEntries, CANVAS_HEIGHT - 70, measureText);
};

const buildXAxisLabels = (
  layout: WindowLayout,
  mapDate: (iso: ISODateString) => number | null,
  measureText: MeasureText
): SceneCommand[] => {
  // Mærke og label udstedes parvis pr. tick, i x-rækkefølge. Rækkefølgen er bevaret
  // bevidst: den er den tegnerækkefølge, grafens udseende er verificeret imod.
  const commands: SceneCommand[] = [];
  const addTickMark = (x: number): void => {
    commands.push({
      kind: 'strokeLines',
      lines: [[
        { x, y: PLOT_BOTTOM },
        { x, y: PLOT_BOTTOM + 11 },
      ]],
      stroke: { color: COLOR_AXIS, width: 2 },
    });
  };
  const addLabel = (x: number, text: string): void => {
    commands.push({
      kind: 'text',
      x,
      y: PLOT_BOTTOM + 48,
      text,
      font: AXIS_LABEL_FONT,
      color: COLOR_TEXT_MUTED,
      align: 'center',
      baseline: 'alphabetic',
    });
  };

  layout.forEach((entry, index) => {
    let lastLabelRight = -Infinity;
    for (const tickDate of buildDateTicks(entry.window)) {
      const x = mapDate(tickDate);
      if (x === null) continue;
      addTickMark(x);
      const label = formatMonthYear(tickDate);
      const halfWidth = measureText(label, AXIS_LABEL_FONT) / 2;
      if (x - halfWidth < lastLabelRight + X_LABEL_MIN_GAP) continue;
      addLabel(x, label);
      lastLabelRight = x + halfWidth;
    }
    if (index !== layout.length - 1) return;
    const x = mapDate(entry.window.til);
    if (x === null) return;
    const label = formatISOToDanish(entry.window.til);
    if (!label || !canAppendTerminalDateLabel(x, measureText(label, AXIS_LABEL_FONT), lastLabelRight)) return;
    addTickMark(x);
    addLabel(x, label);
  });

  return commands;
};

// ---------------------------------------------------------------------------
// Scene-samling
// ---------------------------------------------------------------------------

/**
 * Bygger den fulde scene for TAF-kravgrafen. Rent deterministisk givet `document` og
 * `measureText` — ingen canvas, ingen globaler, ingen dato-læsning.
 */
export const buildTafKravGrafScene = (
  document: TafKravGrafDocument,
  measureText: MeasureText
): TafKravGrafScene => {
  const commands: SceneCommand[] = [];

  // Titel + enhed
  commands.push({
    kind: 'text',
    x: PLOT_LEFT,
    y: 66,
    text: 'Visuel graf over indtægtsniveau',
    font: TITLE_FONT,
    color: COLOR_TEXT,
    align: 'left',
    baseline: 'alphabetic',
  });
  commands.push({
    kind: 'text',
    x: PLOT_LEFT,
    y: 108,
    text: document.unit === 'arbejdsdag' ? 'Beløb pr. arbejdsdag' : 'Beløb pr. måned',
    font: SUBTITLE_FONT,
    color: COLOR_TEXT_MUTED,
    align: 'left',
    baseline: 'alphabetic',
  });

  const layout = buildWindowLayout(document.timeWindows);
  const mapDate = buildXMapper(layout);
  const samples = buildWindowSamples(document, layout, mapDate);

  const maxTotal = maxStackedTotalOre(samples);
  const ticks = buildNiceMoneyTicks(maxTotal);
  const maxTick = ticks.at(-1) ?? (maxTotal || 1);
  const yForAmount = (amount: number): number =>
    PLOT_BOTTOM - (amount / maxTick) * (PLOT_BOTTOM - PLOT_TOP);

  const plotRect = {
    x: PLOT_LEFT,
    y: PLOT_TOP,
    width: PLOT_RIGHT - PLOT_LEFT,
    height: PLOT_BOTTOM - PLOT_TOP,
    radius: PLOT_RADIUS,
  } as const;

  // Plot-baggrund
  commands.push({ kind: 'fillRoundRect', ...plotRect, color: COLOR_PLOT_BG });

  // Vandrette gridlinjer
  commands.push({
    kind: 'strokeLines',
    lines: ticks.map((tick) => {
      const y = yForAmount(tick);
      return [{ x: PLOT_LEFT, y }, { x: PLOT_RIGHT, y }] as const;
    }),
    stroke: { color: COLOR_GRID, width: 1.5 },
  });

  // Indhold klippet til plot-området
  commands.push({ kind: 'clipRoundRect', ...plotRect });
  commands.push(...buildBeregningsperiode(document, mapDate));
  commands.push(...buildFerieMarkers(document, mapDate));
  commands.push(...buildStackedBands(document, samples, yForAmount));
  commands.push(...buildSkadeMarker(document, mapDate));
  commands.push({ kind: 'restore' });

  commands.push(...buildTimeBreaks(layout));

  // Akser: venstre lodret + nederste vandret tegnet som ÉN sammenhængende vinkel, så
  // hjørnet får en ren samling frem for to overlappende endestykker.
  commands.push({
    kind: 'strokeSubpaths',
    subpaths: [[
      { x: PLOT_LEFT, y: PLOT_TOP },
      { x: PLOT_LEFT, y: PLOT_BOTTOM },
      { x: PLOT_RIGHT, y: PLOT_BOTTOM },
    ]],
    stroke: { color: COLOR_AXIS, width: 2.5 },
  });

  // Y-labels
  for (const tick of ticks) {
    commands.push({
      kind: 'text',
      x: PLOT_LEFT - 18,
      y: yForAmount(tick),
      text: formatMoneyOreWithKrTrimmed(tick),
      font: AXIS_LABEL_FONT,
      color: COLOR_TEXT_MUTED,
      align: 'right',
      baseline: 'middle',
    });
  }

  // X-labels pr. vindue, med kollisionsbeskyttelse
  commands.push(...buildXAxisLabels(layout, mapDate, measureText));

  commands.push(...buildLegend(document, measureText));

  return {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    background: COLOR_CANVAS_BG,
    commands,
  };
};

// Test-only eksport af de rene under-byggere. Scene-modellen som helhed er dækket af
// `buildTafKravGrafScene`, men de enkelte primitiver (tick-valg, layout, sampling)
// har egne invarianter, det er værd at hævde direkte.
export const __tafKravGrafSceneTestables = {
  niceCeil,
  buildNiceMoneyTicks,
  buildWindowLayout,
  buildXMapper,
  buildWindowSamples,
  buildDateTicks,
  canAppendTerminalDateLabel,
};
