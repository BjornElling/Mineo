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
import type { DocumentExecutionEnvironment } from './documentExecutionEnvironment';
import { executeDocumentDownload } from './documentLifecycle';
import { resolveDocumentOutcomeMessage } from './documentMessages';
import type { DocumentGateReasons, DocumentOutcome } from './documentOutcome';
import type { DocumentOutputId } from './documentOutputId';
import type { DocumentSourceContext } from './documentSourceContext';

/**
 * Den reaktive gates resultat. Bærer HELE årsagslisten (ikke kun den første), så en konsument kan
 * vise mere end tooltippets primære grund, og bærer det token, gaten blev evalueret på, så en
 * konsument kan se hvilken revision vurderingen hører til.
 */
export type DocumentGateSnapshot =
  | Readonly<{ canDownload: true }>
  | Readonly<{ canDownload: false; reasons: DocumentGateReasons }>;

/**
 * En katalogpost med `TRequest`/`TInput` lukket inde. De to eneste operationer udefra er "evaluér
 * gaten for denne request" og "download denne request", og begge anvender definitionen på sig selv.
 * En katalogpost kan derfor hverken lække et ugated input ud eller modtage et fremmed input ind.
 */
export type DocumentOutput<TRequest, TSettings> = Readonly<{
  id: DocumentOutputId;
  /**
   * Den reaktive knap-gate. Kalder PRÆCIS samme `project` med samme `request` som
   * click-preflighten, så de to ikke kan drifte (§10 acceptkriterie 27).
   */
  evaluateGate: (context: DocumentSourceContext<TSettings>, request: TRequest) => DocumentGateSnapshot;
  download: (request: TRequest) => Promise<DocumentOutcome>;
  /**
   * Den brugerrettede besked for et udfald, eller `null` når der intet er at vise.
   *
   * Ligger på katalogposten frem for hos konsumenten, fordi beskeden kræver BÅDE definitionens
   * `labels` og miljøets formatpolitik — to ting, en side hverken bør kende eller kunne komme til at
   * kombinere forkert. Før Fase 5 skrev hver side sin egen "Kunne ikke generere …"-tekst, og
   * servicelaget omskrev den bagefter med en global `/PDF/g`-substitution.
   *
   * `settings` er kaldertidens settings (render-tidens kontekst). Formatet i beskeden er altså det,
   * brugeren ville få NU — hvilket er det rigtige, fordi beskeden vises efter aktiveringen og
   * beskriver, hvad der ville ske ved et nyt forsøg.
   */
  resolveOutcomeMessage: (outcome: DocumentOutcome, settings: TSettings) => string | null;
}>;

/**
 * Binder én definition til ét miljø. Kaldes kun af en apps katalog-komposition, så en katalogpost
 * altid bærer det miljø, den hører til — en Mineo-definition kan ikke afvikles med standalones
 * runtimepolitik eller omvendt.
 */
export const closeDocumentDefinition = <TRequest, TInput, TSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TSettings, TBrevhovedKey>,
  environment: DocumentExecutionEnvironment<TSettings, TBrevhovedKey>
): DocumentOutput<TRequest, TSettings> =>
  Object.freeze({
    id: definition.id,
    evaluateGate: (context, request) => {
      const projected = definition.project(context, request);
      return projected.status === 'ready'
        ? { canDownload: true }
        : { canDownload: false, reasons: projected.reasons };
    },
    download: (request) => executeDocumentDownload(definition, request, environment),
    resolveOutcomeMessage: (outcome, settings) => resolveDocumentOutcomeMessage(
      outcome,
      definition.labels,
      environment.resolveFormat(settings),
      environment.showRuntimeFailureLocally
    ),
  });
