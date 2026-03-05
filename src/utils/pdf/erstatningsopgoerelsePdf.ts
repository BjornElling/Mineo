/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import jsPDF from 'jspdf';
import { type RowInput } from 'jspdf-autotable';
import { PDF_FONT_FAMILY, PDF_FONT_STYLES } from './pdfConfig';
import { PDF_TITLE_BOTTOM_SPACING_MM, type BrevhovedData } from './pdfHelpers';
import { createPdfWriter } from './pdfWriter';
import { renderEoStylePdfTable } from './pdfTableRenderer';
import type { AarsloenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../schemas/formSchemas';
import { type MoneyOre, type Calculable } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { formatPercent as formatPercentUtil } from '../formatUtils';
import { TODAY } from '../../config/dateRanges';

import { logWarning } from '../logger';
import {
  buildBilagIndkomstYdelserRanges,
  hasNonZeroLoenAmount,
  shouldIncludeLoenRowInBilag,
  shouldIncludeOffentligYdelseRowInBilag,
  shouldIncludeReguleringBilag,
} from '../../domain/erstatningsopgoerelse/bilagRules';
import {
  parseOptionalIsoDate as parseOptionalIsoDateShared,
  formatDateShort as formatDateShortShared,
  formatDateLong as formatDateLongShared,
} from '../../domain/erstatningsopgoerelse/sharedPdfUtils';
import {
  buildReguleringIndexRows,
  buildReguleringsvaerdierTableData,
  resolveLoenSkadesdatoText,
  resolveReguleringsdato,
  resolveStatistikModelIdFromLabel,
  resolveTafDateBounds,
} from '../../domain/erstatningsopgoerelse/eoPdfReguleringEngine';
import { resolveValgtReguleringDisplay } from '../../domain/erstatningsopgoerelse/loenudviklingDisplay';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatPercentDelta,
  isSingularCount,
  resolvePdfFileName,
} from './pdfFormatUtils';
import type { SelectedElements } from './erstatningsopgoerelse/types';
import { assertNoUnsupportedSygeferiegodtgoerelseSelection } from './erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection';
import { renderLoenindkomstSection } from './erstatningsopgoerelse/sections/loenindkomstSection';
import { renderOffentligeYdelserSection } from './erstatningsopgoerelse/sections/offentligeYdelserSection';
import { renderShDageSection } from './erstatningsopgoerelse/sections/shDageSection';
import { renderReguleringSection } from './erstatningsopgoerelse/sections/reguleringSection';
import { renderOpgorelseSection } from './erstatningsopgoerelse/sections/opgoerelseSection';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import type { PdfModel } from '../../domain/erstatningsopgoerelse/eoPdfModel';

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

const formatPctFromInput = (value: number | undefined): string => {
  return formatPercentUtil(value ?? 0);
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
    'ATP mv.\nu. FP',
    'Ferieber.\nløn',
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

// STORE_BEDEDAG_START og STORE_BEDEDAG_PCT importeret fra config

const renderStandardPdfTable = (params: Readonly<{
  doc: jsPDF;
  startY: number;
  body: RowInput[];
  columnStyles?: NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'];
  transparentRowIndices?: readonly number[];
}>): number => {
  const { doc, startY, body, columnStyles, transparentRowIndices } = params;
  return renderEoStylePdfTable({
    doc,
    startY,
    body,
    columnStyles,
    transparentRowIndices,
  });
};

const parseOptionalIsoDate = parseOptionalIsoDateShared;
type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];

const formatDateShort = formatDateShortShared;
const formatDateLong = formatDateLongShared;
export const resolveUdkastStempelValue = (value: unknown): boolean => value === 'Ja';




/**
 * Options for erstatningsopgørelse PDF
 */
interface ErstatningsopgoerelsePdfOptions {
  visBrevhoved?: boolean;
  erstatningsopgoerelseAfsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje';
  visUdkastStempel?: boolean;
  document?: PdfModel;
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
  const model = options.document ?? (() => {
    const snapshot = computeEoSnapshot({
      revision: 'pdf-erstatningsopgoerelse',
      stamdataValues,
      eoValues,
      dagsDatoISO: TODAY,
    });
    const projection = eoSnapshotToEoPdfDocument(snapshot);
    if (projection.kind === 'blocked') {
      throw new Error(projection.message);
    }
    return projection.document;
  })();
  const bilagIndkomstYdelserMode: BilagLoenindkomstOgOffentligeYdelserIndgaar =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';
  const bilagIndkomstYdelserRanges = buildBilagIndkomstYdelserRanges(eoValues, bilagIndkomstYdelserMode);
  const titel = model.titel;

  const warnLayoutFallback = (message: string) => {
    logWarning('PDF-layout fallback aktiveret', {
      context: 'pdf.erstatningsopgoerelse.layout',
      data: { message },
    });
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
    author: 'Mineo',
    creator: 'mineo.dk',
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

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, capitalizeFirstChar(value), standardRightMaxWidth, { rightFontStyle: 'normal' });
  };

  const startBilagPage = (titleText: string) => {
    writer.addPage();
    writer.writeTitle(titleText);
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

  // Tilføj titel
  writer.writeTitle(titel);
  writer.advanceY(-(PDF_TITLE_BOTTOM_SPACING_MM - lineHeight));

  // Tilføj erstatningsperiode-datoer direkte under titel
  writer.setNormalTextStyle();
  if (model.periodeDisplay) {
    safeAddWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Tilføj skadelidtes navn (fed skrift)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  if (model.skadelidteNavn) {
    safeAddWrappedText(model.skadelidteNavn);
  }

  // Tilføj skadestype og skadesdato (normal skrift)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
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
      safeAddWrappedText,
      writeLabelValueLine,
      formatDateLong,
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
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
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
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
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
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
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
          columnStyles: columnStyles as NonNullable<Parameters<typeof renderEoStylePdfTable>[0]>['columnStyles'],
          transparentRowIndices,
        }),
      writer,
    });
  }

  writer.addFooter();

  // Download PDF
  writer.save(resolvePdfFileName(titel, visUdkastStempel, model.brevhoved?.journalnr));
};
