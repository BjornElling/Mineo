import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { RenteOversigtRow } from '../../document/generators/renteberegning/renteOversigtDocument';
import type { ISODateString } from '../../types/branded';
import type { DocumentDownloadResult } from '../../document/service/documentService';
import {
  buildRenteDocumentBaseTitle,
  buildRenteDocumentFilename,
  generateRenteDocument,
  writeRenteDocumentContent,
} from '../../document/generators/renteberegning/renteDocument';
import { generateRenteOversigtDocument } from '../../document/generators/renteberegning/renteOversigtDocument';
import { createPdfChannelWriter } from './pdfWriter';
import { parseDanishDate } from '../../utils/dateUtils';
import { getDocumentCreatorBrand } from '../../document/layout/documentLayoutHelpers';
import { asError } from '../../utils/typeGuards';

const PDF_DOWNLOAD_SUCCESS: DocumentDownloadResult = { success: true };
const PDF_DOWNLOAD_ERROR_MESSAGE = 'Kunne ikke generere rente-PDF';

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
  kommentarer?: string;
}>): Promise<DocumentDownloadResult> => {
  const {
    beloeb,
    actualInterestDate,
    beregningsdato,
    periods,
    latestReferenceRateDate,
    kommentarer,
  } = params;

  try {
    generateRenteDocument(beloeb, actualInterestDate, beregningsdato, periods, {
      visBrevhoved: false,
      stamdata: null,
      kommentarer,
      latestReferenceRateDate,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return reportStandaloneRenteDownloadFailure(error);
  }
};

export const downloadStandaloneRenteOversigtPdf = async (params: Readonly<{
  beregningsdato: ISODateString;
  rows: ReadonlyArray<RenteOversigtRow>;
  kommentarer?: string;
}>): Promise<DocumentDownloadResult> => {
  const { beregningsdato, rows, kommentarer } = params;

  if (rows.length === 0) {
    return { success: false, error: 'Ingen renteberegninger at downloade' };
  }

  try {
    generateRenteOversigtDocument(beregningsdato, rows, {
      visBrevhoved: false,
      stamdata: null,
      kommentarer,
    });
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
  kommentarer?: string;
}>): Promise<DocumentDownloadResult> => {
  const { rows, kommentarer } = params;

  if (rows.length === 0) {
    return { success: false, error: 'Ingen rækker at downloade' };
  }

  try {
    const writer = createPdfChannelWriter();
    writer.setDisplayMode('fullheight');
    writer.setProperties({
      title: 'Procesrente',
      subject: 'Erstatningsberegning',
      author: 'Mineo',
      creator: getDocumentCreatorBrand(),
    });

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (i > 0) {
        writer.addPage();
      }

      const startDate = parseDanishDate(row.actualInterestDate);
      const endDate = parseDanishDate(row.beregningsdato);
      if (!startDate || !endDate) {
        throw new Error('Ugyldige datoer for renteberegning');
      }
      if (row.periods.length === 0) {
        throw new Error('Ingen perioder fundet for renteberegning');
      }

      writeRenteDocumentContent(writer, row.beloeb, startDate, endDate, row.periods, {
        visBrevhoved: false,
        stamdata: null,
        kommentarer,
        latestReferenceRateDate: row.latestReferenceRateDate,
      });
    }

    writer.addFooter();

    const firstRow = rows[0];
    const firstStart = parseDanishDate(firstRow.actualInterestDate);
    const firstEnd = parseDanishDate(firstRow.beregningsdato);
    const baseTitle = firstStart && firstEnd
      ? buildRenteDocumentBaseTitle(firstRow.beloeb, firstStart, firstEnd)
      : 'Procesrente-specifikationer';
    const suffix = rows.length > 1 ? ` +${rows.length - 1}` : '';
    const filename = buildRenteDocumentFilename(`${baseTitle}${suffix}`);
    writer.save(filename);

    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    return reportStandaloneRenteDownloadFailure(error);
  }
};
