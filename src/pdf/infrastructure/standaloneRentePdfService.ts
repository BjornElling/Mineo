import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';
import type { ISODateString } from '../../types/branded';
import type { DocumentDownloadResult } from '../../document/service/documentService';
import {
  buildRenteDocumentBaseTitle,
  generateRenteDocument,
  writeRenteDocumentContent,
} from '../../document/generators/renteberegning/renteDocument';
import { generateRenteOversigtDocument } from '../../document/generators/renteberegning/renteOversigtDocument';
import { createPdfChannelWriter } from './pdfWriter';
import { createDocumentGenerationSession } from '../../document/documentGenerationSession';
import { triggerDocumentDownload } from '../../document/downloadArtifact';
import { parseDanishDate } from '../../utils/dateUtils';
import { getDocumentCreatorBrand } from '../../document/layout/documentLayoutHelpers';
import { asError } from '../../utils/typeGuards';
import { resolveDocumentArtifactFileName } from '../../document/layout/documentFormatUtils';
import { createDocumentComposer } from '../../document/model/documentModel';
import type { ReadyInputRevision } from '../../domain/inputIntegrity/inputBlocker';
import { isReadyInputRevisionCurrent } from '../../document/service/documentInputRevision';

const PDF_DOWNLOAD_SUCCESS: DocumentDownloadResult = { success: true };
const PDF_DOWNLOAD_ERROR_MESSAGE = 'Kunne ikke generere rente-PDF';
const MINPROCESRENTE_PDF_METADATA = {
  subject: 'Renteberegning',
  author: 'minprocesrente.dk',
} as const;

// MinProcesrente er en namespace-isoleret standalone-app (jf. isolations-guarden i
// minprocesrenteStandaloneIsolation-testen): den må IKKE importere hovedappens centrale
// fejlrapportering/app-settings m.m. Runtime-fejl under en (allerede gated) download logges
// derfor lokalt med console.error (reel fejl, jf. console-politikken) og returneres som et
// fejl-result. Den brugervendte result.error-tekst er uændret.
const reportStandaloneRenteDownloadFailure = (error: unknown): DocumentDownloadResult => {
  const normalizedError = asError(error);
  console.error(PDF_DOWNLOAD_ERROR_MESSAGE, normalizedError);
  return { success: false, error: PDF_DOWNLOAD_ERROR_MESSAGE };
};

export const downloadStandaloneRentePdf = async (params: Readonly<{
  beloeb: number;
  actualInterestDate: string;
  beregningsdato: string;
  periods: ReadonlyArray<ProcessInterestPeriod>;
  latestReferenceRateDate: string | null;
  inputRevision: ReadyInputRevision;
  kommentarer?: string;
}>): Promise<DocumentDownloadResult> => {
  const {
    beloeb,
    actualInterestDate,
    beregningsdato,
    periods,
    latestReferenceRateDate,
    inputRevision,
    kommentarer,
  } = params;

  if (!isReadyInputRevisionCurrent(inputRevision)) {
    return { success: false, error: PDF_DOWNLOAD_ERROR_MESSAGE };
  }

  try {
    // Standalone MinProcesrente understøtter kun PDF og opretter derfor sin session
    // direkte med PDF-kanalens writer-fabrik.
    const session = createDocumentGenerationSession('pdf', createPdfChannelWriter);
    const artifact = await generateRenteDocument(session, beloeb, actualInterestDate, beregningsdato, periods, {
        visBrevhoved: false,
        stamdata: null,
        kommentarer,
        latestReferenceRateDate,
        metadata: MINPROCESRENTE_PDF_METADATA,
      });
    triggerDocumentDownload(artifact);
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return reportStandaloneRenteDownloadFailure(error);
  }
};

export const downloadStandaloneRenteOversigtPdf = async (params: Readonly<{
  beregningsdato: ISODateString;
  rows: ReadonlyArray<RenteOversigtRow>;
  latestReferenceRateDate?: ISODateString | null;
  inputRevision: ReadyInputRevision;
  kommentarer?: string;
}>): Promise<DocumentDownloadResult> => {
  const { beregningsdato, rows, latestReferenceRateDate = null, inputRevision, kommentarer } = params;

  if (rows.length === 0) {
    return { success: false, error: 'Ingen renteberegninger at downloade' };
  }
  if (!isReadyInputRevisionCurrent(inputRevision)) {
    return { success: false, error: PDF_DOWNLOAD_ERROR_MESSAGE };
  }

  try {
    // Se note i downloadStandaloneRentePdf: standalone opretter selv sin PDF-session.
    const session = createDocumentGenerationSession('pdf', createPdfChannelWriter);
    const artifact = await generateRenteOversigtDocument(session, beregningsdato, rows, {
        visBrevhoved: false,
        stamdata: null,
        kommentarer,
        latestReferenceRateDate,
        metadata: MINPROCESRENTE_PDF_METADATA,
      });
    triggerDocumentDownload(artifact);
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return reportStandaloneRenteDownloadFailure(error);
  }
};

export type RentePdfRowParams = Readonly<{
  beloeb: number;
  actualInterestDate: string;
  beregningsdato: string;
  periods: ReadonlyArray<ProcessInterestPeriod>;
  latestReferenceRateDate: string | null;
}>;

export const downloadAllStandaloneRentePdf = async (params: Readonly<{
  rows: ReadonlyArray<RentePdfRowParams>;
  inputRevision: ReadyInputRevision;
  kommentarer?: string;
}>): Promise<DocumentDownloadResult> => {
  const { rows, inputRevision, kommentarer } = params;

  if (rows.length === 0) {
    return { success: false, error: 'Ingen rækker at downloade' };
  }
  if (!isReadyInputRevisionCurrent(inputRevision)) {
    return { success: false, error: PDF_DOWNLOAD_ERROR_MESSAGE };
  }

  try {
    // Se note i downloadStandaloneRentePdf: standalone opretter selv sin PDF-session.
    // Multi-varianten bygger én samlet model og renderer via samme session-autoritet
    // som enkelt-dokument-stierne (ingen manuel writer-opsætning / renderDocumentModel).
    const session = createDocumentGenerationSession('pdf', createPdfChannelWriter);
    const { composer, build } = createDocumentComposer();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i > 0) {
        composer.addPage();
      }

      const startDate = parseDanishDate(row.actualInterestDate);
      const endDate = parseDanishDate(row.beregningsdato);
      if (!startDate || !endDate) {
        throw new Error('Ugyldige datoer for renteberegning');
      }
      if (row.periods.length === 0) {
        throw new Error('Ingen perioder fundet for renteberegning');
      }

      writeRenteDocumentContent(composer, row.beloeb, startDate, endDate, row.periods, {
        visBrevhoved: false,
        stamdata: null,
        kommentarer,
        latestReferenceRateDate: row.latestReferenceRateDate,
      });
    }

    composer.addFooter();
    const blob = await session.render({
      model: build(),
      properties: {
        title: 'Procesrente',
        subject: MINPROCESRENTE_PDF_METADATA.subject,
        author: MINPROCESRENTE_PDF_METADATA.author,
        creator: getDocumentCreatorBrand(),
      },
    });

    const firstRow = rows[0];
    const firstStart = parseDanishDate(firstRow.actualInterestDate);
    const firstEnd = parseDanishDate(firstRow.beregningsdato);
    const baseTitle = firstStart && firstEnd
      ? buildRenteDocumentBaseTitle(firstRow.beloeb, firstStart, firstEnd)
      : 'Procesrente-specifikationer';
    const suffix = rows.length > 1 ? ` +${rows.length - 1}` : '';
    const filename = resolveDocumentArtifactFileName(`${baseTitle}${suffix}`, false);
    triggerDocumentDownload({ blob, filename });

    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return reportStandaloneRenteDownloadFailure(error);
  }
};
