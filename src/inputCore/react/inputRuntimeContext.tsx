import * as React from 'react';
import { useSyncExternalStore } from 'react';
import type { InputCatalog } from '../fieldCatalog';
import type { SettledInput } from '../settledInput';
import { sourceTokensEqual, type EvaluationSourceToken, type InputRevision } from '../evaluationSource';
import { captureStableInput, readSourceToken } from '../runtime/evaluationSourceBinding';
import type { FieldIssueSnapshot } from '../inputIssue';
import type { InputEvaluation } from '../inputReader';
import {
  dispatchInput,
  type DispatchInputResult,
  type StructuralCommandKind,
} from '../runtime/dispatchInput';
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

/**
 * Origin-argumentet som en BETINGET tuple (§3.7, WI-004 runde 4, fund S4).
 *
 * En strukturel rækkecommand kræver en origin — argumentet er obligatorisk. Alt andet beholder det valgfrie.
 * ARTEN er fri: en brugerudløst rækkehandling giver `CollectionHistoryOrigin`, mens en række-promovering via
 * celle-commit giver `FieldHistoryOrigin`, så undo fokuserer den celle, brugeren skrev i (§3.8).
 *
 * To fælder er bevidst undgået:
 * - En OVERLOAD duer ikke: `InputSurfaceCommand` er en union, så TypeScript matcher `inputTransaction(...)`
 *   mod den permissive overload og lader origin falde bort — præcis hullet fund S4 beskrev.
 * - At generificere over hele COMMANDEN duer heller ikke: `FieldRef<T>` er invariant, så en `TCommand extends
 *   InputSurfaceCommand<TField, TEntity>`-constraint bryder inferensen for felt-commands. Vi generificerer
 *   derfor kun over DISKRIMINATOREN, som er en ren strengunion.
 */
type OriginArgs<TKind extends string> = TKind extends StructuralCommandKind
  ? [origin: HistoryOrigin]
  : [origin?: HistoryOrigin];

// React-laget (§3.5/§3.10): den ENE binding, React-adapterne læser fra. Til forskel fra den legacy
// `FormPersistenceContext` eksponerer den hverken rå sektioner, `invalidDrafts`, `fieldErrors` eller skrivbare
// hel-sektionshooks. Den giver kun: (1) den aktuelle afsluttede revision (input + revisionsnummer), (2) det
// tokenbundne feltissue-snapshot (§1.8 — komponenter rapporterer ALDRIG ind i det; de læser det), (3) én
// typed `dispatch`, og (4) editorregistret. Feltvalidatorerne (Fase 3) leverer issue-snapshottet; indtil da
// injiceres et syntetisk snapshot i test (§2.3-verifikation).

/** Det aktuelle afsluttede input bundet til sin revision. Adapteren afleder lukket visning HERFRA (§3.5). */
export type SettledSnapshot = Readonly<{
  revision: InputRevision;
  replacementGeneration: number;
}>;

type InternalSettledSnapshot = SettledSnapshot & Readonly<{ input: SettledInput }>;

/**
 * **READ** — alt hvad en visning, en projektion eller et dokument må gøre med sagsinput (§3.5/§3.10).
 *
 * Porten er bevidst rent læsende OG tokenbundet: der er ingen vej fra en read-consumer til en mutation, og
 * ingen vej til rå `sections` uden om `InputReader`. Adskillelsen er strukturel frem for kommenteret —
 * tidligere lå læsning, redigering og systemoperationer som felter på ét objekt, så enhver consumer, der
 * blot skulle vise en værdi, også fik hel-sags-replacement og history i hånden.
 */
export type InputReadPort = Readonly<{
  /**
   * Dokumenter og øvrige kritiske readers optager evalueringen fra den SAMME binding som React-træet.
   * De får aldrig lov til at falde tilbage til produktions-singletonen, som kan repræsentere en anden sag.
   */
  captureEvaluationSource: () => InputEvaluation;
  /** Den autoritative aktuelle token for netop denne binding. */
  readCurrentSourceToken: () => EvaluationSourceToken;
  /** Læser kun revisionsmetadata; det rå aggregate forlader ikke inputinfrastrukturen. */
  getRevisionSnapshot: () => SettledSnapshot;
  /** Abonnér på revisionsændringer (nyt afsluttet input). Returnerer unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  /** Det aktuelle tokenbundne feltissue-snapshot (§1.8). */
  getIssues: () => FieldIssueSnapshot;
  /** Offentlig, tokenbundet reader til projektioner; rå sections forlader aldrig runtimebindingen. */
  getEvaluation: () => InputEvaluation;
}>;

/**
 * **EDIT** — feltniveau-redigering (§3.6). Den capability, en felt-/celleadapter har brug for, og intet mere.
 *
 * En editor-flade kan udstede felt- og rækkecommands og registrere sig som aktiv editor. Den kan IKKE
 * nulstille en sektion, erstatte hele sagen eller udføre undo/redo — de operationer hører til systemporten,
 * så en celle aldrig kan formulere en hel-sagsmutation.
 */
export type InputEditPort = Readonly<{
  /**
   * Den ENE write-grænse (§3.6). Feltadapteren udsteder kun felt-scopede commands.
   *
   * En STRUKTUREL rækkecommand (insert/delete/reorder/settle-i-ny-række samt en strukturel transaktion)
   * kræver en origin — ellers kunne undo/redo gendanne en række uden noget restore-anker (§3.7, WI-004 runde
   * 4, fund S4). ARTEN er fri; se `OriginArgs`. `dispatchInput` håndhæver kravet også på runtime.
   */
  dispatch: <TField, TEntity, TKind extends InputSurfaceCommand<TField, TEntity>['kind']>(
    command: InputSurfaceCommand<TField, TEntity> & { kind: TKind },
    ...origin: OriginArgs<TKind>
  ) => DispatchInputResult;
  registry: ActiveEditorRegistry;
}>;

/**
 * **SYSTEM** — operationer på HELE sagen (§3.6/§3.10): sektionsreset, replacement, history og kritiske
 * handlinger.
 *
 * Porten er forbeholdt composition roots: case-/persistence-porten (`useCaseOperations`), shellens
 * undo/redo-genveje og en sidesektions eksplicitte "Slet alle indtastninger". Den er skilt ud, fordi dens
 * operationer ikke kan udtrykkes som en feltredigering og aldrig må kunne nås fra en celle.
 */
type InputSystemPort = Readonly<{
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
  criticalActions: CriticalActionCoordinator;
}>;

/**
 * Den samlede runtime, providerne distribuerer. Den er en KOMPOSITION af de tre capabilities, ikke ét fladt
 * objekt: en consumer beder om `read`, `edit` eller `system` og får præcis den ene.
 */
export type InputRuntimeBinding = Readonly<{
  read: InputReadPort;
  edit: InputEditPort;
}>;

type InputRuntimeInternals = Readonly<{
  catalog: InputCatalog;
  getSettled: () => InternalSettledSnapshot;
  captureStableSource: () => Readonly<{ input: SettledInput; token: EvaluationSourceToken }>;
  system: InputSystemPort;
}>;

const InputRuntimeContext = React.createContext<InputRuntimeBinding | null>(null);
const INTERNALS_BY_READ_PORT = new WeakMap<InputReadPort, InputRuntimeInternals>();

const useBinding = (): InputRuntimeBinding => {
  const binding = React.useContext(InputRuntimeContext);
  if (binding === null) {
    throw new Error('useInputRuntime: skal bruges inden for en <InputRuntimeProvider>.');
  }
  return binding;
};

const useInternals = (): InputRuntimeInternals => {
  const binding = useBinding();
  const internals = INTERNALS_BY_READ_PORT.get(binding.read);
  if (internals === undefined) {
    throw new Error('InputRuntime: binding mangler intern runtime-capability.');
  }
  return internals;
};

/**
 * Dokumentlagets capability (§5.4): et frisk tokenbundet kildesnapshot + den kritiske handlingsbarriere.
 *
 * Bevidst en NAVNGIVEN, eksplicit port frem for et `Pick<>` af hele bindingen. Dokumentmiljøet skal kunne
 * optage kilden og settle en åben editor før download — men det må hverken dispatche, nulstille en sektion
 * eller erstatte sagen. En `Pick` over ét fladt objekt beskrev det samme, men uden at nogen grænse forhindrede
 * den næste udvidelse i at tage mere med.
 */
export type DocumentInputAccess = Readonly<{
  captureEvaluationSource: InputReadPort['captureEvaluationSource'];
  readCurrentSourceToken: InputReadPort['readCurrentSourceToken'];
  criticalActions: CriticalActionCoordinator;
}>;

/** Læse-capabilityen: aktuel afsluttet revision, tokenbundet reader og issue-snapshot. */
export const useInputReadPort = (): InputReadPort => useBinding().read;

/**
 * Dokumentlagets capability, memoiseret pr. binding. Dokumentmiljøet og katalogposterne afhænger af
 * referencen, så en ny wrapper pr. render ville invalidere hele gate-memoiseringen nedstrøms.
 */
export const useDocumentInputAccess = (): DocumentInputAccess => {
  const read = useInputReadPort();
  const { system } = useInternals();
  return React.useMemo(
    () => Object.freeze({
      captureEvaluationSource: read.captureEvaluationSource,
      readCurrentSourceToken: read.readCurrentSourceToken,
      criticalActions: system.criticalActions,
    }),
    [read, system]
  );
};

/** Redigerings-capabilityen: felt-/rækkecommands + editorregistret. */
export const useInputEditPort = (): InputEditPort => useBinding().edit;

/** Abonnér på det aktuelle afsluttede snapshot. Re-renderer kun, når revisionen faktisk ændres. */
export const useSettledSnapshot = (): SettledSnapshot => {
  const { getRevisionSnapshot, subscribe } = useInputReadPort();
  return useSyncExternalStore(subscribe, getRevisionSnapshot, getRevisionSnapshot);
};

/** Kun inputadaptere: råt afsluttet input til feltvisning og collection-identitet. Eksporteres ikke fra barrelen. */
export const useInternalSettledSnapshot = (): InternalSettledSnapshot => {
  const { getSettled } = useInternals();
  const { subscribe } = useInputReadPort();
  return useSyncExternalStore(subscribe, getSettled, getSettled);
};

/** Kun inputadaptere: det katalog der matcher den monterede runtime. */
export const useInternalInputCatalog = (): InputCatalog => useInternals().catalog;

/** Snæver systemcapability til case save/load/reset. Eksporteres ikke fra den offentlige barrel. */
export const useCaseRuntimeAccess = (): Readonly<{
  catalog: InputCatalog;
  captureStableSource: InputRuntimeInternals['captureStableSource'];
  replaceCase: InputSystemPort['replaceCase'];
  criticalActions: CriticalActionCoordinator;
}> => {
  const { catalog, captureStableSource, system } = useInternals();
  return React.useMemo(() => Object.freeze({
    catalog,
    captureStableSource,
    replaceCase: system.replaceCase,
    criticalActions: system.criticalActions,
  }), [catalog, captureStableSource, system]);
};

/** Snæver historycapability til shellens globale genveje. */
export const useInputHistoryAccess = (): InputSystemPort['history'] => useInternals().system.history;

/** Snæver kritisk handlingsbarriere til evaluering og dokumentflow. */
export const useCriticalActionCoordinator = (): CriticalActionCoordinator =>
  useInternals().system.criticalActions;

/** Snæver sektionsreset-capability til en sides eksplicitte ryd-handling. */
export const useSectionReset = (): InputSystemPort['resetSection'] => useInternals().system.resetSection;

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
  let cached: InternalSettledSnapshot | null = null;
  let cachedRevision: SettledSnapshot | null = null;
  let cachedIssues: FieldIssueSnapshot | null = null;
  const getSettled = (): InternalSettledSnapshot => {
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
  const getRevisionSnapshot = (): SettledSnapshot => {
    const next = getSettled();
    if (
      cachedRevision === null
      || cachedRevision.revision !== next.revision
      || cachedRevision.replacementGeneration !== next.replacementGeneration
    ) {
      cachedRevision = Object.freeze({
        revision: next.revision,
        replacementGeneration: next.replacementGeneration,
      });
    }
    return cachedRevision;
  };
  const getStableIssues = (): FieldIssueSnapshot => {
    const next = getIssues();
    if (cachedIssues === null || !sourceTokensEqual(cachedIssues.sourceToken, next.sourceToken)) {
      cachedIssues = next;
    }
    return cachedIssues;
  };
  const captureEvaluationSource = (): InputEvaluation => {
    // `getEvaluation` kan selv være cachet. Tokenet skal derfor bekræfte, at evalueringen stadig
    // hører til den runtime-tilstand, der er aktuel efter læsningen.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const evaluation = getEvaluation();
      if (sourceTokensEqual(evaluation.issues.sourceToken, readSourceToken(store))) return evaluation;
    }
    throw new Error('InputRuntime: kunne ikke optage en stabil evaluering til kritisk handling');
  };
  const system: InputSystemPort = Object.freeze({
    resetSection: (command: ResetSectionCommand) => dispatchInput(store, catalog, command),
    replaceCase: (command: ReplaceCaseCommand | ClearCaseCommand) => dispatchInput(store, catalog, command),
    history: Object.freeze({
      undo: () => dispatchInput(store, catalog, { kind: 'undo' }),
      redo: () => dispatchInput(store, catalog, { kind: 'redo' }),
    }),
    criticalActions: new CriticalActionCoordinator(store, registry),
  });
  const binding: InputRuntimeBinding = Object.freeze({
    read: Object.freeze({
      captureEvaluationSource,
      readCurrentSourceToken: () => readSourceToken(store),
      getRevisionSnapshot,
      subscribe: (listener: () => void) => store.subscribe(listener),
      // `useSyncExternalStore` kræver stabil snapshot-identitet mellem revisioner. Samme token beskriver samme
      // rene issueprojektion, så en leverandør, der bygger et nyt wrapperobjekt pr. kald, normaliseres her.
      getIssues: getStableIssues,
      getEvaluation,
    }),
    edit: Object.freeze({
      // Implementeringen tager den brede form; det er SIGNATUREN i `InputEditPort` der håndhæver den
      // betingede origin-tuple over for kalderne, og `dispatchInput`s eget runtime-værn der fanger et cast.
      dispatch: ((command: InputSurfaceCommand, origin?: HistoryOrigin) =>
        dispatchInput(store, catalog, command, origin === undefined ? {} : { origin })
      ) as InputEditPort['dispatch'],
      registry,
    }),
  });
  INTERNALS_BY_READ_PORT.set(binding.read, Object.freeze({
    catalog,
    getSettled,
    captureStableSource: () => captureStableInput(store),
    system,
  }));
  return binding;
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
