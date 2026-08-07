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
import { logWarning } from '../../../utils/logger';
import { resolveDocumentArtifactFileName } from '../../layout/documentFormatUtils';
import type { SelectedElements } from './types';
import { renderOpgorelseSection } from './sections/opgoerelseSection';
import { renderEoBilagSections } from './sections/eoBilagSections';
import type { EoModel } from '../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel';
import type { DocumentGenerationSession } from '../../documentGenerationSession';

const EO_RIGHT_COLUMN_WIDTH = PDF_AMOUNT_RIGHT_COLUMN_WIDTH_MM;

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
    eoValues,
    stamdataValues,
    lineHeight,
    doubleLineHeight,
    afsluttesMed,
    rightColumnWidth: EO_RIGHT_COLUMN_WIDTH,
    safeAddLeftRightText,
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
