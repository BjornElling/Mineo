import type { DocumentDownloadFormat } from './documentFormat';
import type { DocumentWriter } from './writer/documentWriter';

export type DocumentWriterFactory = (
  params?: Readonly<{
    visUdkastStempel?: boolean;
    orientation?: 'portrait' | 'landscape';
    onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
  }>
) => DocumentWriter;

type DocumentGenerationContext = Readonly<{
  format: DocumentDownloadFormat;
  pendingDownloads: Promise<void>[];
  createWriter?: DocumentWriterFactory;
}>;

let activeContext: DocumentGenerationContext | null = null;

// Fallback-writer-fabrik der KUN bruges når der ikke er en aktiv generations-kontekst.
// I produktion sættes den aldrig: alle downloads kører gennem
// `runSelectedDocumentFormat`, som altid injicerer en fabrik via konteksten. Den findes
// for at unit-tests kan kalde en generator direkte (uden download-stien) og få en
// PDF-writer; testopsætningen registrerer PDF-kanalens fabrik her. Holdes adskilt fra
// `activeContext`, så den ikke kan skygge for et eksplicit kontekst-valg.
let fallbackWriterFactory: DocumentWriterFactory | null = null;

export const setFallbackDocumentWriterFactory = (factory: DocumentWriterFactory | null): void => {
  fallbackWriterFactory = factory;
};

export const getActiveDocumentDownloadFormat = (): DocumentDownloadFormat => activeContext?.format ?? 'pdf';

export const getActiveDocumentWriterFactory = (): DocumentWriterFactory | undefined =>
  activeContext?.createWriter ?? fallbackWriterFactory ?? undefined;

export const registerPendingDocumentDownload = (pendingDownload: Promise<void>): void => {
  activeContext?.pendingDownloads.push(pendingDownload);
};

export const withDocumentGenerationContext = async <T>(
  format: DocumentDownloadFormat,
  run: () => T | Promise<T>,
  options?: Readonly<{
    createWriter?: DocumentWriterFactory;
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
    // færdiggørelse ikke nå frem til kalderens catch (documentService.runSelectedDocumentFormat),
    // og en mislykket Word-download ville stille returnere success med et tomt/korrupt dokument.
    // Fjern ikke denne await i en refaktor.
    await Promise.all(context.pendingDownloads);
    return result;
  } finally {
    activeContext = previousContext;
  }
};
