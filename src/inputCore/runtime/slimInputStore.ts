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

// Greenfield-runtime (§3.7/§4.2): den ENE autoritative store rummer KUN afsluttet input, den monotone revision,
// history, settingsrevisionen og nødvendig hydration-/systemstatus. Ingen afledte `sections`/`invalidDrafts`-views,
// `fieldErrors`, revisionsmaps, epochs, counters eller legacy-testfacader — hele det gamle `inputRuntimeStore`-
// tilstandsrum udgår. Afledte issues, gates og åbne drafts hører ikke til her (§3.1).

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

export type SlimInputStoreState = {
  input: SettledInput;
  revision: InputRevision;
  history: InputHistory;
  settingsRevision: SettingsRevision;
  /** Ændres kun ved hel-sags-replacement/hydration, ikke ved almindelige feltcommits. */
  replacementGeneration: number;
  meta: SlimInputMeta;

  /** Anvender en valideret commit; skaber altid præcis én ny monoton revision. Kaldes kun af `dispatchInput`. */
  applyCommit: (commit: SlimInputCommit) => void;
  /** Hydrerer afsluttet input før render; rydder history og skaber en ny monoton revision (§3.7). */
  hydrate: (input: SettledInput, options?: Readonly<{ writesBlocked?: boolean }>) => void;
  /** Én monoton settingsrevision, så `EvaluationSourceToken` altid kan verificeres samlet (§3.4/§2.1.9). */
  bumpSettingsRevision: () => void;
};

export type SlimInputStore = StoreApi<SlimInputStoreState>;

const createSlimInputStore = (): SlimInputStore => createStore<SlimInputStoreState>((set) => ({
  input: createEmptySettledInput(),
  revision: createInputRevision(0),
  history: createInputHistory(),
  settingsRevision: createSettingsRevision(0),
  replacementGeneration: 0,
  meta: { hydrated: false, persistedDataVersion: PERSISTED_DATA_VERSION },

  applyCommit: (commit) => set((state) => ({
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

  hydrate: (input, options) => set((state) => ({
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

  bumpSettingsRevision: () => set((state) => ({
    settingsRevision: createSettingsRevision(state.settingsRevision + 1),
  })),
}));

/** Applikations-singleton. Begge app-entrypoints hydrerer den samme runtime før render (§3.10). */
export const slimInputStore = createSlimInputStore();

/** Isoleret test-fabrik (ikke en mutations-facade); produktionscallsites bruger `slimInputStore`. */
export const __createSlimInputTestStore = createSlimInputStore;
