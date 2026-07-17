import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { InputCatalog } from '../fieldCatalog';
import type { SettledInput } from '../settledInput';
import { sourceTokensEqual, type InputRevision } from '../evaluationSource';
import type { FieldIssueSnapshot } from '../inputIssue';
import type { InputEvaluation } from '../inputReader';
import { dispatchInput, type DispatchInputResult } from '../runtime/dispatchInput';
import type { InputSurfaceCommand } from '../inputReducer';
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
    getSettled,
    subscribe: (listener) => store.subscribe(listener),
    // `useSyncExternalStore` kræver stabil snapshot-identitet mellem revisioner. Samme token beskriver samme
    // rene issueprojektion, så en leverandør, der bygger et nyt wrapperobjekt pr. kald, normaliseres her.
    getIssues: getStableIssues,
    getEvaluation,
    dispatch: (command, origin) => dispatchInput(store, catalog, command, origin === undefined ? {} : { origin }),
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
