import type { DocumentDownloadFormat } from './documentFormat';
import type { PdfWriter } from '../pdf/infrastructure/pdfWriter';

type DocumentGenerationContext = Readonly<{
  format: DocumentDownloadFormat;
  pendingDownloads: Promise<void>[];
  createWriter?: (params?: Readonly<{ visUdkastStempel?: boolean; orientation?: 'portrait' | 'landscape' }>) => PdfWriter;
}>;

let activeContext: DocumentGenerationContext | null = null;

export const getActiveDocumentDownloadFormat = (): DocumentDownloadFormat => activeContext?.format ?? 'pdf';

export const getActiveDocumentWriterFactory = ():
  | ((params?: Readonly<{ visUdkastStempel?: boolean; orientation?: 'portrait' | 'landscape' }>) => PdfWriter)
  | undefined => activeContext?.createWriter;

export const registerPendingDocumentDownload = (pendingDownload: Promise<void>): void => {
  activeContext?.pendingDownloads.push(pendingDownload);
};

export const withDocumentGenerationContext = async <T>(
  format: DocumentDownloadFormat,
  run: () => T | Promise<T>,
  options?: Readonly<{
    createWriter?: (params?: Readonly<{ visUdkastStempel?: boolean; orientation?: 'portrait' | 'landscape' }>) => PdfWriter;
  }>
): Promise<T> => {
  const previousContext = activeContext;
  const context: DocumentGenerationContext = {
    format,
    pendingDownloads: [],
    createWriter: options?.createWriter,
  };
  activeContext = context;

  try {
    const result = await run();
    // Ikke-indlysende invariant: denne `await` er korrekthedskritisk for Word-stien.
    // Word-writeren færdiggør sit .docx asynkront via en registreret pending download
    // (registerPendingDocumentDownload). Uden denne await ville en fejl under den asynkrone
    // færdiggørelse ikke nå frem til kalderens catch (pdfService.runSelectedDocumentFormat),
    // og en mislykket Word-download ville stille returnere success med et tomt/korrupt dokument.
    // Fjern ikke denne await i en refaktor.
    await Promise.all(context.pendingDownloads);
    return result;
  } finally {
    activeContext = previousContext;
  }
};
