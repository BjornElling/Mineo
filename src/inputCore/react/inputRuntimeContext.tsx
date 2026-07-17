import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { InputCatalog } from '../fieldCatalog';
import type { SettledInput } from '../settledInput';
import type { InputRevision } from '../evaluationSource';
import type { FieldIssueSnapshot } from '../inputIssue';
import { dispatchInput, type DispatchInputResult, type RuntimeInputCommand } from '../runtime/dispatchInput';
import type { HistoryOrigin } from '../inputHistory';
import { slimInputStore, type SlimInputStore } from '../runtime/slimInputStore';
import { activeEditorRegistry, type ActiveEditorRegistry } from '../runtime/activeEditorRegistry';

// Greenfield-React (§3.5/§3.10): den ENE binding, React-adapterne læser fra. Til forskel fra den legacy
// `FormPersistenceContext` eksponerer den hverken rå sektioner, `invalidDrafts`, `fieldErrors` eller skrivbare
// hel-sektionshooks. Den giver kun: (1) den aktuelle afsluttede revision (input + revisionsnummer), (2) det
// tokenbundne feltissue-snapshot (§1.8 — komponenter rapporterer ALDRIG ind i det; de læser det), (3) én
// typed `dispatch`, og (4) editorregistret. Feltvalidatorerne (Fase 3) leverer issue-snapshottet; indtil da
// injiceres et syntetisk snapshot i test (§2.3-verifikation).

/** Det aktuelle afsluttede input bundet til sin revision. Adapteren afleder lukket visning HERFRA (§3.5). */
export type SettledSnapshot = Readonly<{ input: SettledInput; revision: InputRevision }>;

export type InputRuntimeBinding = Readonly<{
  catalog: InputCatalog;
  /** Læser det aktuelle afsluttede snapshot. Bruges af `useSyncExternalStore`-getSnapshot. */
  getSettled: () => SettledSnapshot;
  /** Abonnér på revisionsændringer (nyt afsluttet input). Returnerer unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Det aktuelle tokenbundne feltissue-snapshot (§1.8). */
  getIssues: () => FieldIssueSnapshot;
  /** Den ENE write-grænse (§3.6). Feltadapteren udsteder kun felt-scopede commands. */
  dispatch: <TField, TEntity>(
    command: RuntimeInputCommand<TField, TEntity>,
    origin?: HistoryOrigin
  ) => DispatchInputResult;
  registry: ActiveEditorRegistry;
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
  getIssues: () => FieldIssueSnapshot
): InputRuntimeBinding => {
  let cached: SettledSnapshot | null = null;
  const getSettled = (): SettledSnapshot => {
    const state = store.getState();
    if (cached === null || cached.revision !== state.revision) {
      cached = Object.freeze({ input: state.input, revision: state.revision });
    }
    return cached;
  };
  return Object.freeze({
    catalog,
    getSettled,
    subscribe: (listener) => store.subscribe(listener),
    getIssues,
    dispatch: (command, origin) => dispatchInput(store, catalog, command, origin === undefined ? {} : { origin }),
    registry,
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

/** Produktions-binding mod applikations-singletonerne. Issue-snapshottet wires ved Fase 3-cutoveren. */
export const createProductionInputRuntimeBinding = (
  catalog: InputCatalog,
  getIssues: () => FieldIssueSnapshot
): InputRuntimeBinding => createInputRuntimeBinding(slimInputStore, catalog, activeEditorRegistry, getIssues);
