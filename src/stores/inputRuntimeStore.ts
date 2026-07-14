import { createStore, type StoreApi } from 'zustand/vanilla';
import { PERSISTED_SECTION_KEYS, type PersistedSectionMap } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import type { StorageKey } from '../config/storageManifest';
import type { RuntimePersistedInputState } from '../input/inputEnvelope';
import { createEmptyPersistedInputSections } from '../input/inputState';
import { rejectedInputsToLegacyInvalidDrafts } from '../input/legacyInputCompatibility';
import { legacyInvalidDraftsToRejectedInputs } from '../input/legacyInputCompatibility';
import { applyLegacyRejectedInputChanges } from '../input/legacyInputCompatibility';
import type {
  FieldErrorBySource,
  FieldErrorSeverity,
  FieldErrorSource,
  FieldErrorsForSection,
  FormFieldError,
} from '../types/fieldErrors';
import { normalizeFieldError } from '../types/fieldErrors';

export type FormPersistenceSections = {
  -readonly [K in keyof RuntimePersistedInputState['sections']]: RuntimePersistedInputState['sections'][K];
};

export type InvalidDraftsForSection = Record<string, string>;
export type InvalidDraftsCache = { [K in StorageKey]: InvalidDraftsForSection };
export type SectionKeyedRevisions = { [K in StorageKey]: number };
export type SectionRevisionMap = SectionKeyedRevisions;
export type InvalidDraftRevisionMap = SectionKeyedRevisions;
export type FieldErrorCache = { [K in StorageKey]: FieldErrorsForSection<K> };
export type FieldErrorRevisionMap = SectionKeyedRevisions;

export type FormPersistenceMeta = Readonly<{
  hydrated: boolean;
  persistedDataVersion: string;
  lastCommittedAt?: number;
  /** Fail-closed efter en startupfejl, så bevarede kilder ikke overskrives af en tom runtime. */
  inputWritesBlocked?: boolean;
}>;

/** Stringidentiteten slettes sammen med fase-4-facaden, når callsites udsteder rigtige FieldRefs. */
export type HistoryFrameOrigin = Readonly<{
  route: string;
  tabKey: string | null;
  sectionKey: StorageKey;
  fieldPath: string | null;
  focusToken: string | null;
}>;

export type HistoryFrame = Readonly<{
  id: string;
  timestamp: number;
  input: RuntimePersistedInputState;
  origin: HistoryFrameOrigin;
  /** Slettes i fase 5, når alle feltissues kan genafledes synkront fra input. */
  compatibilityFieldErrors?: FieldErrorCache;
  compatibilityFieldErrorRevisions?: FieldErrorRevisionMap;
}>;

export type InputHistoryState = Readonly<{
  past: readonly HistoryFrame[];
  future: readonly HistoryFrame[];
  sequence: number;
}>;

export const INPUT_HISTORY_LIMIT = 50;

export type InputRuntimeCommit = Readonly<{
  input: RuntimePersistedInputState;
  history: InputHistoryState;
  committedAt: number;
  changedSections: ReadonlySet<StorageKey>;
  changedRejectedSections: ReadonlySet<StorageKey>;
  authoritativeReplacement: boolean;
  clearFieldErrorsFor: ReadonlySet<StorageKey>;
  restoredFieldErrors?: Readonly<{
    cache: FieldErrorCache;
    revisions: FieldErrorRevisionMap;
  }>;
}>;

type InputRuntimeStoreState = {
  /** Eneste autoritative inputaggregate. */
  input: RuntimePersistedInputState;
  revision: number;
  history: InputHistoryState;

  /** Midlertidige read-facader for fase-4/5-callsites; de kan ikke skrives selvstændigt. */
  sections: FormPersistenceSections;
  invalidDrafts: InvalidDraftsCache;
  sectionRevisions: SectionRevisionMap;
  invalidDraftRevisions: InvalidDraftRevisionMap;
  committedChangeCounter: number;
  authoritativeSnapshotEpoch: number;
  meta: FormPersistenceMeta;

  /** Komponentrapporterede fejl er fase-5-migrationsstate og er ikke input eller history. */
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;

  hydrateInputRuntime: (
    input: RuntimePersistedInputState,
    options?: Readonly<{ writesBlocked?: boolean }>
  ) => void;
  applyInputRuntimeCommit: (commit: InputRuntimeCommit) => void;
  setFieldError: <K extends StorageKey>(
    key: K,
    fieldName: string,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => void;
  clearFieldErrorsForSection: (key: StorageKey) => void;
  clearAllFieldErrors: () => void;
  restoreFieldErrors: (fieldErrors: FieldErrorCache, revisions: FieldErrorRevisionMap) => void;
  /** Legacy-metoder nedenfor findes kun for eksisterende testfixtures og fejler uden for test. */
  clearAll: (meta: FormPersistenceMeta) => void;
  hydrate: (sections: FormPersistenceSections, meta: FormPersistenceMeta, invalidDrafts?: InvalidDraftsCache) => void;
  commitSection: <K extends StorageKey>(key: K, value: FormPersistenceSections[K], meta?: { lastCommittedAt?: number }) => void;
  replaceSections: (sections: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  replaceSectionsAndClearFieldErrors: (sections: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  setInvalidDraft: (key: StorageKey, fieldPath: string, draft: string | null) => void;
  clearAllInvalidDrafts: () => void;
  pruneInvalidDraftsForSectionFields: (key: StorageKey, fieldPaths: readonly string[]) => void;
  restoreInvalidDrafts: (drafts: InvalidDraftsCache, revisions: InvalidDraftRevisionMap) => void;
  resetSection: (key: StorageKey) => void;
  finalizeEdit: (args: Readonly<{
    sectionKey: StorageKey;
    sectionValue: FormPersistenceSections[StorageKey];
    invalidDraftChanges: readonly { pageKey: StorageKey; fieldPath: string; draft: string | null }[];
    metaPatch?: { lastCommittedAt?: number };
  }>) => void;
  restoreHistoryFrame: (
    sections: FormPersistenceSections,
    sectionRevisions: SectionRevisionMap,
    fieldErrors: FieldErrorCache,
    fieldErrorRevisions: FieldErrorRevisionMap,
    invalidDrafts: InvalidDraftsCache,
    invalidDraftRevisions: InvalidDraftRevisionMap,
    meta: FormPersistenceMeta,
    committedAt: number
  ) => void;
  __setSectionUnsafe: <K extends StorageKey>(key: K, value: FormPersistenceSections[K]) => void;
  __setMetaUnsafe: (meta: Partial<FormPersistenceMeta>) => void;
  /** Kun til isolerede tests; runtime-callsites er forbudt. */
  __replaceRuntimeForTests: (input: RuntimePersistedInputState, history?: InputHistoryState) => void;
};

const buildSectionMap = <T>(factory: () => T): { [K in StorageKey]: T } =>
  PERSISTED_SECTION_KEYS.reduce((result, key) => {
    result[key] = factory();
    return result;
  }, {} as { [K in StorageKey]: T });

export const createEmptyInvalidDraftsCache = (): InvalidDraftsCache => buildSectionMap(() => ({}));
const createEmptyFieldErrorCache = (): FieldErrorCache => buildSectionMap(() => ({}));
const createRevisionMap = (): SectionKeyedRevisions => buildSectionMap(() => 0);

export const createEmptyRuntimeInput = (): RuntimePersistedInputState => ({
  sections: createEmptyPersistedInputSections(),
  rejectedInputs: {},
});

export const createEmptyInputHistory = (): InputHistoryState => ({ past: [], future: [], sequence: 0 });

const incrementSelected = (
  revisions: SectionKeyedRevisions,
  sections: ReadonlySet<StorageKey>
): SectionKeyedRevisions => {
  if (sections.size === 0) return revisions;
  const next = { ...revisions };
  for (const section of sections) next[section] += 1;
  return next;
};

const clearSelectedErrors = (
  cache: FieldErrorCache,
  revisions: FieldErrorRevisionMap,
  sections: ReadonlySet<StorageKey>
): Readonly<{ cache: FieldErrorCache; revisions: FieldErrorRevisionMap }> => {
  if (sections.size === 0) return { cache, revisions };
  let nextCache = cache;
  let nextRevisions = revisions;
  for (const section of sections) {
    if (Object.keys(cache[section]).length === 0) continue;
    nextCache = { ...nextCache, [section]: {} };
    nextRevisions = { ...nextRevisions, [section]: nextRevisions[section] + 1 };
  }
  return { cache: nextCache, revisions: nextRevisions };
};

type FieldErrorUpdate =
  | Readonly<{ kind: 'noop' }>
  | Readonly<{ kind: 'delete' }>
  | Readonly<{ kind: 'set'; value: FieldErrorBySource }>;

const updateFieldError = (
  current: FieldErrorBySource,
  source: FieldErrorSource,
  next: FormFieldError | null
): FieldErrorUpdate => {
  if (next === null) {
    if (current[source] === undefined) return { kind: 'noop' };
    const value = { ...current };
    delete value[source];
    return Object.keys(value).length === 0 ? { kind: 'delete' } : { kind: 'set', value };
  }
  const previous = current[source];
  if (
    previous?.message === next.message
    && previous.severity === next.severity
    && previous.source === next.source
    && previous.blocksSave === next.blocksSave
  ) return { kind: 'noop' };
  return { kind: 'set', value: { ...current, [source]: next } };
};

const projectCompatibilityViews = (input: RuntimePersistedInputState): Readonly<{
  sections: FormPersistenceSections;
  invalidDrafts: InvalidDraftsCache;
}> => ({
  sections: input.sections as FormPersistenceSections,
  invalidDrafts: rejectedInputsToLegacyInvalidDrafts(input.rejectedInputs, createEmptyInvalidDraftsCache),
});

const assertTestCompatibility = (): void => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('inputRuntimeStore: legacy testfacade er kun tilladt i testmiljøet');
  }
};

const testReplaceInput = (
  set: StoreApi<InputRuntimeStoreState>['setState'],
  transform: (state: InputRuntimeStoreState) => RuntimePersistedInputState,
  extra: Partial<InputRuntimeStoreState> = {}
): void => {
  assertTestCompatibility();
  set((state) => {
    const nextInput = transform(state);
    return {
      input: nextInput,
      revision: state.revision + 1,
      ...projectCompatibilityViews(nextInput),
      ...extra,
    };
  });
};

const createInputRuntimeStore = () => createStore<InputRuntimeStoreState>((set) => {
  const input = createEmptyRuntimeInput();
  const views = projectCompatibilityViews(input);
  return {
    input,
    revision: 0,
    history: createEmptyInputHistory(),
    ...views,
    sectionRevisions: createRevisionMap(),
    invalidDraftRevisions: createRevisionMap(),
    committedChangeCounter: 0,
    authoritativeSnapshotEpoch: 0,
    meta: { hydrated: false, persistedDataVersion: PERSISTED_DATA_VERSION },
    fieldErrors: createEmptyFieldErrorCache(),
    fieldErrorRevisions: createRevisionMap(),

    hydrateInputRuntime: (nextInput, options) => {
      const nextViews = projectCompatibilityViews(nextInput);
      set((state) => ({
        input: nextInput,
        revision: state.revision + 1,
        history: createEmptyInputHistory(),
        ...nextViews,
        sectionRevisions: incrementSelected(state.sectionRevisions, new Set(PERSISTED_SECTION_KEYS)),
        invalidDraftRevisions: incrementSelected(state.invalidDraftRevisions, new Set(PERSISTED_SECTION_KEYS)),
        committedChangeCounter: state.committedChangeCounter,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: {
          hydrated: true,
          persistedDataVersion: PERSISTED_DATA_VERSION,
          ...(options?.writesBlocked === true ? { inputWritesBlocked: true } : {}),
        },
        fieldErrors: createEmptyFieldErrorCache(),
        fieldErrorRevisions: incrementSelected(state.fieldErrorRevisions, new Set(PERSISTED_SECTION_KEYS)),
      }));
    },

    applyInputRuntimeCommit: (commit) => {
      const nextViews = projectCompatibilityViews(commit.input);
      set((state) => {
        const errors = commit.restoredFieldErrors ?? clearSelectedErrors(
          state.fieldErrors,
          state.fieldErrorRevisions,
          commit.clearFieldErrorsFor
        );
        return {
          input: commit.input,
          revision: state.revision + 1,
          history: commit.history,
          ...nextViews,
          sectionRevisions: incrementSelected(state.sectionRevisions, commit.changedSections),
          invalidDraftRevisions: incrementSelected(
            state.invalidDraftRevisions,
            commit.changedRejectedSections
          ),
          committedChangeCounter: state.committedChangeCounter + 1,
          authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch
            + (commit.authoritativeReplacement ? 1 : 0),
          meta: {
            hydrated: true,
            persistedDataVersion: PERSISTED_DATA_VERSION,
            lastCommittedAt: commit.committedAt,
          },
          fieldErrors: errors.cache,
          fieldErrorRevisions: errors.revisions,
        };
      });
    },

    setFieldError: (key, fieldName, source, error) => {
      set((state) => {
        const section = state.fieldErrors[key] as FieldErrorsForSection<typeof key>;
        const current = (section[fieldName] ?? {}) as FieldErrorBySource;
        const normalized = error === null ? null : normalizeFieldError({ ...error, source });
        const update = updateFieldError(current, source, normalized);
        if (update.kind === 'noop') return state;
        const nextSection = { ...section };
        if (update.kind === 'delete') delete nextSection[fieldName];
        else nextSection[fieldName] = update.value as FieldErrorsForSection<typeof key>[typeof fieldName];
        return {
          fieldErrors: { ...state.fieldErrors, [key]: nextSection } as FieldErrorCache,
          fieldErrorRevisions: {
            ...state.fieldErrorRevisions,
            [key]: state.fieldErrorRevisions[key] + 1,
          },
        };
      });
    },

    clearFieldErrorsForSection: (key) => {
      set((state) => {
        if (Object.keys(state.fieldErrors[key]).length === 0) return state;
        return {
          fieldErrors: { ...state.fieldErrors, [key]: {} } as FieldErrorCache,
          fieldErrorRevisions: {
            ...state.fieldErrorRevisions,
            [key]: state.fieldErrorRevisions[key] + 1,
          },
        };
      });
    },

    clearAllFieldErrors: () => {
      set((state) => ({
        fieldErrors: createEmptyFieldErrorCache(),
        fieldErrorRevisions: incrementSelected(state.fieldErrorRevisions, new Set(PERSISTED_SECTION_KEYS)),
      }));
    },

    restoreFieldErrors: (fieldErrors, revisions) => {
      assertTestCompatibility();
      set({ fieldErrors, fieldErrorRevisions: revisions });
    },

    clearAll: (meta) => {
      assertTestCompatibility();
      const nextInput = createEmptyRuntimeInput();
      set((state) => ({
        input: nextInput,
        revision: state.revision + 1,
        history: createEmptyInputHistory(),
        ...projectCompatibilityViews(nextInput),
        fieldErrors: createEmptyFieldErrorCache(),
        meta,
      }));
    },

    hydrate: (sections, meta, invalidDrafts = createEmptyInvalidDraftsCache()) => {
      assertTestCompatibility();
      const nextInput = { sections, rejectedInputs: legacyInvalidDraftsToRejectedInputs(invalidDrafts) };
      set((state) => ({
        input: nextInput,
        revision: state.revision + 1,
        history: createEmptyInputHistory(),
        ...projectCompatibilityViews(nextInput),
        fieldErrors: createEmptyFieldErrorCache(),
        meta: { ...meta, hydrated: true },
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
      }));
    },

    commitSection: (key, value, metaPatch) => {
      testReplaceInput(set, (state) => ({
        sections: { ...state.input.sections, [key]: value },
        rejectedInputs: state.input.rejectedInputs,
      }), metaPatch?.lastCommittedAt === undefined ? {} : {
        meta: { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION, lastCommittedAt: metaPatch.lastCommittedAt },
      });
    },

    replaceSections: (sections, meta) => testReplaceInput(set, (state) => ({
      sections,
      rejectedInputs: state.input.rejectedInputs,
    }), { meta }),

    replaceSectionsAndClearFieldErrors: (sections, meta) => testReplaceInput(set, () => ({
      sections,
      rejectedInputs: {},
    }), { meta, fieldErrors: createEmptyFieldErrorCache() }),

    setInvalidDraft: (key, fieldPath, draft) => testReplaceInput(set, (state) => ({
      sections: state.input.sections,
      rejectedInputs: applyLegacyRejectedInputChanges(state.input.rejectedInputs, [
        { pageKey: key, fieldPath, draft },
      ]),
    })),

    clearAllInvalidDrafts: () => testReplaceInput(set, (state) => ({
      sections: state.input.sections,
      rejectedInputs: {},
    })),

    pruneInvalidDraftsForSectionFields: (key, fieldPaths) => testReplaceInput(set, (state) => ({
      sections: state.input.sections,
      rejectedInputs: applyLegacyRejectedInputChanges(
        state.input.rejectedInputs,
        fieldPaths.map((fieldPath) => ({ pageKey: key, fieldPath, draft: null }))
      ),
    })),

    restoreInvalidDrafts: (drafts, revisions) => testReplaceInput(set, (state) => ({
      sections: state.input.sections,
      rejectedInputs: legacyInvalidDraftsToRejectedInputs(drafts),
    }), { invalidDraftRevisions: revisions }),

    resetSection: (key) => testReplaceInput(set, (state) => ({
      sections: { ...state.input.sections, [key]: null },
      rejectedInputs: Object.fromEntries(Object.entries(state.input.rejectedInputs).filter(([address]) => {
        const parsed = JSON.parse(address) as { address?: { section?: string } };
        return parsed.address?.section !== key;
      })),
    })),

    finalizeEdit: (args) => testReplaceInput(set, (state) => ({
      sections: { ...state.input.sections, [args.sectionKey]: args.sectionValue },
      rejectedInputs: applyLegacyRejectedInputChanges(state.input.rejectedInputs, args.invalidDraftChanges),
    }), args.metaPatch?.lastCommittedAt === undefined ? {} : {
      meta: {
        hydrated: true,
        persistedDataVersion: PERSISTED_DATA_VERSION,
        lastCommittedAt: args.metaPatch.lastCommittedAt,
      },
    }),

    restoreHistoryFrame: (
      sections,
      sectionRevisions,
      fieldErrors,
      fieldErrorRevisions,
      invalidDrafts,
      invalidDraftRevisions,
      meta
    ) => testReplaceInput(set, () => ({
      sections,
      rejectedInputs: legacyInvalidDraftsToRejectedInputs(invalidDrafts),
    }), { sectionRevisions, fieldErrors, fieldErrorRevisions, invalidDraftRevisions, meta }),

    __setSectionUnsafe: (key, value) => testReplaceInput(set, (state) => ({
      sections: { ...state.input.sections, [key]: value },
      rejectedInputs: state.input.rejectedInputs,
    })),

    __setMetaUnsafe: (meta) => {
      assertTestCompatibility();
      set((state) => ({ meta: { ...state.meta, ...meta } }));
    },

    __replaceRuntimeForTests: (nextInput, nextHistory = createEmptyInputHistory()) => {
      if (process.env.NODE_ENV !== 'test') {
        throw new Error('inputRuntimeStore: testmutation er kun tilladt i testmiljøet');
      }
      const nextViews = projectCompatibilityViews(nextInput);
      set({ input: nextInput, history: nextHistory, ...nextViews });
    },
  };
});

export const inputRuntimeStore = createInputRuntimeStore();
export const __createInputRuntimeTestStore = createInputRuntimeStore;

export const assignFormPersistenceSection = <K extends keyof PersistedSectionMap>(
  target: FormPersistenceSections,
  key: K,
  value: PersistedSectionMap[K] | null
): void => {
  target[key] = value;
};

export const createEmptyFormPersistenceSections = (): FormPersistenceSections =>
  createEmptyPersistedInputSections() as FormPersistenceSections;
