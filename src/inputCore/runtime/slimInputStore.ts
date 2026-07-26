import { createStore, type StoreApi } from 'zustand/vanilla';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { createEmptySettledInput, type SettledInput } from '../settledInput';
import { createInputHistory, type InputHistory } from '../inputHistory';
import {
  createInputRevision,
  createSettingsRevision,
  type InputRevision,
  type SettingsRevision,
} from '../evaluationSource';
import {
  __hydrateInputStoreForTest,
  bumpInputSettingsRevision,
  registerSlimInputStoreInternals,
} from './dispatchInput';

// Greenfield-runtime (§3.7/§4.2): den ENE autoritative store rummer KUN afsluttet input, den monotone revision,
// history, settingsrevisionen og nødvendig hydration-/systemstatus. Ingen afledte `sections`/`invalidDrafts`-views,
// `fieldErrors`, revisionsmaps, epochs, counters eller legacy-testfacader — hele det gamle `inputRuntimeStore`-
// tilstandsrum udgår. Afledte issues, gates og åbne drafts hører ikke til her (§3.1).
//
// **Skrivegrænsen er STRUKTUREL, ikke bevogtet (Fase 6, genåbnet).** Zustands `StoreApi` forlader aldrig dette
// modul: `setState`/`replace` findes ikke på den eksporterede type. Et nyt modul, der importerer storen, kan
// derfor slet ikke formulere et uvalideret write — hverken direkte, gennem et alias eller gennem en
// type-assertion. Det er den forskel [[project_typed_write_boundary_over_ast_guard]] efterspørger: grænsen er
// fjernet som mulighed frem for at blive holdt lukket af et AST-værn oven på en åben capability.

export type SlimInputMeta = Readonly<{
  hydrated: boolean;
  persistedDataVersion: string;
  lastCommittedAt?: number;
  /** Fail-closed efter en hydrationsfejl, så en bevaret korrupt kilde ikke overskrives af normale writes (§1.12). */
  inputWritesBlocked?: boolean;
}>;

/** Resultatet af én valideret inputtransaktion, som `dispatchInput` anvender atomisk. */
export type SlimInputCommit = Readonly<{
  input: SettledInput;
  history: InputHistory;
  committedAt: number;
  authoritativeReplacement: boolean;
}>;

/**
 * Den observerbare runtimetilstand. Ren DATA — mutatorerne bor på handlen, ikke i state.
 *
 * Tidligere lå `applyCommit`/`hydrate` som felter i selve state-objektet. Det var det, der tvang `StoreApi`
 * ud i det offentlige: en kalder skulle have `getState()` for at nå en mutator, og fik dermed `setState` med.
 * Ved at flytte mutatorerne til handlen bliver læsning og skrivning to forskellige capabilities.
 */
export type SlimInputStoreState = Readonly<{
  input: SettledInput;
  revision: InputRevision;
  history: InputHistory;
  settingsRevision: SettingsRevision;
  /** Ændres kun ved hel-sags-replacement/hydration, ikke ved almindelige feltcommits. */
  replacementGeneration: number;
  meta: SlimInputMeta;
}>;

/**
 * Handlen til den autoritative runtime.
 *
 * Den eksponerer PRÆCIS de operationer, runtime har brug for — og ingen generel mutation. `applyCommit`,
 * `hydrate` og `restore` er de tre skriveveje, og de er navngivne, validerede transaktioner. Der findes
 * ingen `setState`: det er derfor ikke længere muligt at skrive input uden at gå gennem `dispatchInput`s
 * serialisering, storage-verifikation, history og revisionsfremskrivning.
 *
 * Handlen er `internal` i den forstand, at kun `src/inputCore/runtime/` og bindingslaget modtager den;
 * consumers får de smalle porte fra `inputRuntimeContext`. Men den er ufarlig at lække sammenlignet med en
 * `StoreApi`, fordi hvert medlem er en autoritativ operation frem for et vilkårligt write.
 */
export type SlimInputStore = Readonly<{
  getState: () => SlimInputStoreState;
  subscribe: (listener: () => void) => () => void;
}>;

const createSlimInputStore = (): SlimInputStore => {
  const store: StoreApi<SlimInputStoreState> = createStore<SlimInputStoreState>(() => ({
    input: createEmptySettledInput(),
    revision: createInputRevision(0),
    history: createInputHistory(),
    settingsRevision: createSettingsRevision(0),
    replacementGeneration: 0,
    meta: { hydrated: false, persistedDataVersion: PERSISTED_DATA_VERSION },
  }));

  const handle: SlimInputStore = Object.freeze({
    getState: () => store.getState(),
    subscribe: (listener: () => void) => store.subscribe(listener),
  });
  registerSlimInputStoreInternals(handle, Object.freeze({
    applyCommit: (commit: SlimInputCommit) => store.setState((state) => ({
      input: commit.input,
      revision: createInputRevision(state.revision + 1),
      history: commit.history,
      replacementGeneration: commit.authoritativeReplacement
        ? state.replacementGeneration + 1
        : state.replacementGeneration,
      meta: {
        hydrated: true,
        persistedDataVersion: PERSISTED_DATA_VERSION,
        lastCommittedAt: commit.committedAt,
      },
    })),

    hydrate: (input: SettledInput, options?: Readonly<{ writesBlocked?: boolean }>) => store.setState((state) => ({
      input,
      revision: createInputRevision(state.revision + 1),
      history: createInputHistory(),
      replacementGeneration: state.replacementGeneration + 1,
      meta: {
        hydrated: true,
        persistedDataVersion: PERSISTED_DATA_VERSION,
        ...(options?.writesBlocked === true ? { inputWritesBlocked: true } : {}),
      },
    })),

    restore: (snapshot: SlimInputStoreState) => store.setState(snapshot, true),

    bumpSettingsRevision: () => store.setState((state) => ({
      settingsRevision: createSettingsRevision(state.settingsRevision + 1),
    })),
  }));
  return handle;
};

/** Applikations-singleton. Begge app-entrypoints hydrerer den samme runtime før render (§3.10). */
export const slimInputStore = createSlimInputStore();

/**
 * Isoleret runtime-fabrik til TESTOPSÆTNING.
 *
 * En test, der arrangerer en tilstand, er en legitim skriver, men den går uden om runneren, og det skal kunne
 * SES. Fabrikken bærer derfor sit eget `__`-præfiksede navn, så en søgning viser præcis hvilke tests der
 * bygger en isoleret runtime. `input/write-boundary` forbyder produktionskode at kalde den.
 *
 * Der er ikke længere et separat "test-skrivevidne": handlen ER capabilityen, og en test, der vil hydrere,
 * gør det på sin egen isolerede runtime frem for at forfalske en autoritet på produktionens.
 */
export const __createSlimInputTestStore = createSlimInputStore;

/** Test-support; må kun bruges under `src/__tests__/`. */
export const __hydrateSlimInputStoreForTest = __hydrateInputStoreForTest;

/** Test-support; må kun bruges under `src/__tests__/`. */
export const __bumpSlimInputSettingsRevisionForTest = bumpInputSettingsRevision;
