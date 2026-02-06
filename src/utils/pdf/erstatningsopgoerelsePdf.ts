/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { COLORS, FONT_SIZES, MARGINS, TABLE_STYLES } from './pdfConfig';
import { addFooter, addBrevhoved, type BrevhovedData } from './pdfHelpers';
import type { ISODateString } from '../../types/branded';
import { isoToDanish } from '../../types/branded';
import type { AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode, OffentligeYdelserRow, StamdataValues } from '../../schemas/formSchemas';
import { buildErstatningsopgoerelsePdfModel, type MoneyOre, type Calculable } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { formatAsAmount, formatCurrency, formatPercent } from '../formatUtils';
import { TAF_BEREGNES_SOM } from '../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { TODAY } from '../../config/dateRanges';
import { amountValueToDisplayString, amountValueToNumber } from '../expressionAmount';
import { calculateAarsloenRowDerived, isAarsloenRowEffectivelyEmpty } from '../aarsloenTableCalculations';
import { ydelsestyper } from '../../data/ydelsestyper';
import { beregnHelligdage } from '../shDageBeregning';
import { diffUtcDays } from '../utcDayMath';
import { aarsloenMax } from '../../data/regulationRates';
import { buildFerieDageSet, buildSHDageSet } from '../../domain/debug/eoDebugRegulationCore';
import { beregnArbejdsdageOgMaaneder } from '../../domain/erstatningsopgoerelse/arbejdsdageMaaneder';

const NBSP = '\u00A0';

const formatCurrencyFromOre = (ore: MoneyOre): string => formatCurrency(ore / 100);

const renderMoney = (value: Calculable<MoneyOre>): string => {
  return value.status === 'ok' ? formatCurrencyFromOre(value.value) : '—';
};

const renderMoneyWithKr = (value: Calculable<MoneyOre>): string => {
  const rendered = renderMoney(value);
  return rendered === '—' ? '—' : `${rendered}${NBSP}kr.`;
};

const formatMoneyOreWithKr = (ore: MoneyOre): string => `${formatCurrencyFromOre(ore)}${NBSP}kr.`;

const ensureNonBreakingKr = (value: string): string => {
  return value.replace(/(-?\d[\d.,]*)\s+kr\./g, `$1${NBSP}kr.`);
};

const normalizeTextForPdf = (value: string): string => {
  return ensureNonBreakingKr(value.replace(/\r\n/g, '\n'));
};

const fitTextToWidth = (doc: jsPDF, text: string, maxWidth: number): string => {
  if (doc.getTextWidth(text) <= maxWidth) return text;
  const ellipsis = '…';
  const ellipsisWidth = doc.getTextWidth(ellipsis);
  if (ellipsisWidth >= maxWidth) return '';
  let trimmed = text;
  while (trimmed.length > 0 && doc.getTextWidth(trimmed) + ellipsisWidth > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed.length > 0 ? `${trimmed}${ellipsis}` : '';
};


const formatMaanederTrimmed = (value: number): string => {
  const rounded = Math.round(value * 10000) / 10000;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

const formatPercentDelta = (value: number): string => {
  const abs = Math.abs(value);
  const rounded = Math.round(abs * 100) / 100;
  return rounded.toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

const formatPctFromInput = (value: number | undefined): string => {
  return `${(value ?? 0).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
};

const isZeroPct = (value: number | undefined): boolean => Math.abs(value ?? 0) < 0.000001;

const getLoenindkomstTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  const periodColumns =
    loenperiode === 'maaned'
      ? ['Måned', 'År']
      : loenperiode === 'uge'
        ? ['Uge fra', 'Uge til']
        : ['Dato fra', 'Dato til'];

  return [
    ...periodColumns,
    'Grundløn',
    'Tillæg',
    'Ikke-pens. giv. løn',
    'ATP og \nikke-FB løn',
    'Ferieberet. \nløn',
    'FP/FV/SH/\nSO/St.B.',
    'Arb.g. Pension',
    'Samlet løn',
  ];
};

const resolvePeriodColumns = (row: AarsloenTableRow, loenperiode: Loenperiode): readonly [string, string] => {
  if (loenperiode === 'maaned') {
    return [row.col0_maaned?.trim() ?? '', row.col1_maaned?.trim() ?? ''];
  }
  if (loenperiode === 'uge') {
    return [row.col0_uge?.trim() ?? '', row.col1_uge?.trim() ?? ''];
  }
  return [row.col0_dag?.trim() ?? '', row.col1_dag?.trim() ?? ''];
};

const OFFENTLIGE_YDELSER_HEADERS = [
  'Fra-dato',
  'Til-dato',
  'Ydelse',
  'Evt. tillæg',
  'I alt',
  'Ydelsestype',
] as const;

const SH_DAGE_WEEKDAY_NAMES = [
  'Søndag',
  'Mandag',
  'Tirsdag',
  'Onsdag',
  'Torsdag',
  'Fredag',
  'Lørdag',
] as const;

type SHDageTableRow = Readonly<{
  ugedag: string;
  datoDisplay: string;
  helligdagNavn: string;
  erSHDag: boolean;
}>;

type ReguleringIndexRow = Readonly<{
  fraDato: string;
  tilDato: string;
  indeksberegning: string;
  indeks: string;
}>;

type PdfAutoTableDoc = jsPDF & {
  lastAutoTable?: {
    finalY?: number;
  };
};

const STANDARD_PDF_TABLE_FONT_SIZE = 8;
const STANDARD_PDF_TABLE_CELL_PADDING = 1.5;

const renderStandardPdfTable = (params: Readonly<{
  doc: jsPDF;
  startY: number;
  body: RowInput[];
  columnStyles?: NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'];
  transparentRowIndices?: readonly number[];
}>): number => {
  const { doc, startY, body, columnStyles, transparentRowIndices = [] } = params;
  const transparentSet = new Set(transparentRowIndices);

  autoTable(doc, {
    startY,
    head: [],
    body,
    margin: { left: MARGINS.left, right: MARGINS.right },
    styles: {
      font: 'helvetica',
      fontSize: STANDARD_PDF_TABLE_FONT_SIZE,
      cellPadding: STANDARD_PDF_TABLE_CELL_PADDING,
      textColor: COLORS.text,
    },
    columnStyles,
    didParseCell: (data: CellHookData) => {
      if (data.row.index === 0) {
        data.cell.styles.fillColor = TABLE_STYLES.headerBackgroundColor;
        return;
      }
      if (transparentSet.has(data.row.index)) {
        data.cell.styles.fillColor = false;
        return;
      }
      data.cell.styles.fillColor =
        data.row.index % 2 === 0 ? TABLE_STYLES.alternateRowBackgroundColor : false;
    },
  });

  return ((doc as PdfAutoTableDoc).lastAutoTable?.finalY ?? startY);
};

const formatDateFromDateObjectLong = (date: Date): string => {
  return `${date.getDate()}. ${MONTH_NAMES_DA[date.getMonth()]} ${date.getFullYear()}`;
};

const calculatePaaskedag = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const identifyHelligdag = (date: Date, paaskedag: Date): string | null => {
  const year = date.getFullYear();
  if (date.getMonth() === 0 && date.getDate() === 1) return 'Nytårsdag';
  if (date.getMonth() === 11 && date.getDate() === 25) return 'Juledag';
  if (date.getMonth() === 11 && date.getDate() === 26) return 'Anden juledag';

  const diffDays = diffUtcDays(date, paaskedag);
  if (diffDays === -3) return 'Skærtorsdag';
  if (diffDays === -2) return 'Langfredag';
  if (diffDays === 0) return 'Påskedag';
  if (diffDays === 1) return 'Anden påskedag';
  if (diffDays === 26 && year <= 2023) return 'Store bededag';
  if (diffDays === 39) return 'Kristi himmelfartsdag';
  if (diffDays === 49) return 'Pinsedag';
  if (diffDays === 50) return 'Anden pinsedag';
  return null;
};

const parseIsoDateToLocalDate = (iso: ISODateString | undefined): Date | null => {
  if (!iso) return null;
  const [yearPart, monthPart, dayPart] = iso.split('-');
  const year = Number.parseInt(yearPart ?? '', 10);
  const month = Number.parseInt(monthPart ?? '', 10);
  const day = Number.parseInt(dayPart ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

const findHelligdageInRange = (fra: ISODateString | undefined, til: ISODateString | undefined): SHDageTableRow[] => {
  const start = parseIsoDateToLocalDate(fra);
  const end = parseIsoDateToLocalDate(til);
  if (!start || !end || start > end) return [];

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const rows: Array<SHDageTableRow & { sortTs: number }> = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const paaskedag = calculatePaaskedag(year);
    const helligdage = beregnHelligdage(year);
    for (const helligdag of helligdage) {
      if (helligdag < start || helligdag > end) continue;
      const helligdagNavn = identifyHelligdag(helligdag, paaskedag);
      if (!helligdagNavn) continue;
      const dayOfWeek = helligdag.getDay();
      const erSHDag = dayOfWeek >= 1 && dayOfWeek <= 5;
      rows.push({
        ugedag: SH_DAGE_WEEKDAY_NAMES[dayOfWeek],
        datoDisplay: formatDateFromDateObjectLong(helligdag),
        helligdagNavn,
        erSHDag,
        sortTs: helligdag.getTime(),
      });
    }
  }

  rows.sort((a, b) => a.sortTs - b.sortTs);
  return rows.map(({ sortTs: _sortTs, ...row }) => row);
};

const parseOptionalIsoDate = (value: unknown): ISODateString | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const [yearPart, monthPart, dayPart] = trimmed.split('-');
  const year = Number.parseInt(yearPart ?? '', 10);
  const month = Number.parseInt(monthPart ?? '', 10);
  const day = Number.parseInt(dayPart ?? '', 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return undefined;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return trimmed as ISODateString;
};

const formatDateIso = (date: Date): ISODateString => {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as ISODateString;
};

const subtractOneDayIso = (iso: ISODateString): ISODateString => {
  const date = parseIsoDateToLocalDate(iso);
  if (!date) return iso;
  date.setDate(date.getDate() - 1);
  return formatDateIso(date);
};

const maxIso = (a: ISODateString, b: ISODateString): ISODateString => (a > b ? a : b);
const minIso = (a: ISODateString, b: ISODateString): ISODateString => (a < b ? a : b);

const resolveTafDateBounds = (
  eoValues: ErstatningsopgoerelseValues
): Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null => {
  const periodeFra = parseOptionalIsoDate(eoValues.vedroererPeriodeFra);
  const periodeTil = parseOptionalIsoDate(eoValues.vedroererPeriodeTil);
  const periodRange =
    periodeFra && periodeTil && periodeFra <= periodeTil
      ? { fra: periodeFra, til: periodeTil }
      : null;

  let foerste: ISODateString | undefined;
  let sidste: ISODateString | undefined;

  for (const row of eoValues.tafPerioder ?? []) {
    const rowFra = parseOptionalIsoDate(row.fra);
    const rowTil = parseOptionalIsoDate(row.til);
    if (!rowFra || !rowTil || rowFra > rowTil) continue;

    let fra = rowFra;
    let til = rowTil;
    if (periodRange) {
      if (til < periodRange.fra || fra > periodRange.til) continue;
      fra = maxIso(fra, periodRange.fra);
      til = minIso(til, periodRange.til);
      if (fra > til) continue;
    }

    foerste = foerste ? minIso(foerste, fra) : fra;
    sidste = sidste ? maxIso(sidste, til) : til;
  }

  if (!foerste || !sidste) return null;
  return { foerste, sidste };
};

const resolveReguleringsdato = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | undefined => {
  const skadesdato = parseOptionalIsoDate(stamdataValues.skadesdato);
  const angivetLoenDato = parseOptionalIsoDate(eoValues.angivetLoenOpreguleresFraDato);
  const saerligDato = parseOptionalIsoDate(ansaettelsesforhold.saerligFraDatoRegulering);
  if (eoValues.beregnesUdFra === 'Beregningsperiode') {
    return saerligDato ?? skadesdato;
  }
  return angivetLoenDato ?? skadesdato;
};

const buildReguleringsvaerdierRows = (
  reguleringsdato: ISODateString | undefined,
  tafFra: ISODateString,
  tafTil: ISODateString,
  statistikModel: string | undefined
): ReadonlyArray<Readonly<{ venstre: string; hoejre: string }>> => {
  const model = (statistikModel ?? '').trim();
  if (!model.startsWith('ASL-') || !reguleringsdato) return [];

  const regDate = parseIsoDateToLocalDate(reguleringsdato);
  const tafFraDate = parseIsoDateToLocalDate(tafFra);
  const tafTilDate = parseIsoDateToLocalDate(tafTil);
  if (!regDate || !tafFraDate || !tafTilDate) return [];

  const regYear = regDate.getFullYear();
  const startYear = tafFraDate.getFullYear();
  const endYear = tafTilDate.getFullYear();

  const rows: Array<{ venstre: string; hoejre: string }> = [];
  const regValue = aarsloenMax[regYear as keyof typeof aarsloenMax];
  if (typeof regValue === 'number') {
    rows.push({ venstre: String(regYear), hoejre: formatCurrency(regValue) });
  }
  for (let year = startYear; year <= endYear; year += 1) {
    if (year === regYear) continue;
    const value = aarsloenMax[year as keyof typeof aarsloenMax];
    if (typeof value !== 'number') continue;
    rows.push({ venstre: String(year), hoejre: formatCurrency(value) });
  }
  return rows;
};

const buildReguleringIndexRows = (params: Readonly<{
  eoValues: ErstatningsopgoerelseValues;
  reguleringsdato: ISODateString | undefined;
  tafFra: ISODateString;
  tafTil: ISODateString;
  statistikModel: string | undefined;
}>): readonly ReguleringIndexRow[] => {
  const { eoValues, reguleringsdato, tafFra, tafTil, statistikModel } = params;
  const model = (statistikModel ?? '').trim();
  if (!model.startsWith('ASL-') || !reguleringsdato) return [];

  const regDate = parseIsoDateToLocalDate(reguleringsdato);
  if (!regDate) return [];
  const regYear = regDate.getFullYear();
  const baseValue = aarsloenMax[regYear as keyof typeof aarsloenMax];
  if (typeof baseValue !== 'number' || baseValue <= 0) return [];

  const tafFraDate = parseIsoDateToLocalDate(tafFra);
  const tafTilDate = parseIsoDateToLocalDate(tafTil);
  if (!tafFraDate || !tafTilDate || tafFraDate > tafTilDate) return [];

  const periodStarts: ISODateString[] = [tafFra];
  for (let year = tafFraDate.getFullYear() + 1; year <= tafTilDate.getFullYear(); year += 1) {
    const jan1 = `${year}-01-01` as ISODateString;
    if (jan1 > tafFra && jan1 <= tafTil) {
      periodStarts.push(jan1);
    }
  }
  periodStarts.sort((a, b) => (a < b ? -1 : 1));

  const shDageSet = buildSHDageSet(tafFra, tafTil);
  const ferieDageSet = buildFerieDageSet(eoValues, shDageSet, tafFra, tafTil);

  const rows: ReguleringIndexRow[] = [];
  for (let i = 0; i < periodStarts.length; i += 1) {
    const fraIso = periodStarts[i];
    const tilIso = i < periodStarts.length - 1 ? subtractOneDayIso(periodStarts[i + 1]) : tafTil;
    if (fraIso > tilIso) continue;

    const year = parseIsoDateToLocalDate(fraIso)?.getFullYear();
    if (!year) continue;
    const value = aarsloenMax[year as keyof typeof aarsloenMax];
    if (typeof value !== 'number') continue;

    const stats = beregnArbejdsdageOgMaaneder(fraIso, tilIso, shDageSet, ferieDageSet);
    const formulaText =
      Math.abs(value - baseValue) < 0.000001
        ? formatCurrency(value)
        : `${formatCurrency(value)} /\n${formatCurrency(baseValue)}`;
    const indeksValue = (value / baseValue) * 100;
    rows.push({
      fraDato: formatDateShort(fraIso),
      tilDato: formatDateShort(tilIso),
      indeksberegning: formulaText,
      indeks: indeksValue.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    });
  }

  return rows;
};

export const resolveUdkastStempelValue = (value: unknown): boolean => {
  return value === 'Ja';
};

const udkastWatermarkCache = new Map<string, string | null>();

const getUdkastWatermarkDataUrl = (pageWidth: number, pageHeight: number): string | null => {
  const cacheKey = `${pageWidth.toFixed(3)}x${pageHeight.toFixed(3)}`;
  const cached = udkastWatermarkCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  if (typeof document === 'undefined') {
    udkastWatermarkCache.set(cacheKey, null);
    return null;
  }

  const canvas = document.createElement('canvas');
  // Match side-ratio for at undgå forvrængning ved draw-to-page.
  const pxScale = 14;
  canvas.width = Math.max(1200, Math.round(pageWidth * pxScale));
  canvas.height = Math.max(1600, Math.round(pageHeight * pxScale));
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    udkastWatermarkCache.set(cacheKey, null);
    return null;
  }

  // Opaque white background avoids alpha-edge fringing in PDF viewers at zoom.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((-45 * Math.PI) / 180);
  const fontSize = Math.round(Math.min(canvas.width, canvas.height) * 0.18);
  ctx.font = `700 ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle = '#f2f2f2';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('UDKAST', 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
  udkastWatermarkCache.set(cacheKey, dataUrl);
  return dataUrl;
};

const addUdkastWatermark = (doc: jsPDF): void => {
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const watermarkDataUrl = getUdkastWatermarkDataUrl(pageWidth, pageHeight);

  if (watermarkDataUrl) {
    doc.addImage(watermarkDataUrl, 'JPEG', 0, 0, pageWidth, pageHeight, undefined, 'NONE');
    return;
  }

  // Fallback hvis canvas ikke er tilgængelig i runtime.
  const text = 'UDKAST';
  const centerX = pageWidth / 2 + 18;
  const centerY = pageHeight / 2 - 80;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(130);
  doc.setTextColor(245);
  doc.text(text, centerX, centerY, { align: 'center', angle: -45 });
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FONT_SIZES.normal);
};

/**
 * Månedsnavn på dansk (med små bogstaver)
 */
/**
 * Formaterer ISO-dato til dansk datoformat (dd-mm-yyyy)
 *
 * @param {ISODateString} isoDate - Dato i ISO-format (yyyy-mm-dd)
 * @returns {string} Formateret dato (dd-mm-yyyy)
 */
const formatDateShort = (isoDate: ISODateString | undefined): string => {
  if (!isoDate) return '';

  const danish = isoToDanish(isoDate);
  if (!danish) return '';

  // danish er allerede i dd-mm-yyyy format, så returner direkte
  return danish;
};

const MONTH_NAMES_DA = [
  'januar',
  'februar',
  'marts',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'september',
  'oktober',
  'november',
  'december',
] as const;

const formatDateLong = (isoDate: ISODateString | undefined): string => {
  const short = formatDateShort(isoDate);
  if (!short) return '';
  const [day, month, year] = short.split('-');
  const monthIndex = Number.parseInt(month ?? '', 10) - 1;
  const dayNumber = Number.parseInt(day ?? '', 10);
  if (!Number.isFinite(dayNumber) || monthIndex < 0 || monthIndex >= MONTH_NAMES_DA.length) {
    return short;
  }
  return `${dayNumber}. ${MONTH_NAMES_DA[monthIndex]} ${year}`;
};

const createPdfCursor = (params: Readonly<{
  lineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (message: string) => void;
}>) => {
  const { lineHeight, visUdkastStempel, onLayoutFallback } = params;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageHeight = doc.internal.pageSize.height;
  const contentBottom = pageHeight - MARGINS.bottom;
  const fullWidth = doc.internal.pageSize.width - MARGINS.left - MARGINS.right;
  const pageContentHeight = contentBottom - MARGINS.top;
  let y = MARGINS.top;
  let activeFont = { fontName: 'helvetica', fontStyle: 'normal' as string };

  const addPage = () => {
    doc.addPage();
    y = MARGINS.top;
    if (visUdkastStempel) {
      addUdkastWatermark(doc);
    }
  };

  const ensureSpace = (height: number) => {
    if (y + height > contentBottom) {
      addPage();
    }
  };

  const splitWrappedLines = (text: string, maxWidth: number): string[] => {
    return doc.splitTextToSize(normalizeTextForPdf(text), maxWidth) as string[];
  };

  const setFont = (fontName: string, fontStyle: string) => {
    doc.setFont(fontName, fontStyle);
    activeFont = { fontName, fontStyle };
  };

  const withFontStyle = (fontStyle: 'normal' | 'bold', fn: () => void) => {
    const previous = activeFont;
    setFont(previous.fontName, fontStyle);
    try {
      fn();
    } finally {
      setFont(previous.fontName, previous.fontStyle);
    }
  };

  const measureTextWidthWithFont = (text: string, fontStyle: 'normal' | 'bold'): number => {
    let measured = 0;
    withFontStyle(fontStyle, () => {
      measured = doc.getTextWidth(text);
    });
    return measured;
  };

  const writeWrappedText = (text: string, maxWidth = fullWidth, x = MARGINS.left) => {
    const lines = splitWrappedLines(text, maxWidth);
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  const writeLeftRightText = (
    leftText: string,
    rightText: string,
    x: number,
    rightPadding: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
    }>
  ) => {
    const pageWidth = doc.internal.pageSize.width;
    const rightFontStyle = options?.rightFontStyle ?? 'bold';
    const maxRightDrawableWidth = Math.max(10, pageWidth - x - rightPadding - 5);
    const actualRightWidth = measureTextWidthWithFont(rightText, rightFontStyle);
    const minRightWidth = options?.minRightColumnWidth ?? 0;
    const rightWidth = Math.max(actualRightWidth, minRightWidth);
    const wrapPadding = doc.getTextWidth('000000');
    const hasRightOverflow = rightWidth > maxRightDrawableWidth;
    const leftMaxWidth = hasRightOverflow
      ? Math.max(30, pageWidth - x - rightPadding - 5)
      : Math.max(30, pageWidth - x - rightPadding - rightWidth - 5 - wrapPadding);
    const leftLines = options?.leftNoWrap ? [normalizeTextForPdf(leftText)] : splitWrappedLines(leftText, leftMaxWidth);

    if (hasRightOverflow) {
      onLayoutFallback('højre kolonne er bredere end tilgængelig plads; flytter beløb til egen linje.');
      for (const line of leftLines) {
        ensureSpace(lineHeight);
        doc.text(line, x, y);
        y += lineHeight;
      }

      const rightLines = splitWrappedLines(rightText, maxRightDrawableWidth);
      for (const line of rightLines) {
        ensureSpace(lineHeight);
        withFontStyle(rightFontStyle, () => {
          doc.text(line, pageWidth - rightPadding, y, { align: 'right' });
        });
        y += lineHeight;
      }

      if (options?.lineAboveRightWidth) {
        const lineWidth = options.lineAboveRightWidth;
        const lineEnd = pageWidth - rightPadding;
        const lineStart = lineEnd - lineWidth;
        const offset = options.lineAboveRightOffset ?? 2;
        doc.setLineWidth(0.2);
        doc.line(lineStart, y - lineHeight - offset, lineEnd, y - lineHeight - offset);
      }
      return;
    }

    leftLines.forEach((line, index) => {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      const isLastLine = index === leftLines.length - 1;
      if (isLastLine) {
        withFontStyle(rightFontStyle, () => {
          doc.text(rightText, pageWidth - rightPadding, y, { align: 'right' });
        });
        if (options?.lineAboveRightWidth) {
          const lineWidth = options.lineAboveRightWidth;
          const lineEnd = pageWidth - rightPadding;
          const lineStart = lineEnd - lineWidth;
          const offset = options.lineAboveRightOffset ?? 2;
          doc.setLineWidth(0.2);
          doc.line(lineStart, y - offset, lineEnd, y - offset);
        }
      }
      y += lineHeight;
    });
  };

  const writeLeftRightTextSingleLine = (
    leftText: string,
    rightText: string,
    x: number,
    rightPadding: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => {
    writeLeftRightText(leftText, rightText, x, rightPadding, { ...options, leftNoWrap: true });
  };

  const writeUnderlinedLabel = (text: string, x: number) => {
    ensureSpace(lineHeight);
    const normalized = normalizeTextForPdf(text).replace(/\n/g, ' ');
    doc.text(normalized, x, y);
    const labelWidth = doc.getTextWidth(normalized);
    doc.setLineWidth(0.2);
    doc.line(x, y + 1, x + labelWidth, y + 1);
    y += lineHeight;
  };

  const writeSignatureBlock = (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => {
    ensureSpace(lineHeight);
    doc.text(dateLine, dateX, y);
    doc.text(sigLine, sigX, y);
    y += lineHeight;
    ensureSpace(lineHeight);
    const dateCenterX = dateX + doc.getTextWidth(dateLine) / 2;
    const sigCenterX = sigX + doc.getTextWidth(sigLine) / 2;
    doc.text('Dato', dateCenterX, y, { align: 'center' });
    doc.text(skadelidteNavn, sigCenterX, y, { align: 'center' });
    y += lineHeight;
  };

  const measureWrappedTextHeight = (text: string) => {
    const lines = splitWrappedLines(text, fullWidth);
    return lineHeight * lines.length;
  };

  return {
    setDisplayMode: (mode: string) => doc.setDisplayMode(mode),
    setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => doc.setProperties(props),
    setFontSize: (size: number) => doc.setFontSize(size),
    setFont,
    getDoc: () => doc,
    getY: () => y,
    setY: (nextY: number) => {
      y = nextY;
    },
    ensureSpace,
    advanceY: (delta: number) => {
      y += delta;
    },
    writeWrappedText,
    writeLeftRightText,
    writeLeftRightTextSingleLine,
    writeUnderlinedLabel,
    writeSignatureBlock,
    writeBrevhoved: (brevhovedData: BrevhovedData) => {
      y = addBrevhoved(doc, brevhovedData);
    },
    addUdkastWatermark: () => {
      if (visUdkastStempel) {
        addUdkastWatermark(doc);
      }
    },
    splitWrappedLines,
    measureWrappedTextHeight,
    getTextWidth: (text: string) => doc.getTextWidth(text),
    fitTextToWidth: (text: string, maxWidth: number) => fitTextToWidth(doc, text, maxWidth),
    getFullWidth: () => fullWidth,
    addPage,
    getPageContentHeight: () => pageContentHeight,
    renderAtomicBlock: (estimatedHeight: number, render: () => void) => {
      ensureSpace(estimatedHeight);
      render();
    },
    addFooter: () => addFooter(doc),
    save: (filename: string) => doc.save(filename),
  };
};

type PdfWriter = {
  setDisplayMode: (mode: string) => void;
  setProperties: (props: Parameters<jsPDF['setProperties']>[0]) => void;
  setFontSize: (size: number) => void;
  setFont: (fontName: string, fontStyle: string) => void;
  getDoc: () => jsPDF;
  getY: () => number;
  setY: (nextY: number) => void;
  addSpacer: (height: number) => void;
  advanceY: (delta: number) => void;
  writeWrappedText: (text: string) => void;
  writeLeftRightText: (
    leftText: string,
    rightText: string,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
      minRightColumnWidth?: number;
    }>
  ) => void;
  writeLeftRightTextSingleLine: (
    leftText: string,
    rightText: string,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
    }>
  ) => void;
  writeSectionHeader: (text: string, nextLineHeight: number) => void;
  writeSubheader: (
    text: string,
    nextLineHeight: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => void;
  writeSubheaderWithWrappedText: (subheaderText: string, bodyText: string) => void;
  writeAtomicTableChunks: <T>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => void;
  writeUnderlinedLabel: (text: string, x: number) => void;
  writeSignatureBlock: (dateLine: string, sigLine: string, dateX: number, sigX: number, skadelidteNavn: string) => void;
  writeBrevhoved: (brevhovedData: BrevhovedData) => void;
  addUdkastWatermark: () => void;
  getTextWidth: (text: string) => number;
  fitTextToWidth: (text: string, maxWidth: number) => string;
  getPageWidth: () => number;
  addPage: () => void;
  addFooter: () => void;
  save: (filename: string) => void;
};

const createPdfWriter = (params: Readonly<{
  lineHeight: number;
  doubleLineHeight: number;
  visUdkastStempel: boolean;
  onLayoutFallback: (message: string) => void;
}>): PdfWriter => {
  const { lineHeight, doubleLineHeight, visUdkastStempel, onLayoutFallback } = params;
  const cursor = createPdfCursor({ lineHeight, visUdkastStempel, onLayoutFallback });

  const writeSectionHeader = (text: string, nextLineHeight: number) => {
    const estimatedHeaderHeight = doubleLineHeight + lineHeight;
    cursor.ensureSpace(estimatedHeaderHeight + nextLineHeight);
    cursor.advanceY(doubleLineHeight);
    cursor.setFont('helvetica', 'bold');
    cursor.setFontSize(FONT_SIZES.header);
    cursor.writeWrappedText(text);
    cursor.advanceY(lineHeight);
    cursor.setFont('helvetica', 'normal');
    cursor.setFontSize(FONT_SIZES.normal);
  };

  const writeSubheader = (
    text: string,
    nextLineHeight: number,
    options?: Readonly<{ addTopSpacing?: boolean }>
  ) => {
    const addTopSpacing = options?.addTopSpacing ?? true;
    const headerHeight = cursor.measureWrappedTextHeight(text) + (addTopSpacing ? lineHeight : 0);
    cursor.ensureSpace(headerHeight + nextLineHeight);
    if (addTopSpacing) {
      cursor.advanceY(lineHeight);
    }
    cursor.setFont('helvetica', 'bold');
    cursor.setFontSize(FONT_SIZES.normal);
    cursor.writeWrappedText(text);
    cursor.setFont('helvetica', 'normal');
  };

  const writeSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    const bodyHeight = cursor.measureWrappedTextHeight(bodyText);
    writeSubheader(subheaderText, bodyHeight);
    cursor.writeWrappedText(bodyText);
  };

  const writeAtomicTableChunks = <T,>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => {
    const { rows, renderHeader, renderRow, estimateRowHeight, headerHeight } = params;
    const rowsPerChunk = Math.max(
      1,
      Math.floor((cursor.getPageContentHeight() - headerHeight) / estimateRowHeight)
    );
    for (let i = 0; i < rows.length; i += rowsPerChunk) {
      const chunk = rows.slice(i, i + rowsPerChunk);
      const estimatedChunkHeight = headerHeight + estimateRowHeight * chunk.length;
      cursor.renderAtomicBlock(estimatedChunkHeight, () => {
        renderHeader();
        chunk.forEach((row) => renderRow(row));
      });
    }
  };

  return {
    setDisplayMode: cursor.setDisplayMode,
    setProperties: cursor.setProperties,
    setFontSize: cursor.setFontSize,
    setFont: cursor.setFont,
    getDoc: cursor.getDoc,
    getY: cursor.getY,
    setY: cursor.setY,
    addSpacer: (height: number) => {
      cursor.ensureSpace(height);
      cursor.advanceY(height);
    },
    advanceY: cursor.advanceY,
    writeWrappedText: cursor.writeWrappedText,
    writeLeftRightText: (leftText, rightText, options) =>
      cursor.writeLeftRightText(leftText, rightText, MARGINS.left, MARGINS.right, options),
    writeLeftRightTextSingleLine: (leftText, rightText, options) =>
      cursor.writeLeftRightTextSingleLine(leftText, rightText, MARGINS.left, MARGINS.right, options),
    writeSectionHeader,
    writeSubheader,
    writeSubheaderWithWrappedText,
    writeAtomicTableChunks,
    writeUnderlinedLabel: cursor.writeUnderlinedLabel,
    writeSignatureBlock: cursor.writeSignatureBlock,
    writeBrevhoved: cursor.writeBrevhoved,
    addUdkastWatermark: cursor.addUdkastWatermark,
    getTextWidth: cursor.getTextWidth,
    fitTextToWidth: cursor.fitTextToWidth,
    getPageWidth: () => MARGINS.left + cursor.getFullWidth() + MARGINS.right,
    addPage: cursor.addPage,
    addFooter: cursor.addFooter,
    save: cursor.save,
  };
};


/**
 * Interface for valgte elementer
 */
interface SelectedElements {
  opgoerelse: boolean;
  loenindkomst: boolean;
  offentligeYdelser: boolean;
  shDage: boolean;
  regulering: boolean;
  okSatser: boolean;
  sygeferiegodtgoerelse: boolean;
}

/**
 * Options for erstatningsopgørelse PDF
 */
interface ErstatningsopgoerelsePdfOptions {
  visBrevhoved?: boolean;
  erstatningsopgoerelseAfsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje';
  visUdkastStempel?: boolean;
}

/**
 * Generer og download PDF for erstatningsopgørelse
 *
 * @param {StamdataValues} stamdataValues - Stamdata fra FormPersistence
 * @param {ErstatningsopgoerelseValues} eoValues - EO-oplysninger fra FormPersistence
 * @param {SelectedElements} selectedElements - Valgte elementer til PDF
 * @param {ErstatningsopgoerelsePdfOptions} options - Valgfrie indstillinger
 */
export const generateErstatningsopgoerelsePdf = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  selectedElements: SelectedElements,
  options: ErstatningsopgoerelsePdfOptions = {}
) => {
  if (!selectedElements.opgoerelse) {
    throw new Error('PDF-generering kræver, at elementet "Opgørelse" er valgt.');
  }

  const unsupportedSelections = [
    ['Sygeferiegodtgørelse', selectedElements.sygeferiegodtgoerelse],
  ].filter(([, isSelected]) => isSelected).map(([label]) => label);

  if (unsupportedSelections.length > 0) {
    throw new Error(
      `Valgte PDF-elementer er ikke understøttet endnu: ${unsupportedSelections.join(', ')}.`
    );
  }

  const { visBrevhoved = false } = options;
  const visUdkastStempel = options.visUdkastStempel ?? resolveUdkastStempelValue(eoValues.indsaetUdkastStempel);
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed ?? eoValues.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;
  const model = buildErstatningsopgoerelsePdfModel(stamdataValues, eoValues, { dagsDatoISO: TODAY });
  const titel = model.titel;

  const warnLayoutFallback = (message: string) => {
    console.warn(`PDF-layout: ${message}`);
  };

  const writer = createPdfWriter({
    lineHeight,
    doubleLineHeight,
    visUdkastStempel,
    onLayoutFallback: warnLayoutFallback,
  });
  writer.setDisplayMode('100%');

  // Dokumentets metadata
  writer.setProperties({
    title: titel,
    subject: 'Erstatningsberegning',
    author: 'MINEO',
    creator: 'MINEO',
  });

  const renderSectionHeader = (text: string, nextLineHeight: number) => {
    writer.writeSectionHeader(text, nextLineHeight);
  };

  const renderSubheader = (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => {
    writer.writeSubheader(text, nextLineHeight, options);
  };

  const safeAddWrappedText = (text: string) => {
    writer.writeWrappedText(text);
  };

  const renderSubheaderWithWrappedText = (subheaderText: string, bodyText: string) => {
    writer.writeSubheaderWithWrappedText(subheaderText, bodyText);
  };

  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      rightFontStyle?: 'normal' | 'bold';
      lineAboveRightWidth?: number;
      lineAboveRightOffset?: number;
      leftNoWrap?: boolean;
    }>
  ) => {
    writer.writeLeftRightText(
      leftText,
      rightText,
      { ...options, minRightColumnWidth: rightMaxWidth }
    );
  };

  const standardRightMaxWidth = writer.getTextWidth('000.000.000,00');

  const writeBodyText = (text: string) => {
    safeAddWrappedText(text);
  };

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, value, standardRightMaxWidth, { rightFontStyle: 'normal' });
  };

  const startBilagPage = (titleText: string) => {
    writer.addPage();
    writer.setFont('helvetica', 'bold');
    writer.setFontSize(FONT_SIZES.title);
    writeBodyText(titleText);
    writer.setFont('helvetica', 'normal');
    writer.setFontSize(FONT_SIZES.normal);
    writer.addSpacer(lineHeight);
  };

  const renderAtomicTableChunks = <T,>(params: Readonly<{
    rows: readonly T[];
    renderHeader: () => void;
    renderRow: (row: T) => void;
    estimateRowHeight: number;
    headerHeight: number;
  }>) => {
    const { rows, renderHeader, renderRow, estimateRowHeight, headerHeight } = params;
    writer.writeAtomicTableChunks({ rows, renderHeader, renderRow, estimateRowHeight, headerHeight });
  };

  const assertModelInvariant = (condition: boolean, message: string) => {
    if (condition) return;
    const invariantMessage = `Inkonsekvent PDF-model: ${message}`;
    throw new Error(invariantMessage);
  };

  writer.addUdkastWatermark();

  // Tilføj brevhoved hvis aktiveret
  if (visBrevhoved && model.brevhoved) {
    const brevhovedData: BrevhovedData = {
      journalnr: model.brevhoved.journalnr,
      advokat: model.brevhoved.advokat,
      sagsbehandler: model.brevhoved.sagsbehandler,
      // UND TAGELSE: EOberegning-tab bruger "Opgørelse lavet den" i stedet for dags dato.
      dagsDatoISO: model.brevhoved.dagsDatoISO,
    };
    writer.writeBrevhoved(brevhovedData);
  }

  // Tilføj titel (fed skrift)
  writer.setFontSize(FONT_SIZES.title);
  writer.setFont('helvetica', 'bold');
  safeAddWrappedText(titel);

  // Tilføj erstatningsperiode-datoer direkte under titel
  writer.setFontSize(FONT_SIZES.normal);
  writer.setFont('helvetica', 'normal');
  if (model.periodeDisplay) {
    safeAddWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Tilføj skadelidtes navn (fed skrift)
  writer.setFont('helvetica', 'bold');
  if (model.skadelidteNavn) {
    safeAddWrappedText(model.skadelidteNavn);
  }

  // Tilføj skadestype og skadesdato (normal skrift)
  writer.setFont('helvetica', 'normal');
  if (model.skadestypeLinje) {
    safeAddWrappedText(model.skadestypeLinje);
    writer.advanceY(lineHeight);
  }

  // ============================================================================
  // SVIE- OG SMERTEGODTGØRELSE SEKTION
  // ============================================================================

  renderSectionHeader('Svie- og smertegodtgørelse', lineHeight);

  renderSubheader('Status', lineHeight, { addTopSpacing: false });

  // Normal skrift for resten
  writer.setFont('helvetica', 'normal');

    for (const line of model.svieSmerte.statusLinjer) {
      safeAddWrappedText(line);
    }

  renderSubheader(model.svieSmerte.periodeHeading, lineHeight);
  assertModelInvariant(
    model.svieSmerte.harPerioder === (model.svieSmerte.periodeLinjer.length > 0),
    'svieSmerte.harPerioder matcher ikke svieSmerte.periodeLinjer.'
  );
  if (!model.svieSmerte.beregnes) {
    safeAddWrappedText('Ingen');
  } else if (!model.svieSmerte.harPerioder) {
    safeAddWrappedText('Ingen');
  } else {
    for (const line of model.svieSmerte.periodeLinjer) {
      safeAddWrappedText(line);
    }

    renderSubheader('Beregningsgrundlag', lineHeight);
    const satserAar = model.svieSmerte.satserAar !== null ? String(model.svieSmerte.satserAar) : '-';
    safeAddWrappedText(`Beregningen af godtgørelse foretages ud fra satserne i år ${satserAar}.`);

    const perDagDisplayWithKr = renderMoneyWithKr(model.svieSmerte.satserPerDag);
    const maxDisplayWithKr = renderMoneyWithKr(model.svieSmerte.satserMax);
    safeAddWrappedText(`Taksten udgår ${perDagDisplayWithKr} pr. sygedag, dog højst ${maxDisplayWithKr}`);

    const tidligere = model.svieSmerte.tidligere;
    const aktuel = model.svieSmerte.aktuel;
    if (tidligere.status === 'ok' || aktuel.status === 'ok') {
      const tidligereDisplay = renderMoneyWithKr(tidligere);
      const aktuelDisplay = renderMoneyWithKr(aktuel);
      let tekst = '';
      if (tidligere.status === 'ok' && aktuel.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder samt modtaget ${aktuelDisplay} for denne periode.`;
      } else if (tidligere.status === 'ok') {
        tekst = `Der er opgjort svie- og smertegodtgørelse med ${tidligereDisplay} for tidligere perioder.`;
      } else if (aktuel.status === 'ok') {
        tekst = `Der er tidligere modtaget ${aktuelDisplay} for denne periode.`;
      }
      if (tekst) {
        safeAddWrappedText(tekst);
      }
    }
    renderSubheader('Beregnet krav på svie- og smertegodtgørelse', lineHeight);
    const sygedage = model.svieSmerte.sygedage;
    const delviseSygedage = model.svieSmerte.delviseSygedage;
    const perDagOre = model.svieSmerte.satserPerDag.status === 'ok' ? model.svieSmerte.satserPerDag.value : null;
    const delvisOre = perDagOre !== null ? Math.round(perDagOre * model.svieSmerte.delvisFaktor) : null;

    const formatCount = (value: number): string => value.toLocaleString('da-DK');
    const perDagText = perDagOre !== null ? formatCurrencyFromOre(perDagOre) : '—';
    const delvisText = delvisOre !== null ? formatCurrencyFromOre(delvisOre) : '—';
    const withKr = (value: string): string => (value === '—' ? value : `${value}${NBSP}kr.`);
    const perDagTextWithKr = withKr(perDagText);
    const delvisTextWithKr = withKr(delvisText);

    const lineLeft = (() => {
      if (sygedage === 0 && delviseSygedage === 0) return '—';
      if (perDagOre === null) return '—';

      let base = '';
      if (model.svieSmerte.delvisFaktor === 1) {
        const combined = [
          sygedage > 0 ? `${formatCount(sygedage)} sygedage` : '',
          delviseSygedage > 0 ? `${formatCount(delviseSygedage)} delvise sygedage` : '',
        ].filter((part) => part !== '').join(' og ');
        base = combined === '' ? '-' : `${combined} á ${perDagTextWithKr}`;
      } else {
        const parts: string[] = [];
        if (sygedage > 0) {
          parts.push(`${formatCount(sygedage)} sygedage á ${perDagTextWithKr}`);
        }
        if (delviseSygedage > 0) {
          parts.push(`${formatCount(delviseSygedage)} delvise sygedage á ${delvisTextWithKr}`);
        }
        base = parts.join(' og ');
      }

      if (base === '' || base === '-') return '-';

      const deductions: string[] = [];
      if (aktuel.status === 'ok') {
        deductions.push(`-${NBSP}${formatMoneyOreWithKr(aktuel.value)}`);
      }
      const maxSuffix = model.svieSmerte.maxApplied ? ' (reduceret til max)' : '';
      return `${base}${deductions.length > 0 ? ` ${deductions.join(' ')}` : ''}${maxSuffix} =`;
    })();

    const beloebDisplay = formatMoneyOreWithKr(model.svieSmerte.totalOre);
    safeAddLeftRightText(lineLeft, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'bold' });
  }
  // ============================================================================
  // TABT ARBEJDSFORTJENESTE SEKTION
  // ============================================================================

  renderSectionHeader('Tabt arbejdsfortjeneste', lineHeight);

  renderSubheader('Status', lineHeight, { addTopSpacing: false });

  // Normal skrift for resten
  writer.setFont('helvetica', 'normal');

    for (const line of model.tabtArbejdsfortjeneste.statusLinjer) {
      safeAddWrappedText(line);
    }

    for (const line of model.tabtArbejdsfortjeneste.eetLinjer) {
      safeAddWrappedText(line);
    }

  if (model.tabtArbejdsfortjeneste.differencekravLinje) {
    safeAddWrappedText(model.tabtArbejdsfortjeneste.differencekravLinje);
  }

  // TAF-perioder
  renderSubheader('Erstatningsperiode, hvor der beregnes tabt arbejdsfortjeneste', lineHeight);

  const tafPerioderLines = model.tabtArbejdsfortjeneste.tafPerioderLinjer;
  const hasTafPerioder = model.tabtArbejdsfortjeneste.harTafPerioder;
  assertModelInvariant(hasTafPerioder === (tafPerioderLines.length > 0), 'harTafPerioder matcher ikke tafPerioderLinjer.');

  if (!hasTafPerioder) {
    safeAddWrappedText('Ingen');
  } else {
    for (const line of tafPerioderLines) {
      safeAddWrappedText(line);
    }
    // Kun hvis der ER TAF-perioder, vis resten af indholdet
    renderSubheader('Indkomst på skadestidspunktet', lineHeight);
    const indkomst = model.tabtArbejdsfortjeneste.indkomstSkadestidspunkt;
    if (indkomst?.beregningsperiodeLabel) {
      safeAddWrappedText(indkomst.beregningsperiodeLabel);
      writer.advanceY(lineHeight);
    }

    if (indkomst?.beregnesUdFra === 'Beregningsperiode') {
      for (const arbejdssted of indkomst.arbejdssteder) {
        writer.writeUnderlinedLabel(arbejdssted.navn, MARGINS.left);

        safeAddLeftRightText('Ferieberettiget indkomst i beregningsperioden', formatMoneyOreWithKr(arbejdssted.breakdown.ferieberetOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText(arbejdssted.fpLabel, formatMoneyOreWithKr(arbejdssted.breakdown.fpFvShSoOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText(arbejdssted.pensionLabel, formatMoneyOreWithKr(arbejdssted.breakdown.pensionOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText('Arbejdsgivers ATP-bidrag og anden indkomst uden tillæg', formatMoneyOreWithKr(arbejdssted.breakdown.atpOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal' }
        );

        safeAddLeftRightText('I alt:', formatMoneyOreWithKr(arbejdssted.breakdown.samletOre), writer.getTextWidth('000.000.000,00'),
          { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
        writer.advanceY(lineHeight);
      }

      if (indkomst.totalBreakdown) {
        const arbejdsgiverTotals = indkomst.arbejdssteder.map((arbejdssted) =>
          formatCurrencyFromOre(arbejdssted.breakdown.samletOre)
        );
        if (indkomst.beregningsenhed === TAF_BEREGNES_SOM.ARBEJDSDAGE && indkomst.arbejdsdage) {
          const arbejdsdageText = indkomst.arbejdsdage.toLocaleString('da-DK');
          const basisText = arbejdsgiverTotals.length > 1
            ? `Dagsløn: (${arbejdsgiverTotals.join(' + ')}${NBSP}kr.) / ${arbejdsdageText} arbejdsdage =`
            : `Dagsløn: ${formatMoneyOreWithKr(indkomst.totalBreakdown.samletOre)} / ${arbejdsdageText} arbejdsdage =`;
          safeAddLeftRightText(
            basisText,
            renderMoneyWithKr(indkomst.dagsloen),
            writer.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );
        } else if (indkomst.maaneder) {
          const maanederText = formatMaanederTrimmed(indkomst.maaneder);
          const basisText = arbejdsgiverTotals.length > 1
            ? `Månedsløn (${arbejdsgiverTotals.join(' + ')}${NBSP}kr.) / ${maanederText} måneder =`
            : `Månedsløn: ${formatMoneyOreWithKr(indkomst.totalBreakdown.samletOre)} / ${maanederText} måneder =`;
          safeAddLeftRightText(
            basisText,
            renderMoneyWithKr(indkomst.maanedsloen),
            writer.getTextWidth('000.000.000,00'),
            { rightFontStyle: 'normal' }
          );
        }
      }
    } else if (indkomst?.beregnesUdFra === 'Angivet månedsløn') {
      if (indkomst.skadesdato) {
        const skadesdatoFormateret = formatDateShort(indkomst.skadesdato);
        if (skadesdatoFormateret) {
          const beloebDisplay = renderMoneyWithKr(indkomst.maanedsloen);

          let leftText = '';
          if (indkomst.loenBaseretPaa) {
            leftText = `Månedslønnen er på baggrund af ${indkomst.loenBaseretPaa} fastsat per ${skadesdatoFormateret} til`;
          } else {
            leftText = `Månedslønnen er fastsat per ${skadesdatoFormateret} til`;
          }

          safeAddLeftRightText(leftText, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'normal' });
        }
      }
    } else if (indkomst?.beregnesUdFra === 'Angivet dagsløn') {
      if (indkomst.skadesdato) {
        const skadesdatoFormateret = formatDateShort(indkomst.skadesdato);
        if (skadesdatoFormateret) {
          const beloebDisplay = renderMoneyWithKr(indkomst.dagsloen);

          let leftText = '';
          if (indkomst.loenBaseretPaa) {
            leftText = `Dagslønnen er på baggrund af ${indkomst.loenBaseretPaa} fastsat per ${skadesdatoFormateret} til`;
          } else {
            leftText = `Dagslønnen er fastsat per ${skadesdatoFormateret} til`;
          }

          safeAddLeftRightText(leftText, beloebDisplay, writer.getTextWidth('000.000.000,00'), { rightFontStyle: 'bold' });
        }
      }
    }

    // Indkomst, hvis skaden ikke var indtrådt
    const loenudvikling = model.tabtArbejdsfortjeneste.loenudvikling;
    const indkomstHvisSkadeIkkeIndtraadtBeskrivelse = loenudvikling?.loenudviklingLabel === 'Ingen'
      ? 'Opgøres på baggrund af lønnen på skadesdatoen.'
      : 'Opgøres som lønnen på skadesdatoen tillagt efterfølgende lønstigninger.';
    renderSubheaderWithWrappedText(
      'Indkomst, hvis skaden ikke var indtrådt',
      indkomstHvisSkadeIkkeIndtraadtBeskrivelse
    );

    if (loenudvikling) {
      if (loenudvikling.loenudviklingLabel !== 'Ingen') {
        safeAddWrappedText(`Lønudvikling beregnes ud fra ${loenudvikling.loenudviklingLabel}.`);
        writer.advanceY(lineHeight);
      }

      if (loenudvikling.loenudviklingTotal.status !== 'ok') {
        safeAddWrappedText('Lønudvikling kan ikke beregnes for den valgte opsætning.');
      } else {
        const rightMaxWidth = writer.getTextWidth('000.000.000,00');
        for (const segment of loenudvikling.beregnedeSegmenter) {
          const roundedDeltaPct = Math.round(segment.deltaPct * 100) / 100;
          const factorText = Math.abs(roundedDeltaPct) < 0.00001
            ? ''
            : ` x (100 % ${roundedDeltaPct >= 0 ? '+' : '-'} ${formatPercentDelta(roundedDeltaPct)} %)`;
          const fraDisplay = formatDateShort(segment.fra);
          const tilDisplay = formatDateShort(segment.til);
          let leftText = '';
          if (segment.kind === 'arbejdsdage') {
            const arbejdsdageText = segment.arbejdsdage.toLocaleString('da-DK');
            const dagsloenText = formatCurrencyFromOre(segment.dagsloenOre);
            leftText = `${fraDisplay} - ${tilDisplay}: ${arbejdsdageText} arbejdsdage á ${dagsloenText}${NBSP}kr.${factorText} =`;
          } else {
            const roundedMaaneder = Math.round(segment.maaneder * 10000) / 10000;
            const maanederText = formatMaanederTrimmed(roundedMaaneder);
            const maanedsloenText = formatCurrencyFromOre(segment.maanedsloenOre);
            leftText = `${fraDisplay} - ${tilDisplay}: ${maanederText} måneder á ${maanedsloenText}${NBSP}kr.${factorText} =`;
          }
          const rightText = formatMoneyOreWithKr(segment.amountOre);
          safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'normal' });
        }

        if (loenudvikling.beregnedeSegmenter.length > 1) {
          safeAddLeftRightText(
            'I alt',
            formatMoneyOreWithKr(loenudvikling.loenudviklingTotal.value),
            rightMaxWidth,
            { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
          );
        }
      }
    }

    // Indtægter i erstatningsperioden (TAF-perioden)
    const tafIndtaegter = model.tabtArbejdsfortjeneste.tafIndtaegter;
    if (tafIndtaegter) {
      assertModelInvariant(
        tafIndtaegter.total.status === 'ok' || tafIndtaegter.total.status === 'not_calculable',
        'tafIndtaegter.total har en uventet status.'
      );
      renderSubheader('Indtægter i erstatningsperioden', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      for (const entry of tafIndtaegter.entries) {
        safeAddLeftRightText(entry.label, formatMoneyOreWithKr(entry.amountOre), rightMaxWidth, { rightFontStyle: 'normal' }
        );
      }

      if (tafIndtaegter.entries.length === 0) {
        safeAddWrappedText('Ingen');
      } else if (tafIndtaegter.entries.length > 1 && tafIndtaegter.total.status === 'ok') {
        safeAddLeftRightText('I alt', formatMoneyOreWithKr(tafIndtaegter.total.value), rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      } else if (tafIndtaegter.entries.length > 1) {
        safeAddLeftRightText('I alt', '—', rightMaxWidth, { rightFontStyle: 'normal', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
        );
      }
    }

    const loenudviklingTotal = model.tabtArbejdsfortjeneste.loenudvikling?.loenudviklingTotal ?? null;
    const tafTotal = model.tabtArbejdsfortjeneste.tafIndtaegter?.total ?? null;
    if (loenudviklingTotal && tafTotal && loenudviklingTotal.status === 'ok' && tafTotal.status === 'ok') {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);

      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      const leftText = `${formatMoneyOreWithKr(loenudviklingTotal.value)} - ${formatMoneyOreWithKr(tafTotal.value)} =`;
      const rightText = formatMoneyOreWithKr(model.tabtArbejdsfortjeneste.tabtArbejdsfortjenesteOre);
      safeAddLeftRightText(leftText, rightText, rightMaxWidth, { rightFontStyle: 'bold' }
      );
    } else if (model.tabtArbejdsfortjeneste.harTafPerioder) {
      renderSubheader('Beregnet krav på tabt arbejdsfortjeneste', lineHeight);
      const rightMaxWidth = writer.getTextWidth('000.000.000,00');
      safeAddLeftRightText('Beregnet krav på tabt arbejdsfortjeneste', '—', rightMaxWidth, { rightFontStyle: 'bold' }
      );
    }
  }

  // Øvrige krav (chunked atomic blocks)
  const kravEntries = model.oevrigeKrav.entries;
  const kravIndentX = MARGINS.left;
  const kravPageWidth = writer.getPageWidth();
  const kravRightX = kravPageWidth - MARGINS.right;
  const kravTotalMaxWidth = writer.getTextWidth('000.000.000,00');
  const kravRightMaxWidth = kravTotalMaxWidth;
  const kravLeftMaxWidth = Math.max(30, kravRightX - kravTotalMaxWidth - kravIndentX - 5);
  const kravHeaderHeight = lineHeight * 4;

  if (kravEntries.length === 0) {
    renderSectionHeader('Øvrige krav', lineHeight);
    safeAddWrappedText('Ingen');
  } else {
    renderAtomicTableChunks({
      rows: kravEntries,
      estimateRowHeight: lineHeight,
      headerHeight: kravHeaderHeight,
      renderHeader: () => {
        renderSectionHeader('Øvrige krav', lineHeight);
      },
      renderRow: (entry) => {
        const udgiftText = entry.udgiftTil !== '' ? entry.udgiftTil : '-';
        const leftLabel = entry.dateText !== '' ? `${entry.dateText}: ${udgiftText}` : udgiftText;
        const amountText = formatMoneyOreWithKr(entry.amountOre);
        const leftText = writer.fitTextToWidth(
          ensureNonBreakingKr(leftLabel),
          kravLeftMaxWidth
        );
        writer.writeLeftRightTextSingleLine(leftText, amountText, { rightFontStyle: kravEntries.length === 1 ? 'bold' : 'normal' }
        );
      },
    });

    if (kravEntries.length > 1) {
      writer.addSpacer(lineHeight * 2);
      safeAddLeftRightText('I alt', formatMoneyOreWithKr(model.oevrigeKrav.totalOre), kravRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
      );
    }
  }
  renderSectionHeader('Samlet erstatningskrav', lineHeight);

  const periodeFraKort = model.periode?.fra ? formatDateShort(model.periode.fra) : '';
  const periodeTilKort = model.periode?.til ? formatDateShort(model.periode.til) : '';
  const periodeText =
    periodeFraKort && periodeTilKort
      ? `Det samlede krav for perioden ${periodeFraKort} - ${periodeTilKort} udgør:`
      : 'Det samlede krav udgør:';
  safeAddWrappedText(periodeText);
  writer.advanceY(lineHeight);

  const summaryRightMaxWidth = writer.getTextWidth('000.000.000,00');
  safeAddLeftRightText('Svie- og smertegodtgørelse', formatMoneyOreWithKr(model.samlet.svieSmerteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' }
  );
  safeAddLeftRightText('Tabt arbejdsfortjeneste', formatMoneyOreWithKr(model.samlet.tabtArbejdsfortjenesteOre), summaryRightMaxWidth, { rightFontStyle: 'normal' }
  );
  safeAddLeftRightText('Øvrige krav', formatMoneyOreWithKr(model.samlet.oevrigeKravOre), summaryRightMaxWidth, { rightFontStyle: 'normal' }
  );
  writer.setFont('helvetica', 'bold');
  safeAddLeftRightText('Erstatningskrav i alt', formatMoneyOreWithKr(model.samlet.totalOre), summaryRightMaxWidth, { rightFontStyle: 'bold', lineAboveRightWidth: 33.125, lineAboveRightOffset: 4 }
  );
  writer.setFont('helvetica', 'normal');
  const saerligeKommentarer = model.saerligeKommentarer;
  if (saerligeKommentarer) {
    renderSectionHeader('Særlige bemærkninger', lineHeight);
    safeAddWrappedText(saerligeKommentarer);
  }
  writer.advanceY(doubleLineHeight);
  if (afsluttesMed === 'Bekræftet godkendt') {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som har bekræftet, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.');
  } else {
    safeAddWrappedText('Opgørelsen er gennemgået af skadelidte, som ved sin underskrift nedenfor bekræfter, at oplysningerne er korrekte og retvisende, samt at erstatningskravene er opgjort i overensstemmelse med samtlige relevant oplysninger, som skadelidte er bekendt med.');
    writer.advanceY(lineHeight * 2);
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim() || '*skadelidtes navn*';
    const dateX = MARGINS.left;
    const dateLine = '____ / ____ - ____________';
    const sigX = MARGINS.left + 90;
    const sigLine = '________________________________________';
    writer.writeSignatureBlock(dateLine, sigLine, dateX, sigX, skadelidteNavn);
  }

  if (selectedElements.loenindkomst) {
    const formatAmountCell = (value: AarsloenTableRow['col2']): string => amountValueToDisplayString(value, 2);

    const renderLoenindkomstTable = (
      ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
    ) => {
      const hasNonZeroAmount = (value: AarsloenTableRow['col2']): boolean => {
        const numeric = amountValueToNumber(value);
        return numeric !== undefined && Math.abs(numeric) > 0.000001;
      };

      const rows = (ansaettelsesforhold.indtaegtsoplysningerTableData ?? []).filter((row) => {
        if (isAarsloenRowEffectivelyEmpty(row)) return false;
        const hasAnyIncomeInput =
          hasNonZeroAmount(row.col2) ||
          hasNonZeroAmount(row.col3) ||
          hasNonZeroAmount(row.col4) ||
          hasNonZeroAmount(row.col5);
        return hasAnyIncomeInput;
      });
      if (rows.length === 0) {
        safeAddWrappedText('Ingen rækker i indtægtsoplysninger.');
        return;
      }

      const allHeaders = getLoenindkomstTableHeaders(ansaettelsesforhold.loenperiode);
      const inputColumnDefs = [
        { index: 2, key: 'col2' as const },
        { index: 3, key: 'col3' as const },
        { index: 4, key: 'col4' as const },
        { index: 5, key: 'col5' as const },
      ];
      const visibleInputColumns = inputColumnDefs.filter((column) =>
        rows.some((row) => hasNonZeroAmount(row[column.key]))
      );
      const headers = [
        allHeaders[0],
        allHeaders[1],
        ...visibleInputColumns.map((column) => allHeaders[column.index]),
        allHeaders[6],
        allHeaders[7],
        allHeaders[8],
        allHeaders[9],
      ];
      const satser = {
        feriePct: ansaettelsesforhold.feriePct,
        fritvalgPct: ansaettelsesforhold.fritvalgPct,
        shSoPct: ansaettelsesforhold.shSoPct,
        storeBededagPct: ansaettelsesforhold.storeBededagPct,
        pensionPct: ansaettelsesforhold.pensionPct,
      };

      const tableRows: RowInput[] = [
        headers.map((header) => ({
          content: header,
          styles: { fontStyle: 'bold', halign: 'center' as const },
        })),
      ];

      for (const row of rows) {
        const [col0, col1] = resolvePeriodColumns(row, ansaettelsesforhold.loenperiode);
        const derived = calculateAarsloenRowDerived(row, satser);
        const rowValues = [
          col0,
          col1,
          ...visibleInputColumns.map((column) => formatAmountCell(row[column.key])),
          formatAsAmount(derived.ferieberet, 2),
          formatAsAmount(derived.fpFvShSo, 2),
          formatAsAmount(derived.pension, 2),
          formatAsAmount(derived.samlet, 2),
        ];
        tableRows.push(
          rowValues.map((value, index) => ({
            content: value,
            styles: { halign: index < 2 ? 'center' : 'right' as const },
          }))
        );
      }

      const doc = writer.getDoc();
      const columnCount = headers.length;
      const defaultCellWidth = Math.min(22, Math.max(13, 170 / columnCount));
      const columnStyles = Object.fromEntries(
        Array.from({ length: columnCount }, (_, index) => [index, { cellWidth: defaultCellWidth }])
      );
      const finalY = renderStandardPdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
        columnStyles,
      });
      writer.setY(finalY + lineHeight);
    };

    startBilagPage('Lønindkomst');

    const ansaettelser = eoValues.loenindkomstAnsaettelsesforhold ?? [];
    if (ansaettelser.length === 0) {
      safeAddWrappedText('Ingen ansættelsesforhold.');
    } else {
      for (const [index, ansaettelsesforhold] of ansaettelser.entries()) {
        const fallbackNavn = `Ansættelsesforhold ${index + 1}`;
        const arbejdsstedNavn = ansaettelsesforhold.navnPaaArbejdssted?.trim() || fallbackNavn;
        renderSubheader(arbejdsstedNavn, lineHeight, { addTopSpacing: index > 0 });
        writer.addSpacer(lineHeight);
        writeLabelValueLine(
          'Ansat på skadestidspunktet',
          formatJaNej(ansaettelsesforhold.ansatPaaSkadestidspunktet)
        );
        writeLabelValueLine(
          'Medlem opsagt',
          (() => {
            const isOpsagt = ansaettelsesforhold.ansaettelsesforholdOphoert;
            if (!isOpsagt) return 'Nej';
            const sidsteArbejdsdag = formatDateLong(ansaettelsesforhold.sidsteArbejdsdag);
            if (!sidsteArbejdsdag) return 'Ja';
            return `Ja, sidste arbejdsdag ${sidsteArbejdsdag}`;
          })()
        );
        writer.addSpacer(lineHeight);
        if (!isZeroPct(ansaettelsesforhold.feriePct)) {
          writeLabelValueLine('Feriegodtgørelse/-tillæg:', formatPctFromInput(ansaettelsesforhold.feriePct));
        }
        if (!isZeroPct(ansaettelsesforhold.fritvalgPct)) {
          writeLabelValueLine('Fritvalg:', formatPctFromInput(ansaettelsesforhold.fritvalgPct));
        }
        if (!isZeroPct(ansaettelsesforhold.shSoPct)) {
          writeLabelValueLine('SH/SO-sats:', formatPctFromInput(ansaettelsesforhold.shSoPct));
        }
        if (!isZeroPct(ansaettelsesforhold.storeBededagPct)) {
          writeLabelValueLine('Store Bededagstillæg:', formatPctFromInput(ansaettelsesforhold.storeBededagPct));
        }
        if (!isZeroPct(ansaettelsesforhold.pensionPct)) {
          writeLabelValueLine('Arbejdsgivers pensionsbidrag:', formatPctFromInput(ansaettelsesforhold.pensionPct));
        }
        writer.addSpacer(lineHeight);
        renderLoenindkomstTable(ansaettelsesforhold);
      }
    }
  }

  if (selectedElements.offentligeYdelser) {
    const isOffentligeYdelserRowEmpty = (row: OffentligeYdelserRow): boolean => {
      return (
        (row.fraDato?.trim() ?? '') === '' &&
        (row.tilDato?.trim() ?? '') === '' &&
        row.ydelse === undefined &&
        row.tillaeg === undefined &&
        (row.ydelsestype?.trim() ?? '') === ''
      );
    };

    const renderOffentligeYdelserTable = () => {
      const rows = (eoValues.offentligeYdelserRows ?? []).filter((row) => !isOffentligeYdelserRowEmpty(row));
      if (rows.length === 0) {
        safeAddWrappedText('Ingen rækker i offentlige ydelser.');
        return;
      }

      const tableRows: RowInput[] = [
        OFFENTLIGE_YDELSER_HEADERS.map((header) => ({
          content: header,
          styles: { fontStyle: 'bold', halign: 'center' as const },
        })),
      ];

      for (const row of rows) {
        const ydelsestypeKey = row.ydelsestype?.trim() ?? '';
        const ydelsestypeLabel = ydelsestypeKey ? (ydelsestyper[ydelsestypeKey]?.label ?? ydelsestypeKey) : '';
        const ydelseValue = amountValueToNumber(row.ydelse) ?? 0;
        const tillaegValue = amountValueToNumber(row.tillaeg) ?? 0;
        const samletValue = ydelseValue + tillaegValue;
        const samletDisplay =
          row.ydelse !== undefined || row.tillaeg !== undefined
            ? formatAsAmount(samletValue, 2)
            : '';
        const rowValues = [
          row.fraDato?.trim() ?? '',
          row.tilDato?.trim() ?? '',
          amountValueToDisplayString(row.ydelse, 2),
          amountValueToDisplayString(row.tillaeg, 2),
          samletDisplay,
          ydelsestypeLabel,
        ];
        tableRows.push(
          rowValues.map((value, index) => {
            const halign: 'center' | 'left' | 'right' =
              index <= 1 ? 'center' : 'right';
            return {
              content: value,
              styles: { halign },
            };
          })
        );
      }

      const doc = writer.getDoc();
      const columnStyles = {
        0: { cellWidth: 29 },
        1: { cellWidth: 29 },
        2: { cellWidth: 29 },
        3: { cellWidth: 29 },
        4: { cellWidth: 29 },
        5: { cellWidth: 29 },
      };

      const finalY = renderStandardPdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
        columnStyles,
      });

      writer.setY(finalY + lineHeight);
    };

    startBilagPage('Offentlige ydelser');
    renderSubheader('Ydelser fra offentlige myndigheder, herunder midlertidigt erhvervsevnetab.', lineHeight, { addTopSpacing: false });
    writer.addSpacer(lineHeight);
    renderOffentligeYdelserTable();
  }

  if (selectedElements.shDage) {
    const formatRangeLong = (fra: ISODateString | undefined, til: ISODateString | undefined): string => {
      const fraDisplay = formatDateLong(fra);
      const tilDisplay = formatDateLong(til);
      return `${fraDisplay || '-'} - ${tilDisplay || '-'}`;
    };

    const renderShDageTable = (rows: readonly SHDageTableRow[]) => {
      const antalShDage = rows.filter((row) => row.erSHDag).length;
      const tableRows: RowInput[] = [
        [
          { content: 'Ugedag', styles: { fontStyle: 'bold', halign: 'left' } },
          { content: 'Dato', styles: { fontStyle: 'bold', halign: 'left' } },
          { content: 'Helligdag', styles: { fontStyle: 'bold', halign: 'left' } },
          { content: 'SH-dag', styles: { fontStyle: 'bold', halign: 'center' } },
        ],
      ];

      for (const row of rows) {
        tableRows.push([
          { content: row.ugedag, styles: { halign: 'left' } },
          { content: row.datoDisplay, styles: { halign: 'left' } },
          { content: row.helligdagNavn, styles: { halign: 'left' } },
          { content: row.erSHDag ? 'x' : '', styles: { halign: 'center' } },
        ]);
      }

      tableRows.push([
        { content: 'SH-dage i alt', styles: { fontStyle: 'bold', halign: 'left', fillColor: false } },
        { content: '', styles: { fontStyle: 'bold', fillColor: false } },
        { content: '', styles: { fontStyle: 'bold', fillColor: false } },
        { content: String(antalShDage), styles: { fontStyle: 'bold', halign: 'center', fillColor: false } },
      ]);

      const doc = writer.getDoc();
      const finalY = renderStandardPdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 'auto' },
          3: { cellWidth: 25 },
        },
        transparentRowIndices: [tableRows.length - 1],
      });
      writer.setY(finalY + lineHeight);
    };

    startBilagPage('SH-dage');

    safeAddWrappedText('Søgnehelligdage er helligdage, der falder på hverdage (mandag-fredag).');
    writer.addSpacer(lineHeight);

    if (eoValues.beregnesUdFra === 'Beregningsperiode') {
      writer.addSpacer(lineHeight);
      renderSubheader('Beregningsperiode', lineHeight, { addTopSpacing: false });
      safeAddWrappedText(formatRangeLong(eoValues.periodeTilBeregningFra, eoValues.periodeTilBeregningTil));
      writer.addSpacer(lineHeight);
      const beregningsperiodeHelligdage = findHelligdageInRange(eoValues.periodeTilBeregningFra, eoValues.periodeTilBeregningTil);
      if (beregningsperiodeHelligdage.length === 0) {
        safeAddWrappedText('Ingen helligdage');
        writer.addSpacer(lineHeight * 2);
      } else {
        renderShDageTable(beregningsperiodeHelligdage);
        writer.addSpacer(lineHeight);
      }
    }

    renderSubheader('Erstatningsperiode', lineHeight, { addTopSpacing: false });
    safeAddWrappedText(formatRangeLong(eoValues.vedroererPeriodeFra, eoValues.vedroererPeriodeTil));
    writer.addSpacer(lineHeight);
    const erstatningsperiodeHelligdage = findHelligdageInRange(eoValues.vedroererPeriodeFra, eoValues.vedroererPeriodeTil);
    if (erstatningsperiodeHelligdage.length === 0) {
      safeAddWrappedText('Ingen helligdage');
    } else {
      renderShDageTable(erstatningsperiodeHelligdage);
    }
  }

  // Tilføj footer med versionsnummer
  if (selectedElements.regulering) {

    const renderReguleringIndeksTable = (rows: readonly ReguleringIndexRow[]) => {
      if (rows.length === 0) {
        safeAddWrappedText('Ingen reguleringsrækker i perioden.');
        return;
      }

      const tableRows: RowInput[] = [
        [
          { content: 'Fra-dato', styles: { fontStyle: 'bold', halign: 'center' } },
          { content: 'Til-dato', styles: { fontStyle: 'bold', halign: 'center' } },
          { content: 'Indeksberegning', styles: { fontStyle: 'bold', halign: 'center' } },
          { content: 'Indeks', styles: { fontStyle: 'bold', halign: 'center' } },
        ],
      ];

      for (const row of rows) {
        tableRows.push([
          { content: row.fraDato, styles: { halign: 'center' } },
          { content: row.tilDato, styles: { halign: 'center' } },
          { content: row.indeksberegning, styles: { halign: 'right' } },
          { content: row.indeks, styles: { halign: 'right' } },
        ]);
      }

      const doc = writer.getDoc();
      const finalY = renderStandardPdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
      });
      writer.setY(finalY + lineHeight);
    };

    const renderReguleringsvaerdierTable = (
      rows: ReadonlyArray<Readonly<{ venstre: string; hoejre: string }>>
    ) => {
      if (rows.length === 0) {
        safeAddWrappedText('Ingen reguleringsværdier.');
        return;
      }

      const tableRows: RowInput[] = [
        [
          { content: 'År', styles: { fontStyle: 'bold', halign: 'center' } },
          { content: 'Maksimum årsløn', styles: { fontStyle: 'bold', halign: 'center' } },
        ],
        ...rows.map((row) => [
          { content: row.venstre, styles: { halign: 'center' as const } },
          { content: row.hoejre, styles: { halign: 'right' as const } },
        ]),
      ];

      const doc = writer.getDoc();
      const finalY = renderStandardPdfTable({
        doc,
        startY: writer.getY(),
        body: tableRows,
      });
      writer.setY(finalY + lineHeight);
    };

    const foersteAnsaettelsesforhold = eoValues.loenindkomstAnsaettelsesforhold?.[0];
    startBilagPage('Regulering');

    if (!foersteAnsaettelsesforhold) {
      safeAddWrappedText('Ingen ansættelsesforhold.');
    } else {
      const tafBounds = resolveTafDateBounds(eoValues);
      writeLabelValueLine(
        'Første dato i TAF-periode',
        tafBounds ? formatDateShort(tafBounds.foerste) : ''
      );
      writeLabelValueLine(
        'Sidste dato i TAF-periode',
        tafBounds ? formatDateShort(tafBounds.sidste) : ''
      );
      writer.addSpacer(lineHeight);

      const underoverskrift = foersteAnsaettelsesforhold.navnPaaArbejdssted?.trim() || 'Ansættelsesforhold 1';
      renderSubheader(underoverskrift, lineHeight, { addTopSpacing: false });
      writer.addSpacer(lineHeight);

      const valgtRegulering = (() => {
        const grundlag = foersteAnsaettelsesforhold.loenudviklingBeregningsgrundlag;
        if (!grundlag) return '-';
        if (grundlag === 'Statistik') return foersteAnsaettelsesforhold.loenudviklingStatistikModel?.trim() || '-';
        if (grundlag === 'Overenskomst') return foersteAnsaettelsesforhold.overenskomstId?.trim() || '-';
        if (grundlag === 'Manuelt angivet') return 'Manuelt angivet';
        return 'Ingen';
      })();

      const reguleringsdato = resolveReguleringsdato(stamdataValues, eoValues, foersteAnsaettelsesforhold);
      writeLabelValueLine('Valgt regulering', valgtRegulering);
      writeLabelValueLine(
        'Reguleringsdato (Skadesdato)',
        formatDateShort(reguleringsdato)
      );
      writer.addSpacer(lineHeight);
      safeAddWrappedText('Reguleringsværdier:');
      writer.addSpacer(lineHeight);

      const reguleringsvaerdierRows =
        tafBounds
          ? buildReguleringsvaerdierRows(
              reguleringsdato,
              tafBounds.foerste,
              tafBounds.sidste,
              foersteAnsaettelsesforhold.loenudviklingStatistikModel
            )
          : [];
      renderReguleringsvaerdierTable(reguleringsvaerdierRows);

      writer.addSpacer(lineHeight);
      safeAddWrappedText('Beregnet regulering');
      writer.addSpacer(lineHeight);

      const reguleringTableRows =
        tafBounds
          ? buildReguleringIndexRows({
              eoValues,
              reguleringsdato,
              tafFra: tafBounds.foerste,
              tafTil: tafBounds.sidste,
              statistikModel: foersteAnsaettelsesforhold.loenudviklingStatistikModel,
            })
          : [];
      renderReguleringIndeksTable(reguleringTableRows);
    }
  }

  writer.addFooter();

  // Download PDF
  writer.save(`${titel}.pdf`);
};


