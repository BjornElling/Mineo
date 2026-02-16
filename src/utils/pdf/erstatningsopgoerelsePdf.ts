/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import autoTable, { type CellHookData, type RowInput } from 'jspdf-autotable';
import { COLORS, FONT_SIZES, MARGINS, TABLE_STYLES } from './pdfConfig';
import { type BrevhovedData } from './pdfHelpers';
import { createPdfWriter, type PdfWriter, ensureNonBreakingKr } from './pdfWriter';
import type { ISODateString } from '../../types/branded';
import { isoToDanish, subtractOneDay } from '../../types/branded';
import type { AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode, OffentligeYdelserRow, StamdataValues } from '../../schemas/formSchemas';
import { buildErstatningsopgoerelsePdfModel, type MoneyOre, type Calculable, type LoenudviklingSegment } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { getAngivetLoenOpreguleresFraDato, resolveLoenudviklingKilde } from '../../domain/erstatningsopgoerelse/angivetLoenHelpers';
import { formatAsAmount, formatCurrency, formatPercent, parseAmount } from '../formatUtils';
import { parseISODate } from '../../types/branded';
import { TAF_BEREGNES_SOM, type TafBeregningsenhed } from '../../domain/erstatningsopgoerelse/tafBeregningsenhed';
import { TODAY } from '../../config/dateRanges';
import { amountValueToDisplayString, amountValueToNumber } from '../expressionAmount';
import { isAarsloenRowEffectivelyEmpty } from '../aarsloenTableCalculations';
import { ydelsestyper } from '../../data/ydelsestyper';

import { aarsloenMax } from '../../data/regulationRates';
import {
  getEffektiveSatserForDato,
  getEffektiveSatserForPeriode,
  getGrundloenAngivetPerForOverenskomst,
  getOverenskomst,
  getOverenskomstMetaById,
  getOffentligOverenskomstTypeById,
  resolveOverenskomstRef,
} from '../../data/overenskomstRates';
import { getOffentligLoenForDato, getOffentligLoenForPeriode } from '../../data/offentligLoenLookup';
import { resolveOffentligLoenTypeFromLabel, toLoentrin, type Loengruppe } from '../../data/offentligLoenTypes';
import { getStatistiskLoenudvikling } from '../../data/statistiskLoenudviklingRates';
import { formatKRLSatstabelDisplay, getKRLSatstabel, isKRLSatstabelId, type KRLSatstabelId } from '../../data/KRLrates';
import { clampTafRow, resolveTafConstraintBounds } from '../../domain/erstatningsopgoerelse/tafPeriodConstraints';
import { buildBeregningsperiodeRange, buildIncomeForRanges, buildTafRanges, parseAarsloenRowInterval } from '../../domain/erstatningsopgoerelse/indtaegtPerioder';
import { erDetteFoersteErstatningsopgoerelse } from '../../domain/erstatningsopgoerelse/eoNummerValidering';
import {
  STORE_BEDEDAG_START,
  STORE_BEDEDAG_PCT,
  convertAnciennitetSats,
  resolveReguleringsdato as resolveReguleringsdatoShared,
  resolveStatistikModelId,
  parseOptionalIsoDate as parseOptionalIsoDateShared,
  parseDanishToIso as parseDanishToIsoShared,
  formatDateShort as formatDateShortShared,
  formatDateLong as formatDateLongShared,
  formatPercentFixed2 as formatPercentFixed2Shared,
  roundToTwoDecimals,
} from '../../domain/erstatningsopgoerelse/sharedPdfUtils';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatPercentDelta,
  isSingularCount,
  resolvePdfFileName,
} from './sharedPdfUtils';
import { maxISO, minISO } from '../isoDateHelpers';
import type { SelectedElements } from './erstatningsopgoerelse/types';
import { assertNoUnsupportedSygeferiegodtgoerelseSelection } from './erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection';
import { renderLoenindkomstSection } from './erstatningsopgoerelse/sections/loenindkomstSection';
import { renderOffentligeYdelserSection } from './erstatningsopgoerelse/sections/offentligeYdelserSection';
import { renderShDageSection } from './erstatningsopgoerelse/sections/shDageSection';
import { renderReguleringSection } from './erstatningsopgoerelse/sections/reguleringSection';
import { renderOpgorelseSection } from './erstatningsopgoerelse/sections/opgoerelseSection';

const NBSP = '\u00A0';
const EO_RIGHT_COLUMN_WIDTH = 33.125;
const CSS_PIXELS_PER_INCH = 96;
const MILLIMETERS_PER_INCH = 25.4;
const EO_LEFT_WRAP_EXTRA_WIDTH_PX = 50;
const EO_LEFT_WRAP_EXTRA_WIDTH_MM = (EO_LEFT_WRAP_EXTRA_WIDTH_PX * MILLIMETERS_PER_INCH) / CSS_PIXELS_PER_INCH;

const renderMoney = (value: Calculable<MoneyOre>): string => {
  return value.status === 'ok' ? formatCurrencyFromOre(value.value) : '—';
};

const renderMoneyWithKr = (value: Calculable<MoneyOre>): string => {
  const rendered = renderMoney(value);
  return rendered === '—' ? '—' : `${rendered}${NBSP}kr.`;
};

const renderMoneyWithKrOrError = (value: Calculable<MoneyOre>): string => {
  if (value.status === 'ok') return `${formatCurrencyFromOre(value.value)}${NBSP}kr.`;
  return `Fejl (${value.reason})`;
};

/** Formaterer øre-beløb uden decimaler når de er ,00 */
const formatCurrencyFromOreTrimmed = (ore: MoneyOre): string => {
  const formatted = formatCurrencyFromOre(ore);
  return formatted.endsWith(',00') ? formatted.slice(0, -3) : formatted;
};

const renderMoneyWithKrTrimmed = (value: Calculable<MoneyOre>): string => {
  if (value.status !== 'ok') return '—';
  return `${formatCurrencyFromOreTrimmed(value.value)}${NBSP}kr.`;
};

const formatMoneyOreWithKrTrimmed = (ore: MoneyOre): string => `${formatCurrencyFromOreTrimmed(ore)}${NBSP}kr.`;

const isLoengruppe = (value: number): value is Loengruppe =>
  Number.isInteger(value) && value >= 0 && value <= 4;

const formatJaNej = (value: boolean): string => (value ? 'Ja' : 'Nej');

const formatPctFromInput = (value: number | undefined): string => {
  return `${(value ?? 0).toLocaleString('da-DK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
};

const isZeroPct = (value: number | undefined): boolean => Math.abs(value ?? 0) < 0.000001;
const capitalizeFirstChar = (value: string): string => {
  if (value.length === 0) return value;
  return `${value.charAt(0).toLocaleUpperCase('da-DK')}${value.slice(1)}`;
};

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

type ReguleringIndexRow = Readonly<{
  fraDato: string;
  tilDato: string;
  indeksberegning: string;
  indeks: string;
  loenudvikling: string;
}>;

type ReguleringValuesTableData = Readonly<{
  columns: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string>>;
}>;

type FormulaComponents = Readonly<{
  baseValue: number;
  feriePct: number;
  fritvalgPct: number;
  shSoPct: number;
  pensionPct: number;
  storeBededagPct: number;
}>;

type FormulaVisibility = Readonly<{
  showFritvalg: boolean;
  showShSo: boolean;
  showPension: boolean;
  showStoreBededag: boolean;
}>;

// STORE_BEDEDAG_START og STORE_BEDEDAG_PCT importeret fra sharedPdfUtils

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
        data.cell.styles.valign = 'bottom';
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

const parseIsoDateToUtcDate = (iso: ISODateString | undefined): Date | null => {
  if (!iso) return null;
  return parseISODate(iso) ?? null;
};

const parseOptionalIsoDate = parseOptionalIsoDateShared;

type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
type IsoRange = Readonly<{ fra: ISODateString; til: ISODateString }>;

// Overlap er inklusiv begge endepunkter.
const isIsoRangeOverlap = (a: IsoRange, b: IsoRange): boolean => a.fra <= b.til && b.fra <= a.til;

export const buildBilagIndkomstYdelserRanges = (
  eoValues: ErstatningsopgoerelseValues,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar
): readonly IsoRange[] => {
  if (mode === 'Alle') return [];
  // "Perioden" skal følge de aktuelle TAF-perioder (clampet til gældende bounds).
  // Hvis der ingen TAF-perioder er, returneres tom liste.
  return buildTafRanges(eoValues);
};

const shouldIncludeByBilagRanges = (
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[],
  rowRange: IsoRange | null
): boolean => {
  // NOTE: Fail-closed by design.
  // Rækker uden gyldigt dato-interval medtages aldrig i PDF-bilag.
  if (!rowRange) return false;
  if (mode === 'Alle') return true;
  // NOTE: Fail-closed by design.
  // Når "Perioden" er valgt uden gyldige bilag-ranges, medtages ingen rækker.
  if (ranges.length === 0) return false;
  return ranges.some((range) => isIsoRangeOverlap(rowRange, range));
};

export const hasAarsloenRowOverlapWithRanges = (
  row: AarsloenTableRow,
  loenperiode: Loenperiode,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[]
): boolean => {
  const interval = parseAarsloenRowInterval(row, loenperiode);
  if (!interval) return shouldIncludeByBilagRanges(mode, ranges, null);
  const fra = parseOptionalIsoDate(
    `${interval.start.getUTCFullYear()}-${String(interval.start.getUTCMonth() + 1).padStart(2, '0')}-${String(interval.start.getUTCDate()).padStart(2, '0')}`
  );
  const til = parseOptionalIsoDate(
    `${interval.end.getUTCFullYear()}-${String(interval.end.getUTCMonth() + 1).padStart(2, '0')}-${String(interval.end.getUTCDate()).padStart(2, '0')}`
  );
  if (!fra || !til || fra > til) return shouldIncludeByBilagRanges(mode, ranges, null);
  const rowRange: IsoRange = { fra, til };
  return shouldIncludeByBilagRanges(mode, ranges, rowRange);
};

export const hasOffentligYdelseRowOverlapWithRanges = (
  row: OffentligeYdelserRow,
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar,
  ranges: readonly IsoRange[]
): boolean => {
  const fra = parseDanishToISO(row.fraDato);
  const til = parseDanishToISO(row.tilDato);
  if (!fra || !til || fra > til) return shouldIncludeByBilagRanges(mode, ranges, null);
  const rowRange: IsoRange = { fra, til };
  return shouldIncludeByBilagRanges(mode, ranges, rowRange);
};

const isOffentligeYdelserRowEmpty = (row: OffentligeYdelserRow): boolean => {
  return (
    (row.fraDato?.trim() ?? '') === '' &&
    (row.tilDato?.trim() ?? '') === '' &&
    row.ydelse === undefined &&
    row.tillaeg === undefined &&
    (row.ydelsestype?.trim() ?? '') === ''
  );
};

const hasNonZeroLoenAmount = (value: AarsloenTableRow['col2']): boolean => {
  const numeric = amountValueToNumber(value);
  return numeric !== undefined && Math.abs(numeric) > 0.000001;
};

export const shouldIncludeLoenRowInBilag = (params: Readonly<{
  row: AarsloenTableRow;
  loenperiode: Loenperiode;
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar;
  ranges: readonly IsoRange[];
  errorRowIds: ReadonlySet<string>;
}>): boolean => {
  const { row, loenperiode, mode, ranges, errorRowIds } = params;
  if (isAarsloenRowEffectivelyEmpty(row)) return false;
  // NOTE: Fail-closed by design.
  // PDF må kun vise rækker uden valideringsfejl.
  if (errorRowIds.has(row.id)) return false;
  const hasAnyIncomeInput =
    hasNonZeroLoenAmount(row.col2) ||
    hasNonZeroLoenAmount(row.col3) ||
    hasNonZeroLoenAmount(row.col4) ||
    hasNonZeroLoenAmount(row.col5);
  if (!hasAnyIncomeInput) return false;
  return hasAarsloenRowOverlapWithRanges(row, loenperiode, mode, ranges);
};

export const shouldIncludeOffentligYdelseRowInBilag = (params: Readonly<{
  row: OffentligeYdelserRow;
  mode: BilagLoenindkomstOgOffentligeYdelserIndgaar;
  ranges: readonly IsoRange[];
  errorRowIds: ReadonlySet<string>;
}>): boolean => {
  const { row, mode, ranges, errorRowIds } = params;
  if (isOffentligeYdelserRowEmpty(row)) return false;
  // NOTE: Fail-closed by design.
  // PDF må kun vise rækker uden valideringsfejl.
  if (errorRowIds.has(row.id)) return false;
  // NOTE: Besluttet UX-semantik.
  // Offentlige ydelser uden beløb (men med gyldig periode/type) vises i bilaget.
  return hasOffentligYdelseRowOverlapWithRanges(row, mode, ranges);
};

export const shouldIncludeReguleringBilag = (
  eoValues: ErstatningsopgoerelseValues
): boolean => {
  if (eoValues.beregnesUdFra === 'Beregningsperiode') {
    const beregningsperiodeRange = buildBeregningsperiodeRange(eoValues);
    if (!beregningsperiodeRange) return true;

    const income = buildIncomeForRanges(eoValues, [beregningsperiodeRange]);
    const employerIdsWithIncome = new Set(income.employers.map((entry) => entry.id));
    const reguleringskilder = resolveLoenudviklingKilde(eoValues);
    const kilderMedIndkomst = reguleringskilder.filter((kilde) => employerIdsWithIncome.has(kilde.id));
    if (kilderMedIndkomst.length === 0) return true;
    const alleIngen = kilderMedIndkomst.every((kilde) => kilde.loenudviklingBeregningsgrundlag === 'Ingen');
    return !alleIngen;
  }

  if (eoValues.beregnesUdFra === 'Angivet månedsløn' || eoValues.beregnesUdFra === 'Angivet dagsløn') {
    return eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag !== 'Ingen';
  }

  return true;
};

const resolveReguleringTableStartIso = (
  reguleringsdato: ISODateString | undefined,
  tafFra: ISODateString
): ISODateString => {
  if (!reguleringsdato) return tafFra;
  return reguleringsdato < tafFra ? reguleringsdato : tafFra;
};

const resolveTafDateBounds = (
  eoValues: ErstatningsopgoerelseValues
): Readonly<{ foerste: ISODateString; sidste: ISODateString }> | null => {
  const tafBounds = resolveTafConstraintBounds(eoValues);

  let foerste: ISODateString | undefined;
  let sidste: ISODateString | undefined;

  for (const row of eoValues.tafPerioder ?? []) {
    const clamped = clampTafRow(row, tafBounds);
    if (!clamped) continue;
    foerste = foerste ? minISO(foerste, clamped.fra) : clamped.fra;
    sidste = sidste ? maxISO(sidste, clamped.til) : clamped.til;
  }

  if (!foerste || !sidste) return null;
  return { foerste, sidste };
};

const resolveReguleringsdato = (
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): ISODateString | undefined => resolveReguleringsdatoShared({
  beregnesUdFra: eoValues.beregnesUdFra,
  angivetLoenMetodeOpreguleresFraDato: getAngivetLoenOpreguleresFraDato(eoValues),
  saerligFraDatoRegulering: ansaettelsesforhold.saerligFraDatoRegulering,
  skadesdato: stamdataValues.skadesdato,
});

const resolveLoenSkadesdatoText = (params: {
  subject: 'lønnen';
  skadesdato: ISODateString | undefined;
  saerligFraDatoRegulering: ISODateString | undefined;
}): string => {
  const { subject, skadesdato, saerligFraDatoRegulering } = params;
  if (saerligFraDatoRegulering && skadesdato && saerligFraDatoRegulering !== skadesdato) {
    const formatted = formatDateLong(saerligFraDatoRegulering);
    if (formatted) {
      return `${subject} opgjort per ${formatted}`;
    }
  }
  return `${subject} på skadesdatoen`;
};

const parseDanishToISO = parseDanishToIsoShared;

const resolveStatistikModelIdFromLabel = resolveStatistikModelId;

const formatOverenskomstPercent = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  const pct = Math.round(value * 10000) / 100;
  return formatPercent(pct);
};

const formatOverenskomstAmount = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return formatCurrency(value);
};

const detectDecimalPlaces = (values: readonly number[], maxPlaces = 4): number => {
  let max = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    let places = 0;
    for (; places < maxPlaces; places += 1) {
      const scaled = value * 10 ** places;
      if (Math.abs(scaled - Math.round(scaled)) < 1e-9) break;
    }
    if (places > max) max = places;
  }
  return max;
};

const percentFromDecimal = (value: number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10000) / 100;
};

const formatPercentFixed2 = formatPercentFixed2Shared;

const formatIndexValue = (value: number): string =>
  value.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatLoenudviklingFromIndex = (indexValue: number): string => {
  if (!Number.isFinite(indexValue)) return '';
  const delta = Math.round((indexValue - 100) * 100) / 100;
  if (Math.abs(delta) < 0.000001) return '';
  const absDisplay = Math.abs(delta).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return delta > 0 ? `+ ${absDisplay} %` : `- ${absDisplay} %`;
};

const parsePercentInput = (raw: string | undefined): number => {
  if (typeof raw !== 'string') return 0;
  const trimmed = raw.replace('%', '').trim();
  if (trimmed === '') return 0;
  const cleaned = trimmed.replace(/\./g, '').replace(',', '.');
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
};

const buildFormulaText = (components: FormulaComponents, visibility: FormulaVisibility): string => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;

  const baseStr = formatCurrency(baseValue);
  const extraParts = [
    ...(feriePct !== 0 ? [formatPercent(feriePct)] : []),
    ...(visibility.showFritvalg && fritvalgPct !== 0 ? [formatPercent(fritvalgPct)] : []),
    ...(visibility.showShSo && shSoPct !== 0 ? [formatPercent(shSoPct)] : []),
    ...(visibility.showStoreBededag && storeBededagPct !== 0 ? [formatPercentFixed2(storeBededagPct)] : []),
  ];
  const hasMiddle = extraParts.length > 0;
  const middleParts = [formatPercent(100), ...extraParts];
  const middle = middleParts.join(' + ');
  if (visibility.showPension) {
    const pensionParts = [
      formatPercent(100),
      ...(pensionPct !== 0 ? [formatPercent(pensionPct)] : []),
    ];
    return `${baseStr} x (${middle}) x (${pensionParts.join(' + ')})`;
  }
  if (!hasMiddle) return baseStr;
  return `${baseStr} x (${middle})`;
};

const computeFormulaValue = (components: FormulaComponents): number => {
  const baseValue = Number.isFinite(components.baseValue) ? components.baseValue : 0;
  const feriePct = Number.isFinite(components.feriePct) ? components.feriePct : 0;
  const fritvalgPct = Number.isFinite(components.fritvalgPct) ? components.fritvalgPct : 0;
  const shSoPct = Number.isFinite(components.shSoPct) ? components.shSoPct : 0;
  const pensionPct = Number.isFinite(components.pensionPct) ? components.pensionPct : 0;
  const storeBededagPct = Number.isFinite(components.storeBededagPct) ? components.storeBededagPct : 0;
  const tillaeg = feriePct + fritvalgPct + shSoPct + storeBededagPct;
  return baseValue * (1 + tillaeg / 100) * (1 + pensionPct / 100);
};

type ReguleringsPeriode = Readonly<{
  startIso: ISODateString;
  components: FormulaComponents;
  visibility: FormulaVisibility;
}>;

const findPeriodForDate = (
  periods: readonly ReguleringsPeriode[],
  iso: ISODateString
): ReguleringsPeriode | undefined => {
  let candidate: ReguleringsPeriode | undefined;
  for (const period of periods) {
    if (period.startIso > iso) break;
    candidate = period;
  }
  return candidate ?? periods[0];
};

const buildIndexFormulaDisplay = (
  numeratorDisplay: string,
  denominatorDisplay: string,
  numeratorValue: number,
  denominatorValue: number,
  isStatistik: boolean
): string => {
  const isPlainValue = isStatistik || (!numeratorDisplay.includes(' x ') && !denominatorDisplay.includes(' x '));
  const isSameNumericValue = Math.abs(numeratorValue - denominatorValue) < 1e-9;
  if (isSameNumericValue) {
    return isPlainValue ? numeratorDisplay : `(${numeratorDisplay})`;
  }
  return isPlainValue
    ? `${numeratorDisplay} / ${denominatorDisplay}`
    : `(${numeratorDisplay}) /\n(${denominatorDisplay})`;
};

export const resolveValgtReguleringDisplay = (
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]
): string => {
  const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
  if (!grundlag) return '-';
  if (grundlag === 'Statistik') return ansaettelsesforhold.loenudviklingStatistikModel?.trim() || '-';
  if (grundlag === 'Overenskomst') {
    const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
    if (!overenskomstId) return '-';
    const meta = getOverenskomstMetaById(overenskomstId);
    if (!meta) return overenskomstId;
    const loenPart = meta.loenmodtagerOrg[0] || '';
    const arbPart = meta.arbejdsgiverOrg[0] || '';
    return `${meta.navn} (${loenPart} / ${arbPart})`;
  }
  if (grundlag === 'Manuelt angivet') {
    const manuelNavn = ansaettelsesforhold.loenudviklingManuelNavn?.trim() ?? '';
    return manuelNavn !== '' ? manuelNavn : 'Manuelt angivet';
  }
  if (grundlag === 'KRL satstabel') {
    const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
    if (!krlId) return '-';
    return formatKRLSatstabelDisplay(krlId);
  }
  return 'Ingen';
};

export const resolveLoenudviklingLabelDisplay = (params: Readonly<{
  label: string;
  eoValues: ErstatningsopgoerelseValues;
  ansaettelsesforholdId?: string;
}>): string => {
  const { label, eoValues, ansaettelsesforholdId } = params;
  if (label !== 'Overenskomst') {
    return isKRLSatstabelId(label)
      ? formatKRLSatstabelDisplay(label)
      : label;
  }
  if (eoValues.beregnesUdFra === 'Angivet månedsløn' || eoValues.beregnesUdFra === 'Angivet dagsløn') {
    return resolveOverenskomstDisplay(eoValues.eoAngivetLoenLoenudvikling?.overenskomstId) || label;
  }

  const ansaettelsesforhold = ansaettelsesforholdId
    ? eoValues.loenindkomstAnsaettelsesforhold?.find((row) => row.id === ansaettelsesforholdId)
    : eoValues.loenindkomstAnsaettelsesforhold?.[0];
  if (!ansaettelsesforhold) return label;
  return resolveValgtReguleringDisplay(ansaettelsesforhold);
};

const resolveOverenskomstDisplay = (overenskomstId: string | undefined): string => {
  const trimmed = overenskomstId?.trim();
  if (!trimmed) return '-';
  const meta = getOverenskomstMetaById(trimmed);
  if (!meta) return trimmed;
  const loenPart = meta.loenmodtagerOrg[0] || '';
  const arbPart = meta.arbejdsgiverOrg[0] || '';
  return `${meta.navn} (${loenPart} / ${arbPart})`;
};

const buildReguleringsvaerdierTableData = (params: Readonly<{
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  reguleringsdato: ISODateString | undefined;
  tafFra: ISODateString;
  tafTil: ISODateString;
}>): ReguleringValuesTableData | null => {
  const { ansaettelsesforhold, reguleringsdato, tafFra, tafTil } = params;
  // Bevidst forskel: Reguleringsværdier-tabellen må starte tidligere end TAF ved tidlig reguleringsdato.
  const reguleringTableStartIso = resolveReguleringTableStartIso(reguleringsdato, tafFra);
  const grundlag = ansaettelsesforhold.loenudviklingBeregningsgrundlag;

  if (grundlag === 'Overenskomst') {
    const overenskomstId = ansaettelsesforhold.overenskomstId?.trim();
    if (!overenskomstId) return null;
    const offentligType = getOffentligOverenskomstTypeById(overenskomstId);
    if (offentligType) {
      const loenType = resolveOffentligLoenTypeFromLabel(ansaettelsesforhold.offentligLoenType);
      if (!loenType) return null;
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
      if (typeof trinValue !== 'number' || typeof gruppeValue !== 'number') return null;
      if (!isLoengruppe(gruppeValue)) return null;
      let loentrin: ReturnType<typeof toLoentrin>;
      try {
        loentrin = toLoentrin(trinValue);
      } catch {
        return null;
      }

      const fraDato = isoToDanish(reguleringTableStartIso);
      const tilDato = isoToDanish(tafTil);
      if (!fraDato || !tilDato) return null;

      const baseResult = getOffentligLoenForDato(offentligType, fraDato, loentrin, gruppeValue);
      if (!baseResult) return null;

      const satser = getOffentligLoenForPeriode(offentligType, fraDato, tilDato, loentrin, gruppeValue);
      const columns = ['Fra-dato', 'Månedsløn', 'Timeløn'];

      const rows: string[][] = [];
      const addRow = (labelIso: ISODateString, maanedsLoen: number, timeLoen: number) => {
        rows.push([
          isoToDanish(labelIso) ?? labelIso,
          formatCurrency(maanedsLoen),
          formatCurrency(timeLoen),
        ]);
      };

      addRow(reguleringTableStartIso, baseResult.maanedsLoen, baseResult.timeLoen);

      const later = satser
        .map((entry) => {
          const iso = parseDanishToISO(entry.effectiveDate);
          if (!iso) return null;
          return { iso, maanedsLoen: entry.maanedsLoen, timeLoen: entry.timeLoen };
        })
        .filter((entry): entry is Readonly<{ iso: ISODateString; maanedsLoen: number; timeLoen: number }> => Boolean(entry))
        .filter((entry) => entry.iso > reguleringTableStartIso)
        .sort((a, b) => (a.iso < b.iso ? -1 : 1));

      for (const entry of later) {
        addRow(entry.iso, entry.maanedsLoen, entry.timeLoen);
      }

      return { columns, rows };
    }

    const ref = resolveOverenskomstRef(overenskomstId);
    if (!ref) return null;
    const fraDato = isoToDanish(reguleringTableStartIso);
    const tilDato = isoToDanish(tafTil);
    if (!fraDato || !tilDato) return null;

    const satser = getEffektiveSatserForPeriode({
      overenskomstId: ref.baseId,
      fraDato,
      tilDato,
      applyAlmindeligLoenPaaShDageRegel: ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn',
    }).slice().reverse();
    const allSatser = getOverenskomst(ref.baseId)?.satser ?? satser;
    const hasGrundloen = allSatser.some((sats) => sats.grundloen !== null);
    const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
    const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
    const hasAgPension = allSatser.some((sats) => sats.agPension !== null);
    const hasSfgg = allSatser.some((sats) => sats.sfgg !== null);
    const hasSfggFaglKbh = allSatser.some((sats) => sats.sfggFaglKbh !== null);
    const hasSfggFaglProv = allSatser.some((sats) => sats.sfggFaglProv !== null);
    const hasSfggUfaglKbh = allSatser.some((sats) => sats.sfggUfaglKbh !== null);
    const hasSfggUfaglProv = allSatser.some((sats) => sats.sfggUfaglProv !== null);
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isZeroPct(ansaettelsesforhold.feriePct);
    const columns = [
      'Fra-dato',
      ...(hasGrundloen ? ['Grundløn'] : []),
      ...(hasGrundloen && showFeriePctColumn ? ['Ferie\ngodtgørelse'] : []),
      ...(hasShSo ? ['SH/SO'] : []),
      ...(hasFritvalg ? ['Fritvalg'] : []),
      ...(hasAgPension ? ['AG pension'] : []),
      ...(hasSfgg ? ['SFGG'] : []),
      ...(hasSfggFaglKbh ? ['SFGG\nfagl. Kbh'] : []),
      ...(hasSfggFaglProv ? ['SFGG\nfagl. prov'] : []),
      ...(hasSfggUfaglKbh ? ['SFGG\nufagl. Kbh'] : []),
      ...(hasSfggUfaglProv ? ['SFGG\nufagl. prov'] : []),
    ] as const;
    const rows = satser.map((sats) => {
      const row: string[] = [sats.fraDato];
      if (hasGrundloen) row.push(formatOverenskomstAmount(sats.grundloen));
      if (hasGrundloen && showFeriePctColumn) row.push(feriePctDisplay);
      if (hasShSo) row.push(formatOverenskomstPercent(sats.shSoSats));
      if (hasFritvalg) row.push(formatOverenskomstPercent(sats.fritvalg));
      if (hasAgPension) row.push(formatOverenskomstPercent(sats.agPension));
      if (hasSfgg) row.push(formatOverenskomstAmount(sats.sfgg));
      if (hasSfggFaglKbh) row.push(formatOverenskomstAmount(sats.sfggFaglKbh));
      if (hasSfggFaglProv) row.push(formatOverenskomstAmount(sats.sfggFaglProv));
      if (hasSfggUfaglKbh) row.push(formatOverenskomstAmount(sats.sfggUfaglKbh));
      if (hasSfggUfaglProv) row.push(formatOverenskomstAmount(sats.sfggUfaglProv));
      return row;
    });
    return { columns, rows };
  }

  if (grundlag === 'Manuelt angivet') {
    const feriePctDisplay = formatPctFromInput(ansaettelsesforhold.feriePct);
    const showFeriePctColumn = !isZeroPct(ansaettelsesforhold.feriePct);
    const rows = (ansaettelsesforhold.loenudviklingManuelTableData ?? [])
      .map((row, index) => {
        const iso = index === 0 ? reguleringTableStartIso : parseDanishToISO(row.dato);
        if (!iso || iso < reguleringTableStartIso || iso > tafTil) return null;
        const cells: string[] = [
          formatDateShort(iso),
          amountValueToDisplayString(row.grundloen, 2) || '-',
        ];
        if (showFeriePctColumn) cells.push(feriePctDisplay);
        cells.push(
          row.feriepenge?.trim() || '-',
          row.shSoSats?.trim() || '-',
          row.fritvalg?.trim() || '-',
          row.agPension?.trim() || '-'
        );
        return { iso, cells };
      })
      .filter((row): row is Readonly<{ iso: ISODateString; cells: string[] }> => Boolean(row))
      .sort((a, b) => (a.iso < b.iso ? -1 : 1))
      .map((row) => row.cells);
    return {
      columns: [
        'Dato',
        'Grundløn',
        ...(showFeriePctColumn ? ['Feriegodtgørelse'] : []),
        'Feriepenge',
        'SH/SO',
        'Fritvalg',
        'AG pension',
      ],
      rows,
    };
  }

  if (grundlag === 'Statistik') {
    const modelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
    if (modelLabel === '') return null;

    if (modelLabel.startsWith('ASL-')) {
      const regDate = parseIsoDateToUtcDate(reguleringsdato);
      const tafFraDate = parseIsoDateToUtcDate(reguleringTableStartIso);
      const tafTilDate = parseIsoDateToUtcDate(tafTil);
      if (!regDate || !tafFraDate || !tafTilDate) return null;
      const regYear = regDate.getUTCFullYear();
      const startYear = tafFraDate.getUTCFullYear();
      const endYear = tafTilDate.getUTCFullYear();
      const rows: string[][] = [];
      const regValue = aarsloenMax[regYear as keyof typeof aarsloenMax];
      if (typeof regValue === 'number') rows.push([String(regYear), formatCurrency(regValue)]);
      for (let year = startYear; year <= endYear; year += 1) {
        if (year === regYear) continue;
        const value = aarsloenMax[year as keyof typeof aarsloenMax];
        if (typeof value !== 'number') continue;
        rows.push([String(year), formatCurrency(value)]);
      }
      return { columns: ['År', 'Maksimum årsløn'], rows };
    }

    const modelId = resolveStatistikModelIdFromLabel(modelLabel);
    if (!modelId) return null;
    const model = getStatistiskLoenudvikling(modelId);
    if (!model) return null;

    const periodStarts = model.indeksvaerdier
      .flatMap((value) => {
        const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
        if (!match) return [];
        const year = Number(match[1]);
        const quarter = Number(match[2]);
        if (!Number.isFinite(year) || !Number.isFinite(quarter)) return [];
        const month = (quarter - 1) * 3 + 1;
        const startIso = parseOptionalIsoDate(`${year}-${String(month).padStart(2, '0')}-01`);
        if (!startIso) return [];
        return [{ kvartal: value.kvartal, startIso, indeksvaerdi: value.indeksvaerdi }];
      })
      .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
    if (periodStarts.length === 0) return null;

    const decimals = detectDecimalPlaces(model.indeksvaerdier.map((value) => value.indeksvaerdi));
    const formatIndex = (value: number) =>
      value.toLocaleString('da-DK', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

    let basePeriod = periodStarts[0];
    for (const period of periodStarts) {
      if (period.startIso > reguleringTableStartIso) break;
      basePeriod = period;
    }

    const rows: string[][] = [[basePeriod.kvartal, formatDateShort(reguleringTableStartIso), formatIndex(basePeriod.indeksvaerdi)]];
    for (const period of periodStarts) {
      if (period.startIso <= reguleringTableStartIso) continue;
      if (period.startIso > tafTil) continue;
      rows.push([period.kvartal, formatDateShort(period.startIso), formatIndex(period.indeksvaerdi)]);
    }
    return { columns: ['Kvartal', 'Startdato', 'Indeksværdi'], rows };
  }

  if (grundlag === 'KRL satstabel') {
    const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
    if (!krlId || !isKRLSatstabelId(krlId)) return null;
    const tabel = getKRLSatstabel(krlId);
    if (!tabel || tabel.vaerdier.length === 0) return null;

    const formatKrlPct = (value: number): string =>
      value.toLocaleString('da-DK', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' %';

    const periodStarts = tabel.vaerdier
      .map((v) => {
        const startIso = parseDanishToISO(v.fraDato);
        if (!startIso) return null;
        return { startIso, fraDato: v.fraDato, reguleringsPct: v.reguleringsPct };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
    if (periodStarts.length === 0) return null;

    // Find basisperiode
    let basePeriod = periodStarts[0];
    for (const period of periodStarts) {
      if (period.startIso > reguleringTableStartIso) break;
      basePeriod = period;
    }

    const rows: string[][] = [[basePeriod.fraDato, formatKrlPct(basePeriod.reguleringsPct)]];
    for (const period of periodStarts) {
      if (period.startIso <= reguleringTableStartIso) continue;
      if (period.startIso > tafTil) continue;
      rows.push([period.fraDato, formatKrlPct(period.reguleringsPct)]);
    }
    return { columns: ['Fra-dato', 'Reguleringsprocent'], rows };
  }

  return null;
};

const buildReguleringIndexRows = (params: Readonly<{
  segments: readonly LoenudviklingSegment[];
  ansaettelsesforhold: ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number];
  reguleringsdato: ISODateString | undefined;
  tafBeregningsenhed: TafBeregningsenhed;
}>): readonly ReguleringIndexRow[] => {
  const { segments, ansaettelsesforhold, reguleringsdato, tafBeregningsenhed } = params;
  if (segments.length === 0) return [];
  const tafStartIso = segments[0].fra;
  const tafEndIso = segments[segments.length - 1].til;
  const loenudviklingBasis = ansaettelsesforhold.loenudviklingBeregningsgrundlag;
  const applyAlmindeligLoenPaaShDageRegel = ansaettelsesforhold.loenPaaHelligdage === 'Almindelig løn';
  const statistikModelLabel = (ansaettelsesforhold.loenudviklingStatistikModel ?? '').trim();
  const isStatistik = loenudviklingBasis === 'Statistik';
  const isKRL = loenudviklingBasis === 'KRL satstabel';
  const isSimpleIndex = isStatistik || isKRL;
  const isAslModel = isStatistik && statistikModelLabel.startsWith('ASL-');
  const statDecimalPlaces = (() => {
    if (isKRL) return 4;
    if (!isStatistik || isAslModel) return 2;
    const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
    if (!modelId) return 2;
    const model = getStatistiskLoenudvikling(modelId);
    if (!model) return 2;
    return detectDecimalPlaces(model.indeksvaerdier.map((value) => value.indeksvaerdi));
  })();
  const formatStatValue = isAslModel
    ? formatCurrency
    : (value: number) =>
      value.toLocaleString('da-DK', { minimumFractionDigits: statDecimalPlaces, maximumFractionDigits: statDecimalPlaces });

  const splitSegmentsAtBoundary = (
    inputSegments: readonly LoenudviklingSegment[],
    boundaryIso: ISODateString
  ): readonly LoenudviklingSegment[] => {
    const result: LoenudviklingSegment[] = [];
    for (const segment of inputSegments) {
      if (!(segment.fra < boundaryIso && segment.til >= boundaryIso)) {
        result.push(segment);
        continue;
      }
      const leftTil = subtractOneDay(boundaryIso);
      if (leftTil && segment.fra <= leftTil) {
        result.push({ ...segment, til: leftTil });
      }
      if (boundaryIso <= segment.til) {
        result.push({ ...segment, fra: boundaryIso });
      }
    }
    return result;
  };

  type IndexRowWithIso = ReguleringIndexRow & Readonly<{
    fraIso: ISODateString;
    tilIso: ISODateString;
    signature: string;
  }>;

  const mergeConsecutiveRowsWithSameCalculation = (rows: readonly IndexRowWithIso[]): readonly ReguleringIndexRow[] => {
    if (rows.length <= 1) return rows;
    const merged: IndexRowWithIso[] = [];
    for (const row of rows) {
      const last = merged[merged.length - 1];
      const isAdjacent = Boolean(last && subtractOneDay(row.fraIso) === last.tilIso);
      const hasSameCalculation = Boolean(last && last.signature === row.signature);
      if (last && isAdjacent && hasSameCalculation) {
        const updated: IndexRowWithIso = {
          ...last,
          tilIso: row.tilIso,
          tilDato: formatDateShort(row.tilIso),
        };
        merged[merged.length - 1] = updated;
      } else {
        merged.push(row);
      }
    }
    return merged;
  };

  const anciennitetForIndex = (() => {
    if (loenudviklingBasis !== 'Overenskomst') return null;
    if (!ansaettelsesforhold.overenskomstId || !ansaettelsesforhold.harAnciennitetstillaegEfterSkadesdatoen) return null;
    const anciennitetDato = ansaettelsesforhold.anciennitetstillaegDato;
    const satsValue = ansaettelsesforhold.anciennitetstillaegSats?.value;
    if (!anciennitetDato || typeof satsValue !== 'number' || !Number.isFinite(satsValue) || satsValue <= 0) {
      return null;
    }
    const tafBeregnesSom = tafBeregningsenhed === TAF_BEREGNES_SOM.MAANEDER ? 'Måneder' : 'Arbejdsdage';
    const grundloenAngivetPer = getGrundloenAngivetPerForOverenskomst(ansaettelsesforhold.overenskomstId, tafBeregnesSom);
    if (!grundloenAngivetPer) return null;
    if (anciennitetDato > tafEndIso) return null;
    const inputPer = ansaettelsesforhold.anciennitetstillaegSatsAngivesPer;
    const supplementValue = convertAnciennitetSats(satsValue, inputPer, grundloenAngivetPer);
    const roundedSupplement = roundToTwoDecimals(supplementValue);
    if (!Number.isFinite(roundedSupplement) || roundedSupplement <= 0) return null;
    return {
      activeFromIso: anciennitetDato < tafStartIso ? tafStartIso : anciennitetDato,
      supplementValue: roundedSupplement,
    };
  })();

  const segmentsForCalc = anciennitetForIndex
    ? splitSegmentsAtBoundary(segments, anciennitetForIndex.activeFromIso)
    : segments;

  if (
    ansaettelsesforhold.loenudviklingBeregningsgrundlag === 'Overenskomst' &&
    reguleringsdato &&
    ansaettelsesforhold.overenskomstId
  ) {
    const fallbackRowWithIso = (segment: LoenudviklingSegment): IndexRowWithIso => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const indeksberegning = Math.abs(indeksValue - 100) < 0.000001 ? '100,00' : `${indeksDisplay} /\n100,00`;
      const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
      return {
        fraIso: segment.fra,
        tilIso: segment.til,
        fraDato: formatDateShort(segment.fra),
        tilDato: formatDateShort(segment.til),
        indeksberegning,
        indeks: indeksDisplay,
        loenudvikling,
        signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
      };
    };

    const offentligType = getOffentligOverenskomstTypeById(ansaettelsesforhold.overenskomstId);
    if (offentligType) {
      const baseDato = isoToDanish(reguleringsdato);
      const loenType = resolveOffentligLoenTypeFromLabel(ansaettelsesforhold.offentligLoenType);
      const trinValue = ansaettelsesforhold.offentligLoenTrin;
      const gruppeValue = ansaettelsesforhold.offentligLoenGruppe;
      if (!baseDato || !loenType || typeof trinValue !== 'number' || typeof gruppeValue !== 'number') {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }
      if (!isLoengruppe(gruppeValue)) {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }
      let loentrin: ReturnType<typeof toLoentrin>;
      try {
        loentrin = toLoentrin(trinValue);
      } catch {
        return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      }

      const baseResult = getOffentligLoenForDato(offentligType, baseDato, loentrin, gruppeValue);
      if (!baseResult) return mergeConsecutiveRowsWithSameCalculation(segments.map(fallbackRowWithIso));
      const baseValue = loenType === 'maanedsLoen' ? baseResult.maanedsLoen : baseResult.timeLoen;
      const baseComponents: FormulaComponents = {
        baseValue,
        feriePct: 0,
        fritvalgPct: 0,
        shSoPct: 0,
        pensionPct: 0,
        storeBededagPct: 0,
      };
      const baseVisibility: FormulaVisibility = {
        showFritvalg: false,
        showShSo: false,
        showPension: false,
        showStoreBededag: false,
      };
      const baseFormula = buildFormulaText(baseComponents, baseVisibility);
      const baseValueRaw = computeFormulaValue(baseComponents);

      const rows = segmentsForCalc.map((segment) => {
        const segmentDato = isoToDanish(segment.fra);
        const segmentResult = segmentDato
          ? getOffentligLoenForDato(offentligType, segmentDato, loentrin, gruppeValue)
          : undefined;
        if (!segmentResult) return fallbackRowWithIso(segment);
        const segmentBase = loenType === 'maanedsLoen' ? segmentResult.maanedsLoen : segmentResult.timeLoen;
        const components: FormulaComponents = {
          baseValue: segmentBase,
          feriePct: 0,
          fritvalgPct: 0,
          shSoPct: 0,
          pensionPct: 0,
          storeBededagPct: 0,
        };
        const visibility: FormulaVisibility = {
          showFritvalg: false,
          showShSo: false,
          showPension: false,
          showStoreBededag: false,
        };
        const anciennitetAktiv = Boolean(anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso);
        const formula = (() => {
          if (!anciennitetAktiv || !anciennitetForIndex) return buildFormulaText(components, visibility);
          const original = buildFormulaText(components, visibility);
          const suffixIndex = original.indexOf(' x ');
          const suffix = suffixIndex >= 0 ? original.slice(suffixIndex) : '';
          return `(${formatCurrency(components.baseValue)}+${formatCurrency(anciennitetForIndex.supplementValue)})${suffix}`;
        })();
        const valueRaw = (() => {
          if (!anciennitetAktiv || !anciennitetForIndex) return computeFormulaValue(components);
          return computeFormulaValue({
            ...components,
            baseValue: components.baseValue + anciennitetForIndex.supplementValue,
          });
        })();
        const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
        const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
        const indeksberegning = buildIndexFormulaDisplay(
          formula,
          baseFormula,
          valueRaw,
          baseValueRaw,
          false
        );
        const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
        return {
          fraIso: segment.fra,
          tilIso: segment.til,
          fraDato: formatDateShort(segment.fra),
          tilDato: formatDateShort(segment.til),
          indeksberegning,
          indeks: indeksDisplay,
          loenudvikling,
          signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
        };
      });
      return mergeConsecutiveRowsWithSameCalculation(rows);
    }

    const ref = resolveOverenskomstRef(ansaettelsesforhold.overenskomstId);
    const baseDato = isoToDanish(reguleringsdato);
    if (ref && baseDato) {
      const baseSats = getEffektiveSatserForDato({
        overenskomstId: ref.baseId,
        dato: baseDato,
        applyAlmindeligLoenPaaShDageRegel,
      });
      if (baseSats) {
        const allSatser = getOverenskomst(ref.baseId)?.satser ?? [];
        const hasShSo = allSatser.some((sats) => sats.shSoSats !== null);
        const hasFritvalg = allSatser.some((sats) => sats.fritvalg !== null);
        const hasAgPension = allSatser.some((sats) => sats.agPension !== null);
        const firstSegmentStartIso = segments[0]?.fra;
        const lastSegmentEndIso = segments[segments.length - 1]?.til;
        const applyStoreBededagRegulering = Boolean(
          firstSegmentStartIso &&
          lastSegmentEndIso &&
          applyAlmindeligLoenPaaShDageRegel &&
          firstSegmentStartIso < STORE_BEDEDAG_START &&
          lastSegmentEndIso >= STORE_BEDEDAG_START
        );
        const feriePct = typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0;
        const baseComponents: FormulaComponents = {
          baseValue: baseSats.grundloen ?? 0,
          feriePct,
          fritvalgPct: percentFromDecimal(baseSats.fritvalg),
          shSoPct: percentFromDecimal(baseSats.shSoSats),
          pensionPct: percentFromDecimal(baseSats.agPension),
          storeBededagPct: 0,
        };
        const baseVisibility: FormulaVisibility = {
          showFritvalg: hasFritvalg,
          showShSo: hasShSo,
          showPension: hasAgPension,
          showStoreBededag: false,
        };
        const baseFormula = buildFormulaText(baseComponents, baseVisibility);
        const baseValueRaw = computeFormulaValue(baseComponents);

        const rows = segmentsForCalc.map((segment) => {
          const segmentDato = isoToDanish(segment.fra);
          const sats = segmentDato
            ? getEffektiveSatserForDato({
                overenskomstId: ref.baseId,
                dato: segmentDato,
                applyAlmindeligLoenPaaShDageRegel,
              })
            : undefined;

          if (!sats) {
            return fallbackRowWithIso(segment);
          }

          const storeBededagPct =
            applyStoreBededagRegulering && segment.fra >= STORE_BEDEDAG_START ? STORE_BEDEDAG_PCT : 0;
          const components: FormulaComponents = {
            baseValue: sats.grundloen ?? 0,
            feriePct,
            fritvalgPct: percentFromDecimal(sats.fritvalg),
            shSoPct: percentFromDecimal(sats.shSoSats),
            pensionPct: percentFromDecimal(sats.agPension),
            storeBededagPct,
          };
          const visibility: FormulaVisibility = {
            showFritvalg: hasFritvalg,
            showShSo: hasShSo,
            showPension: hasAgPension,
            showStoreBededag: applyStoreBededagRegulering,
          };
          const anciennitetAktiv = Boolean(anciennitetForIndex && segment.fra >= anciennitetForIndex.activeFromIso);
          const formula = (() => {
            if (!anciennitetAktiv || !anciennitetForIndex) return buildFormulaText(components, visibility);
            const original = buildFormulaText(components, visibility);
            const suffixIndex = original.indexOf(' x ');
            const suffix = suffixIndex >= 0 ? original.slice(suffixIndex) : '';
            return `(${formatCurrency(components.baseValue)}+${formatCurrency(anciennitetForIndex.supplementValue)})${suffix}`;
          })();
          const valueRaw = (() => {
            if (!anciennitetAktiv || !anciennitetForIndex) return computeFormulaValue(components);
            return computeFormulaValue({
              ...components,
              baseValue: components.baseValue + anciennitetForIndex.supplementValue,
            });
          })();
          const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
          const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
          const indeksberegning = buildIndexFormulaDisplay(
            formula,
            baseFormula,
            valueRaw,
            baseValueRaw,
            false
          );
          const loenudvikling = formatLoenudviklingFromIndex(indeksValue);
          return {
            fraIso: segment.fra,
            tilIso: segment.til,
            fraDato: formatDateShort(segment.fra),
            tilDato: formatDateShort(segment.til),
            indeksberegning,
            indeks: indeksDisplay,
            loenudvikling,
            signature: `${indeksberegning}|${indeksDisplay}|${loenudvikling}`,
          };
        });
        return mergeConsecutiveRowsWithSameCalculation(rows);
      }
    }
  }

  const baseIndex = (() => {
    if (!reguleringsdato) return null;
    if (loenudviklingBasis === 'Manuelt angivet') {
      const baseRow = (ansaettelsesforhold.loenudviklingManuelTableData ?? [])[0];
      return {
        components: {
          baseValue: parseAmount(baseRow?.grundloen),
          feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
          fritvalgPct: parsePercentInput(baseRow?.fritvalg),
          shSoPct: parsePercentInput(baseRow?.shSoSats),
          pensionPct: parsePercentInput(baseRow?.agPension),
          storeBededagPct: 0,
        },
        visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
      };
    }
    if (loenudviklingBasis === 'Statistik') {
      if (statistikModelLabel === '') return null;
      if (isAslModel) {
        const regDate = parseIsoDateToUtcDate(reguleringsdato);
        if (!regDate) return null;
        const value = aarsloenMax[regDate.getUTCFullYear() as keyof typeof aarsloenMax];
        if (typeof value !== 'number') return null;
        return {
          components: {
            baseValue: value,
            feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
            fritvalgPct: typeof ansaettelsesforhold.fritvalgPct === 'number' ? ansaettelsesforhold.fritvalgPct : 0,
            shSoPct: typeof ansaettelsesforhold.shSoPct === 'number' ? ansaettelsesforhold.shSoPct : 0,
            pensionPct: typeof ansaettelsesforhold.pensionPct === 'number' ? ansaettelsesforhold.pensionPct : 0,
            storeBededagPct: 0,
          },
          visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
        };
      }
      const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
      if (!modelId) return null;
      const model = getStatistiskLoenudvikling(modelId);
      if (!model) return null;
      const periodStarts = model.indeksvaerdier
        .flatMap((value) => {
          const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
          if (!match) return [];
          const year = Number(match[1]);
          const quarter = Number(match[2]);
          if (!Number.isFinite(year) || !Number.isFinite(quarter)) return [];
          const month = (quarter - 1) * 3 + 1;
          const startIso = parseOptionalIsoDate(`${year}-${String(month).padStart(2, '0')}-01`);
          if (!startIso) return [];
          return [{ startIso, indeksvaerdi: value.indeksvaerdi }];
        })
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      if (periodStarts.length === 0) return null;
      let candidate = periodStarts[0];
      for (const period of periodStarts) {
        if (period.startIso > reguleringsdato) break;
        candidate = period;
      }
      return {
        components: {
          baseValue: candidate.indeksvaerdi,
          feriePct: typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0,
          fritvalgPct: typeof ansaettelsesforhold.fritvalgPct === 'number' ? ansaettelsesforhold.fritvalgPct : 0,
          shSoPct: typeof ansaettelsesforhold.shSoPct === 'number' ? ansaettelsesforhold.shSoPct : 0,
          pensionPct: typeof ansaettelsesforhold.pensionPct === 'number' ? ansaettelsesforhold.pensionPct : 0,
          storeBededagPct: 0,
        },
        visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
      };
    }
    if (isKRL) {
      const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
      if (!krlId || !isKRLSatstabelId(krlId)) return null;
      const tabel = getKRLSatstabel(krlId);
      if (!tabel || tabel.vaerdier.length === 0) return null;
      const periodStarts = tabel.vaerdier
        .map((v) => {
          const startIso = parseDanishToISO(v.fraDato);
          if (!startIso) return null;
          return { startIso, reguleringsPct: v.reguleringsPct };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      if (periodStarts.length === 0) return null;
      let candidate = periodStarts[0];
      for (const period of periodStarts) {
        if (period.startIso > reguleringsdato) break;
        candidate = period;
      }
      return {
        components: {
          baseValue: 100 + candidate.reguleringsPct,
          feriePct: 0,
          fritvalgPct: 0,
          shSoPct: 0,
          pensionPct: 0,
          storeBededagPct: 0,
        },
        visibility: { showFritvalg: false, showShSo: false, showPension: false, showStoreBededag: false },
      };
    }
    return null;
  })();

  const baseComponents = baseIndex?.components;
  const baseVisibility = baseIndex?.visibility;
  const baseValueRaw = baseComponents
    ? (isSimpleIndex ? baseComponents.baseValue : computeFormulaValue(baseComponents))
    : null;
  const baseFormula = baseComponents && baseVisibility
    ? (isSimpleIndex ? formatStatValue(baseComponents.baseValue) : buildFormulaText(baseComponents, baseVisibility))
    : null;

  const periods: ReguleringsPeriode[] = (() => {
    if (!loenudviklingBasis || loenudviklingBasis === 'Ingen') return [];
    const feriePct = typeof ansaettelsesforhold.feriePct === 'number' ? ansaettelsesforhold.feriePct : 0;
    if (loenudviklingBasis === 'Manuelt angivet') {
      const rows = ansaettelsesforhold.loenudviklingManuelTableData ?? [];
      const baseRow = rows[0];
      const baseComponents: FormulaComponents = {
        baseValue: parseAmount(baseRow?.grundloen),
        feriePct,
        fritvalgPct: parsePercentInput(baseRow?.fritvalg),
        shSoPct: parsePercentInput(baseRow?.shSoSats),
        pensionPct: parsePercentInput(baseRow?.agPension),
        storeBededagPct: 0,
      };
      const periodStarts = [
        { startIso: tafStartIso, components: baseComponents },
        ...rows.slice(1).map((row) => {
          const startIso = parseDanishToISO(row.dato);
          if (!startIso) return null;
          if (startIso < tafStartIso) return null;
          if (tafEndIso && startIso > tafEndIso) return null;
          const components: FormulaComponents = {
            baseValue: parseAmount(row.grundloen),
            feriePct,
            fritvalgPct: parsePercentInput(row.fritvalg),
            shSoPct: parsePercentInput(row.shSoSats),
            pensionPct: parsePercentInput(row.agPension),
            storeBededagPct: 0,
          };
          return { startIso, components };
        }),
      ]
        .filter((row): row is Readonly<{ startIso: ISODateString; components: FormulaComponents }> => Boolean(row))
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));

      const applyStoreBededagRegulering =
        applyAlmindeligLoenPaaShDageRegel && tafStartIso < STORE_BEDEDAG_START && tafEndIso >= STORE_BEDEDAG_START;

      if (applyStoreBededagRegulering) {
        const baseForStore = [...periodStarts]
          .filter((period) => period.startIso <= STORE_BEDEDAG_START)
          .sort((a, b) => (a.startIso < b.startIso ? 1 : -1))[0];
        if (baseForStore && !periodStarts.some((p) => p.startIso === STORE_BEDEDAG_START)) {
          periodStarts.push({
            startIso: STORE_BEDEDAG_START,
            components: {
              ...baseForStore.components,
              storeBededagPct: STORE_BEDEDAG_PCT,
            },
          });
        }
        const updated = periodStarts.map((period) => {
          if (period.startIso < STORE_BEDEDAG_START) return period;
          return {
            ...period,
            components: {
              ...period.components,
              storeBededagPct: STORE_BEDEDAG_PCT,
            },
          };
        });
        periodStarts.length = 0;
        periodStarts.push(...updated);
        periodStarts.sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      }

      return periodStarts.map((period) => ({
        ...period,
        visibility: {
          showFritvalg: true,
          showShSo: true,
          showPension: true,
          showStoreBededag: applyStoreBededagRegulering,
        },
      }));
    }
    if (loenudviklingBasis === 'Statistik') {
      const fritvalgPct = typeof ansaettelsesforhold.fritvalgPct === 'number' ? ansaettelsesforhold.fritvalgPct : 0;
      const shSoPct = typeof ansaettelsesforhold.shSoPct === 'number' ? ansaettelsesforhold.shSoPct : 0;
      const pensionPct = typeof ansaettelsesforhold.pensionPct === 'number' ? ansaettelsesforhold.pensionPct : 0;
      if (statistikModelLabel === '') return [];
      if (isAslModel) {
        const start = parseIsoDateToUtcDate(tafStartIso);
        const end = parseIsoDateToUtcDate(tafEndIso);
        if (!start || !end) return [];
        const startYear = start.getUTCFullYear();
        const endYear = end.getUTCFullYear();
        const periodStarts: Array<{ startIso: ISODateString; components: FormulaComponents }> = [];
        for (let year = startYear; year <= endYear; year += 1) {
          const value = aarsloenMax[year as keyof typeof aarsloenMax];
          if (typeof value !== 'number') continue;
          const startIso = parseOptionalIsoDate(`${year}-01-01`);
          if (!startIso) continue;
          periodStarts.push({
            startIso,
            components: {
              baseValue: value,
              feriePct,
              fritvalgPct,
              shSoPct,
              pensionPct,
              storeBededagPct: 0,
            },
          });
        }
        return periodStarts
          .sort((a, b) => (a.startIso < b.startIso ? -1 : 1))
          .map((period) => ({
            ...period,
            visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
          }));
      }
      const modelId = resolveStatistikModelIdFromLabel(statistikModelLabel);
      if (!modelId) return [];
      const model = getStatistiskLoenudvikling(modelId);
      if (!model) return [];
      const periodStarts = model.indeksvaerdier
        .flatMap((value) => {
          const match = value.kvartal.match(/^(\d{4})K([1-4])$/);
          if (!match) return [];
          const year = Number(match[1]);
          const quarter = Number(match[2]);
          if (!Number.isFinite(year) || !Number.isFinite(quarter)) return [];
          const month = (quarter - 1) * 3 + 1;
          const startIso = parseOptionalIsoDate(`${year}-${String(month).padStart(2, '0')}-01`);
          if (!startIso) return [];
          return [{
            startIso,
            components: {
              baseValue: value.indeksvaerdi,
              feriePct,
              fritvalgPct,
              shSoPct,
              pensionPct,
              storeBededagPct: 0,
            },
          }];
        })
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      return periodStarts.map((period) => ({
        ...period,
        visibility: { showFritvalg: true, showShSo: true, showPension: true, showStoreBededag: false },
      }));
    }
    if (isKRL) {
      const krlId = ansaettelsesforhold.loenudviklingKRLSatstabel;
      if (!krlId || !isKRLSatstabelId(krlId)) return [];
      const tabel = getKRLSatstabel(krlId);
      if (!tabel || tabel.vaerdier.length === 0) return [];
      const periodStarts = tabel.vaerdier
        .map((v) => {
          const startIso = parseDanishToISO(v.fraDato);
          if (!startIso) return null;
          return {
            startIso,
            components: {
              baseValue: 100 + v.reguleringsPct,
              feriePct: 0,
              fritvalgPct: 0,
              shSoPct: 0,
              pensionPct: 0,
              storeBededagPct: 0,
            },
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
        .sort((a, b) => (a.startIso < b.startIso ? -1 : 1));
      return periodStarts.map((period) => ({
        ...period,
        visibility: { showFritvalg: false, showShSo: false, showPension: false, showStoreBededag: false },
      }));
    }
    return [];
  })();

  if (!baseComponents || !baseVisibility || baseValueRaw === null || baseFormula === null || periods.length === 0) {
    return segments.map((segment) => {
      const indeksValue = 100 + segment.deltaPct;
      const indeksDisplay = formatIndexValue(indeksValue);
      const formulaText = Math.abs(indeksValue - 100) < 0.000001 ? '100,00' : `${indeksDisplay} /\n100,00`;
      return {
        fraDato: formatDateShort(segment.fra),
        tilDato: formatDateShort(segment.til),
        indeksberegning: formulaText,
        indeks: indeksDisplay,
        loenudvikling: formatLoenudviklingFromIndex(indeksValue),
      };
    });
  }

  return segments.map((segment) => {
    const period = findPeriodForDate(periods, segment.fra);
    const components = period?.components ?? baseComponents;
    const visibility = period?.visibility ?? baseVisibility;
    const valueRaw = isSimpleIndex ? components.baseValue : computeFormulaValue(components);
    const formula = isSimpleIndex ? formatStatValue(valueRaw) : buildFormulaText(components, visibility);
    const indeksValue = baseValueRaw > 0 ? (valueRaw / baseValueRaw) * 100 : Number.NaN;
    const indeksDisplay = Number.isFinite(indeksValue) ? formatIndexValue(indeksValue) : '-';
    return {
      fraDato: formatDateShort(segment.fra),
      tilDato: formatDateShort(segment.til),
      indeksberegning: buildIndexFormulaDisplay(formula, baseFormula, valueRaw, baseValueRaw, isSimpleIndex),
      indeks: indeksDisplay,
      loenudvikling: formatLoenudviklingFromIndex(indeksValue),
    };
  });
};

export const resolveUdkastStempelValue = (value: unknown): boolean => {
  return value === 'Ja';
};


/**
 * Månedsnavn på dansk (med små bogstaver)
 */
const formatDateShort = formatDateShortShared;

const formatDateLong = formatDateLongShared;





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

  assertNoUnsupportedSygeferiegodtgoerelseSelection(selectedElements);

  const { visBrevhoved = false } = options;
  const visUdkastStempel = options.visUdkastStempel ?? resolveUdkastStempelValue(eoValues.indsaetUdkastStempel);
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed ?? eoValues.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = 5;
  const doubleLineHeight = lineHeight * 2;
  const model = buildErstatningsopgoerelsePdfModel(stamdataValues, eoValues, { dagsDatoISO: TODAY });
  const bilagIndkomstYdelserMode: BilagLoenindkomstOgOffentligeYdelserIndgaar =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';
  const bilagIndkomstYdelserRanges = buildBilagIndkomstYdelserRanges(eoValues, bilagIndkomstYdelserMode);
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
  writer.setDisplayMode('fullheight');

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
    }>
  ) => {
    writer.writeLeftRightText(
      leftText,
      rightText,
      {
        ...options,
        minRightColumnWidth: Math.max(
          rightMaxWidth,
          Math.max(0, EO_RIGHT_COLUMN_WIDTH - EO_LEFT_WRAP_EXTRA_WIDTH_MM)
        ),
      }
    );
  };

  const standardRightMaxWidth = writer.getTextWidth('000.000.000,00');

  const writeBodyText = (text: string) => {
    safeAddWrappedText(text);
  };

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, capitalizeFirstChar(value), standardRightMaxWidth, { rightFontStyle: 'normal' });
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

  renderOpgorelseSection({
    model,
    eoValues,
    stamdataValues,
    lineHeight,
    doubleLineHeight,
    afsluttesMed,
    NBSP,
    rightColumnWidth: EO_RIGHT_COLUMN_WIDTH,
    renderSectionHeader,
    renderSubheader,
    renderSubheaderWithWrappedText,
    safeAddWrappedText,
    safeAddLeftRightText,
    renderAtomicTableChunks,
    assertModelInvariant,
    renderMoneyWithKr,
    renderMoneyWithKrTrimmed,
    renderMoneyWithKrOrError,
    formatMoneyOreWithKr,
    formatMoneyOreWithKrTrimmed,
    formatCurrencyFromOre,
    formatCurrencyFromOreTrimmed,
    formatCountWithUnit,
    formatMaanederTrimmed,
    isSingularCount,
    parseOptionalIsoDate,
    resolveLoenSkadesdatoText,
    resolveLoenudviklingLabelDisplay,
    formatDateShort,
    formatDateLong,
    formatPercentDelta,
    writer,
  });

  const skalFiltrereBilagTilKunPerioden =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar === 'Perioden';
  const skalViseIndkomstOgYdelserBilag =
    !skalFiltrereBilagTilKunPerioden || model.tabtArbejdsfortjeneste.harTafPerioder;

  if (selectedElements.loenindkomst && skalViseIndkomstOgYdelserBilag) {
    renderLoenindkomstSection({
      selectedElements,
      eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      writeLabelValueLine,
      formatJaNej,
      formatDateLong,
      resolveOverenskomstDisplay,
      formatPctFromInput,
      isZeroPct,
      getLoenindkomstTableHeaders,
      resolvePeriodColumns,
      hasNonZeroLoenAmount,
      shouldIncludeLoenRowInBilag,
      bilagIndkomstYdelserMode,
      bilagIndkomstYdelserRanges,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'],
        }),
      writer,
    });
  }

  if (selectedElements.offentligeYdelser && skalViseIndkomstOgYdelserBilag) {
    renderOffentligeYdelserSection({
      eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      shouldIncludeOffentligYdelseRowInBilag,
      bilagIndkomstYdelserMode,
      bilagIndkomstYdelserRanges,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'],
        }),
      writer,
    });
  }

  if (selectedElements.regulering && skalViseIndkomstOgYdelserBilag && shouldIncludeReguleringBilag(eoValues)) {
    renderReguleringSection({
      eoValues,
      stamdataValues,
      lineHeight,
      modelLoenudviklingSegmenter: model.tabtArbejdsfortjeneste.loenudvikling?.beregnedeSegmenter ?? [],
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      writeLabelValueLine,
      resolveValgtReguleringDisplay,
      resolveReguleringsdato,
      parseOptionalIsoDate,
      resolveLoenSkadesdatoText,
      resolveTafDateBounds,
      buildReguleringsvaerdierTableData,
      buildReguleringIndexRows: (params) => buildReguleringIndexRows({
        ...params,
        tafBeregningsenhed: model.tabtArbejdsfortjeneste.tafBeregningsenhed,
      }),
      resolveStatistikModelIdFromLabel,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'],
        }),
      writer,
    });
  }

  if (selectedElements.shDage) {
    renderShDageSection({
      eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      renderStandardPdfTable: ({ doc, startY, body, columnStyles, transparentRowIndices }) =>
        renderStandardPdfTable({
          doc: doc as jsPDF,
          startY,
          body,
          columnStyles: columnStyles as NonNullable<Parameters<typeof autoTable>[1]>['columnStyles'],
          transparentRowIndices,
        }),
      writer,
    });
  }

  writer.addFooter();

  // Download PDF
  writer.save(resolvePdfFileName(titel, visUdkastStempel, model.brevhoved?.journalnr));
};
