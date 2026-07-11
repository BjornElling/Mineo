import type { DocumentDownloadFormat } from './documentFormat';
import type { DocumentWriter } from './writer/documentWriter';

export type DocumentWriterOptions = Readonly<{
  visUdkastStempel?: boolean;
  orientation?: 'portrait' | 'landscape';
  onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
}>;

export type DocumentWriterFactory = (params?: DocumentWriterOptions) => DocumentWriter;

/**
 * Isolerer ét dokumentforløbs format og writer-fabrik fra alle andre forløb.
 * Sessionsobjektet er immutable og kan derfor sikkert leve hen over asynkrone
 * grænser uden at samtidige downloads kan overtage hinandens kanal.
 */
export type DocumentGenerationSession = Readonly<{
  format: DocumentDownloadFormat;
  createWriter: DocumentWriterFactory;
}>;

export const createDocumentGenerationSession = (
  format: DocumentDownloadFormat,
  createWriter: DocumentWriterFactory
): DocumentGenerationSession => Object.freeze({ format, createWriter });
