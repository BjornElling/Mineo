/**
 * Hovedappens `DocumentExecutionEnvironment`.
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
import type { MineoDocumentGateSettings } from '../definition/mineoDocumentDefinition';
import {
  projectDocumentRenderSettings,
  projectEoRowPolicy,
  type DocumentRenderSettings,
  type SourceSettings,
} from '../../settings/sourceSettings';
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
 * Ingen af de to settings-halvdele er `AppSettings`. Det er ikke en forenkling, men den eneste
 * korrekte binding: `DocumentSourceContext` er KONTRAvariant i sin gate-settings (den optræder som
 * parameter i `evaluateGate`), så et miljø, der lovede hele `AppSettings`, ville kræve, at hver
 * konsument også havde hele `AppSettings` — og definitionerne lover kun at læse det source-relevante
 * snapshot. `projectSourceSettings` skærer capturens `AppSettings` ned til netop det.
 *
 * **De to halvdele er DISJUNKTE.** `gateSettings` er rækkepolitikken — det eneste settings,
 * en definitions `project` kan se — og `renderSettings` er format + brevhoved, som kun dette miljø
 * læser, og først efter gaten har sagt ready. Formatet vælger writer, ikke dækning; opdelingen gør
 * normen til en typegrænse frem for en regel, et værn skal overvåge.
 *
 * **`readSourceSettings` er en FUNKTION, ikke en værdi.** Begge halvdele af kildesnapshottet skal
 * optages på SAMME tidspunkt. Tog miljøet imod et færdigt `SourceSettings`-objekt, ville det uundgåeligt
 * være fanget ved React-render, mens `captureEvaluationSource()` læser friskt efter settle — og et nyere
 * settingsrevision-token kunne dermed parres med et ældre format-, brevhoved- eller EO-regelobjekt.
 * Tokenet ville se aktuelt ud, så intet friskhedscheck kunne fange det. Signaturen udelukker fejlen: der
 * findes ikke længere en værdi at holde fast på. Opdelingen i to halvdele ændrer det ikke: begge
 * projiceres fra ÉT `readSourceSettings()`-kald nedenfor, så de ikke kan stamme fra to tidspunkter.
 */
export const createMineoDocumentEnvironment = (
  runtime: DocumentInputAccess,
  readSourceSettings: () => SourceSettings
): DocumentExecutionEnvironment<MineoDocumentGateSettings, DocumentRenderSettings, DocumentBrevhovedType> => Object.freeze({
  captureSource: () => {
    // Rækkefølgen er bevidst: evalueringen optages først (den validerer selv sit token mod runtime), og
    // settings læses umiddelbart efter fra den værdi, der publiceres i samme layout-fase som revisionen.
    const evaluation = runtime.captureEvaluationSource();
    // ÉT læs, to projektioner. Læste de to halvdele hver sit `readSourceSettings()`, kunne de stamme
    // fra to revisioner, og den atomiske kildeoptagelse ville være tabt.
    const settings = readSourceSettings();
    return {
      evaluation,
      gateSettings: projectEoRowPolicy(settings),
      renderSettings: projectDocumentRenderSettings(settings),
    };
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
