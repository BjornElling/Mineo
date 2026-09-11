import { createDocumentGenerationSession } from '../../../document/documentGenerationSession';

/**
 * Opretter en eksplicit PDF-session efter testens jsPDF-mock er installeret.
 * Build erstattes med en tom blob, fordi disse tests verificerer render-kald og
 * layout, ikke serialisering af jsPDF-artefaktet.
 */
export const createPdfDocumentSessionForTest = async () => {
  const { createPdfChannelWriter } = await import('../../../pdf/infrastructure/pdfWriter');
  return createDocumentGenerationSession('pdf', (options) => ({
    ...createPdfChannelWriter(options),
    build: async () => new Blob([], { type: 'application/pdf' }),
  }));
};

/**
 * Opretter en PDF-session, der beholder produktions-writerens faktiske build.
 * Bruges kun af artefakttests, hvor de serialiserede PDF-bytes selv er beviset.
 */
export const createRealPdfDocumentSessionForTest = async () => {
  const { createPdfChannelWriter } = await import('../../../pdf/infrastructure/pdfWriter');
  return createDocumentGenerationSession('pdf', (options) => createPdfChannelWriter(options));
};
