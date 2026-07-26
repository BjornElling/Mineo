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

declare const writeAuthorityBrand: unique symbol;

/**
 * Skrivegrænsen som TYPE (§3.6, Fase 6): kun runneren må skrive input.
 *
 * Mutatorerne kræver denne witness, og den kan kun opnås gennem {@link claimInputWriteAuthority},
 * som ligger i dette modul og kaldes af præcis de to autoritative skriveveje —
 * `dispatchInput` (feltcommits) og `initializeInputRuntime` (hydration). Et nyt modul, der
 * importerer storen og forsøger `applyCommit({...})`, får en COMPILERFEJL frem for at slippe
 * igennem review.
 *
 * Valgt frem for en AST-regel efter [[project_typed_write_boundary_over_ast_guard]]: kan grænsen
 * udtrykkes som en type, så gør det. Typen dækker desuden det, en AST-regel principielt ikke kan se
 * — en muteret store, der er ført videre gennem en variabel eller en generisk hjælper.
 *
 * Vidnet er bevidst UFORFALSKELIGT udefra: `unique symbol`-brandet kan ikke skrives af en anden fil,
 * så hverken en objektliteral eller en type-assertion fra et fremmed modul kan producere det.
 */
export type InputWriteAuthority = Readonly<{ readonly [writeAuthorityBrand]: true }>;

/**
 * Udsteder skrive-vidnet. ENESTE producent — og derfor det ene sted, hvor grænsen kan flyttes.
 *
 * Den er eksporteret, fordi de to autoritative skriveveje ligger i søskendemoduler, men enhver ny
 * kalder er en BEVIDST udvidelse af skrivegrænsen: den står i importgrafen og fanges af
 * `input/write-boundary`-reglen, som holder producentlisten lukket.
 */
export const claimInputWriteAuthority = (): InputWriteAuthority =>
  Object.freeze({}) as InputWriteAuthority;

export type SlimInputStoreState = {
  input: SettledInput;
  revision: InputRevision;
  history: InputHistory;
  settingsRevision: SettingsRevision;
  /** Ændres kun ved hel-sags-replacement/hydration, ikke ved almindelige feltcommits. */
  replacementGeneration: number;
  meta: SlimInputMeta;

  /** Anvender en valideret commit; skaber altid præcis én ny monoton revision. Kaldes kun af `dispatchInput`. */
  applyCommit: (commit: SlimInputCommit, authority: InputWriteAuthority) => void;
  /** Hydrerer afsluttet input før render; rydder history og skaber en ny monoton revision (§3.7). */
  hydrate: (
    input: SettledInput,
    authority: InputWriteAuthority,
    options?: Readonly<{ writesBlocked?: boolean }>
  ) => void;
  /**
   * Én monoton settingsrevision, så `EvaluationSourceToken` altid kan verificeres samlet (§3.4/§2.1.9).
   * Kræver IKKE vidnet: den rører ikke sagsinput, kun den revision, der gør evalueringen stale.
   */
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

  applyCommit: (commit, _authority) => set((state) => ({
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

  hydrate: (input, _authority, options) => set((state) => ({
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

/**
 * Skrive-vidne til TESTOPSÆTNING.
 *
 * En test, der arrangerer en tilstand, er en legitim skriver — men den går uden om runneren, og det
 * skal kunne SES. Derfor sit eget navn frem for et `claimInputWriteAuthority()` spredt ud i suiten:
 * en søgning på dette symbol viser præcis, hvilke tests der hydrerer direkte.
 *
 * Navnet er `__`-præfikset som testfabrikken ovenfor, og `input/write-boundary` forbyder
 * produktionskode at kalde det.
 */
export const __testInputWriteAuthority = claimInputWriteAuthority;
