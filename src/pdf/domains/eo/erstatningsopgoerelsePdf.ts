/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { MARGINS, PDF_BASE_LINE_HEIGHT_MM, PDF_FONT_FAMILY, PDF_FONT_STYLES } from '../../infrastructure/pdfConfig';
import { PDF_TITLE_BOTTOM_SPACING_MM, type BrevhovedData } from '../../shared/pdfHelpers';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../../schemas/formSchemas';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { type MoneyOre, type Calculable } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { formatAsAmount, formatPercent as formatPercentUtil } from '../../../utils/formatUtils';
import { TODAY } from '../../../config/dateRanges';
import { getStandardLoenTableHeaders } from '../../../domain/aarsloen/standardLoenTableColumns';
import { createPdfTableCell, createPdfTableHeaderCell, renderEoStylePdfTable } from '../../shared/pdfTableRenderer';

import { logWarning } from '../../../utils/logger';
import {
  buildBilagIndkomstYdelserRanges,
  hasNonZeroLoenAmount,
  shouldIncludeLoenRowInBilag,
  shouldIncludeOffentligYdelseRowInBilag,
  shouldIncludeReguleringBilag,
} from '../../../domain/erstatningsopgoerelse/helpers/bilagRules';
import {
  parseOptionalIsoDate,
} from '../../../domain/erstatningsopgoerelse/pdf/sharedPdfUtils';
import { formatIsoDateShort as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import {
  buildReguleringIndexRows,
  buildReguleringsvaerdierTableData,
} from '../../../domain/erstatningsopgoerelse/pdf/eoPdfRegulering';
import {
  resolveLoenSkadedatoText,
  resolveAnvendtReguleringsdato,
  resolveStatistikModelIdFromLabel,
  resolveTafDateBounds,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringsBeregning';
import {
  resolveValgtReguleringDisplayForPdf,
} from '../../../domain/erstatningsopgoerelse/helpers/loenudviklingDisplay';
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
} from '../../shared/pdfFormatUtils';
import type { SelectedElements } from './types';
import { renderLoenindkomstSection } from './sections/loenindkomstSection';
import { renderMidlertidigtEetSection, renderOffentligeYdelserSection } from './sections/offentligeYdelserSection';
import { renderShDageSection } from './sections/shDageSection';
import { renderReguleringSection } from './sections/reguleringSection';
import { renderOpgorelseSection } from './sections/opgoerelseSection';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { mergeIsoDateRanges } from '../../../domain/erstatningsopgoerelse/engines/periodMerging';
import {
  SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL,
  SFGG_FERIEPENGE_MODTAGET_LABEL,
  SFGG_TABLE_TOTAL_LABEL,
  buildSfggReferenceperiodeCountLabel,
  parseSfggExplanatoryLine,
} from '../../../domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelseTexts';

const NBSP = '\u00A0';
const EO_RIGHT_COLUMN_WIDTH = 33.125;

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

const normalizeSfggIntroRightText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;
  return capitalizeFirstChar(trimmed.replace(/\.$/, ''));
};

const resolveSfggReferenceSatsUnit = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): string =>
  divisorLabel === 'kalenderdage' ? 'kr./kalenderdag' : 'kr./arbejdsdag';

const resolveSfggPeriodDayUnitSingular = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): 'kalenderdag' | 'arbejdsdag' =>
  divisorLabel === 'kalenderdage' ? 'kalenderdag' : 'arbejdsdag';

const buildSfggPeriodRateAdjustmentText = (sfggSourceKind: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]['sfggSourceKind']): string => {
  if (sfggSourceKind === 'ferielov') {
    return ' tillagt senere lønudvikling';
  }
  if (sfggSourceKind === 'overenskomst_ferielov') {
    return ' tillagt senere overenskomstmæssige stigninger';
  }
  return '';
};

const buildSfggDisplayedTafPeriodText = (tafPerioderLinjer: readonly string[], tafRanges: EoModel['tafRanges']): string => {
  if (tafPerioderLinjer.length > 0) {
    return tafPerioderLinjer.join(', ');
  }
  return tafRanges
    .map((range) => {
      const fraText = formatDateShort(range.fra);
      const tilText = formatDateShort(range.til);
      return fraText && tilText ? `${fraText} - ${tilText}` : '';
    })
    .filter((value) => value !== '')
    .join(', ');
};

const buildSfggDisplayedCalculatedPeriodText = (
  entry: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
): string => {
  const ranges = entry.segments.length > 0
    ? entry.segments.map((segment) => ({ fra: segment.fra, til: segment.til }))
    : entry.sfggVisningsperiode;

  return ranges
    .map((range) => {
      const fraText = formatDateShort(range.fra);
      const tilText = formatDateShort(range.til);
      return fraText && tilText ? `${fraText} - ${tilText}` : '';
    })
    .filter((value) => value !== '')
    .join(', ');
};

const parseSfggPdfExplanatoryLine = (
  line: string
): Readonly<{ left: string; right: string }> | null => {
  const parsed = parseSfggExplanatoryLine(line);
  if (!parsed) return null;
  if (parsed.kind === 'four_month_cap') {
    return {
      left: 'Skaden er før 01-01-2015 og retten er begrænset til 4 måneder, som ophørte',
      right: parsed.date,
    };
  }
  return {
    left: `Retten ${parsed.verb} ved ansættelsesforholdets ophør`,
    right: parsed.date,
  };
};

const getLoenindkomstTableHeaders = (loenperiode: Loenperiode): readonly string[] => {
  return getStandardLoenTableHeaders(loenperiode).map((header) => {
    if (header === 'Ikke-pensions-\ngivende løn') return 'Ikke-pens. giv. løn';
    if (header === 'ATP og anden\nløn u. tillæg') return 'ATP og løn\nu. till./pens.';
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
  document?: EoModel;
  midlertidigtEetGroups?: readonly MidlertidigtEetAfgoerelseGroup[];
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
  const lineHeight = PDF_BASE_LINE_HEIGHT_MM;
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

  const renderSubheader = (text: string, nextLineHeight: number, options?: Readonly<{ addTopSpacing?: boolean }>) => {
    writer.writeSubheader(text, nextLineHeight, options);
  };

  const safeAddWrappedText = (text: string) => {
    writer.writeWrappedText(text);
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
        minRightColumnWidth: Math.max(rightMaxWidth, EO_RIGHT_COLUMN_WIDTH),
      }
    );
  };

  const standardRightMaxWidth = writer.getTextWidth('000.000.000,00');

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, capitalizeFirstChar(value), standardRightMaxWidth, { rightFontStyle: 'normal' });
  };

  const renderSfggReferenceSatsBlock = (
    entry: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
  ) => {
    const usesReferenceperiodeRate = entry.sfggReferencesatsFormula !== null;

    if (usesReferenceperiodeRate) {
      writer.writeUnderlinedLabel('Referencesats', MARGINS.left);
    }

    if (entry.sfggSourceKind === 'overenskomst_direkte') {
      const satsText = (() => {
        const satsOre = entry.segments[0]?.satsOre;
        if (typeof satsOre === 'number') {
          return `${formatCurrencyFromOre(satsOre)} kr./arbejdsdag`;
        }
        return null;
      })();
      if (satsText && entry.sfggDirectRateLabel) {
        safeAddLeftRightText(entry.sfggDirectRateLabel, satsText, standardRightMaxWidth, { rightFontStyle: 'normal' });
      }
      return;
    }

    if (
      !entry.sfggReferenceperiode
      || !entry.sfggReferenceperiode.fra
      || !entry.sfggReferenceperiode.til
      || !entry.sfggReferencesatsFormula
      || entry.sfggReferencesats.status !== 'ok'
    ) {
      return;
    }
    const { sfggReferencesatsFormula } = entry;
    if (!entry.sfggReferenceperiodeAuthorityText) {
      return;
    }

    safeAddWrappedText(
      `Opgøres som den gennemsnitlige feriepengebetaling i ${entry.sfggReferenceperiodeLabel} før sygeforløbet.`
    );
    writer.addSpacer(lineHeight);
    writeLabelValueLine(
      'Referenceperiode',
      `${formatDateShort(entry.sfggReferenceperiode.fra)} - ${formatDateShort(entry.sfggReferenceperiode.til)}`
    );
    writeLabelValueLine(
      buildSfggReferenceperiodeCountLabel(sfggReferencesatsFormula),
      `${formatAsAmount(sfggReferencesatsFormula.divisorDage, 0)} ${sfggReferencesatsFormula.divisorLabel}`
    );
    writeLabelValueLine(
      'Lønnen i referenceperioden udgør',
      `${formatAsAmount(sfggReferencesatsFormula.loenPlusLoen2PlusIkkePensLoenKroner, 2)} kr.`
    );
    safeAddLeftRightText(
      `Referencesats (${formatAsAmount(sfggReferencesatsFormula.loenPlusLoen2PlusIkkePensLoenKroner, 2)} x ${formatPercentUtil(sfggReferencesatsFormula.feriePctDecimal * 100)} / ${formatAsAmount(sfggReferencesatsFormula.divisorDage, 0)} ${sfggReferencesatsFormula.divisorLabel}) =`,
      `${formatCurrencyFromOre(entry.sfggReferencesats.value)} ${resolveSfggReferenceSatsUnit(sfggReferencesatsFormula.divisorLabel)}`,
      standardRightMaxWidth,
      { rightFontStyle: 'bold' }
    );
  };

  const renderSfggPeriodBlock = (
    entry: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
  ) => {
    const tafPeriodeText = buildSfggDisplayedTafPeriodText(
      model.tabtArbejdsfortjeneste.tafPerioderLinjer,
      model.tafRanges
    );
    const calculatedPeriodeText = buildSfggDisplayedCalculatedPeriodText(entry);
    if (calculatedPeriodeText !== '') {
      writer.writeUnderlinedLabel('Beregningsgrundlag', MARGINS.left);
      writeLabelValueLine(
        calculatedPeriodeText === tafPeriodeText
          ? 'Der beregnes sygeferiegodtgørelse i TAF-perioden'
          : 'Der beregnes sygeferiegodtgørelse i perioden',
        calculatedPeriodeText
      );
    }

    const divisorLabel = entry.sfggDayBasis;
    const dayUnit = resolveSfggPeriodDayUnitSingular(divisorLabel);
    const rateAdjustmentText = buildSfggPeriodRateAdjustmentText(entry.sfggSourceKind);
    const rateLabel = entry.sfggSourceKind === 'overenskomst_direkte' ? 'overenskomstens referencesats' : 'referencesatsen';
    const baseAdjustmentText = divisorLabel === 'arbejdsdage'
      ? 'Der beregnes ikke sygeferiegodtgørelse på SH-dage, under ferie og på andre fraværsdage uden løn.'
      : 'Der beregnes ikke sygeferiegodtgørelse under ferie og på eventuelle andre fraværsdage uden løn.';
    writer.writeUnderlinedLabel(SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL, MARGINS.left);
    safeAddWrappedText(
      `Kravet beregnes per ${dayUnit} med ${rateLabel}${rateAdjustmentText}.`
    );

    const firstDayAdjustmentText = entry.sfggFirstTafDayExcludedText
      ? ` ${entry.sfggFirstTafDayExcludedText}`
      : '';
    safeAddWrappedText(`${baseAdjustmentText}${firstDayAdjustmentText}`);

    if (entry.sfggAfterEmployerSickPayText) {
      safeAddWrappedText(entry.sfggAfterEmployerSickPayText);
    }

    const rows = entry.segments;
    if (rows.length === 0) {
      if (entry.sfggAfterEmployerSickPayText) {
        writer.writeUnderlinedLabel('Beregnet krav', MARGINS.left);
        safeAddWrappedText('Der er betalt sygeløn i hele perioden og derfor ikke krav på sygeferiegodtgørelse.');
      }
      return;
    }

    const antalDageHeader = divisorLabel === 'kalenderdage' ? 'Antal kalenderdage' : 'Antal arbejdsdage';
    const tableRows: RowInput[] = [
      [
        createPdfTableHeaderCell('Fra-dato', 'center'),
        createPdfTableHeaderCell('Til-dato', 'center'),
        createPdfTableHeaderCell('Feriepenge-sats', 'center'),
        createPdfTableHeaderCell('AG-pension', 'center'),
        createPdfTableHeaderCell(antalDageHeader, 'center'),
        createPdfTableHeaderCell(SFGG_TABLE_TOTAL_LABEL, 'center'),
      ],
    ];

    for (const row of rows) {
      tableRows.push(
        [
          createPdfTableCell(formatDateShort(row.fra) ?? '', { halign: 'center' }),
          createPdfTableCell(formatDateShort(row.til) ?? '', { halign: 'center' }),
          createPdfTableCell(formatCurrencyFromOreTrimmed(row.satsOre), { halign: 'center' }),
          createPdfTableCell(`+ ${formatPercentUtil(row.agPensionPct)}`, { halign: 'center' }),
          createPdfTableCell(String(row.antalDage), { halign: 'center' }),
          createPdfTableCell(formatCurrencyFromOreTrimmed(row.feriepengekravOre), { halign: 'right' }),
        ]
      );
    }

    if (rows.length > 1) {
      tableRows.push(
        [
          createPdfTableCell('I alt', { halign: 'left', bold: true, transparent: true }),
          createPdfTableCell('', { bold: true, transparent: true }),
          createPdfTableCell('', { bold: true, transparent: true }),
          createPdfTableCell('', { bold: true, transparent: true }),
          createPdfTableCell('', { bold: true, transparent: true }),
          createPdfTableCell(formatMoneyOreWithKrTrimmed(entry.feriepengekravTotalOre), { halign: 'right', bold: true, transparent: true }),
        ]
      );
    }

    const finalY = renderEoStylePdfTable({
      doc: writer.getDoc() as jsPDF,
      startY: writer.getY(),
      body: tableRows,
      transparentRowIndices: rows.length > 1 ? [tableRows.length - 1] : [],
    });
    writer.setY(finalY + lineHeight);

    const feriepengeHvisIkkeSkadeOre = entry.feriepengekravTotalOre;
    const feriepengeModtagetOre = entry.feriepengeModtagetFormula?.totalOre ?? 0;
    const alleredeBetaltOre = entry.alleredeBetaltOre ?? 0;
    const beregnetSygeferiegodtgoerelseOre = entry.totalOre;
    const feriepengeModtagetLabel = SFGG_FERIEPENGE_MODTAGET_LABEL;

    writer.writeUnderlinedLabel('Beregnet krav', MARGINS.left);
    writeLabelValueLine(SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL, formatCurrencyFromOre(feriepengeHvisIkkeSkadeOre));
    writeLabelValueLine(feriepengeModtagetLabel, formatCurrencyFromOre(-feriepengeModtagetOre));
    writeLabelValueLine('Allerede betalt sygeferiegodtgørelse i perioden', formatCurrencyFromOre(-alleredeBetaltOre));
    safeAddLeftRightText(
      'Beregnet sygeferiegodtgørelse',
      formatCurrencyFromOre(beregnetSygeferiegodtgoerelseOre),
      standardRightMaxWidth,
      { rightFontStyle: 'bold' }
    );
  };

  const startBilagPage = (titleText: string) => {
    writer.addPage();
    writer.writeTitle(titleText);
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
    writer.writeWrappedText(model.periodeDisplay);
    writer.advanceY(lineHeight);
  }

  // Tilføj skadelidtes navn (fed skrift)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.bold);
  if (model.skadelidteNavn) {
    writer.writeWrappedText(model.skadelidteNavn);
  }

  // Tilføj skadestype og skadedato (normal skrift)
  writer.setFont(PDF_FONT_FAMILY, PDF_FONT_STYLES.normal);
  if (model.skadestypeLinje) {
    writer.writeWrappedText(model.skadestypeLinje);
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
    renderSectionHeader: writer.writeSectionHeader,
    renderSubheader: writer.writeSubheader,
    renderSubheaderIfContent: writer.writeSubheaderIfContent,
    renderSubheaderWithWrappedText: writer.writeSubheaderWithWrappedText,
    safeAddWrappedText: writer.writeWrappedText,
    safeAddLeftRightText,
    renderAtomicTableChunks: writer.writeAtomicTableChunks,
    assertModelInvariant: (condition, message) => {
      if (condition) return;
      throw new Error(`Inkonsekvent PDF-model: ${message}`);
    },
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
    resolveLoenSkadedatoText,
    formatDateShort,
    formatDateLong,
    formatPercentDelta,
    writer,
  });

  const skalFiltrereBilagTilKunPerioden =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar === 'Perioden';
  const skalViseIndkomstOgYdelserBilag =
    !skalFiltrereBilagTilKunPerioden || model.tabtArbejdsfortjeneste.harTafPerioder;
  const midlertidigtEetGroups = options.midlertidigtEetGroups ?? [];

  if (selectedElements.loenindkomst && skalViseIndkomstOgYdelserBilag) {
    renderLoenindkomstSection({
      selectedElements,
      eoValues: eoValues,
      lineHeight,
      startBilagPage,
      renderSubheader: writer.writeSubheader,
      safeAddWrappedText: writer.writeWrappedText,
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
      renderSubheader: writer.writeSubheader,
      shouldIncludeOffentligYdelseRowInBilag,
      bilagIndkomstYdelserMode,
      bilagIndkomstYdelserRanges,
      writer,
    });
  }

  if (selectedElements.midlertidigEet && midlertidigtEetGroups.length > 0) {
    renderMidlertidigtEetSection({
      groups: midlertidigtEetGroups,
      lineHeight,
      startBilagPage,
      renderSubheader: writer.writeSubheader,
      formatAfgoerelsesdato: formatDateLong,
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
      modelLoenudviklingPerAnsaettelse: model.tabtArbejdsfortjeneste.loenudvikling?.perAnsaettelse ?? [],
      startBilagPage,
      renderSubheader: writer.writeSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writeLabelValueLine,
      resolveValgtReguleringDisplay: resolveValgtReguleringDisplayForPdf,
      resolveAnvendtReguleringsdato,
      parseOptionalIsoDate,
      resolveLoenSkadedatoText,
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
    const sfggReferenceperiodeRanges = mergeIsoDateRanges(
      model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.flatMap((entry) => {
        if (entry.sfggDayBasis !== 'arbejdsdage' || entry.sfggReferencesatsFormula === null) return [];
        return entry.sfggReferenceperiode ? [entry.sfggReferenceperiode] : [];
      }),
      { mergeAdjacent: true }
    );
    const harSfggReferenceperiodeMedShFradrag =
      model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.some((entry) =>
        entry.sfggDayBasis === 'arbejdsdage' && entry.sfggReferencesatsFormula !== null
      );
    renderShDageSection({
      eoValues: eoValues,
      tafRanges: model.tafRanges,
      sfggReferenceperiodeRanges,
      harSfggReferenceperiodeMedShFradrag,
      lineHeight,
      startBilagPage,
      renderSubheader: writer.writeSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writer,
    });
  }

  if (selectedElements.sygeferiegodtgoerelse && model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0) {
    startBilagPage('Sygeferiegodtgørelse');
    model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.forEach((entry) => {
      renderSubheader(entry.ansaettelsesforholdNavn, lineHeight);
      if (entry.sfggIntroText) {
        const introPrefix = 'Sygeferiegodtgørelse beregnes i henhold til ';
        if (entry.sfggIntroText.startsWith(introPrefix)) {
          safeAddLeftRightText(
            introPrefix.trimEnd(),
            normalizeSfggIntroRightText(entry.sfggIntroText.slice(introPrefix.length)),
            standardRightMaxWidth,
            { rightFontStyle: 'normal' }
          );
        } else {
          safeAddWrappedText(entry.sfggIntroText);
        }
      }
      const usesReferenceperiodeRate = entry.sfggReferencesatsFormula !== null;
      if (entry.sfggSourceKind === 'manuel' && entry.sfggReferencesats.status === 'ok') {
        writeLabelValueLine('Referencesatsen udgør', `${formatCurrencyFromOre(entry.sfggReferencesats.value)} kr./arbejdsdag`);
      }
      entry.pdfExplanatoryLines.forEach((line) => {
        const parsedLine = parseSfggPdfExplanatoryLine(line);
        if (parsedLine) {
          safeAddLeftRightText(parsedLine.left, parsedLine.right, standardRightMaxWidth, { rightFontStyle: 'normal' });
          return;
        }
        safeAddWrappedText(line);
      });
      if (entry.sfggSourceKind !== 'manuel') {
        renderSfggReferenceSatsBlock(entry);
      }
      if (!usesReferenceperiodeRate && entry.sfggSourceKind !== 'manuel' && entry.sfggReferenceperiode) {
        safeAddWrappedText(`Referenceperiode: ${formatDateShort(entry.sfggReferenceperiode.fra)} - ${formatDateShort(entry.sfggReferenceperiode.til)}`);
      }
      if (!usesReferenceperiodeRate && entry.sfggSourceKind !== 'manuel' && entry.sfggReferencesats.status === 'ok') {
        safeAddWrappedText(`Referencesats: ${formatCurrencyFromOre(entry.sfggReferencesats.value)} kr.`);
      }
      renderSfggPeriodBlock(entry);
      writer.advanceY(lineHeight);
    });
  }

  writer.addFooter();

  // Download PDF
  writer.save(resolvePdfFileName(titel, visUdkastStempel, model.brevhoved?.journalnr));
};
