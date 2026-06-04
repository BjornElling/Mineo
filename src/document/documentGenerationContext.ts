import type { DocumentDownloadFormat } from './documentFormat';
import type { PdfWriter } from '../pdf/infrastructure/pdfWriter';

type DocumentGenerationContext = Readonly<{
  format: DocumentDownloadFormat;
  pendingDownloads: Promise<void>[];
  createWriter?: (params?: Readonly<{ visUdkastStempel?: boolean }>) => PdfWriter;
}>;

let activeContext: DocumentGenerationContext | null = null;

export const getActiveDocumentDownloadFormat = (): DocumentDownloadFormat => activeContext?.format ?? 'pdf';

export const getActiveDocumentWriterFactory = ():
  | ((params?: Readonly<{ visUdkastStempel?: boolean }>) => PdfWriter)
  | undefined => activeContext?.createWriter;

export const registerPendingDocumentDownload = (pendingDownload: Promise<void>): void => {
  activeContext?.pendingDownloads.push(pendingDownload);
};

export const withDocumentGenerationContext = async <T>(
  format: DocumentDownloadFormat,
  run: () => T | Promise<T>,
  options?: Readonly<{
    createWriter?: (params?: Readonly<{ visUdkastStempel?: boolean }>) => PdfWriter;
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
    await Promise.all(context.pendingDownloads);
    return result;
  } finally {
    activeContext = previousContext;
  }
};
