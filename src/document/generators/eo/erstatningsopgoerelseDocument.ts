/**
 * PDF Generator for Erstatningsopgørelse
 *
 * Genererer PDF-dokument med komplet erstatningsopgørelse
 */

import { PDF_BASE_LINE_HEIGHT_MM, PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM } from '../../layout/pdfConfig';
import type { DocumentCommonOptions } from '../../layout/documentOptions';
import { defineDocument } from '../documentGeneratorSetup';
import type { DocumentLabelValueOptions } from '../../model/documentModel';
import type { ErstatningsopgoerelseValues, StamdataValues } from '../../../schemas/formSchemas';
import type { MidlertidigtEetAfgoerelseGroup } from '../../../domain/erstatningsopgoerelse/helpers/midlertidigtEetInsertRows';
import type { Calculable } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { MoneyOre } from '../../../domain/money/money';
import { logWarning } from '../../../utils/logger';
import {
  parseOptionalIsoDate,
} from '../../../domain/erstatningsopgoerelse/helpers/eoSharedUtils';
import { formatISOToDanish as formatDateShort, formatIsoDateLong as formatDateLong } from '../../../utils/dateFormatting';
import {
  resolveLoenSkadedatoText,
} from '../../../domain/erstatningsopgoerelse/engines/reguleringsPresentation';
import {
  formatCountWithUnit,
  formatCurrencyFromOre,
  formatCurrencyFromOreTrimmed,
  formatMaanederTrimmed,
  formatMoneyOreWithKr,
  formatMoneyOreWithKrTrimmed,
  isSingularCount,
  resolveDocumentArtifactFileName,
} from '../../layout/documentFormatUtils';
import type { SelectedElements } from './types';
import { renderOpgorelseSection } from './sections/opgoerelseSection';
import { renderEoBilagSections } from './sections/eoBilagSections';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { DocumentGenerationSession } from '../../documentGenerationSession';

const NBSP = '\u00A0';
const EO_RIGHT_COLUMN_WIDTH = PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM;

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

const resolveUdkastStempelValue = (value: unknown): boolean => value === 'Ja';

/**
 * Options for erstatningsopgørelse PDF
 *
 * Udvider DocumentCommonOptions for visBrevhoved-kontrakten.
 * stamdata fra DocumentCommonOptions bruges ikke — brevhoved-data hentes fra model.brevhoved.
 */
interface ErstatningsopgoerelseDocumentOptions extends DocumentCommonOptions {
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
 * @param {ErstatningsopgoerelseDocumentOptions} options - Valgfrie indstillinger
 */
export const generateErstatningsopgoerelseDocument = (
  session: DocumentGenerationSession,
  stamdataValues: StamdataValues,
  eoValues: ErstatningsopgoerelseValues,
  selectedElements: SelectedElements,
  options: ErstatningsopgoerelseDocumentOptions
) => {
  if (!selectedElements.opgoerelse) {
    throw new Error('Dokumentgenerering kræver, at elementet "Opgørelse" er valgt.');
  }

  const { visBrevhoved = false } = options;
  const visUdkastStempel = options.visUdkastStempel ?? resolveUdkastStempelValue(eoValues.indsaetUdkastStempel);
  const afsluttesMed = options.erstatningsopgoerelseAfsluttesMed ?? eoValues.erstatningsopgoerelseAfsluttesMed;
  const lineHeight = PDF_BASE_LINE_HEIGHT_MM;
  const doubleLineHeight = lineHeight * 2;
  if (!options.document) {
    throw new Error('EO-dokumentet kræver en præ-projiceret dokumentmodel.');
  }
  const model = options.document;
  const titel = model.titel;

  const warnLayoutFallback = ({ message, label }: Readonly<{ message: string; label: string }>) => {
    logWarning('PDF-layout fallback aktiveret', {
      context: 'pdf.erstatningsopgoerelse.layout',
      data: { message, label },
    });
  };

  const generate = defineDocument<void>({
    title: titel,
    filename: (_input, format) => resolveDocumentArtifactFileName(
      titel,
      visUdkastStempel,
      model.brevhoved?.journalnr,
      format
    ),
    writerOptions: { onLayoutFallback: warnLayoutFallback },
    beforeBrevhoved: (writer) => {
      if (visUdkastStempel) writer.addUdkastWatermark();
    },
    brevhoved: () => visBrevhoved && model.brevhoved
      ? {
        journalnr: model.brevhoved.journalnr,
        advokat: model.brevhoved.advokat,
        sagsbehandler: model.brevhoved.sagsbehandler,
        // UND TAGELSE: EOberegning-tab bruger "Opgørelse lavet den" i stedet for dags dato.
        dagsDatoISO: model.brevhoved.dagsDatoISO,
      }
      : null,
    titleOptions: { trailingSpacing: 0 },
    body: (writer) => {
  const safeAddLeftRightText = (
    leftText: string,
    rightText: string,
    rightMaxWidth: number,
    options?: DocumentLabelValueOptions
  ) => {
    writer.writeLeftRightText(
      leftText,
      rightText,
      {
        ...options,
        minRightColumnWidth: Math.max(rightMaxWidth, EO_RIGHT_COLUMN_WIDTH),
        minRightColumnWidthText: '000.000.000,00',
      }
    );
  };

  const renderSubheader = writer.writeBoldSubheader;

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

  renderEoBilagSections({
    writer,
    model,
    eoValues,
    stamdataValues,
    selectedElements,
    midlertidigtEetGroups: options.midlertidigtEetGroups,
  });

    },
  });
  return generate(session, undefined);
};
