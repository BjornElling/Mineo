/**
 * Dokument-preflightens ENE implementering (Fase 5; `document-output-contract.md` §A2/§A2.1).
 *
 * Rækkefølgen her er trust-kritisk og var før Fase 5 kopieret ind i hver enkelt callsite —
 * med det resultat, at fem outputs manglede mindst ét trin (se WI-008's kortlægning). Nu findes
 * den præcis ét sted:
 *
 *   1. Commit-barriere: `criticalActions.prepare('download')` settler en eventuel åben editor.
 *   2. Frisk, stabil kildeoptagelse EFTER settle (aldrig render-tidens evaluation).
 *   3. Token-lighed mellem barrierens token og det optagne snapshots token — en godkendelse fra
 *      et tidligere token må ikke genbruges (§A2 sidste konsekvenspunkt).
 *   4. Definitionens `project`: dependencies, autoritativ projektion og output-invariants.
 *
 * Først når alle fire er passeret, findes der et `PreparedDocument`. Lazy-load, generator og
 * fil-I/O ligger i `runPreparedDocument.ts` og kan derfor strukturelt ikke nås før gaten
 * (planens exitkriterie: "For blokerede cases beviser testen, at der ikke sker lazy-load,
 * generatorimport eller fil-I/O").
 */
import { sourceTokensEqual, type EvaluationSourceToken } from '../../inputCore/evaluationSource';
import type { InputEvaluation } from '../../inputCore/inputReader';
import type { EditorFocusTarget } from '../../inputCore/runtime/activeEditorRegistry';
import type { CriticalActionCoordinator } from '../../inputCore/runtime/criticalActionCoordinator';
import type { DocumentSettings } from '../layout/documentBrevhoved';
import type { DocumentDownloadGateReason } from '../layout/documentGateTypes';
import type { DocumentDefinition } from './documentDefinition';
import { createDocumentSourceContext } from './documentSourceContext';

/**
 * Den read-only kildeport, preflighten optager sit friske snapshot fra. Hovedappen leverer
 * `captureProductionEvaluationSource`; standalone-appen og tests leverer deres egen. Porten er
 * bevidst en funktion og ikke et objekt, så preflighten ikke kan holde et forældet snapshot.
 *
 * Produktionen leverer hele `AppSettings`, som strukturelt opfylder `DocumentSettings`; kernen
 * ser kun sidstnævnte og kan derfor ikke læse UI-indstillinger.
 */
export type DocumentEvaluationSource = () => Readonly<{
  evaluation: InputEvaluation;
  settings: DocumentSettings;
  isSourceCurrent: () => boolean;
}>;

/**
 * Et godkendt dokument. Bærer det token, godkendelsen hviler på, og den `isSourceCurrent`-closure,
 * afviklingen re-tjekker imod ved hver asynkron grænse. Typen kan kun konstrueres af
 * `prepareDocument`, så en generator ikke kan nås med et ugated input.
 */
export type PreparedDocument<TInput> = Readonly<{
  definition: DocumentDefinition<TInput>;
  input: TInput;
  settings: DocumentSettings;
  sourceToken: EvaluationSourceToken;
  isSourceCurrent: () => boolean;
}>;

/**
 * Hvorfor preflighten stoppede. `settle-failed` og `stale-source` er systemtilstande, hvor
 * brugeren blot skal prøve igen; `gate-blocked` er den brugerrettelige tilstand med definitionens
 * egne auditerbare årsager. `focusTarget` sættes kun ved `settle-failed`, hvor der findes et
 * konkret felt at pege på (§A2.1 sidste punkt).
 */
export type DocumentPreflightRejection =
  | Readonly<{ status: 'settle-failed'; focusTarget: EditorFocusTarget | null }>
  | Readonly<{ status: 'editor-open' }>
  | Readonly<{ status: 'stale-source' }>
  | Readonly<{ status: 'gate-blocked'; reasons: readonly DocumentDownloadGateReason[] }>;

export type DocumentPreflightResult<TInput> =
  | Readonly<{ status: 'ready'; prepared: PreparedDocument<TInput> }>
  | Readonly<{ status: 'rejected'; rejection: DocumentPreflightRejection }>;

const rejected = <TInput>(rejection: DocumentPreflightRejection): DocumentPreflightResult<TInput> =>
  Object.freeze({ status: 'rejected' as const, rejection });

export const prepareDocument = async <TInput>(
  definition: DocumentDefinition<TInput>,
  deps: Readonly<{
    criticalActions: CriticalActionCoordinator;
    captureSource: DocumentEvaluationSource;
  }>
): Promise<DocumentPreflightResult<TInput>> => {
  // 1. Commit-barriere. Download settler den åbne editor (§1.4-matricen); et fejlende settle er
  //    fail-closed, fordi vi da ikke kan garantere, at editoren blev finaliseret.
  const preparation = await deps.criticalActions.prepare('download');
  if (preparation.status === 'blocked') {
    return rejected({ status: 'settle-failed', focusTarget: preparation.target });
  }
  if (preparation.status === 'noop') {
    return rejected({ status: 'editor-open' });
  }

  // 2. Frisk, stabilt kildesnapshot EFTER settle.
  const source = deps.captureSource();

  // 3. Token-lighed: barrierens token og snapshottets token skal være samme revision. Uden dette
  //    kan et input-/settingsskift i vinduet mellem settle og optagelse slippe igennem.
  if (!sourceTokensEqual(preparation.token, source.evaluation.issues.sourceToken)) {
    return rejected({ status: 'stale-source' });
  }

  // 4. Definitionens dependencies, projektion og output-invariants — samme funktion som den
  //    reaktive knap-gate kalder. Konteksten er frisk, så dens memo kun deler arbejde inden for
  //    denne ene aktivering.
  const projected = definition.project(createDocumentSourceContext(source.evaluation, source.settings));
  if (projected.status === 'blocked') {
    return rejected({ status: 'gate-blocked', reasons: projected.reasons });
  }

  return Object.freeze({
    status: 'ready' as const,
    prepared: Object.freeze({
      definition,
      input: projected.input,
      settings: source.settings,
      sourceToken: source.evaluation.issues.sourceToken,
      isSourceCurrent: source.isSourceCurrent,
    }),
  });
};
