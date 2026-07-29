/**
 * Én typed dokumentdefinition pr. katalogiseret output (Fase 5;
 * `document-output-contract.md` §A1.2/§A2/§A7.1).
 *
 * Definitionen er den ENE ejer af et outputs inputdependencies, gate og output-invariants. Før
 * Fase 5 var den viden spredt over tre lag pr. output — React-handleren (commit-barriere,
 * kildeoptagelse, token-lighed, gate), `documentService.ts`' per-output funktion (lazy-load,
 * friskheds-recheck, formatvalg, generatorkald, fejlrouting) og et domæne-gate-modul — og hvert
 * output havde sin egen kopi af den spredning. Det gjorde det umuligt at håndhæve "alle outputs gør
 * dette", og fem af de atten outputs manglede i praksis mindst ét trin.
 *
 * Efter Fase 5 er livscyklussen ÉT objekt: definitionen leverer `project` (dependencies + gate) og
 * `loadRenderer` (generatorkald), og kernen ejer rækkefølgen. Reaktiv knap-gate og click-preflight
 * kalder derfor samme `project` og kan ikke drifte fra hinanden (§10 acceptkriterie 27).
 */
import type { DocumentArtifact } from '../downloadArtifact';
import type { DocumentGenerationSession } from '../documentGenerationSession';
import type { DocumentGateReasons } from './documentOutcome';
import type { DocumentBrevhovedPolicy } from './documentExecutionEnvironment';
import type { DocumentOutputId } from './documentOutputId';
import type { DocumentSourceContext } from './documentSourceContext';

/**
 * Resultatet af definitionens dependency-/gate-evaluering.
 *
 * `ready` betyder: alle dependencies er læsbare, den autoritative projektion kan dannes, og
 * output-invariants holder. `blocked` bærer de auditerbare årsager, som både knappens tooltip og
 * click-preflightens afvisning bruger — ÉN årsagskilde, ikke to (§A2). Listen er non-empty, fordi en
 * blokering uden synlig grund er et invariantbrud.
 */
export type DocumentProjectionResult<TInput> =
  | Readonly<{ status: 'ready'; input: TInput }>
  | Readonly<{ status: 'blocked'; reasons: DocumentGateReasons }>;

/**
 * Definitionens generator-side. Modtager KUN den godkendte, tokenbundne `TInput` og
 * brevhoved-beslutningen — aldrig en reader, rå sektioner eller UI-state (§A1.4).
 */
export type DocumentRenderer<TInput> = (
  session: DocumentGenerationSession,
  input: TInput,
  context: Readonly<{ visBrevhoved: boolean }>
) => Promise<DocumentArtifact>;

/**
 * Fejltekst-metadata pr. output.
 *
 * Erstatter pass 0's arvede `errorLabel: string`, som var en PDF-formuleret prosasætning ("Kunne
 * ikke generere satser-PDF"), hvis format bagefter blev omskrevet med en global `/PDF/g`-regex.
 * Substitutionen var skrøbelig af konstruktion — den forudsatte, at ordet "PDF" i teksten
 * UDELUKKENDE optrådte som formatreference — og `document-format-contract.md` kræver kun formatet i
 * knapper, tooltips og aria-labels, ikke denne tekstomskrivning. Nu erklærer outputtet i stedet sit
 * navn, og laget formulerer beskeden.
 */
export type DocumentLabels = Readonly<{
  /** Outputtets navn i brugerbeskeder, fx "erstatningsopgørelse" eller "KRL". Uden format-suffiks. */
  documentName: string;
}>;

/**
 * `TRequest` er outputtets AKTIVERINGSIDENTITET — det, brugeren pegede på, når ét output kan
 * aktiveres for flere entiteter.
 *
 * Fem outputs har brug for den: `rente` og `standalone-rente` aktiveres pr. renteberegningsrække,
 * og `regulering`/`krl`/`kl-loenaftaler` findes både for EO's overordnede løn og for hvert konkret
 * ansættelsesforhold. Uden en parameter i definitionen ville de fem være tvunget til at smugle
 * identiteten ind gennem en closure eller en definition-fabrik pr. klik — altså tilbage til de
 * per-callsite-kopier, Fase 5 fjerner.
 *
 * **Invariant:** `TRequest` må kun bære STABIL IDENTITET (`rowId`, `{scope, entityId}`) — aldrig
 * præberegnet data. Grunden er, at requesten dannes ved klik, altså FØR commit-barrieren, mens
 * `project` kører EFTER settle på et frisk snapshot. Bar den data, ville den data stamme fra den
 * forrige revision. Identiteten genopslås i stedet friskt i `project`, som fail-closer, hvis
 * entiteten ikke længere findes eller ikke længere er gyldig.
 *
 * Outputs uden flere entiteter bruger `TRequest = void`.
 */
export type DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey extends string> = Readonly<{
  id: DocumentOutputId;
  /**
   * Hvordan brevhoved afgøres. En policy frem for et bart nøglenavn, fordi "intet brevhoved" er en
   * legitim tilstand (standalone) og ikke skal udtrykkes ved at pege på en fremmed indstilling.
   */
  brevhoved: DocumentBrevhovedPolicy<TBrevhovedKey>;
  labels: DocumentLabels;
  /**
   * Dependencies + gate + output-invariants i ÉN ren funktion. Kaldes både af den reaktive knap-gate
   * (render-tidens evaluation) og af click-preflighten (frisk evaluation efter settle) med samme
   * `request`. Må ikke læse rå sektioner, DOM eller UI-state. Delt domænearbejde hentes gennem
   * `context.shared`, så flere outputs på samme domæne kun betaler for det én gang.
   *
   * `context.settings` er GATE-settings alene: det valgte outputformat og brevhovedet er ikke i
   * typen (R6-F03), fordi formatet vælger writer og ikke dækning. Miljøet anvender dem efter ready.
   */
  project: (context: DocumentSourceContext<TGateSettings>, request: TRequest) => DocumentProjectionResult<TInput>;
  /** Lazy-load af den tunge generator. Kernen kalder den FØRST efter gaten har sagt ready. */
  loadRenderer: () => Promise<DocumentRenderer<TInput>>;
}>;

/** Bevarer `TRequest`/`TInput`-inferensen og fryser definitionen. */
export const defineDocumentOutput = <TRequest, TInput, TGateSettings, TBrevhovedKey extends string>(
  definition: DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey>
): DocumentDefinition<TRequest, TInput, TGateSettings, TBrevhovedKey> => Object.freeze(definition);
