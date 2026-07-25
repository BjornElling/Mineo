import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { InputCatalog } from '../fieldCatalog';
import type { SettledInput } from '../settledInput';
import { sourceTokensEqual, type EvaluationSourceToken, type InputRevision } from '../evaluationSource';
import { captureStableInput } from '../runtime/evaluationSourceBinding';
import type { FieldIssueSnapshot } from '../inputIssue';
import type { InputEvaluation } from '../inputReader';
import { dispatchInput, type DispatchInputResult } from '../runtime/dispatchInput';
import type {
  ClearCaseCommand,
  InputSurfaceCommand,
  ReplaceCaseCommand,
  ResetSectionCommand,
} from '../inputReducer';
import type { HistoryOrigin } from '../inputHistory';
import type { SlimInputStore } from '../runtime/slimInputStore';
import type { ActiveEditorRegistry } from '../runtime/activeEditorRegistry';
import { CriticalActionCoordinator } from '../runtime/criticalActionCoordinator';

// Greenfield-React (§3.5/§3.10): den ENE binding, React-adapterne læser fra. Til forskel fra den legacy
// `FormPersistenceContext` eksponerer den hverken rå sektioner, `invalidDrafts`, `fieldErrors` eller skrivbare
// hel-sektionshooks. Den giver kun: (1) den aktuelle afsluttede revision (input + revisionsnummer), (2) det
// tokenbundne feltissue-snapshot (§1.8 — komponenter rapporterer ALDRIG ind i det; de læser det), (3) én
// typed `dispatch`, og (4) editorregistret. Feltvalidatorerne (Fase 3) leverer issue-snapshottet; indtil da
// injiceres et syntetisk snapshot i test (§2.3-verifikation).

/** Det aktuelle afsluttede input bundet til sin revision. Adapteren afleder lukket visning HERFRA (§3.5). */
export type SettledSnapshot = Readonly<{
  input: SettledInput;
  revision: InputRevision;
  replacementGeneration: number;
}>;

export type InputRuntimeBinding = Readonly<{
  catalog: InputCatalog;
  /**
   * READ-ONLY systemport til et stabilt `{input, token}`-snapshot fra PRÆCIS den runtime, React-træet læser.
   *
   * System-porte (§3.10) skal kunne optage kilden fra bindingen i stedet for at importere produktions-
   * singletonen — ellers kunne en alternativ/testbinding vise én sag, mens en port læste og gemte en anden.
   * Porten eksponerer BEVIDST ikke selve store'en: en rå `StoreApi` ville give `setState` og dermed en
   * generel bypass af typed commands, transaktion/history og storage-grænsen. Kun læsning er mulig herfra;
   * al mutation går gennem `dispatch`/`resetSection`/`replaceCase`.
   */
  captureStableSource: () => Readonly<{ input: SettledInput; token: EvaluationSourceToken }>;
  /** Læser det aktuelle afsluttede snapshot. Bruges af `useSyncExternalStore`-getSnapshot. */
  getSettled: () => SettledSnapshot;
  /** Abonnér på revisionsændringer (nyt afsluttet input). Returnerer unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Det aktuelle tokenbundne feltissue-snapshot (§1.8). */
  getIssues: () => FieldIssueSnapshot;
  /** Offentlig, tokenbundet reader til projektioner; rå sections forlader aldrig runtimebindingen. */
  getEvaluation: () => InputEvaluation;
  /** Den ENE write-grænse (§3.6). Feltadapteren udsteder kun felt-scopede commands. */
  dispatch: <TField, TEntity>(
    command: InputSurfaceCommand<TField, TEntity>,
    origin?: HistoryOrigin
  ) => DispatchInputResult;
  /**
   * System-reset af én sektion (§3.6). Adskilt fra `dispatch`, så en form-/grid-CELLE ikke kan udstede en
   * hel-sektionsmutation, men en sidesektions "Slet alle indtastninger" (fx renteberegning) kan. Route reset,
   * `Slet alt` og load gennem denne/`CaseResetOperations`-porten, aldrig gennem celle-dispatch.
   */
  resetSection: (command: ResetSectionCommand) => DispatchInputResult;
  /**
   * System-ejet hel-sags-replacement (§3.6/§3.10). Adskilt fra `dispatch`, så en form-/grid-CELLE aldrig kan
   * udstede en hel-sagsmutation. `CaseFileOperations` (load-apply) og `CaseResetOperations` routes HERIGENNEM;
   * `dispatchInput` klassificerer den som autoritativ (rydder history, tvinger commit, hæver
   * `replacementGeneration`) og tillader den som eneste command, når runtime er `writesBlocked` (clearCase, §1.12).
   */
  replaceCase: (command: ReplaceCaseCommand | ClearCaseCommand) => DispatchInputResult;
  /** History er en separat port; editor-surfaces kan ikke forveksle restore med en feltkommando. */
  history: Readonly<{
    undo: () => DispatchInputResult;
    redo: () => DispatchInputResult;
  }>;
  registry: ActiveEditorRegistry;
  criticalActions: CriticalActionCoordinator;
}>;

const InputRuntimeContext = React.createContext<InputRuntimeBinding | null>(null);

export const useInputRuntime = (): InputRuntimeBinding => {
  const binding = React.useContext(InputRuntimeContext);
  if (binding === null) {
    throw new Error('useInputRuntime: skal bruges inden for en <InputRuntimeProvider>.');
  }
  return binding;
};

/** Abonnér på det aktuelle afsluttede snapshot. Re-renderer kun, når revisionen faktisk ændres. */
export const useSettledSnapshot = (): SettledSnapshot => {
  const { getSettled, subscribe } = useInputRuntime();
  return useSyncExternalStore(subscribe, getSettled, getSettled);
};

/**
 * Bygger en binding oven på den levende slim-store (§3.10). `getSettled` er memoiseret pr. revision, så
 * `useSyncExternalStore` ser en stabil reference mellem revisioner (ellers ville getSnapshot-identitetstjekket
 * loope). Issue-snapshottet leveres af consumeren (Fase 3-validatorer); i test injiceres et syntetisk snapshot.
 */
export const createInputRuntimeBinding = (
  store: SlimInputStore,
  catalog: InputCatalog,
  registry: ActiveEditorRegistry,
  getEvaluation: () => InputEvaluation,
  getIssues: () => FieldIssueSnapshot = () => getEvaluation().issues
): InputRuntimeBinding => {
  let cached: SettledSnapshot | null = null;
  let cachedIssues: FieldIssueSnapshot | null = null;
  const getSettled = (): SettledSnapshot => {
    const state = store.getState();
    if (cached === null || cached.revision !== state.revision) {
      cached = Object.freeze({
        input: state.input,
        revision: state.revision,
        replacementGeneration: state.replacementGeneration,
      });
    }
    return cached;
  };
  const getStableIssues = (): FieldIssueSnapshot => {
    const next = getIssues();
    if (cachedIssues === null || !sourceTokensEqual(cachedIssues.sourceToken, next.sourceToken)) {
      cachedIssues = next;
    }
    return cachedIssues;
  };
  return Object.freeze({
    catalog,
    captureStableSource: () => captureStableInput(store),
    getSettled,
    subscribe: (listener) => store.subscribe(listener),
    // `useSyncExternalStore` kræver stabil snapshot-identitet mellem revisioner. Samme token beskriver samme
    // rene issueprojektion, så en leverandør, der bygger et nyt wrapperobjekt pr. kald, normaliseres her.
    getIssues: getStableIssues,
    getEvaluation,
    dispatch: (command, origin) => dispatchInput(store, catalog, command, origin === undefined ? {} : { origin }),
    resetSection: (command) => dispatchInput(store, catalog, command),
    replaceCase: (command) => dispatchInput(store, catalog, command),
    history: Object.freeze({
      undo: () => dispatchInput(store, catalog, { kind: 'undo' }),
      redo: () => dispatchInput(store, catalog, { kind: 'redo' }),
    }),
    registry,
    criticalActions: new CriticalActionCoordinator(store, registry),
  });
};

export type InputRuntimeProviderProps = Readonly<{
  binding: InputRuntimeBinding;
  children: React.ReactNode;
}>;

/**
 * Leverer bindingen til React-træet. Provideren hydrerer ALDRIG og overskriver aldrig input (§3.10) — begge
 * app-entrypoints initialiserer den samme runtime FØR render, og provideren distribuerer kun den færdige binding.
 */
export const InputRuntimeProvider = ({ binding, children }: InputRuntimeProviderProps): React.ReactElement => (
  <InputRuntimeContext.Provider value={binding}>{children}</InputRuntimeContext.Provider>
);
