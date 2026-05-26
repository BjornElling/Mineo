import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { PdfDownloadResult } from './pdfService';

const PDF_DOWNLOAD_SUCCESS: PdfDownloadResult = { success: true };
const PDF_DOWNLOAD_ERROR_MESSAGE = 'Kunne ikke generere rente-PDF';

const toError = (value: unknown): Error => {
  return value instanceof Error ? value : new Error(String(value));
};

export const downloadStandaloneRentePdf = async (params: Readonly<{
  beloeb: number;
  actualInterestDate: string;
  beregningsdato: string;
  periods: ReadonlyArray<ProcessInterestPeriod>;
  latestReferenceRateDate: string | null;
  kommentarer?: string;
}>): Promise<PdfDownloadResult> => {
  const {
    beloeb,
    actualInterestDate,
    beregningsdato,
    periods,
    latestReferenceRateDate,
    kommentarer,
  } = params;

  try {
    const { generateRentePdf } = await import('../domains/renteberegning/rentePdf');
    generateRentePdf(beloeb, actualInterestDate, beregningsdato, periods, {
      visBrevhoved: false,
      stamdata: null,
      kommentarer,
      latestReferenceRateDate,
    });
    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    const normalizedError = toError(error);
    console.error(PDF_DOWNLOAD_ERROR_MESSAGE, normalizedError);
    return { success: false, error: PDF_DOWNLOAD_ERROR_MESSAGE };
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
}>): Promise<PdfDownloadResult> => {
  const { rows, kommentarer } = params;

  if (rows.length === 0) {
    return { success: false, error: 'Ingen rækker at downloade' };
  }

  try {
    const [
      { writeRentePdfContent, buildRentePdfBaseTitle, buildRentePdfFilename },
      { createStandardPdfWriter },
      { parseDanishDate },
    ] = await Promise.all([
      import('../domains/renteberegning/rentePdf'),
      import('./pdfWriter'),
      import('../../utils/dateUtils'),
    ]);

    const writer = createStandardPdfWriter();
    writer.setDisplayMode('fullheight');
    writer.setProperties({
      title: 'Procesrente',
      subject: 'Erstatningsberegning',
      author: 'Mineo',
      creator: 'mineo.dk',
    });

    let firstStart: Date | null = null;
    let firstEnd: Date | null = null;

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

      if (i === 0) {
        firstStart = startDate;
        firstEnd = endDate;
      }

      writeRentePdfContent(writer, row.beloeb, startDate, endDate, row.periods, {
        visBrevhoved: false,
        stamdata: null,
        kommentarer,
        latestReferenceRateDate: row.latestReferenceRateDate,
      });
    }

    writer.addFooter();

    const firstRow = rows[0];
    const baseTitle = firstStart && firstEnd
      ? buildRentePdfBaseTitle(firstRow.beloeb, firstStart, firstEnd)
      : 'Procesrente-specifikationer';
    const suffix = rows.length > 1 ? ` +${rows.length - 1}` : '';
    const filename = buildRentePdfFilename(`${baseTitle}${suffix}`);
    writer.save(filename);

    return PDF_DOWNLOAD_SUCCESS;
  } catch (error) {
    const normalizedError = toError(error);
    console.error(PDF_DOWNLOAD_ERROR_MESSAGE, normalizedError);
    return { success: false, error: PDF_DOWNLOAD_ERROR_MESSAGE };
  }
};
