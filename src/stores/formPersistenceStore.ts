import { createStore } from 'zustand/vanilla';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import {
  type FieldErrorBySource,
  type FieldErrorSeverity,
  type FieldErrorSource,
  type FieldErrorsForSection,
  type FormFieldError,
  normalizeFieldError,
} from '../types/fieldErrors';

export type FormPersistenceSections = {
  stamdata: PersistedSectionMap['stamdata'] | null;
  satser: PersistedSectionMap['satser'] | null;
  aarsloen: PersistedSectionMap['aarsloen'] | null;
  faellesAarsloen: PersistedSectionMap['faellesAarsloen'] | null;
  faellesPersondata: PersistedSectionMap['faellesPersondata'] | null;
  renteberegning: PersistedSectionMap['renteberegning'] | null;
  varigemen: PersistedSectionMap['varigemen'] | null;
  forsoergertab: PersistedSectionMap['forsoergertab'] | null;
  erstatningsopgoerelse: PersistedSectionMap['erstatningsopgoerelse'] | null;
  erhvervsevnetab: PersistedSectionMap['erhvervsevnetab'] | null;
};

export type FormPersistenceMeta = {
  hydrated: boolean;
  schemaFingerprint: string;
  lastCommittedAt?: number;
};

export type SectionRevisionMap = {
  [K in keyof FormPersistenceSections]: number;
};

export type FieldErrorCache = { [K in keyof FormPersistenceSections]: FieldErrorsForSection<K> };
export type FieldErrorRevisionMap = { [K in keyof FormPersistenceSections]: number };

export type FormPersistenceStoreState = {
  sections: FormPersistenceSections;
  sectionRevisions: SectionRevisionMap;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  authoritativeSnapshotEpoch: number;
  meta: FormPersistenceMeta;
  hydrate: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  commitSection: <K extends keyof FormPersistenceSections>(key: K, next: FormPersistenceSections[K] | null, metaPatch?: Partial<FormPersistenceMeta>) => void;
  clearSection: <K extends keyof FormPersistenceSections>(key: K, metaPatch?: Partial<FormPersistenceMeta>) => void;
  // NOTE: replaceSections preserves existing field-errors.
  // Use replaceSectionsAndClearFieldErrors for load/replace flows that must clear errors atomically.
  replaceSections: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  replaceSectionsAndClearFieldErrors: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  clearAll: (meta: FormPersistenceMeta) => void;
  rollbackSections: (
    next: FormPersistenceSections,
    sectionRevisions: SectionRevisionMap,
    authoritativeSnapshotEpoch: number,
    meta: FormPersistenceMeta
  ) => void;
  setFieldError: <K extends keyof FormPersistenceSections>(
    key: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => void;
  clearFieldErrorsForSection: <K extends keyof FormPersistenceSections>(key: K) => void;
  clearAllFieldErrors: () => void;
  restoreFieldErrors: (fieldErrors: FieldErrorCache, fieldErrorRevisions: FieldErrorRevisionMap) => void;
  /** Test-only escape hatch. Runtime brug udenfor test skal fejle lukket. */
  __setSectionUnsafe: <K extends keyof FormPersistenceSections>(key: K, next: FormPersistenceSections[K] | null) => void;
  /** Test-only escape hatch. Runtime brug udenfor test skal fejle lukket. */
  __setMetaUnsafe: (next: Partial<FormPersistenceMeta>) => void;
};

const REQUIRED_SECTION_KEYS = Object.keys(persistenceSchemas).sort();
const SECTION_KEYS = REQUIRED_SECTION_KEYS as Array<keyof FormPersistenceSections>;

const EMPTY_SECTIONS: FormPersistenceSections = SECTION_KEYS.reduce((acc, key) => {
  acc[key] = null;
  return acc;
}, {} as FormPersistenceSections);

const createInitialSectionRevisions = (): SectionRevisionMap =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as SectionRevisionMap);

const createEmptyFieldErrorCache = (): FieldErrorCache =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = {};
    return acc;
  }, {} as FieldErrorCache);

const createInitialFieldErrorRevisions = (): FieldErrorRevisionMap =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as FieldErrorRevisionMap);

const assertKeyCoverage = (next: FormPersistenceSections): void => {
  const keys = Object.keys(next).sort();
  if (keys.length !== REQUIRED_SECTION_KEYS.length) {
    throw new Error('formPersistenceStore: section key coverage mismatch');
  }
  for (let i = 0; i < REQUIRED_SECTION_KEYS.length; i += 1) {
    if (keys[i] !== REQUIRED_SECTION_KEYS[i]) {
      throw new Error('formPersistenceStore: section key coverage mismatch');
    }
  }
};

const assertMetaFingerprintMatch = (meta: FormPersistenceMeta): void => {
  if (meta.schemaFingerprint !== PERSISTED_DATA_VERSION) {
    throw new Error('formPersistenceStore: schemaFingerprint mismatch');
  }
};

const assertMetaPatchFingerprint = (metaPatch?: Partial<FormPersistenceMeta>): void => {
  if (!metaPatch?.schemaFingerprint) return;
  if (metaPatch.schemaFingerprint !== PERSISTED_DATA_VERSION) {
    throw new Error('formPersistenceStore: schemaFingerprint mismatch');
  }
};

const assertFieldErrorKeyCoverage = (next: FieldErrorCache): void => {
  const keys = Object.keys(next).sort();
  if (keys.length !== REQUIRED_SECTION_KEYS.length) {
    throw new Error('formPersistenceStore: field-error key coverage mismatch');
  }
  for (let i = 0; i < REQUIRED_SECTION_KEYS.length; i += 1) {
    if (keys[i] !== REQUIRED_SECTION_KEYS[i]) {
      throw new Error('formPersistenceStore: field-error key coverage mismatch');
    }
  }
};

const assertFieldErrorRevisionKeyCoverage = (next: FieldErrorRevisionMap): void => {
  const keys = Object.keys(next).sort();
  if (keys.length !== REQUIRED_SECTION_KEYS.length) {
    throw new Error('formPersistenceStore: field-error revision key coverage mismatch');
  }
  for (let i = 0; i < REQUIRED_SECTION_KEYS.length; i += 1) {
    if (keys[i] !== REQUIRED_SECTION_KEYS[i]) {
      throw new Error('formPersistenceStore: field-error revision key coverage mismatch');
    }
  }
};

const assertSectionValid = <K extends keyof FormPersistenceSections>(
  key: K,
  value: FormPersistenceSections[K] | null
): void => {
  if (value === null) return;
  const schema = persistenceSchemas[key];
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`formPersistenceStore: invalid section for '${String(key)}'`);
  }
};

const assertAllSectionsValid = (next: FormPersistenceSections): void => {
  (Object.keys(next) as Array<keyof FormPersistenceSections>).forEach((key) => {
    assertSectionValid(key, next[key]);
  });
};

const incrementSectionRevision = <K extends keyof FormPersistenceSections>(
  revisions: SectionRevisionMap,
  key: K
): SectionRevisionMap => ({
  ...revisions,
  [key]: (revisions[key] ?? 0) + 1,
});

const incrementAllSectionRevisions = (revisions: SectionRevisionMap): SectionRevisionMap => {
  const next = { ...revisions };
  (Object.keys(next) as Array<keyof SectionRevisionMap>).forEach((key) => {
    next[key] = (revisions[key] ?? 0) + 1;
  });
  return next;
};
const incrementFieldErrorRevision = <K extends keyof FormPersistenceSections>(
  revisions: FieldErrorRevisionMap,
  key: K
): FieldErrorRevisionMap => ({
  ...revisions,
  [key]: (revisions[key] ?? 0) + 1,
});
const incrementAllFieldErrorRevisions = (revisions: FieldErrorRevisionMap): FieldErrorRevisionMap => {
  const next = { ...revisions };
  (Object.keys(next) as Array<keyof FieldErrorRevisionMap>).forEach((key) => {
    next[key] = (revisions[key] ?? 0) + 1;
  });
  return next;
};

type FieldErrorUpdateResult =
  | { kind: 'noop' }
  | { kind: 'deleteField' }
  | { kind: 'updateField'; nextForField: FieldErrorBySource };

const applyFieldErrorUpdate = (
  prevForField: FieldErrorBySource,
  source: FieldErrorSource,
  next: FormFieldError | null
): FieldErrorUpdateResult => {
  if (next === null) {
    if (!prevForField[source]) return { kind: 'noop' };
    const updated: FieldErrorBySource = { ...prevForField };
    delete updated[source];
    return Object.keys(updated).length === 0 ? { kind: 'deleteField' } : { kind: 'updateField', nextForField: updated };
  }

  const existing = prevForField[source];
  if (
    existing &&
    existing.message === next.message &&
    existing.severity === next.severity &&
    existing.source === next.source &&
    existing.blocksSave === next.blocksSave
  ) {
    return { kind: 'noop' };
  }

  return { kind: 'updateField', nextForField: { ...prevForField, [source]: next } };
};

const resolveMeta = (prev: FormPersistenceMeta, metaPatch?: Partial<FormPersistenceMeta>): FormPersistenceMeta => {
  const next: FormPersistenceMeta = {
    ...prev,
    ...metaPatch,
    hydrated: true,
    schemaFingerprint: PERSISTED_DATA_VERSION,
  };
  return next;
};

const assertTestOnlyUnsafeMutation = (): void => {
  if (process.env.NODE_ENV === 'test') return;
  throw new Error('formPersistenceStore: unsafe test mutation is only allowed in test environment');
};

const createFormPersistenceStore = () =>
  createStore<FormPersistenceStoreState>((set) => ({
    sections: { ...EMPTY_SECTIONS },
    sectionRevisions: createInitialSectionRevisions(),
    fieldErrors: createEmptyFieldErrorCache(),
    fieldErrorRevisions: createInitialFieldErrorRevisions(),
    authoritativeSnapshotEpoch: 0,
    meta: { hydrated: false, schemaFingerprint: PERSISTED_DATA_VERSION },
    hydrate: (next, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      set((state) => ({
        sections: { ...next },
        sectionRevisions: state.sectionRevisions,
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        // Hydration from persisted storage is authoritative for form consumers.
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    commitSection: (key, next, metaPatch) => {
      assertSectionValid(key, next);
      assertMetaPatchFingerprint(metaPatch);
      set((state) => ({
        sections: { ...state.sections, [key]: next },
        sectionRevisions: incrementSectionRevision(state.sectionRevisions, key),
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
        meta: resolveMeta(state.meta, { ...metaPatch, lastCommittedAt: Date.now() }),
      }));
    },
    clearSection: (key, metaPatch) => {
      assertMetaPatchFingerprint(metaPatch);
      set((state) => ({
        sections: { ...state.sections, [key]: null },
        sectionRevisions: incrementSectionRevision(state.sectionRevisions, key),
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
        meta: resolveMeta(state.meta, { ...metaPatch, lastCommittedAt: Date.now() }),
      }));
    },
    replaceSections: (next, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      set((state) => ({
        sections: { ...next },
        sectionRevisions: incrementAllSectionRevisions(state.sectionRevisions),
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    replaceSectionsAndClearFieldErrors: (next, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      set((state) => ({
        sections: { ...next },
        sectionRevisions: incrementAllSectionRevisions(state.sectionRevisions),
        fieldErrors: createEmptyFieldErrorCache(),
        fieldErrorRevisions: incrementAllFieldErrorRevisions(state.fieldErrorRevisions),
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    clearAll: (meta) => {
      assertMetaFingerprintMatch(meta);
      set((state) => ({
        sections: { ...EMPTY_SECTIONS },
        sectionRevisions: incrementAllSectionRevisions(state.sectionRevisions),
        fieldErrors: createEmptyFieldErrorCache(),
        fieldErrorRevisions: incrementAllFieldErrorRevisions(state.fieldErrorRevisions),
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    rollbackSections: (next, sectionRevisions, authoritativeSnapshotEpoch, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      // NOTE: rollbackSections intentionally only rolls back section state.
      // Field errors are restored via restoreFieldErrors() by the caller.
      set((state) => ({
        sections: { ...next },
        sectionRevisions: { ...sectionRevisions },
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        authoritativeSnapshotEpoch,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    setFieldError: (key, fieldName, source, error) => {
      set((state) => {
        const prevForPage = state.fieldErrors[key] as FieldErrorsForSection<typeof key>;
        const prevForField = (prevForPage[fieldName] ?? {}) as FieldErrorBySource;
        const nextForPage: FieldErrorsForSection<typeof key> = { ...prevForPage };
        const normalized = error === null
          ? null
          : normalizeFieldError({
              message: error.message,
              severity: error.severity,
              source,
              blocksSave: error.blocksSave,
            });
        const update = applyFieldErrorUpdate(prevForField, source, normalized);
        if (update.kind === 'noop') return state;
        if (update.kind === 'deleteField') {
          delete nextForPage[fieldName];
        } else {
          nextForPage[fieldName] = update.nextForField as FieldErrorsForSection<typeof key>[typeof fieldName];
        }
        return {
          fieldErrors: { ...state.fieldErrors, [key]: nextForPage } as FieldErrorCache,
          fieldErrorRevisions: incrementFieldErrorRevision(state.fieldErrorRevisions, key),
        };
      });
    },
    clearFieldErrorsForSection: (key) => {
      set((state) => ({
        fieldErrors: { ...state.fieldErrors, [key]: {} } as FieldErrorCache,
        fieldErrorRevisions: incrementFieldErrorRevision(state.fieldErrorRevisions, key),
      }));
    },
    clearAllFieldErrors: () => {
      set((state) => ({
        fieldErrors: createEmptyFieldErrorCache(),
        fieldErrorRevisions: incrementAllFieldErrorRevisions(state.fieldErrorRevisions),
      }));
    },
    restoreFieldErrors: (fieldErrors, fieldErrorRevisions) => {
      assertFieldErrorKeyCoverage(fieldErrors);
      assertFieldErrorRevisionKeyCoverage(fieldErrorRevisions);
      set({
        fieldErrors: { ...fieldErrors },
        fieldErrorRevisions: { ...fieldErrorRevisions },
      });
    },
    __setSectionUnsafe: (key, next) => {
      assertTestOnlyUnsafeMutation();
      set((state) => ({ sections: { ...state.sections, [key]: next } }));
    },
    __setMetaUnsafe: (next) => {
      assertTestOnlyUnsafeMutation();
      set((state) => ({ meta: { ...state.meta, ...next } }));
    },
  }));

export const formPersistenceStore = createFormPersistenceStore();
export const __createTestStore = createFormPersistenceStore;
