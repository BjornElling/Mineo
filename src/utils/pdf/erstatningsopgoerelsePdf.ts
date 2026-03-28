/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import { MARGINS, PDF_FONT_FAMILY, PDF_FONT_STYLES } from './pdfConfig';
import { PDF_TITLE_BOTTOM_SPACING_MM, type BrevhovedData } from './pdfHelpers';
import type { PdfCommonOptions } from './pdfOptions';
import { createStandardPdfWriter } from './pdfWriter';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../schemas/formSchemas';
import { type MoneyOre, type Calculable } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { formatAsAmount, formatPercent as formatPercentUtil } from '../formatUtils';
import { TODAY } from '../../config/dateRanges';
import { getStandardLoenTableHeaders } from '../../domain/aarsloen/standardLoenTableColumns';

import { logWarning } from '../logger';
import {
  buildBilagIndkomstYdelserRanges,
  hasNonZeroLoenAmount,
  shouldIncludeLoenRowInBilag,
  shouldIncludeOffentligYdelseRowInBilag,
  shouldIncludeReguleringBilag,
} from '../../domain/erstatningsopgoerelse/bilagRules';
import {
  parseOptionalIsoDate,
} from '../../domain/erstatningsopgoerelse/sharedPdfUtils';
import { formatIsoDateShort as formatDateShort, formatIsoDateLong as formatDateLong } from '../dateFormatting';
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
  formatCurrencyFromOreTrimmed,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatMoneyOreWithKrTrimmed,
  formatPercentDelta,
  isSingularCount,
  resolvePdfFileName,
} from './pdfFormatUtils';
import type { SelectedElements } from './erstatningsopgoerelse/types';
import { renderLoenindkomstSection } from './erstatningsopgoerelse/sections/loenindkomstSection';
import { renderOffentligeYdelserSection } from './erstatningsopgoerelse/sections/offentligeYdelserSection';
import { renderShDageSection } from './erstatningsopgoerelse/sections/shDageSection';
import { renderReguleringSection } from './erstatningsopgoerelse/sections/reguleringSection';
import { renderOpgorelseSection } from './erstatningsopgoerelse/sections/opgoerelseSection';
import { computeEoSnapshot } from '../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import type { PdfModel } from '../../domain/erstatningsopgoerelse/eoPdfModel';
import { getEffektiveSatserForDato, getOverenskomstMetaById, getOverenskomstSfggPolicy } from '../../data/overenskomstRates';
import {
  isSfggReferenceperiodeSource,
  resolveSfggReferenceperiodeDayCount,
  resolveSfggSource,
  sumFerieberettigetLoenInRangesKroner,
} from '../../domain/erstatningsopgoerelse/sygeferiegodtgoerelse';
import { parsePercentToDecimal } from '../numberParsing';
import { isoToDanish } from '../../types/branded';

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

const renderMoneyWithKrTrimmed = (value: Calculable<MoneyOre>): string => {
  if (value.status !== 'ok') return '—';
  return `${formatCurrencyFromOreTrimmed(value.value)}${NBSP}kr.`;
};

const formatPctFromInput = (value: number | undefined): string => {
  return formatPercentUtil(value ?? 0);
};

const isZeroPct = (value: number | undefined): boolean => Math.abs(value ?? 0) < 0.000001;
const capitalizeFirstChar = (value: string): string => {
  if (value.length === 0) return value;
  return `${value.charAt(0).toLocaleUpperCase('da-DK')}${value.slice(1)}`;
};

const ensureSentencePunctuation = (value: string): string => (
  /[.!?]$/.test(value) ? value : `${value}.`
);

const resolveSfggPdfIntroText = (
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string
): string | null => {
  const sfggRow = eoValues.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);
  const employment = eoValues.loenindkomstAnsaettelsesforhold.find((row) => row.id === ansaettelsesforholdId);
  const beregningskilde = sfggRow?.sfggBeregningskilde;

  if (beregningskilde === 'Manuelt angivet') {
    const manualSource = sfggRow?.sfggManuelBeloebIHenholdTil?.trim();
    if (manualSource) {
      return ensureSentencePunctuation(`Sygeferiegodtgørelse beregnes i henhold til ${manualSource}`);
    }
    return 'Sygeferiegodtgørelse beregnes på baggrund af en manuelt angivet sats.';
  }

  if (beregningskilde === 'Ferieloven') {
    return 'Sygeferiegodtgørelse beregnes i henhold til ferieloven.';
  }

  if (beregningskilde === 'Overenskomst') {
    const overenskomstNavn = employment?.overenskomstId
      ? (getOverenskomstMetaById(employment.overenskomstId)?.navn ?? employment.overenskomstId.trim())
      : null;
    const sfggPolicy = employment?.overenskomstId
      ? getOverenskomstSfggPolicy(employment.overenskomstId)
      : undefined;

    if (!overenskomstNavn) {
      return 'Sygeferiegodtgørelse beregnes i henhold til overenskomsten.';
    }

    if (sfggPolicy?.fravigerFerielov === false) {
      return `Sygeferiegodtgørelse beregnes i henhold til ${overenskomstNavn}, der følger ferielovens regler.`;
    }

    return `Sygeferiegodtgørelse beregnes i henhold til ${overenskomstNavn}.`;
  }

  return null;
};

const resolveSfggReferenceSatsUnit = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): string =>
  divisorLabel === 'kalenderdage' ? 'kr./kalenderdag' : 'kr./arbejdsdag';

const resolveSfggReferenceperiodeAuthorityText = (
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string
): string => {
  const sfggRow = eoValues.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === ansaettelsesforholdId);
  const employment = eoValues.loenindkomstAnsaettelsesforhold.find((row) => row.id === ansaettelsesforholdId);
  if (!sfggRow || !employment) return 'ferieloven';

  return resolveSfggSource(sfggRow, employment).kind === 'overenskomst_ferielov'
    ? 'overenskomsten'
    : 'ferieloven';
};

const resolveSfggReferenceperiodeLabel = (
  eoValues: ErstatningsopgoerelseValues,
  ansaettelsesforholdId: string
): string => {
  const employment = eoValues.loenindkomstAnsaettelsesforhold.find((row) => row.id === ansaettelsesforholdId);
  if (!employment?.overenskomstId) return '4 uger';
  return getOverenskomstSfggPolicy(employment.overenskomstId)?.referenceperiodeLabel ?? '4 uger';
};

const resolveSfggDifferentieretSatsLabel = (
  sfggSatsvalg: ErstatningsopgoerelseValues['sfggAnsaettelsesforhold'][number]['sfggSatsvalg']
): string => {
  switch (sfggSatsvalg) {
    case 'Faglaert-Koebenhavn':
      return 'Skadelidte var faglært og ansat i København, og satsen er i overenskomsten fastsat til';
    case 'Faglaert-Provinsen':
      return 'Skadelidte var faglært og ansat uden for København, og satsen er i overenskomsten fastsat til';
    case 'Ufaglaert-Koebenhavn':
      return 'Skadelidte var ufaglært og ansat i København, og satsen er i overenskomsten fastsat til';
    case 'Ufaglaert-Provinsen':
      return 'Skadelidte var ufaglært og ansat uden for København, og satsen er i overenskomsten fastsat til';
    default:
      return 'Referencesatsen er i overenskomsten fastsat til';
  }
};

const getLoenindkomstTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  return getStandardLoenTableHeaders(loenperiode).map((header) => {
    if (header === 'Ikke-pensions-\ngivende løn') return 'Ikke-pens. giv. løn';
    if (header === 'ATP og anden\nikke FB-løn') return 'ATP mv.\nu. FP';
    if (header === 'Arb.g.\nPension') return 'Arb.g. Pension';
    return header;
  });
};

const resolvePeriodColumns = (row: StandardLoenTableRow, loenperiode: Loenperiode): readonly [string, string] => {
  if (loenperiode === 'maaned') {
    return [row.col0_maaned?.trim() ?? '', row.col1_maaned?.trim() ?? ''];
  }
  if (loenperiode === 'uge') {
    return [row.col0_uge?.trim() ?? '', row.col1_uge?.trim() ?? ''];
  }
  return [row.col0_dag?.trim() ?? '', row.col1_dag?.trim() ?? ''];
};


type BilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
const resolveUdkastStempelValue = (value: unknown): boolean => value === 'Ja';

/**
 * Options for erstatningsopgørelse PDF
 *
 * Udvider PdfCommonOptions for visBrevhoved-kontrakten.
 * stamdata fra PdfCommonOptions bruges ikke — brevhoved-data hentes fra model.brevhoved.
 */
interface ErstatningsopgoerelsePdfOptions extends PdfCommonOptions {
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

  const writer = createStandardPdfWriter({
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

  const renderSubheaderIfContent = (params: Readonly<{
    text: string;
    nextLineHeight: number;
    hasContent: boolean;
    renderContent: () => void;
    options?: Readonly<{ addTopSpacing?: boolean }>;
  }>) => writer.writeSubheaderIfContent(params);

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

  const renderSfggReferenceSatsBlock = (
    entry: PdfModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
  ) => {
    const sfggRow = eoValues.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === entry.ansaettelsesforholdId);
    const employment = eoValues.loenindkomstAnsaettelsesforhold.find((row) => row.id === entry.ansaettelsesforholdId);
    if (!sfggRow || !employment) return;

    const sfggSource = resolveSfggSource(sfggRow, employment);
    const usesReferenceperiodeRate = isSfggReferenceperiodeSource(sfggSource);

    if (usesReferenceperiodeRate) {
      writer.writeUnderlinedLabel('Referencesats', MARGINS.left);
    }

    if (sfggSource.kind === 'manuel') {
      if (entry.sfggReferencesats.status === 'ok') {
        writeLabelValueLine('Referencesatsen udgør', `${formatCurrencyFromOre(entry.sfggReferencesats.value)} kr./arbejdsdag`);
      }
      return;
    }

    if (sfggSource.kind === 'overenskomst_direkte') {
      const overenskomstPolicy = employment.overenskomstId
        ? getOverenskomstSfggPolicy(employment.overenskomstId)
        : undefined;
      const label = overenskomstPolicy?.direkteSatsErDifferentieret
        ? resolveSfggDifferentieretSatsLabel(sfggRow.sfggSatsvalg)
        : 'Referencesatsen er i overenskomsten fastsat til';
      const satsText = (() => {
        const satsOre = entry.segments[0]?.satsOre;
        if (typeof satsOre === 'number') {
          return `${formatCurrencyFromOre(satsOre)} kr./arbejdsdag`;
        }

        const firstTafDate = entry.segments[0]?.fra ?? model.tafRanges[0]?.fra;
        const lookupDate = isoToDanish(firstTafDate);
        if (!employment.overenskomstId || !lookupDate) return null;
        const satser = getEffektiveSatserForDato({
          overenskomstId: employment.overenskomstId as never,
          dato: lookupDate,
          applyAlmindeligLoenPaaShDageRegel: employment.loenPaaHelligdage === 'Almindelig løn',
        });
        if (!satser) return null;

        const satsValue = overenskomstPolicy?.direkteSatsErDifferentieret
          ? sfggRow.sfggSatsvalg === 'Faglaert-Koebenhavn'
            ? satser.sfggFaglKbh
            : sfggRow.sfggSatsvalg === 'Faglaert-Provinsen'
              ? satser.sfggFaglProv
              : sfggRow.sfggSatsvalg === 'Ufaglaert-Koebenhavn'
                ? satser.sfggUfaglKbh
                : sfggRow.sfggSatsvalg === 'Ufaglaert-Provinsen'
                  ? satser.sfggUfaglProv
                  : satser.sfgg
          : satser.sfgg;

        return typeof satsValue === 'number' ? `${formatAsAmount(satsValue, 2)} kr./arbejdsdag` : null;
      })();
      if (satsText) {
        safeAddWrappedText(label);
        safeAddLeftRightText('', satsText, standardRightMaxWidth, { rightFontStyle: 'normal' });
      }
      return;
    }

    const sfggReferenceperiodeDayCount = resolveSfggReferenceperiodeDayCount(eoValues, sfggRow, sfggSource);
    if (
      !entry.sfggReferenceperiode
      || !entry.sfggReferenceperiode.fra
      || !entry.sfggReferenceperiode.til
      || !sfggReferenceperiodeDayCount
      || entry.sfggReferencesats.status !== 'ok'
    ) {
      return;
    }

    const ferieberettigetLoenKroner = sumFerieberettigetLoenInRangesKroner(
      employment,
      [{ fra: entry.sfggReferenceperiode.fra, til: entry.sfggReferenceperiode.til }],
      eoValues.ferieperioder ?? []
    );
    const feriePctDecimal = parsePercentToDecimal(employment.feriePct);

    safeAddWrappedText(
      'Sygeferiegodtgørelse opgøres på baggrund af en referencesats, opgjort som den gennemsnitlige feriepengebetaling i en referenceperiode før sygeforløbet.'
    );
    safeAddWrappedText(
      `Referenceperioden udgør i henhold til ${resolveSfggReferenceperiodeAuthorityText(eoValues, entry.ansaettelsesforholdId)} ${resolveSfggReferenceperiodeLabel(eoValues, entry.ansaettelsesforholdId)}.`
    );
    writeLabelValueLine(
      'Den ferieberettigede løn i referenceperioden udgør',
      `${formatAsAmount(ferieberettigetLoenKroner, 2)} kr.`
    );
    writeLabelValueLine(
      'I referenceperioden var der',
      `${sfggReferenceperiodeDayCount.divisorDage.toLocaleString('da-DK')} ${sfggReferenceperiodeDayCount.divisorLabel}`
    );
    writeLabelValueLine(
      `Referencesatsen udgør: ${formatPercentUtil(feriePctDecimal * 100)} x ${formatAsAmount(ferieberettigetLoenKroner, 2)} / ${sfggReferenceperiodeDayCount.divisorDage.toLocaleString('da-DK')}:`,
      `${formatCurrencyFromOre(entry.sfggReferencesats.value)} ${resolveSfggReferenceSatsUnit(sfggReferenceperiodeDayCount.divisorLabel)}`
    );
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
    eoValues: eoValues,
    stamdataValues,
    lineHeight,
    doubleLineHeight,
    afsluttesMed,
    NBSP,
    rightColumnWidth: EO_RIGHT_COLUMN_WIDTH,
    renderSectionHeader,
    renderSubheader,
    renderSubheaderIfContent,
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
      eoValues: eoValues,
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
      writer,
    });
  }

  if (selectedElements.offentligeYdelser && skalViseIndkomstOgYdelserBilag) {
    renderOffentligeYdelserSection({
      eoValues: eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader,
      shouldIncludeOffentligYdelseRowInBilag,
      bilagIndkomstYdelserMode,
      bilagIndkomstYdelserRanges,
      writer,
    });
  }

  if (selectedElements.regulering && skalViseIndkomstOgYdelserBilag && shouldIncludeReguleringBilag(eoValues)) {
    renderReguleringSection({
      eoValues: eoValues,
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
      writer,
    });
  }

  if (selectedElements.shDage) {
    renderShDageSection({
      eoValues: eoValues,
      tafRanges: model.tafRanges,
      lineHeight,
      startBilagPage,
      renderSubheader,
      safeAddWrappedText,
      writer,
    });
  }

  if (selectedElements.sygeferiegodtgoerelse && model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0) {
    startBilagPage('Sygeferiegodtgørelse');
    model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.forEach((entry) => {
      renderSubheader(entry.ansaettelsesforholdNavn, lineHeight);
      const sfggIntroText = resolveSfggPdfIntroText(eoValues, entry.ansaettelsesforholdId);
      if (sfggIntroText) {
        safeAddWrappedText(sfggIntroText);
      }
      const sfggRow = eoValues.sfggAnsaettelsesforhold.find((row) => row.ansaettelsesforholdId === entry.ansaettelsesforholdId);
      const employment = eoValues.loenindkomstAnsaettelsesforhold.find((row) => row.id === entry.ansaettelsesforholdId);
      const sfggSource = sfggRow && employment ? resolveSfggSource(sfggRow, employment) : null;
      const usesReferenceperiodeRate = sfggSource ? isSfggReferenceperiodeSource(sfggSource) : false;
      renderSfggReferenceSatsBlock(entry);
      if (!usesReferenceperiodeRate && entry.sfggReferenceperiode) {
        safeAddWrappedText(`Referenceperiode: ${formatDateShort(entry.sfggReferenceperiode.fra)} - ${formatDateShort(entry.sfggReferenceperiode.til)}`);
      }
      if (!usesReferenceperiodeRate && entry.sfggReferencesats.status === 'ok') {
        safeAddWrappedText(`Referencesats: ${formatCurrencyFromOre(entry.sfggReferencesats.value)} kr.`);
      }
      entry.explanatoryLines.forEach((line) => safeAddWrappedText(line));
      const rows = entry.segments;
      if (rows.length > 0) {
        safeAddWrappedText('Fra-dato | Til-dato | Sats | Antal dage | Feriepengekrav');
        rows.forEach((row) => {
          safeAddWrappedText(
            `${formatDateShort(row.fra) ?? ''} | ${formatDateShort(row.til) ?? ''} | ${formatCurrencyFromOreTrimmed(row.satsOre)} | ${String(row.antalDage)} | ${formatCurrencyFromOreTrimmed(row.feriepengekravOre)}`
          );
        });
        safeAddWrappedText(`I alt: ${formatMoneyOreWithKrTrimmed(entry.feriepengekravTotalOre)}`);
      }
      if (entry.capRows.length > 0) {
        renderSubheader('Opgørelse af 4-månedersgrænsen', lineHeight);
        safeAddWrappedText('Fra-dato | Til-dato | Antal dage | Antal måneder');
        entry.capRows.forEach((row) => {
          safeAddWrappedText(
            `${formatDateShort(row.fra) ?? ''} | ${formatDateShort(row.til) ?? ''} | ${String(row.antalDage)} | ${formatAsAmount(row.maanederPraecis, 3)}`
          );
        });
      }
      writer.advanceY(lineHeight);
    });
  }

  writer.addFooter();

  // Download PDF
  writer.save(resolvePdfFileName(titel, visUdkastStempel, model.brevhoved?.journalnr));
};
