import type { DocumentDownloadFormat } from './documentFormat';
import type { DocumentWriter } from './writer/documentWriter';
import { renderDocumentModel, type DocumentModel } from './model/documentModel';

export type DocumentWriterOptions = Readonly<{
  visUdkastStempel?: boolean;
  orientation?: 'portrait' | 'landscape';
  onLayoutFallback?: (params: Readonly<{ message: string; label: string }>) => void;
}>;

export type DocumentWriterFactory = (params?: DocumentWriterOptions) => DocumentWriter;
export type DocumentRenderRequest = Readonly<{
  model: DocumentModel;
  writerOptions?: DocumentWriterOptions;
  properties: Parameters<DocumentWriter['setProperties']>[0];
}>;

/**
 * Isolerer ét dokumentforløbs format og writer-fabrik fra alle andre forløb.
 * Sessionsobjektet er immutable og kan derfor sikkert leve hen over asynkrone
 * grænser uden at samtidige downloads kan overtage hinandens kanal.
 */
export type DocumentGenerationSession = Readonly<{
  format: DocumentDownloadFormat;
  render: (request: DocumentRenderRequest) => Promise<Blob>;
}>;

export const createDocumentGenerationSession = (
  format: DocumentDownloadFormat,
  createWriter: DocumentWriterFactory
): DocumentGenerationSession => Object.freeze({
  format,
  render: async ({ model, writerOptions, properties }) => {
    const writer = createWriter(writerOptions);
    writer.setDisplayMode('fullheight');
    writer.setProperties(properties);
    renderDocumentModel(writer, model);
    return writer.build();
  },
});
