/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { PDF_BASE_LINE_HEIGHT_MM } from '../../infrastructure/pdfConfig';
import { resolvePdfSectionEndY, type BrevhovedData } from '../../shared/pdfHelpers';
import type { PdfCommonOptions } from '../../shared/pdfOptions';
import { createStandardPdfWriter } from '../../infrastructure/pdfWriter';
import type { StandardLoenTableRow, ErstatningsopgoerelseValues, Loenperiode, StamdataValues } from '../../../schemas/formSchemas';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import { type MoneyOre, type Calculable } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import { capitalizeFirstCharDa, formatAsAmount, formatPercent as formatPercentUtil } from '../../../utils/formatUtils';
import { isEffectivelyZero, isWithinTolerance } from '../../../utils/numberComparison';
import { getStandardLoenTableHeaders } from '../../../domain/aarsloen/standardLoenTableColumns';
import {
  createPdfTableCell,
  createPdfTableHeaderCell,
  createPdfTableSummedTotalRow,
  renderPdfTable,
} from '../../shared/pdfTableRenderer';

import { logWarning } from '../../../utils/logger';
import {
  buildEoBilagIndkomstYdelserRanges,
  hasNonZeroLoenAmount,
  shouldRenderEoIndkomstOgYdelserBilag,
  shouldIncludeLoenRowInEoBilag,
  shouldIncludeOffentligYdelseRowInEoBilag,
  hasLoenReguleringEoBilagData,
} from '../../../domain/erstatningsopgoerelse/helpers/eoBilagRules';
import {
  parseOptionalIsoDate,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import { buildOffentligeYdelserReguleringTableData } from '../../../domain/erstatningsopgoerelse/engines/offentligeYdelserUdviklingBeregning';
import {
  buildReguleringIndexRows,
  buildReguleringsvaerdierTableData,
  resolveLoenSkadedatoText,
  resolveAnvendtReguleringsdato,
  resolveStatistikModelIdFromLabel,
  resolveTafDateBounds,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
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
  formatReguleringFactorText,
  isSingularCount,
  resolvePdfFileName,
} from '../../shared/pdfFormatUtils';
import type { SelectedElements } from './types';
import { renderLoenindkomstSection } from './sections/loenindkomstSection';
import { renderMidlertidigtEetSection, renderOffentligeYdelserSection } from './sections/offentligeYdelserSection';
import { renderShDageSection } from './sections/shDageSection';
import { renderReguleringSection } from './sections/reguleringSection';
import { renderOpgorelseSection } from './sections/opgoerelseSection';
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

const normalizeSfggIntroRightText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') return trimmed;
  return capitalizeFirstCharDa(trimmed.replace(/\.$/, ''));
};

const resolveSfggReferenceSatsUnit = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): string =>
  divisorLabel === 'kalenderdage' ? 'kr./kalenderdag' : 'kr./arbejdsdag';

const resolveSfggPeriodDayUnitSingular = (divisorLabel: 'kalenderdage' | 'arbejdsdage'): 'kalenderdag' | 'arbejdsdag' =>
  divisorLabel === 'kalenderdage' ? 'kalenderdag' : 'arbejdsdag';

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


type EoBilagLoenindkomstOgOffentligeYdelserIndgaar = ErstatningsopgoerelseValues['eoBilagLoenindkomstOgOffentligeYdelserIndgaar'];
const resolveUdkastStempelValue = (value: unknown): boolean => value === 'Ja';

/**
 * Options for erstatningsopgørelse PDF
 *
 * Udvider PdfCommonOptions for visBrevhoved-kontrakten.
 * stamdata fra PdfCommonOptions bruges ikke — brevhoved-data hentes fra model.brevhoved.
 */
interface ErstatningsopgoerelsePdfOptions extends PdfCommonOptions {
  erstatningsopgoerelseAfsluttesMed?: 'Bekræftet godkendt' | 'Underskrift-linje' | 'Ingen';
  visUdkastStempel?: boolean;
  document: EoModel;
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
  options: ErstatningsopgoerelsePdfOptions
) => {
  if (!selectedElements.opgoerelse) {
    throw new Error('PDF-generering kræver, at elementet "Opgørelse" er valgt.');
  }

  const { visBrevhoved = false } = options;
  const visUdkastStempel = options.visUdkastStempel ?? resolveUdkastStempelValue(eoValues.indsaetUdkastStempel);
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed ?? eoValues.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = PDF_BASE_LINE_HEIGHT_MM;
  const doubleLineHeight = lineHeight * 2;
  if (!options.document) {
    throw new Error('EO-PDF kræver et præ-projiceret PDF-dokument.');
  }
  const model = options.document;
  const eoBilagIndkomstYdelserMode: EoBilagLoenindkomstOgOffentligeYdelserIndgaar =
    eoValues.eoBilagLoenindkomstOgOffentligeYdelserIndgaar ?? 'Perioden';
  const eoBilagIndkomstYdelserRanges = buildEoBilagIndkomstYdelserRanges(eoValues, eoBilagIndkomstYdelserMode);
  const titel = model.titel;

  const warnLayoutFallback = ({ message, label }: Readonly<{ message: string; label: string }>) => {
    logWarning('PDF-layout fallback aktiveret', {
      context: 'pdf.erstatningsopgoerelse.layout',
      data: { message, label },
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

  const safeAddWrappedText = (text: string) => {
    writer.writeWrappedText(text);
  };

  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: Readonly<{
      leftFontStyle?: 'normal' | 'bold';
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
  const renderSubheader = writer.writeBoldSubheader;

  const writeLabelValueLine = (label: string, value: string) => {
    safeAddLeftRightText(label, capitalizeFirstCharDa(value), standardRightMaxWidth, { rightFontStyle: 'normal' });
  };

  const renderSfggReferenceSatsBlock = (
    entry: EoModel['tabtArbejdsfortjeneste']['sygeferiegodtgoerelse']['perAnsaettelsesforhold'][number]
  ) => {
    const usesReferenceperiodeRate = entry.sfggReferencesatsFormula !== null;

    if (usesReferenceperiodeRate) {
      writer.writeUnderlinedSubheader('Referencesats');
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
    writer.addSectionSpacer();
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
    const sfggVisningsperiodeLines = entry.sfggVisningsperiode.map((range) =>
      `${formatDateShort(range.fra)} - ${formatDateShort(range.til)}`
    );
    const divisorLabel = entry.sfggDayBasis;
    const dayUnit = resolveSfggPeriodDayUnitSingular(divisorLabel);
    const rateLabel = entry.sfggSourceKind === 'overenskomst_direkte' ? 'overenskomstens referencesats' : 'referencesatsen';
    const hasRegulatedSfggRate = entry.segments.some((segment) =>
      typeof segment.reguleringsindeks === 'number' && !isWithinTolerance(segment.reguleringsindeks, 100)
    );
    const baseAdjustmentText = divisorLabel === 'arbejdsdage'
      ? 'Der beregnes ikke sygeferiegodtgørelse på SH-dage, under ferie og på andre fraværsdage uden løn.'
      : 'Der beregnes ikke sygeferiegodtgørelse under ferie og på eventuelle andre fraværsdage uden løn.';
    writer.writeUnderlinedSubheader(
      entry.sfggVisningsperiode.length === 1
        ? 'Periode med sygeferiegodtgørelse'
        : 'Perioder med sygeferiegodtgørelse'
    );
    if (sfggVisningsperiodeLines.length === 0) {
      safeAddWrappedText('Ingen');
    } else {
      sfggVisningsperiodeLines.forEach((line) => safeAddWrappedText(line));
    }

    writer.writeUnderlinedSubheader(SFGG_FERIEPENGE_HVIS_IKKE_SKADE_LABEL);
    safeAddWrappedText(
      hasRegulatedSfggRate
        ? `Kravet beregnes per ${dayUnit} med ${rateLabel} tillagt efterfølgende lønstigninger.`
        : `Kravet beregnes per ${dayUnit} med ${rateLabel}.`
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
        writer.writeUnderlinedSubheader('Beregnet krav');
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

    const totalRow = createPdfTableSummedTotalRow(
      'I alt',
      rows.map((row) => row.feriepengekravOre),
      {
        columnCount: 6,
        valueColumnIndex: 5,
        formatValue: (total) => formatMoneyOreWithKrTrimmed(total),
        valueHasKrSuffix: false,
      }
    );
    const totalRowIndex = totalRow ? tableRows.length : null;
    if (totalRow) {
      tableRows.push(totalRow.row);
    }

    const startY = writer.getY();
    const finalY = renderPdfTable({
      doc: writer.getDoc() as jsPDF,
      startY,
      body: tableRows,
      underlinedCellPositions: totalRowIndex === null || totalRow === null
        ? []
        : [{ rowIndex: totalRowIndex, columnIndex: totalRow.valueCellColumnIndex }],
    });
    writer.setY(resolvePdfSectionEndY(finalY, startY));

    const feriepengeHvisIkkeSkadeOre = entry.feriepengekravTotalOre;
    const feriepengeModtagetOre = entry.feriepengeModtagetFormula?.totalOre ?? 0;
    const alleredeBetaltOre = entry.alleredeBetaltOre ?? 0;
    const beregnetSygeferiegodtgoerelseOre = entry.totalOre;
    const feriepengeModtagetLabel = SFGG_FERIEPENGE_MODTAGET_LABEL;

    writer.writeUnderlinedSubheader('Beregnet krav');
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

  const startEoBilagPage = (titleText: string) => {
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
  writer.writeTitle(titel, { trailingSpacing: 0 });

  // Tilføj erstatningsperiode-datoer direkte under titel
  if (model.periodeDisplay) {
    writer.writeWrappedText(model.periodeDisplay);
    writer.addSectionSpacer();
  }

  // Tilføj skadelidtes navn (fed skrift)
  if (model.skadelidteNavn) {
    writer.writeBoldWrappedText(model.skadelidteNavn);
  }

  // Tilføj skadestype og skadedato (normal skrift)
  if (model.skadestypeLinje) {
    writer.writeWrappedText(model.skadestypeLinje);
    writer.addSectionSpacer();
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
    renderSubheader,
    renderSubheaderIfContent: writer.writeBoldSubheaderIfContent,
    renderSubheaderWithWrappedText: writer.writeBoldSubheaderWithWrappedText,
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
    writer,
  });

  const skalViseIndkomstOgYdelserBilag =
    shouldRenderEoIndkomstOgYdelserBilag(eoValues, eoBilagIndkomstYdelserMode);
  const midlertidigtEetGroups = options.midlertidigtEetGroups ?? [];

  if (selectedElements.loenindkomst && skalViseIndkomstOgYdelserBilag) {
    renderLoenindkomstSection({
      selectedElements,
      eoValues: eoValues,
      startEoBilagPage,
      renderSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writeLabelValueLine,
      formatDateLong,
      formatPctFromInput,
      isZeroPct: isEffectivelyZero,
      getLoenindkomstTableHeaders,
      resolvePeriodColumns,
      hasNonZeroLoenAmount,
      shouldIncludeLoenRowInEoBilag,
      eoBilagIndkomstYdelserMode,
      eoBilagIndkomstYdelserRanges,
      writer,
    });
  }

  if (selectedElements.offentligeYdelser && skalViseIndkomstOgYdelserBilag) {
    renderOffentligeYdelserSection({
      eoValues: eoValues,
      startEoBilagPage,
      renderSubheader,
      shouldIncludeOffentligYdelseRowInEoBilag,
      eoBilagIndkomstYdelserMode,
      eoBilagIndkomstYdelserRanges,
      writeBoldSubheaderWithWrappedText: writer.writeBoldSubheaderWithWrappedText,
      writer,
    });
  }

  if (selectedElements.midlertidigEet && midlertidigtEetGroups.length > 0) {
    renderMidlertidigtEetSection({
      groups: midlertidigtEetGroups,
      startEoBilagPage,
      renderSubheader,
      formatAfgoerelsesdato: formatDateLong,
      tafRanges: model.tafRanges,
      writer,
    });
  }

  // Bilagsvalget "Regulering" styrer både lønregulering og regulering af offentlige ydelser.
  // De to sektioner renderes fortsat kun, når deres eget datagrundlag faktisk findes.
  if (selectedElements.regulering && skalViseIndkomstOgYdelserBilag && hasLoenReguleringEoBilagData(eoValues)) {
    renderReguleringSection({
      eoValues: eoValues,
      stamdataValues,
      modelLoenudviklingPerAnsaettelse: model.tabtArbejdsfortjeneste.loenudvikling?.perAnsaettelse ?? [],
      startEoBilagPage,
      renderSubheader,
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

  const offentligeYdelserUdvikling = model.tabtArbejdsfortjeneste.offentligeYdelserUdvikling;
  if (
    selectedElements.regulering &&
    eoValues.regulerOffentligeYdelser === 'Ja' &&
    offentligeYdelserUdvikling &&
    offentligeYdelserUdvikling.entries.length > 0
  ) {
    startEoBilagPage('Regulering af offentlige ydelser');
    const reguleringsBaseDato = offentligeYdelserUdvikling.reguleringsBaseIso
      ? formatDateShort(offentligeYdelserUdvikling.reguleringsBaseIso)
      : 'ikke angivet';
    writeLabelValueLine('Regulering foretages med afsæt i værdier den', reguleringsBaseDato);
    if (model.periodeDisplay) {
      writeLabelValueLine('Periode', model.periodeDisplay);
    }
    const skadelidteNavn = (stamdataValues.skadelidte ?? '').trim();
    if (skadelidteNavn) {
      writeLabelValueLine('Skadelidte', skadelidteNavn);
    }
    writer.addSectionSpacer();
    safeAddWrappedText('Reguleringsværdier:');
    let tableData: ReturnType<typeof buildOffentligeYdelserReguleringTableData> = null;
    let tableDataError = false;
    try {
      tableData = buildOffentligeYdelserReguleringTableData(offentligeYdelserUdvikling);
    } catch {
      tableDataError = true;
      tableData = null;
    }
    if (tableData && tableData.rows.length > 0) {
      const tableRows: RowInput[] = [
        tableData.columns.map((column) => createPdfTableHeaderCell(column, 'center')),
        ...tableData.rows.map((row) => row.map((cell) => createPdfTableCell(cell, { halign: 'center' }))),
      ];
      const startY = writer.getY();
      const finalY = renderPdfTable({
        doc: writer.getDoc() as jsPDF,
        startY,
        body: tableRows,
        didParseCell: (data) => {
          const isDataRow = data.row.index >= 1;
          const isNumericColumn = data.column.index >= 1;
          if (!isDataRow || !isNumericColumn) return;

          data.cell.styles.halign = 'right';
          data.cell.styles.cellPadding = {
            top: 1.5,
            bottom: 1.5,
            left: 1.5,
            right: 8,
          };
        },
      });
      writer.setY(resolvePdfSectionEndY(finalY, startY));
    } else if (tableDataError) {
      safeAddWrappedText('Reguleringsværdier kan ikke vises, fordi en nødvendig reguleringssats mangler.');
    } else {
      safeAddWrappedText('Ingen regulering i den relevante periode.');
    }
    for (const entry of offentligeYdelserUdvikling.entries) {
      writer.addSectionSpacer();
      writer.writeUnderlinedSubheader(entry.label);
      for (const segment of entry.beregnedeSegmenter) {
        const fraDisplay = formatDateShort(segment.fra) ?? segment.fra;
        const tilDisplay = formatDateShort(segment.til) ?? segment.til;
        const deltaText = formatReguleringFactorText(segment.deltaPct);
        const leftText = segment.kind === 'arbejdsdage'
          ? `${fraDisplay} - ${tilDisplay}: ${formatCountWithUnit(segment.arbejdsdage, 'arbejdsdag', 'arbejdsdage')} á ${formatCurrencyFromOre(segment.dagsloenOre)}${NBSP}kr.${deltaText} =`
          : `${fraDisplay} - ${tilDisplay}: ${formatMaanederTrimmed(segment.maaneder)} ${isSingularCount(segment.maaneder) ? 'måned' : 'måneder'} á ${formatCurrencyFromOre(segment.maanedsloenOre)}${NBSP}kr.${deltaText} =`;
        safeAddLeftRightText(leftText, formatMoneyOreWithKr(segment.amountOre), standardRightMaxWidth, { rightFontStyle: 'normal' });
      }
      if (entry.total.status === 'ok') {
        safeAddLeftRightText(
          `I alt ${entry.label}`,
          formatMoneyOreWithKr(entry.total.value),
          standardRightMaxWidth,
          { rightFontStyle: 'normal', lineAboveRightWidth: EO_RIGHT_COLUMN_WIDTH, lineAboveRightOffset: 4 }
        );
      } else {
        safeAddLeftRightText(`I alt ${entry.label}`, '—', standardRightMaxWidth, { rightFontStyle: 'normal' });
      }
    }
    if (offentligeYdelserUdvikling.total.status === 'ok') {
      writer.addSectionSpacer();
      safeAddLeftRightText(
        'Samlet offentlige ydelser (hypotetisk)',
        formatMoneyOreWithKr(offentligeYdelserUdvikling.total.value),
        standardRightMaxWidth,
        { rightFontStyle: 'normal', lineAboveRightWidth: EO_RIGHT_COLUMN_WIDTH, lineAboveRightOffset: 4 }
      );
    }
    writer.addSectionSpacer();
    writer.writeWrappedText('Offentlige ydelser fremskrives årligt per 1. januar med tilpasningsprocenten + 2 %, svarende til den almene statslige regulering af offentlige ydelser.');
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
      startEoBilagPage,
      renderSubheader,
      safeAddWrappedText: writer.writeWrappedText,
      writer,
    });
  }

  if (selectedElements.sygeferiegodtgoerelse && model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.length > 0) {
    startEoBilagPage('Sygeferiegodtgørelse');
    model.tabtArbejdsfortjeneste.sygeferiegodtgoerelse.perAnsaettelsesforhold.forEach((entry) => {
      renderSubheader(entry.ansaettelsesforholdNavn);
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
      writer.addSectionSpacer();
    });
  }

  writer.addFooter();

  // Download PDF
  writer.save(resolvePdfFileName(titel, visUdkastStempel, model.brevhoved?.journalnr));
};
