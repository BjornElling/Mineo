/**
 * Hovedappens `DocumentExecutionEnvironment` (Fase 5, pass 0).
 *
 * Dette er Mineos composition root for dokument-download: her — og kun her — møder den
 * app-uafhængige livscyklus hovedappens konkrete politik: `AppSettings` som kildesettings, PDF/Word
 * efter brugerindstilling, brevhoved slået op i `brevhovedIndstillinger`, DEV-server-detektion, og
 * `reportSystemIssue` som failure-sink.
 *
 * Kernen kender ingen af de fire. Standalone MinProcesrente komponerer sit eget miljø med fast PDF,
 * intet brevhoved og en isoleret lokal sink (jf. isolations-værnet), uden at kernen skal kende
 * forskellen.
 */
import type { DocumentInputAccess } from '../../inputCore/react/inputRuntimeContext';
import { createDocumentGenerationSession, type DocumentGenerationSession } from '../documentGenerationSession';
import type { DocumentDownloadFormat } from '../documentFormat';
import type { DocumentBrevhovedType } from '../layout/documentBrevhoved';
import type { DocumentExecutionEnvironment } from '../definition/documentExecutionEnvironment';
import type { SourceSettings } from '../../settings/sourceSettings';
import type { DocumentDiagnostics, DocumentFailure } from '../definition/documentOutcome';
import {
  ensureDevServerAvailableForDocumentDownload,
  reportDocumentRuntimeFailure,
} from '../service/documentRuntimeFailure';

const createSession = async (format: DocumentDownloadFormat): Promise<DocumentGenerationSession> => {
  if (format === 'word') {
    const { createDocxWriter } = await import('../../docx/infrastructure/docxWriter');
    return createDocumentGenerationSession('word', createDocxWriter);
  }
  const { createPdfChannelWriter } = await import('../../pdf/infrastructure/pdfWriter');
  return createDocumentGenerationSession('pdf', createPdfChannelWriter);
};

/**
 * Bygger hovedappens miljø. `criticalActions` kommer fra input-runtimens binding og injiceres af
 * kalderen, så miljøet ikke selv skal kende React-konteksten.
 *
 * `TSettings` er `SourceSettings` og ikke `AppSettings`. Det er ikke en forenkling, men den
 * eneste korrekte binding: `DocumentSourceContext` er KONTRAvariant i `TSettings` (den optræder som
 * parameter i `evaluateGate`), så et miljø, der lovede hele `AppSettings`, ville kræve, at hver
 * konsument også havde hele `AppSettings` — og definitionerne lover kun at læse det source-relevante
 * snapshot. `projectSourceSettings` skærer capturens `AppSettings` ned til netop det.
 */
export const createMineoDocumentEnvironment = (
  runtime: DocumentInputAccess,
  settings: SourceSettings
): DocumentExecutionEnvironment<SourceSettings, DocumentBrevhovedType> => Object.freeze({
  captureSource: () => {
    return { evaluation: runtime.captureEvaluationSource(), settings };
  },
  readCurrentSourceToken: runtime.readCurrentSourceToken,
  criticalActions: runtime.criticalActions,
  resolveFormat: (settings) => settings.documentDownloadFormat,
  createSession,
  resolveVisBrevhoved: (settings, policy) =>
    policy.kind === 'none' ? false : settings.brevhovedIndstillinger[policy.key],
  checkDevServerAvailability: (diagnostics: DocumentDiagnostics): Promise<DocumentFailure | null> =>
    ensureDevServerAvailableForDocumentDownload(diagnostics),
  reportFailure: reportDocumentRuntimeFailure,
  // §A5: en systemteknisk fejl routes ALENE til den centrale fejlrapportering. En lokal tekst
  // ville rapportere den samme fejl to steder og møde brugeren med den inline i sideflowet.
  showRuntimeFailureLocally: false,
});
