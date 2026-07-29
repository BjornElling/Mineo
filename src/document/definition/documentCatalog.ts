/**
 * Katalog-FABRIKKEN (Fase 5; `document-output-contract.md` §A2a).
 *
 * Dette modul indeholder bevidst INGEN definitioner. Kataloget var oprindeligt en global `Map`, som
 * statisk importerede alle domæners definitioner i kernelaget — og dermed hvert domænes projektioner
 * og gates. Mineos sider er ellers route-lazy (`App.tsx`), så efter en cutover ville den første
 * dokumentførende route have trukket samtlige domæners projektionskode ind, og standalone
 * MinProcesrente ville have trukket hele hovedappens domænegraf. (Generatorerne var ikke problemet —
 * de lazy-loades fortsat via `loadRenderer` — men projektionslaget mistede sin routeopdeling.)
 *
 * Derfor: kontrakter og fabrik bor her, mens KOMPOSITIONEN sker i app-/route-rødder. Hver app bygger
 * sit eget runtime-katalog over sine egne outputs, og `documentOutputId.ts` er den fælles
 * completeness-kilde, som en test måler de to kataloger imod.
 *
 * `TRequest`/`TInput` lukkes eksistentielt ved kilden: `closeDocumentDefinition` er det ene sted,
 * typerne bindes, så et katalog kan være en homogen liste uden at koblingen mellem `project` og
 * renderer går tabt. Der findes ingen `as`-cast og intet `unknown`-mellemled.
 */
import type { DocumentDefinition } from './documentDefinition';
import { documentActionFromDefinition, type DocumentAction } from './documentAction';
import type { DocumentExecutionEnvironment } from './documentExecutionEnvironment';
import { executeDocumentDownload } from './documentLifecycle';
import { resolveDocumentOutcomeMessage } from './documentMessages';
import type { DocumentGateReasons, DocumentOutcome } from './documentOutcome';
import type { DocumentOutputId } from './documentOutputId';
import type { DocumentSourceContext } from './documentSourceContext';
import type { EvaluationSourceToken } from '../../inputCore/evaluationSource';

/** Kun katalogfabrikken kan udstede en output-handle. */
const documentOutputBrand = Symbol('DocumentOutput');

/**
 * Den reaktive gates resultat. Bærer HELE årsagslisten (ikke kun den første), så en konsument kan
 * vise mere end tooltippets primære grund, og bærer det token, gaten blev evalueret på, så en
 * konsument kan se hvilken revision vurderingen hører til.
 */
export type DocumentGateSnapshot =
  | Readonly<{ canDownload: true; sourceToken: EvaluationSourceToken }>
  | Readonly<{ canDownload: false; sourceToken: EvaluationSourceToken; reasons: DocumentGateReasons }>;

/**
 * En katalogpost med `TRequest`/`TInput` lukket inde. De to eneste operationer udefra er "evaluér
 * gaten for denne request" og "download denne request", og begge anvender definitionen på sig selv.
 * En katalogpost kan derfor hverken lække et ugated input ud eller modtage et fremmed input ind.
 */
export type DocumentOutput<TRequest, TGateSettings, TRenderSettings> = Readonly<{
  readonly [documentOutputBrand]: true;
  id: DocumentOutputId;
  /**
   * Den reaktive knap-gate. Kalder PRÆCIS samme `project` med samme `request` som
   * click-preflighten, så de to ikke kan drifte (§10 acceptkriterie 27).
   */
  evaluateGate: (context: DocumentSourceContext<TGateSettings>, request: TRequest) => DocumentGateSnapshot;
  download: (request: TRequest) => Promise<DocumentOutcome>;
  /**
   * Den brugerrettede besked for et udfald, eller `null` når der intet er at vise.
   *
   * Ligger på katalogposten frem for hos konsumenten, fordi beskeden kræver BÅDE definitionens
   * `labels` og miljøets formatpolitik — to ting, en side hverken bør kende eller kunne komme til at
   * kombinere forkert. Før Fase 5 skrev hver side sin egen "Kunne ikke generere …"-tekst, og
   * servicelaget omskrev den bagefter med en global `/PDF/g`-substitution.
   *
   * `settings` er kaldertidens RENDER-settings (render-tidens kontekst). Formatet i beskeden er
   * altså det, brugeren ville få NU — hvilket er det rigtige, fordi beskeden vises efter aktiveringen
   * og beskriver, hvad der ville ske ved et nyt forsøg. Den er bevidst render-halvdelen og ikke
   * gate-halvdelen: beskeden navngiver netop formatet (R6-F03).
   */
  resolveOutcomeMessage: (outcome: DocumentOutcome, settings: TRenderSettings) => string | null;
}>;

/**
 * Binder én definition til ét miljø. Kaldes kun af en apps katalog-komposition, så en katalogpost
 * altid bærer det miljø, den hører til — en Mineo-definition kan ikke afvikles med standalones
 * runtimepolitik eller omvendt.
 */
export const closeDocumentDefinition = <TRequest, TInput, TGateSettings, TRenderSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey>,
  environment: DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey>
): DocumentOutput<TRequest, TGateSettings, TRenderSettings> =>
  closeDocumentAction(documentActionFromDefinition(definition), environment);

/** Binder også en dynamisk, men stadig nominalt lukket, dokumentaktion til ét app-miljø. */
export const closeDocumentAction = <TRequest, TGateSettings, TRenderSettings, TBrevhovedKey extends string>(
  action: DocumentAction<TRequest, TGateSettings, TBrevhovedKey>,
  environment: DocumentExecutionEnvironment<TGateSettings, TRenderSettings, TBrevhovedKey>
): DocumentOutput<TRequest, TGateSettings, TRenderSettings> =>
  Object.freeze({
    [documentOutputBrand]: true as const,
    id: action.id,
    evaluateGate: (context, request) => {
      const projected = action.resolve(context, request);
      return projected.status === 'ready'
        ? { canDownload: true, sourceToken: context.evaluation.issues.sourceToken }
        : { canDownload: false, sourceToken: context.evaluation.issues.sourceToken, reasons: projected.reasons };
    },
    download: (request) => executeDocumentDownload(action, request, environment),
    resolveOutcomeMessage: (outcome, settings) => resolveDocumentOutcomeMessage(
      outcome,
      action.labels,
      environment.resolveFormat(settings),
      environment.showRuntimeFailureLocally
    ),
  });
