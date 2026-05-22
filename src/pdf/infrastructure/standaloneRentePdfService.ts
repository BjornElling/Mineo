import type { ProcessInterestPeriod } from '../../domain/renteberegning/procesrenteCalculator';
import type { PdfDownloadResult } from './pdfService';
import { reportSystemIssue } from '../../utils/systemIssueReporter';

const PDF_DOWNLOAD_SUCCESS: PdfDownloadResult = { success: true };

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
    reportSystemIssue({
      code: 'pdf:download_failure',
      area: 'pdf',
      context: 'standaloneRentePdfService.downloadStandaloneRentePdf',
      userMessage: 'Kunne ikke generere rente-PDF',
      developerMessage: normalizedError.message,
      error: normalizedError,
    });
    return { success: false, error: 'Kunne ikke generere rente-PDF' };
  }
};
