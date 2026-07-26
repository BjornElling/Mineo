/**
 * Standalone MinProcesrentes `DocumentExecutionEnvironment` (Fase 5, pass 6).
 *
 * Standalone-appens composition root for dokument-download. Den er den anden af de to apps, kernen
 * betjener, og den findes netop for at bevise, at livscyklussen ikke har hovedappens runtimepolitik
 * indbygget: her er formatet fast PDF, der er intet brevhoved, der er ingen dev-server-preflight, og
 * fejl-sinken er lokal.
 *
 * **Isolationen er en håndhævet grænse, ikke en stilart.** AST-reglen
 * `layer/minprocesrente-standalone-import-boundary` forbyder standalone-scopet at importere Mineos
 * `AppSettings`, `reportSystemIssue` m.fl. Derfor er `TSettings` her `void` frem for en dummy
 * settings-værdi: "standalone har ingen indstillinger" bliver en TYPE frem for et objekt med
 * ligegyldige felter, og `TBrevhovedKey` er `never`, så en brevhoved-nøgle ikke kan navngives.
 *
 * Før Fase 5 stod de tre standalone-outputs helt uden gate og uden commit-barriere
 * (`standaloneRentePdfService.ts`): et klik med en åben editor kunne danne dokumentet på de gamle
 * tal. Kontraktens §A2a kræver udtrykkeligt, at også standalone er katalogiseret.
 */
import { createDocumentGenerationSession, type DocumentGenerationSession } from '../../../document/documentGenerationSession';
import type { DocumentDownloadFormat } from '../../../document/documentFormat';
import type { DocumentExecutionEnvironment } from '../../../document/definition/documentExecutionEnvironment';
import type { DocumentDiagnostics, DocumentFailure } from '../../../document/definition/documentOutcome';
import type { InputRuntimeBinding } from '../../../inputCore/react/inputRuntimeContext';

/**
 * Standalone understøtter kun PDF. Word ville kræve docx-writeren i standalone-bundlet, og
 * formatvalget bor i hovedappens indstillinger, som standalone hverken har eller må importere.
 */
const createStandalonePdfSession = async (format: DocumentDownloadFormat): Promise<DocumentGenerationSession> => {
  if (format !== 'pdf') {
    throw new Error(`Standalone MinProcesrente understøtter kun PDF, men fik formatet "${format}".`);
  }
  const { createPdfChannelWriter } = await import('../../../pdf/infrastructure/pdfWriter');
  return createDocumentGenerationSession('pdf', createPdfChannelWriter);
};

/**
 * Standalones fejl-sink. Kun `kind: 'runtime'` når hertil (kernen filtrerer), og standalone har
 * ingen central systemfejls-overflade at rapportere til — `console.error` er den reelle fejl-log,
 * jf. den eksisterende note i `standaloneRentePdfService.ts`.
 */
const reportStandaloneFailure = (failure: DocumentFailure, diagnostics: DocumentDiagnostics): void => {
  if (failure.kind !== 'runtime') return;
  console.error(
    `Kunne ikke generere dokument (${diagnostics.outputId}, fase ${diagnostics.phase})`,
    failure.cause
  );
};

/** Standalones miljø. `TSettings = void`: appen har ingen indstillinger, der kan påvirke et dokument. */
export const createStandaloneDocumentEnvironment = (
  runtime: Pick<InputRuntimeBinding, 'captureEvaluationSource' | 'readCurrentSourceToken' | 'criticalActions'>
): DocumentExecutionEnvironment<void, never> => Object.freeze({
  captureSource: () => ({
    evaluation: runtime.captureEvaluationSource(),
    settings: undefined,
  }),
  readCurrentSourceToken: runtime.readCurrentSourceToken,
  criticalActions: runtime.criticalActions,
  resolveFormat: () => 'pdf',
  createSession: createStandalonePdfSession,
  // Ingen brevhoved-nøgler findes i standalone; policyen kan derfor kun være `{ kind: 'none' }`.
  resolveVisBrevhoved: () => false,
  // Ingen `checkDevServerAvailability`: standalone har ingen dev-server-heuristik. Kernens
  // entry-friskhedscheck ligger bevidst UDEN FOR den gren, så det også kører her.
  reportFailure: reportStandaloneFailure,
  // Standalone har ingen central fejloverflade (må ikke importere `reportSystemIssue`), så uden en
  // lokal besked ville en runtimefejl være helt tavs for brugeren.
  showRuntimeFailureLocally: true,
});
