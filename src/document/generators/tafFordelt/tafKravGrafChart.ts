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
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';

// Ren præsentationsmodul: tegner "Visuel graf over indtægtsniveau" på et canvas og
// returnerer en PNG-data-URL. Bruges af både PDF- og DOCX-generering (begge indlejrer
// resultatet som billede), så modulet er bevidst format-agnostisk.

// Canvas-dimensioner. Forholdet matcher den landscape-A4-indlejring i tafKravGrafPdf
// (indholdsbredde 257 mm × maks. 142 mm), så billedet ikke strækkes ved indsættelse.
export const TAF_KRAV_GRAF_CANVAS = { width: 2570, height: 1420 } as const;
const CANVAS_WIDTH = TAF_KRAV_GRAF_CANVAS.width;
const CANVAS_HEIGHT = TAF_KRAV_GRAF_CANVAS.height;

const PLOT_LEFT = 196;
const PLOT_RIGHT = CANVAS_WIDTH - 90;
const PLOT_TOP = 150;
const PLOT_BOTTOM = 1118;
const BREAK_WIDTH = 60;

const COLOR_TEXT = '#1F2733';
const COLOR_TEXT_MUTED = '#5A6473';
const COLOR_AXIS = '#3A4250';
const COLOR_GRID = '#E4E8EE';
const COLOR_PLOT_BG = '#FAFBFC';
const COLOR_BEREGNING_TINT = 'rgba(48, 99, 142, 0.07)';
const COLOR_BEREGNING_LABEL = '#30638E';
const COLOR_SKADE = '#9B2F2F';

const MONTHS_DA = ['jan.', 'feb.', 'mar.', 'apr.', 'maj', 'jun.', 'jul.', 'aug.', 'sep.', 'okt.', 'nov.', 'dec.'] as const;
const X_LABEL_MIN_GAP = 16;
const X_LABEL_FONT = '400 28px Arial, sans-serif';

export type TafKravGrafChartOptions = Readonly<{
  // Antal måneder i glidende gennemsnit (kantbevidst: udglatter kun inden for
  // sammenhængende aktive strækninger). 1 (eller mindre) = ingen udglatning.
  smoothingWindow?: number;
}>;

type Point = Readonly<{ x: number; y: number }>;

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
    ticks.push(roundByMethod(i * stepKr * 100, 0, 'halfAwayFromZero') as MoneyOre);
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

// Kantbevidst glidende gennemsnit: udglatter kun inden for hver sammenhængende
// aktive strækning (måneder med beløb > 0). Nul-måneder før en series start og
// efter dens ophør trækkes aldrig ind i gennemsnittet, så et nyt beløb ikke
// "smitter" visuelt bagud før sin faktiske startdato (eller frem efter ophør).
const smoothWithinActiveRuns = (values: readonly number[], window: number): number[] => {
  const radius = window <= 1 ? 0 : Math.floor(window / 2);
  const result = values.map(() => 0);
  let runStart = 0;
  while (runStart < values.length) {
    if (values[runStart] <= 0) {
      runStart += 1;
      continue;
    }
    let runEnd = runStart;
    while (runEnd + 1 < values.length && values[runEnd + 1] > 0) runEnd += 1;
    for (let i = runStart; i <= runEnd; i += 1) {
      const from = Math.max(runStart, i - radius);
      const to = Math.min(runEnd, i + radius);
      let sum = 0;
      for (let j = from; j <= to; j += 1) sum += values[j];
      result[i] = sum / (to - from + 1);
    }
    runStart = runEnd + 1;
  }
  return result;
};

type SampleColumn = { x: number; order: number; values: number[] };

const buildValuesAtIso = (document: TafKravGrafDocument, iso: ISODateString): number[] =>
  document.series.map((series) => amountAtIso(series, iso));

const buildWindowSamples = (
  document: TafKravGrafDocument,
  layout: WindowLayout,
  mapDate: (iso: ISODateString) => number | null,
  smoothingWindow: number
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
    // Derfor lægges der før/efter-kolonner på hver faktisk start og dagen efter
    // hver faktisk slutdato, så kurven springer på brugerens indtastede datoer.
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
      const afterValues = buildValuesAtIso(document, iso);
      const beforeIso = getDayBeforeIso(iso);
      const beforeValues = beforeIso && beforeIso >= entry.window.fra
        ? buildValuesAtIso(document, beforeIso)
        : null;
      if (beforeValues && beforeValues.some((value, index) => value !== afterValues[index])) {
        columns.push({ x, order: transitionOrder, values: beforeValues });
        transitionOrder += 1;
      }
      columns.push({ x, order: transitionOrder, values: afterValues });
      transitionOrder += 1;
    }
    columns.sort((a, b) => a.x - b.x || a.order - b.order);
    const smoothedBySeries = document.series.map((_, seriesIndex) =>
      smoothWithinActiveRuns(columns.map((column) => column.values[seriesIndex] ?? 0), smoothingWindow)
    );

    return {
      window: entry.window,
      sampleX: columns.map((column) => column.x),
      leftX: entry.x,
      rightX: entry.x + entry.width,
      valuesBySeries: smoothedBySeries,
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
// Monotone kubisk interpolation (Fritsch–Carlson) — bløde kurver uden overshoot
// ---------------------------------------------------------------------------

const appendMonotoneCurve = (ctx: CanvasRenderingContext2D, points: readonly Point[]): void => {
  const n = points.length;
  if (n === 0) return;
  if (n === 1) {
    ctx.lineTo(points[0].x, points[0].y);
    return;
  }
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i];
  }
  const tangent: number[] = new Array(n);
  tangent[0] = slope[0];
  tangent[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i += 1) {
    tangent[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = Math.hypot(a, b);
    if (h > 3) {
      const factor = 3 / h;
      tangent[i] = factor * a * slope[i];
      tangent[i + 1] = factor * b * slope[i];
    }
  }
  for (let i = 0; i < n - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const c1x = p1.x + dx[i] / 3;
    const c1y = p1.y + (tangent[i] * dx[i]) / 3;
    const c2x = p2.x - dx[i] / 3;
    const c2y = p2.y - (tangent[i + 1] * dx[i]) / 3;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
};

// ---------------------------------------------------------------------------
// Tegnerutiner
// ---------------------------------------------------------------------------

const roundRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
};

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

const drawStackedBands = (
  ctx: CanvasRenderingContext2D,
  document: TafKravGrafDocument,
  samples: readonly WindowSamples[],
  yForAmount: (amount: number) => number
): void => {
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

      ctx.fillStyle = document.series[seriesIndex].color;
      ctx.beginPath();
      ctx.moveTo(upper[0].x, upper[0].y);
      appendMonotoneCurve(ctx, upper);
      if (lower) {
        const reversed = [...lower].reverse();
        ctx.lineTo(reversed[0].x, reversed[0].y);
        appendMonotoneCurve(ctx, reversed);
      } else {
        ctx.lineTo(upper.at(-1)!.x, baselineY);
        ctx.lineTo(upper[0].x, baselineY);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
};

const drawBeregningsperiode = (
  ctx: CanvasRenderingContext2D,
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null
): void => {
  if (!document.beregningsperiode) return;
  const x1 = mapDate(document.beregningsperiode.fra);
  const x2 = mapDate(document.beregningsperiode.til);
  if (x1 === null || x2 === null) return;
  const width = Math.max(3, x2 - x1);
  ctx.fillStyle = COLOR_BEREGNING_TINT;
  ctx.fillRect(x1, PLOT_TOP, width, PLOT_BOTTOM - PLOT_TOP);
  // Tynd top-streg + label-chip inde i perioden.
  ctx.strokeStyle = COLOR_BEREGNING_LABEL;
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.moveTo(x1, PLOT_TOP);
  ctx.lineTo(x1, PLOT_BOTTOM);
  ctx.moveTo(x2, PLOT_TOP);
  ctx.lineTo(x2, PLOT_BOTTOM);
  ctx.stroke();
  ctx.setLineDash([]);
};

const drawSkadeMarker = (
  ctx: CanvasRenderingContext2D,
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null
): void => {
  if (!document.skadeMarker) return;
  const x = mapDate(document.skadeMarker.date);
  if (x === null) return;
  ctx.strokeStyle = COLOR_SKADE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, PLOT_TOP);
  ctx.lineTo(x, PLOT_BOTTOM);
  ctx.stroke();
  // Lille trekant-anker i toppen markerer skadestidspunktet.
  ctx.fillStyle = COLOR_SKADE;
  ctx.beginPath();
  ctx.moveTo(x - 11, PLOT_TOP - 2);
  ctx.lineTo(x + 11, PLOT_TOP - 2);
  ctx.lineTo(x, PLOT_TOP + 14);
  ctx.closePath();
  ctx.fill();
};

const drawTimeBreaks = (ctx: CanvasRenderingContext2D, layout: WindowLayout): void => {
  for (let index = 0; index < layout.length - 1; index += 1) {
    const entry = layout[index];
    const centerX = entry.x + entry.width + BREAK_WIDTH / 2;
    const y = PLOT_BOTTOM;
    // To tynde parallelle skråstreger på aksen = klassisk "afbrudt akse".
    ctx.strokeStyle = COLOR_AXIS;
    ctx.lineWidth = 3;
    for (const offset of [-9, 9]) {
      ctx.beginPath();
      ctx.moveTo(centerX + offset - 9, y + 13);
      ctx.lineTo(centerX + offset + 9, y - 13);
      ctx.stroke();
    }
  }
};

type LegendEntry = { label: string; draw: (x: number, y: number) => void };

const drawLegendRow = (ctx: CanvasRenderingContext2D, entries: readonly LegendEntry[], y: number): void => {
  if (entries.length === 0) return;
  const swatch = 26;
  const gap = 18;
  const itemGap = 56;
  ctx.font = '400 30px Arial, sans-serif';
  const widths = entries.map((entry) => swatch + 12 + gap + ctx.measureText(entry.label).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + itemGap * (entries.length - 1);
  let x = PLOT_LEFT + Math.max(0, (PLOT_RIGHT - PLOT_LEFT - totalWidth) / 2);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  entries.forEach((entry, index) => {
    entry.draw(x, y);
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText(entry.label, x + swatch + 12 + gap, y);
    x += widths[index] + itemGap;
  });
};

const drawLegend = (ctx: CanvasRenderingContext2D, document: TafKravGrafDocument): void => {
  const swatch = 26;
  const seriesEntries: LegendEntry[] = [];
  const markerEntries: LegendEntry[] = [];

  if (document.skadeMarker) {
    markerEntries.push({
      label: document.skadeMarker.label,
      draw: (x, y) => {
        ctx.strokeStyle = COLOR_SKADE;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x + swatch / 2, y - swatch + 4);
        ctx.lineTo(x + swatch / 2, y + 4);
        ctx.stroke();
      },
    });
  }
  if (document.beregningsperiode) {
    markerEntries.push({
      label: 'Beregningsperiode',
      draw: (x, y) => {
        ctx.fillStyle = COLOR_BEREGNING_TINT;
        ctx.fillRect(x, y - swatch + 4, swatch + 6, swatch);
        ctx.strokeStyle = COLOR_BEREGNING_LABEL;
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 5]);
        ctx.strokeRect(x, y - swatch + 4, swatch + 6, swatch);
        ctx.setLineDash([]);
      },
    });
  }
  for (const series of document.series) {
    seriesEntries.push({
      label: series.label,
      draw: (x, y) => {
        ctx.fillStyle = series.color;
        roundRectPath(ctx, x, y - swatch + 4, swatch, swatch, 6);
        ctx.fill();
      },
    });
  }

  if (markerEntries.length > 0) {
    drawLegendRow(ctx, markerEntries, CANVAS_HEIGHT - 118);
    drawLegendRow(ctx, seriesEntries, CANVAS_HEIGHT - 58);
    return;
  }
  drawLegendRow(ctx, seriesEntries, CANVAS_HEIGHT - 70);
};

// ---------------------------------------------------------------------------
// Hovedrenderer
// ---------------------------------------------------------------------------

export const renderTafKravGrafChartPng = (
  document: TafKravGrafDocument,
  options: TafKravGrafChartOptions = {}
): string => {
  if (typeof globalThis.document === 'undefined') {
    throw new Error('Grafen kræver browserens dokument-API.');
  }
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Grafen kunne ikke oprette et canvas.');
  }
  const smoothingWindow = Math.max(1, options.smoothingWindow ?? 1);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Titel + enhed
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = '700 46px Arial, sans-serif';
  ctx.fillText('Visuel graf over indtægtsniveau', PLOT_LEFT, 66);
  ctx.fillStyle = COLOR_TEXT_MUTED;
  ctx.font = '400 30px Arial, sans-serif';
  ctx.fillText(
    document.unit === 'arbejdsdag' ? 'Beløb pr. arbejdsdag' : 'Beløb pr. måned',
    PLOT_LEFT,
    108
  );

  const layout = buildWindowLayout(document.timeWindows);
  const mapDate = buildXMapper(layout);
  const samples = buildWindowSamples(document, layout, mapDate, smoothingWindow);

  const maxTotal = maxStackedTotalOre(samples);
  const ticks = buildNiceMoneyTicks(maxTotal);
  const maxTick = ticks.at(-1) ?? (maxTotal || 1);
  const yForAmount = (amount: number): number =>
    PLOT_BOTTOM - (amount / maxTick) * (PLOT_BOTTOM - PLOT_TOP);

  // Plot-baggrund
  roundRectPath(ctx, PLOT_LEFT, PLOT_TOP, PLOT_RIGHT - PLOT_LEFT, PLOT_BOTTOM - PLOT_TOP, 16);
  ctx.fillStyle = COLOR_PLOT_BG;
  ctx.fill();

  // Vandrette gridlinjer
  ctx.strokeStyle = COLOR_GRID;
  ctx.lineWidth = 1.5;
  for (const tick of ticks) {
    const y = yForAmount(tick);
    ctx.beginPath();
    ctx.moveTo(PLOT_LEFT, y);
    ctx.lineTo(PLOT_RIGHT, y);
    ctx.stroke();
  }

  // Indhold klippet til plot-området
  ctx.save();
  roundRectPath(ctx, PLOT_LEFT, PLOT_TOP, PLOT_RIGHT - PLOT_LEFT, PLOT_BOTTOM - PLOT_TOP, 16);
  ctx.clip();
  drawBeregningsperiode(ctx, document, mapDate);
  drawStackedBands(ctx, document, samples, yForAmount);
  drawSkadeMarker(ctx, document, mapDate);
  ctx.restore();

  drawTimeBreaks(ctx, layout);

  // Akser
  ctx.strokeStyle = COLOR_AXIS;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(PLOT_LEFT, PLOT_TOP);
  ctx.lineTo(PLOT_LEFT, PLOT_BOTTOM);
  ctx.lineTo(PLOT_RIGHT, PLOT_BOTTOM);
  ctx.stroke();

  // Y-labels
  ctx.fillStyle = COLOR_TEXT_MUTED;
  ctx.font = X_LABEL_FONT;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const tick of ticks) {
    ctx.fillText(formatMoneyOreWithKrTrimmed(tick), PLOT_LEFT - 18, yForAmount(tick));
  }

  // X-labels pr. vindue, med kollisionsbeskyttelse
  ctx.font = X_LABEL_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  layout.forEach((entry, index) => {
    let lastLabelRight = -Infinity;
    for (const tickDate of buildDateTicks(entry.window)) {
      const x = mapDate(tickDate);
      if (x === null) continue;
      ctx.strokeStyle = COLOR_AXIS;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, PLOT_BOTTOM);
      ctx.lineTo(x, PLOT_BOTTOM + 11);
      ctx.stroke();
      const label = formatMonthYear(tickDate);
      const halfWidth = ctx.measureText(label).width / 2;
      if (x - halfWidth < lastLabelRight + X_LABEL_MIN_GAP) continue;
      ctx.fillStyle = COLOR_TEXT_MUTED;
      ctx.fillText(label, x, PLOT_BOTTOM + 48);
      lastLabelRight = x + halfWidth;
    }
    if (index !== layout.length - 1) return;
    const x = mapDate(entry.window.til);
    if (x === null) return;
    const label = formatISOToDanish(entry.window.til);
    if (!label || !canAppendTerminalDateLabel(x, ctx.measureText(label).width, lastLabelRight)) return;
    ctx.strokeStyle = COLOR_AXIS;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, PLOT_BOTTOM);
    ctx.lineTo(x, PLOT_BOTTOM + 11);
    ctx.stroke();
    ctx.fillStyle = COLOR_TEXT_MUTED;
    ctx.fillText(label, x, PLOT_BOTTOM + 48);
  });

  drawLegend(ctx, document);

  return canvas.toDataURL('image/png');
};

// Test-only eksport af de rene tegne-/sampling-helpers. De er modul-private i produktion
// (kaldes kun internt af `renderTafKravGrafChartPng`), men kan ikke nås via PNG-rendereren
// i test, fordi jsdom ikke har et canvas-API. Da de er rene og deterministiske, eksponeres
// de smalt her til direkte unit-test (jf. review 13.4 / udskudt fund fra 10.6).
export const __tafKravGrafChartTestables = {
  niceCeil,
  buildNiceMoneyTicks,
  smoothWithinActiveRuns,
  buildWindowLayout,
  buildXMapper,
  buildWindowSamples,
  buildDateTicks,
  canAppendTerminalDateLabel,
};
