import { createDate, dateToISO, isoToDanish, parseISODate, type ISODateString } from '../../../types/branded';
import { diffUtcDays } from '../../../utils/utcDayMath';
import { getDayAfterIso, getDayBeforeIso, isoYear } from '../../../utils/isoDateHelpers';
import { roundByMethod } from '../../../utils/rounding';
import { formatMoneyOreWithKrTrimmed, resolvePdfFileName } from '../../shared/pdfFormatUtils';
import { MARGINS } from '../../infrastructure/pdfConfig';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import { type BrevhovedData } from '../../shared/pdfHelpers';
import { logWarning } from '../../../utils/logger';
import type {
  TafKravGrafDocument,
  TafKravGrafSeries,
  TafKravGrafTimeWindow,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafKravGrafDocument';
import type { MoneyOre } from '../../../domain/erstatningsopgoerelse/shared/eoTypes';

const FILE_BASE_NAME = 'Visuel graf over indtægtsniveau';
const CANVAS_WIDTH = 2200;
const CANVAS_HEIGHT = 1220;
const CHART_LEFT = 190;
const CHART_TOP = 125;
const CHART_RIGHT = 80;
const CHART_BOTTOM = 245;
const BREAK_WIDTH = 52;
const AXIS_COLOR = '#2D3440';
const GRID_COLOR = '#D8DDE5';
const TEXT_COLOR = '#202632';
const BEREGNINGSPERIODE_COLOR = 'rgba(48, 99, 142, 0.13)';
const BEREGNINGSPERIODE_BORDER = '#30638E';
const SKADE_MARKER_COLOR = '#9B2F2F';

type DrawInterval = Readonly<{
  fra: ISODateString;
  til: ISODateString;
  values: readonly MoneyOre[];
  total: MoneyOre;
}>;

interface TafKravGrafPdfOptions {
  document: TafKravGrafDocument;
  visBrevhoved?: boolean;
  visUdkastStempel?: boolean;
}

type CurvePoint = Readonly<{
  x: number;
  y: number;
}>;

const drawRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
};

const daysBetween = (fra: ISODateString, til: ISODateString): number => {
  const start = parseISODate(fra);
  const end = parseISODate(til);
  if (!start || !end) return 0;
  return Math.max(0, diffUtcDays(start, end));
};

const windowContains = (window: TafKravGrafTimeWindow, iso: ISODateString): boolean =>
  iso >= window.fra && iso <= window.til;

const makeDate = (year: number, monthIndex: number, day: number): ISODateString | null =>
  dateToISO(createDate(year, monthIndex, day)) ?? null;

const addTickDatesForWindow = (window: TafKravGrafTimeWindow): ISODateString[] => {
  const spanDays = daysBetween(window.fra, window.til);
  const dates: ISODateString[] = [];
  const startYear = isoYear(window.fra);
  const endYear = isoYear(window.til);
  const monthStep = spanDays <= 180 ? 3 : spanDays <= 730 ? 6 : 12;
  for (let year = startYear; year <= endYear; year += 1) {
    for (let month = 0; month < 12; month += monthStep) {
      const iso = makeDate(year, month, 1);
      if (iso && windowContains(window, iso)) dates.push(iso);
    }
  }
  if (!dates.includes(window.fra)) dates.unshift(window.fra);
  if (!dates.includes(window.til)) dates.push(window.til);
  return [...new Set(dates)].sort();
};

const buildNiceMoneyTicks = (maxOre: MoneyOre): readonly MoneyOre[] => {
  const maxKr = Math.max(1, roundByMethod((maxOre * 1.06) / 100, 0, 'ceil'));
  const candidates = [5_000, 10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000];
  const stepKr = candidates.find((candidate) => roundByMethod(maxKr / candidate, 0, 'ceil') <= 6) ?? 2_000_000;
  const tickCount = roundByMethod(maxKr / stepKr, 0, 'ceil');
  const ticks: MoneyOre[] = [];
  for (let i = 0; i <= tickCount; i += 1) {
    ticks.push((i * stepKr * 100) as MoneyOre);
  }
  return ticks;
};

const formatUnitLabel = (unit: TafKravGrafDocument['unit']): string =>
  unit === 'arbejdsdag' ? 'Beløb pr. arbejdsdag' : 'Beløb pr. måned';

const buildWindowLayout = (windows: readonly TafKravGrafTimeWindow[]) => {
  const chartWidth = CANVAS_WIDTH - CHART_LEFT - CHART_RIGHT;
  const breakCount = Math.max(0, windows.length - 1);
  const availableWidth = chartWidth - breakCount * BREAK_WIDTH;
  const spans = windows.map((window) => Math.max(1, daysBetween(window.fra, window.til)));
  const totalSpan = spans.reduce((sum, span) => sum + span, 0);
  let cursorX = CHART_LEFT;
  return windows.map((window, index) => {
    const width = availableWidth * (spans[index] / totalSpan);
    const layout = { window, x: cursorX, width, span: spans[index] };
    cursorX += width + BREAK_WIDTH;
    return layout;
  });
};

const buildXMapper = (windows: readonly TafKravGrafTimeWindow[]) => {
  const layout = buildWindowLayout(windows);
  const mapDate = (iso: ISODateString): number | null => {
    const entry = layout.find(({ window }) => windowContains(window, iso));
    if (!entry) return null;
    const offsetDays = daysBetween(entry.window.fra, iso);
    return entry.x + (offsetDays / entry.span) * entry.width;
  };
  return { layout, mapDate };
};

const buildIntervals = (
  series: readonly TafKravGrafSeries[],
  windows: readonly TafKravGrafTimeWindow[]
): readonly DrawInterval[] => {
  const intervals: DrawInterval[] = [];
  for (const window of windows) {
    const boundaries = new Set<ISODateString>([window.fra]);
    for (const item of series) {
      for (const segment of item.segments) {
        if (segment.til < window.fra || segment.fra > window.til) continue;
        boundaries.add(segment.fra > window.fra ? segment.fra : window.fra);
        const after = getDayAfterIso(segment.til < window.til ? segment.til : window.til);
        if (after && after <= window.til) boundaries.add(after);
      }
    }
    const sorted = [...boundaries].sort();
    for (let index = 0; index < sorted.length; index += 1) {
      const fra = sorted[index];
      const next = sorted[index + 1];
      const til = next ? getDayBeforeIso(next) : window.til;
      if (!fra || !til || fra > til) continue;
      const values = series.map((item) =>
        item.segments
          .filter((segment) => segment.fra <= til && segment.til >= fra)
          .reduce((sum, segment) => sum + segment.amountOre, 0) as MoneyOre
      );
      const total = values.reduce((sum, value) => sum + value, 0) as MoneyOre;
      intervals.push({ fra, til, values, total });
    }
  }
  return intervals;
};

const formatTickLabel = (iso: ISODateString): string => {
  const parsed = parseISODate(iso);
  if (!parsed) return isoToDanish(iso) ?? iso;
  const day = parsed.getUTCDate();
  const month = parsed.getUTCMonth();
  const year = parsed.getUTCFullYear();
  if (day === 1 && month === 0) return `1. jan. ${year}`;
  if (day === 1 && month === 6) return `1. jul. ${year}`;
  return isoToDanish(iso) ?? iso;
};

const drawStackedAreas = (
  ctx: CanvasRenderingContext2D,
  intervals: readonly DrawInterval[],
  series: readonly TafKravGrafSeries[],
  mapDate: (iso: ISODateString) => number | null,
  yForAmount: (amount: MoneyOre) => number
): void => {
  const drawSmoothTopLine = (points: readonly CurvePoint[]): void => {
    if (points.length === 0) return;
    const first = points[0];
    ctx.moveTo(first.x, first.y);
    for (let index = 1; index < points.length; index += 1) {
      const p0 = points[Math.max(0, index - 2)] ?? first;
      const p1 = points[index - 1] ?? first;
      const p2 = points[index];
      const p3 = points[Math.min(points.length - 1, index + 1)] ?? p2;
      const smoothness = 1.25;
      const cp1x = p1.x + ((p2.x - p0.x) * smoothness) / 6;
      const cp1y = p1.y + ((p2.y - p0.y) * smoothness) / 6;
      const cp2x = p2.x - ((p3.x - p1.x) * smoothness) / 6;
      const cp2y = p2.y - ((p3.y - p1.y) * smoothness) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  };

  const buildCumulativeTopPoints = (seriesIndex: number): CurvePoint[] => {
    const points: CurvePoint[] = [];
    for (const interval of intervals) {
      const x1 = mapDate(interval.fra);
      const x2 = mapDate(interval.til);
      if (x1 === null || x2 === null) continue;
      const upper = interval.values
        .slice(0, seriesIndex + 1)
        .reduce((sum, value) => sum + value, 0) as MoneyOre;
      if (upper <= 0) continue;
      const y = yForAmount(upper);
      if (points.length === 0) {
        points.push({ x: x1, y });
      }
      points.push({ x: (x1 + x2) / 2, y });
      points.push({ x: x2, y });
    }
    return points;
  };

  const baselineY = yForAmount(0 as MoneyOre);
  for (let seriesIndex = series.length - 1; seriesIndex >= 0; seriesIndex -= 1) {
    const item = series[seriesIndex];
    const points = buildCumulativeTopPoints(seriesIndex);
    if (points.length === 0) continue;
    const first = points[0];
    const last = points.at(-1);
    if (!last) continue;

    ctx.fillStyle = item.color;
    ctx.beginPath();
    drawSmoothTopLine(points);
    ctx.lineTo(last.x, baselineY);
    ctx.lineTo(first.x, baselineY);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = item.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    drawSmoothTopLine(points);
    ctx.stroke();
  }
};

const drawBeregningsperiodeOverlay = (
  ctx: CanvasRenderingContext2D,
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null,
  chartHeight: number
): void => {
  if (!document.beregningsperiode) return;
  const x1 = mapDate(document.beregningsperiode.fra);
  const x2 = mapDate(document.beregningsperiode.til);
  if (x1 === null || x2 === null) return;
  ctx.fillStyle = BEREGNINGSPERIODE_COLOR;
  ctx.fillRect(x1, CHART_TOP, Math.max(3, x2 - x1), chartHeight);
  ctx.strokeStyle = BEREGNINGSPERIODE_BORDER;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x1, CHART_TOP);
  ctx.lineTo(x1, CHART_TOP + chartHeight);
  ctx.moveTo(x2, CHART_TOP);
  ctx.lineTo(x2, CHART_TOP + chartHeight);
  ctx.stroke();
};

const drawSkadeMarker = (
  ctx: CanvasRenderingContext2D,
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null,
  chartHeight: number
): void => {
  if (!document.skadeMarker) return;
  const markerX = mapDate(document.skadeMarker.date);
  if (markerX === null) return;
  ctx.strokeStyle = SKADE_MARKER_COLOR;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(markerX, CHART_TOP);
  ctx.lineTo(markerX, CHART_TOP + chartHeight);
  ctx.stroke();
};

const drawTimeBreaks = (
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof buildWindowLayout>,
  chartHeight: number
): void => {
  for (let index = 0; index < layout.length - 1; index += 1) {
    const entry = layout[index];
    const x = entry.x + entry.width + BREAK_WIDTH / 2;
    const centerY = CHART_TOP + chartHeight - 28;
    ctx.strokeStyle = AXIS_COLOR;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x - 17, centerY - 14);
    ctx.lineTo(x - 5, centerY + 14);
    ctx.lineTo(x + 5, centerY - 14);
    ctx.lineTo(x + 17, centerY + 14);
    ctx.stroke();
  }
};

const drawMarkersAboveAreas = (
  ctx: CanvasRenderingContext2D,
  document: TafKravGrafDocument,
  mapDate: (iso: ISODateString) => number | null,
  layout: ReturnType<typeof buildWindowLayout>,
  chartHeight: number
): void => {
  drawBeregningsperiodeOverlay(ctx, document, mapDate, chartHeight);
  drawSkadeMarker(ctx, document, mapDate, chartHeight);
  drawTimeBreaks(ctx, layout, chartHeight);
};

const renderGraphPng = (document: TafKravGrafDocument): string => {
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

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.font = '700 42px Arial, sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  ctx.fillText('Visuel graf over indtægtsniveau', CHART_LEFT, 56);
  ctx.font = '400 27px Arial, sans-serif';
  ctx.fillText(formatUnitLabel(document.unit), CHART_LEFT, 91);

  const chartWidth = CANVAS_WIDTH - CHART_LEFT - CHART_RIGHT;
  const chartHeight = CANVAS_HEIGHT - CHART_TOP - CHART_BOTTOM;
  drawRoundedRectPath(ctx, CHART_LEFT, CHART_TOP, chartWidth, chartHeight, 20);
  ctx.fillStyle = '#FBFCFE';
  ctx.fill();
  ctx.save();
  drawRoundedRectPath(ctx, CHART_LEFT, CHART_TOP, chartWidth, chartHeight, 20);
  ctx.clip();

  const intervals = buildIntervals(document.series, document.timeWindows);
  const maxTotal = Math.max(...intervals.map((interval) => interval.total), 0) as MoneyOre;
  const ticks = buildNiceMoneyTicks(maxTotal);
  const maxTick = ticks.at(-1) ?? (maxTotal || 1);
  const yForAmount = (amount: MoneyOre): number =>
    CHART_TOP + chartHeight - (amount / maxTick) * chartHeight;
  const { layout, mapDate } = buildXMapper(document.timeWindows);

  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 2;
  ctx.font = '400 25px Arial, sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  for (const tick of ticks) {
    const y = yForAmount(tick);
    ctx.beginPath();
    ctx.moveTo(CHART_LEFT, y);
    ctx.lineTo(CHART_LEFT + chartWidth, y);
    ctx.stroke();
  }

  drawStackedAreas(ctx, intervals, document.series, mapDate, yForAmount);
  drawMarkersAboveAreas(ctx, document, mapDate, layout, chartHeight);

  ctx.restore();

  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(CHART_LEFT, CHART_TOP);
  ctx.lineTo(CHART_LEFT, CHART_TOP + chartHeight);
  ctx.lineTo(CHART_LEFT + chartWidth, CHART_TOP + chartHeight);
  ctx.stroke();

  ctx.font = '400 25px Arial, sans-serif';
  ctx.fillStyle = TEXT_COLOR;
  ctx.textAlign = 'right';
  for (const tick of ticks) {
    const y = yForAmount(tick);
    ctx.fillText(formatMoneyOreWithKrTrimmed(tick), CHART_LEFT - 18, y + 8);
  }

  ctx.textAlign = 'center';
  for (const entry of layout) {
    const tickDates = addTickDatesForWindow(entry.window);
    for (const tickDate of tickDates) {
      const x = mapDate(tickDate);
      if (x === null) continue;
      ctx.strokeStyle = AXIS_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, CHART_TOP + chartHeight);
      ctx.lineTo(x, CHART_TOP + chartHeight + 12);
      ctx.stroke();
      ctx.fillText(formatTickLabel(tickDate), x, CHART_TOP + chartHeight + 43);
    }
  }

  ctx.textAlign = 'left';
  let legendX = CHART_LEFT;
  let legendY = CANVAS_HEIGHT - 128;
  ctx.font = '400 29px Arial, sans-serif';
  for (const item of document.series) {
    const textWidth = ctx.measureText(item.label).width;
    if (legendX + 42 + textWidth > CANVAS_WIDTH - CHART_RIGHT) {
      legendX = CHART_LEFT;
      legendY += 52;
    }
    ctx.fillStyle = item.color;
    drawRoundedRectPath(ctx, legendX, legendY - 24, 28, 28, 7);
    ctx.fill();
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText(item.label, legendX + 42, legendY);
    legendX += 42 + textWidth + 50;
  }
  if (document.beregningsperiode) {
    ctx.fillStyle = BEREGNINGSPERIODE_COLOR;
    ctx.fillRect(legendX, legendY - 24, 34, 28);
    ctx.strokeStyle = BEREGNINGSPERIODE_BORDER;
    ctx.lineWidth = 3;
    ctx.strokeRect(legendX, legendY - 24, 34, 28);
    ctx.fillStyle = TEXT_COLOR;
    ctx.fillText('Beregningsperiode', legendX + 48, legendY);
  }

  if (document.skadeMarker) {
    ctx.fillStyle = SKADE_MARKER_COLOR;
    ctx.fillRect(CHART_LEFT, CANVAS_HEIGHT - 45, 34, 6);
    ctx.fillStyle = TEXT_COLOR;
    ctx.font = '400 25px Arial, sans-serif';
    ctx.fillText(document.skadeMarker.label, CHART_LEFT + 48, CANVAS_HEIGHT - 36);
  }

  return canvas.toDataURL('image/png');
};

export const generateTafKravGrafPdf = (options: TafKravGrafPdfOptions): void => {
  const { document, visBrevhoved = false, visUdkastStempel = false } = options;
  const { model } = document;
  const writer = createStandardPdfWriter({
    visUdkastStempel,
    orientation: 'landscape',
    onLayoutFallback: ({ message, label }) => {
      logWarning('PDF-layout fallback aktiveret', {
        context: 'pdf.tafKravGraf.layout',
        data: { message, label },
      });
    },
  });

  writer.setDisplayMode('fullheight');
  writer.setProperties({
    title: 'Visuel graf over indtægtsniveau',
    subject: 'Erstatningsberegning',
    author: 'Mineo',
    creator: 'mineo.dk',
  });
  writer.addUdkastWatermark();

  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  const imageDataUrl = renderGraphPng(document);
  const imageWidth = writer.getPageWidth() - MARGINS.left - MARGINS.right;
  const imageHeight = Math.min(142, (imageWidth * CANVAS_HEIGHT) / CANVAS_WIDTH);
  writer.ensureSpace(imageHeight + 8);
  const y = writer.getY() + 4;
  writer.addImageDataUrl(imageDataUrl, MARGINS.left, y, imageWidth, imageHeight);
  writer.setY(y + imageHeight + 4);
  writer.addUdkastWatermark();

  writer.addFooter();
  writer.save(resolvePdfFileName(FILE_BASE_NAME, visUdkastStempel, model.brevhoved?.journalnr));
};
