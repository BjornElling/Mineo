/**
 * Afviklingen af et ALLEREDE godkendt dokument (Fase 5). Typen `PreparedDocument<TInput>` kan kun
 * konstrueres af `prepareDocument`, så denne funktion kan strukturelt ikke nås med et ugated input:
 * lazy-load, formatvalg, generator og fil-I/O ligger bag gaten, ikke ved siden af den.
 *
 * Rækkefølgen (og hvorfor):
 *   1. Dev-server-preflight — kun DEV; forbedret fejltekst når vite er død (§A5 sidste punkt).
 *   2. Lazy-load af generatoren. FØRSTE asynkrone grænse.
 *   3. Friskheds-recheck efter generator-load.
 *   4. Formatvalg (PDF/Word) og writer-load. ANDEN asynkrone grænse — bevidst EFTER gaten,
 *      jf. planens arbejdstrin 8 "Placér PDF/Word-formatvalg efter gaten".
 *   5. Friskheds-recheck umiddelbart før generatorstart.
 *   6. Generator → artifact → browser-download.
 *
 * De to rechecks (3 og 5) er ikke redundans: hver af de to modul-loads er et vindue, hvor input
 * eller settings kan ændre sig, og et dokument må ikke dannes på et forældet grundlag
 * (`document-output-contract.md` §A2 punkt 4).
 */
import { createDocumentGenerationSession, type DocumentGenerationSession } from '../documentGenerationSession';
import { triggerDocumentDownload } from '../downloadArtifact';
import { getVisBrevhoved } from '../layout/documentBrevhoved';
import {
  buildDocumentFailureMessage,
  createPdfDownloadFailure,
  DOCUMENT_DOWNLOAD_SUCCESS,
  ensureDevServerAvailableForPdfDownload,
  type DocumentDownloadResult,
} from '../service/documentRuntimeFailure';
import type { PreparedDocument } from './prepareDocument';

const createSession = async (format: 'pdf' | 'word'): Promise<DocumentGenerationSession> => {
  if (format === 'word') {
    const { createDocxWriter } = await import('../../docx/infrastructure/docxWriter');
    return createDocumentGenerationSession('word', createDocxWriter);
  }
  const { createPdfChannelWriter } = await import('../../pdf/infrastructure/pdfWriter');
  return createDocumentGenerationSession('pdf', createPdfChannelWriter);
};

export const runPreparedDocument = async <TInput>(
  prepared: PreparedDocument<TInput>
): Promise<DocumentDownloadResult> => {
  const { definition, settings, input, isSourceCurrent } = prepared;
  const context = `documentService.${definition.id}`;
  const failureMessage = buildDocumentFailureMessage(settings, definition.errorLabel);

  const preflightFailure = await ensureDevServerAvailableForPdfDownload(context);
  if (preflightFailure) return preflightFailure;

  try {
    const render = await definition.loadRenderer();
    if (!isSourceCurrent()) {
      return { success: false, error: failureMessage };
    }

    const session = await createSession(settings.documentDownloadFormat);
    if (!isSourceCurrent()) {
      return { success: false, error: failureMessage };
    }

    const artifact = await render(session, input, {
      visBrevhoved: getVisBrevhoved(settings, definition.brevhovedType),
      settings,
    });
    triggerDocumentDownload(artifact);
    return DOCUMENT_DOWNLOAD_SUCCESS;
  } catch (error) {
    return await createPdfDownloadFailure(failureMessage, context, error);
  }
};
