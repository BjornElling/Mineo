import { createStore } from 'zustand/vanilla';
import { PERSISTED_SECTION_KEYS, persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { isInteractiveDevLoggingEnabled } from '../utils/debugRuntime';
import {
  type FieldErrorBySource,
  type FieldErrorSeverity,
  type FieldErrorSource,
  type FieldErrorsForSection,
  type FormFieldError,
  normalizeFieldError,
} from '../types/fieldErrors';

const debugFormPersistenceStore = (event: string, details: Record<string, unknown>): void => {
  if (!isInteractiveDevLoggingEnabled) return;
  console.debug('[formPersistenceStore]', event, details);
};

export type FormPersistenceSections = {
  -readonly [K in keyof PersistedSectionMap]: PersistedSectionMap[K] | null;
};

export type FormPersistenceMeta = {
  hydrated: boolean;
  // Version-tag (PERSISTED_DATA_VERSION), IKKE et beregnet schema-fingerprint trods navnet.
  // Bruges som version-guard ved hydrate/replace/rollback (se assertMetaFingerprintMatch).
  schemaFingerprint: string;
  lastCommittedAt?: number;
};

type SectionMetaPatch = Pick<FormPersistenceMeta, 'lastCommittedAt'>;

/**
 * Kanonisk revision-map for en keyed slice. Alle tre slices (sections/fieldErrors/invalidDrafts)
 * bruger nøjagtig samme form — pr. sektions-key en monotont voksende revision-tæller.
 */
export type SectionKeyedRevisions = {
  [K in keyof FormPersistenceSections]: number;
};
export type SectionRevisionMap = SectionKeyedRevisions;

export type FieldErrorCache = { [K in keyof FormPersistenceSections]: FieldErrorsForSection<K> };
export type FieldErrorRevisionMap = SectionKeyedRevisions;

/**
 * `invalidDrafts`-recovery-kanal (committed rå draft, jf. persistence-contract.md §11).
 * Pr. sektion en map fra fieldPath til ikke-tom råstreng. Separat slice ved siden af fieldErrors;
 * IKKE en persisteret sektion (indgår ikke i sectionRevisions/schemaFingerprint).
 */
export type InvalidDraftsForSection = Record<string, string>;
export type InvalidDraftsCache = { [K in keyof FormPersistenceSections]: InvalidDraftsForSection };
export type InvalidDraftRevisionMap = SectionKeyedRevisions;

export type FormPersistenceStoreState = {
  sections: FormPersistenceSections;
  sectionRevisions: SectionRevisionMap;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  invalidDrafts: InvalidDraftsCache;
  invalidDraftRevisions: InvalidDraftRevisionMap;
  committedChangeCounter: number;
  authoritativeSnapshotEpoch: number;
  meta: FormPersistenceMeta;
  hydrate: (next: FormPersistenceSections, meta: FormPersistenceMeta, invalidDrafts?: InvalidDraftsCache) => void;
  commitSection: <K extends keyof FormPersistenceSections>(key: K, next: FormPersistenceSections[K] | null, metaPatch?: SectionMetaPatch) => void;
  clearSection: <K extends keyof FormPersistenceSections>(key: K, metaPatch?: SectionMetaPatch) => void;
  // NOTE: replaceSections bevarer eksisterende field-errors.
  // Brug replaceSectionsAndClearFieldErrors til load/replace-flows, der skal rydde fejl atomisk
  // (rydder både fieldErrors OG invalidDrafts atomisk sammen med sektionerne).
  replaceSections: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  replaceSectionsAndClearFieldErrors: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  clearAll: (meta: FormPersistenceMeta) => void;
  rollbackSections: (
    next: FormPersistenceSections,
    sectionRevisions: SectionRevisionMap,
    committedChangeCounter: number,
    authoritativeSnapshotEpoch: number,
    meta: FormPersistenceMeta
  ) => void;
  restoreHistoryFrame: (
    next: FormPersistenceSections,
    sectionRevisions: SectionRevisionMap,
    fieldErrors: FieldErrorCache,
    fieldErrorRevisions: FieldErrorRevisionMap,
    invalidDrafts: InvalidDraftsCache,
    invalidDraftRevisions: InvalidDraftRevisionMap,
    meta: FormPersistenceMeta,
    committedAt: number
  ) => void;
  setInvalidDraft: <K extends keyof FormPersistenceSections>(
    key: K,
    fieldPath: string,
    draft: string | null
  ) => void;
  clearInvalidDraftsForSection: <K extends keyof FormPersistenceSections>(key: K) => void;
  /**
   * Fjern et udvalg af `invalidDrafts`-nøgler i én sektion atomisk (forældreløse celle-drafts efter
   * række-/scope-sletning). Bumper kun revisionen ved reel ændring. Fanger BEVIDST ingen undo-frame —
   * det er housekeeping (jf. useTableCellErrorTracker.pruneToValidRowIds), og en slettet rækkes egen
   * undo-frame bærer allerede draften, så undo af sletningen gendanner den.
   */
  pruneInvalidDraftsForSectionFields: <K extends keyof FormPersistenceSections>(key: K, fieldPaths: readonly string[]) => void;
  clearAllInvalidDrafts: () => void;
  restoreInvalidDrafts: (invalidDrafts: InvalidDraftsCache, invalidDraftRevisions: InvalidDraftRevisionMap) => void;
  setFieldError: <K extends keyof FormPersistenceSections>(
    key: K,
    fieldName: string,
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

const REQUIRED_SECTION_KEYS = [...PERSISTED_SECTION_KEYS].sort();
const SECTION_KEYS = REQUIRED_SECTION_KEYS as Array<keyof FormPersistenceSections>;

// Tre slices (sections/fieldErrors/invalidDrafts) er strukturelt identiske: hver er en cache nøglet på
// det fulde sæt sektions-keys plus et revision-map af samme form. Tidligere havde hver sin egen kopi af
// create-empty / initial-revisions / increment-one / increment-all (fire næsten-identiske kopier).
// Én generisk slice-factory instantieres pr. concern, så de fem operationer ikke kan drifte fra hinanden.
const buildSectionKeyedMap = <T>(makeValue: () => T): { [K in keyof FormPersistenceSections]: T } =>
  SECTION_KEYS.reduce((acc, key) => {
    acc[key] = makeValue();
    return acc;
  }, {} as { [K in keyof FormPersistenceSections]: T });

const createSectionKeyedRevisions = (): SectionKeyedRevisions => buildSectionKeyedMap(() => 0);

const incrementSectionKeyedRevision = (
  revisions: SectionKeyedRevisions,
  key: keyof FormPersistenceSections
): SectionKeyedRevisions => ({
  ...revisions,
  [key]: (revisions[key] ?? 0) + 1,
});

const incrementAllSectionKeyedRevisions = (revisions: SectionKeyedRevisions): SectionKeyedRevisions => {
  const next = { ...revisions };
  for (const key of SECTION_KEYS) {
    next[key] = (revisions[key] ?? 0) + 1;
  }
  return next;
};

type KeyedSectionSlice<TCache> = {
  createEmptyCache: () => TCache;
  createInitialRevisions: () => SectionKeyedRevisions;
  incrementRevision: (revisions: SectionKeyedRevisions, key: keyof FormPersistenceSections) => SectionKeyedRevisions;
  incrementAllRevisions: (revisions: SectionKeyedRevisions) => SectionKeyedRevisions;
};

const createKeyedSectionSlice = <TCache extends { [K in keyof FormPersistenceSections]: unknown }>(
  makeEmptyValue: () => TCache[keyof FormPersistenceSections]
): KeyedSectionSlice<TCache> => ({
  createEmptyCache: () => buildSectionKeyedMap(makeEmptyValue) as TCache,
  createInitialRevisions: createSectionKeyedRevisions,
  incrementRevision: incrementSectionKeyedRevision,
  incrementAllRevisions: incrementAllSectionKeyedRevisions,
});

const SECTIONS_SLICE = createKeyedSectionSlice<FormPersistenceSections>(() => null);
const FIELD_ERRORS_SLICE = createKeyedSectionSlice<FieldErrorCache>(() => ({}));
const INVALID_DRAFTS_SLICE = createKeyedSectionSlice<InvalidDraftsCache>(() => ({}));

const EMPTY_SECTIONS: FormPersistenceSections = SECTIONS_SLICE.createEmptyCache();

const createInitialSectionRevisions = SECTIONS_SLICE.createInitialRevisions;
const createEmptyFieldErrorCache = FIELD_ERRORS_SLICE.createEmptyCache;
const createInitialFieldErrorRevisions = FIELD_ERRORS_SLICE.createInitialRevisions;
const createInitialInvalidDraftRevisions = INVALID_DRAFTS_SLICE.createInitialRevisions;

/**
 * Kanonisk tom `invalidDrafts`-cache. Eksporteres, så `invalidDraftsStorage` deler præcis samme
 * konstruktor i stedet for at vedligeholde en fjerde parallel kopi.
 */
export const createEmptyInvalidDraftsCache = INVALID_DRAFTS_SLICE.createEmptyCache;

// Alle slices (sections, fieldErrors, fieldErrorRevisions, invalidDrafts) er nøglet på det fulde
// sæt af sektions-keys. Én generisk coverage-assert undgår drift mellem fire næsten-identiske kopier.
const assertSectionKeyCoverage = (next: Record<string, unknown>, label: string): void => {
  const keys = Object.keys(next).sort();
  if (keys.length !== REQUIRED_SECTION_KEYS.length) {
    throw new Error(`formPersistenceStore: ${label} key coverage mismatch`);
  }
  for (let i = 0; i < REQUIRED_SECTION_KEYS.length; i += 1) {
    if (keys[i] !== REQUIRED_SECTION_KEYS[i]) {
      throw new Error(`formPersistenceStore: ${label} key coverage mismatch`);
    }
  }
};

const assertInvalidDraftsKeyCoverage = (next: InvalidDraftsCache): void =>
  assertSectionKeyCoverage(next, 'invalid-drafts');

const assertKeyCoverage = (next: FormPersistenceSections): void =>
  assertSectionKeyCoverage(next, 'section');

const assertFieldErrorKeyCoverage = (next: FieldErrorCache): void =>
  assertSectionKeyCoverage(next, 'field-error');

const assertFieldErrorRevisionKeyCoverage = (next: FieldErrorRevisionMap): void =>
  assertSectionKeyCoverage(next, 'field-error revision');

// `meta.schemaFingerprint` holder bevidst version-stregen PERSISTED_DATA_VERSION (ikke et beregnet
// schema-fingerprint, jf. computeSchemaFingerprint i schemaFingerprint.ts, som kun er en test-tids
// drift-gate). Det er en version-guard mod at anvende en snapshot fra en anden sagsinput-version.
// Skift IKKE denne assert til at sammenligne mod et beregnet fingerprint — det ville bryde hydrering.
const assertMetaFingerprintMatch = (meta: FormPersistenceMeta): void => {
  if (meta.schemaFingerprint !== PERSISTED_DATA_VERSION) {
    throw new Error('formPersistenceStore: schemaFingerprint mismatch');
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

// Alle seks increment-varianter er nu ét delt par (slice-metoderne peger på samme impl); de bevarede
// navne holder call-sites i store-body uændrede og gør concern→slice-bindingen eksplicit.
const incrementSectionRevision = SECTIONS_SLICE.incrementRevision;
const incrementAllSectionRevisions = SECTIONS_SLICE.incrementAllRevisions;
const incrementFieldErrorRevision = FIELD_ERRORS_SLICE.incrementRevision;
const incrementAllFieldErrorRevisions = FIELD_ERRORS_SLICE.incrementAllRevisions;
const incrementInvalidDraftRevision = INVALID_DRAFTS_SLICE.incrementRevision;
const incrementAllInvalidDraftRevisions = INVALID_DRAFTS_SLICE.incrementAllRevisions;

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

const resolveMeta = (prev: FormPersistenceMeta, metaPatch?: SectionMetaPatch): FormPersistenceMeta => {
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
    invalidDrafts: createEmptyInvalidDraftsCache(),
    invalidDraftRevisions: createInitialInvalidDraftRevisions(),
    committedChangeCounter: 0,
    authoritativeSnapshotEpoch: 0,
    meta: { hydrated: false, schemaFingerprint: PERSISTED_DATA_VERSION },
    hydrate: (next, meta, invalidDrafts) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      const nextInvalidDrafts = invalidDrafts ?? createEmptyInvalidDraftsCache();
      assertInvalidDraftsKeyCoverage(nextInvalidDrafts);
      set((state) => ({
        sections: { ...next },
        sectionRevisions: state.sectionRevisions,
        // Hydration er en autoritativ initialization/replacement: runtime-feltfejl ryddes atomisk
        // sammen med apply (persistence-contract §6.3), så et evt. ikke-tomt store (re-hydrering,
        // test-genbrug) ikke efterlader ghost-fejl fra før hydreringen.
        fieldErrors: createEmptyFieldErrorCache(),
        fieldErrorRevisions: incrementAllFieldErrorRevisions(state.fieldErrorRevisions),
        invalidDrafts: { ...nextInvalidDrafts },
        invalidDraftRevisions: incrementAllInvalidDraftRevisions(state.invalidDraftRevisions),
        committedChangeCounter: state.committedChangeCounter,
        // Hydration fra persisteret storage er autoritativ for form-consumers.
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    commitSection: (key, next, metaPatch) => {
      assertSectionValid(key, next);
      // lastCommittedAt resolves fra caller-leveret metaPatch — ingen ikke-deterministisk
      // Date.now() inde i state-updater'en (jf. undo/redo-mønstret: ingen RNG/tid i setState).
      set((state) => ({
        sections: { ...state.sections, [key]: next },
        sectionRevisions: incrementSectionRevision(state.sectionRevisions, key),
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        committedChangeCounter: state.committedChangeCounter + 1,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
        meta: resolveMeta(state.meta, metaPatch),
      }));
    },
    clearSection: (key, metaPatch) => {
      set((state) => ({
        sections: { ...state.sections, [key]: null },
        sectionRevisions: incrementSectionRevision(state.sectionRevisions, key),
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        committedChangeCounter: state.committedChangeCounter + 1,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
        meta: resolveMeta(state.meta, metaPatch),
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
        committedChangeCounter: state.committedChangeCounter + 1,
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
        invalidDrafts: createEmptyInvalidDraftsCache(),
        invalidDraftRevisions: incrementAllInvalidDraftRevisions(state.invalidDraftRevisions),
        committedChangeCounter: state.committedChangeCounter + 1,
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
        invalidDrafts: createEmptyInvalidDraftsCache(),
        invalidDraftRevisions: incrementAllInvalidDraftRevisions(state.invalidDraftRevisions),
        committedChangeCounter: state.committedChangeCounter + 1,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    rollbackSections: (next, sectionRevisions, committedChangeCounter, authoritativeSnapshotEpoch, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      // NOTE: rollbackSections ruller bevidst kun section-state tilbage.
      // Field errors gendannes via restoreFieldErrors() af kalderen.
      set((state) => ({
        sections: { ...next },
        sectionRevisions: { ...sectionRevisions },
        fieldErrors: state.fieldErrors,
        fieldErrorRevisions: state.fieldErrorRevisions,
        committedChangeCounter,
        authoritativeSnapshotEpoch,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      }));
    },
    restoreHistoryFrame: (next, sectionRevisions, fieldErrors, fieldErrorRevisions, invalidDrafts, invalidDraftRevisions, meta, committedAt) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      assertFieldErrorKeyCoverage(fieldErrors);
      assertFieldErrorRevisionKeyCoverage(fieldErrorRevisions);
      assertInvalidDraftsKeyCoverage(invalidDrafts);
      // committedAt leveres af caller udenfor updater'en — undgår ikke-deterministisk Date.now() i setState.
      set((state) => ({
        sections: { ...next },
        sectionRevisions: { ...sectionRevisions },
        fieldErrors: { ...fieldErrors },
        fieldErrorRevisions: { ...fieldErrorRevisions },
        invalidDrafts: { ...invalidDrafts },
        invalidDraftRevisions: { ...invalidDraftRevisions },
        committedChangeCounter: state.committedChangeCounter + 1,
        authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch + 1,
        meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION, lastCommittedAt: committedAt },
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
        debugFormPersistenceStore('setFieldError', {
          section: key,
          fieldName,
          source,
          rawError: error,
          normalized,
          updateKind: update.kind,
          prevForField,
        });
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
      set((state) => {
        const current = state.fieldErrors[key];
        if (Object.keys(current).length === 0) {
          debugFormPersistenceStore('clearFieldErrorsForSection-noop', {
            section: key,
          });
          return state;
        }
        debugFormPersistenceStore('clearFieldErrorsForSection', {
          section: key,
          fieldCount: Object.keys(current).length,
        });
        return {
          fieldErrors: { ...state.fieldErrors, [key]: {} } as FieldErrorCache,
          fieldErrorRevisions: incrementFieldErrorRevision(state.fieldErrorRevisions, key),
        };
      });
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
    setInvalidDraft: (key, fieldPath, draft) => {
      set((state) => {
        const prevForPage = state.invalidDrafts[key];
        const trimmedExists = typeof draft === 'string' && draft !== '';
        const existing = prevForPage[fieldPath];

        if (!trimmedExists) {
          if (existing === undefined) return state;
          const nextForPage = { ...prevForPage };
          delete nextForPage[fieldPath];
          return {
            invalidDrafts: { ...state.invalidDrafts, [key]: nextForPage },
            invalidDraftRevisions: incrementInvalidDraftRevision(state.invalidDraftRevisions, key),
          };
        }

        if (existing === draft) return state;
        return {
          invalidDrafts: { ...state.invalidDrafts, [key]: { ...prevForPage, [fieldPath]: draft } },
          invalidDraftRevisions: incrementInvalidDraftRevision(state.invalidDraftRevisions, key),
        };
      });
    },
    clearInvalidDraftsForSection: (key) => {
      set((state) => {
        if (Object.keys(state.invalidDrafts[key]).length === 0) return state;
        return {
          invalidDrafts: { ...state.invalidDrafts, [key]: {} },
          invalidDraftRevisions: incrementInvalidDraftRevision(state.invalidDraftRevisions, key),
        };
      });
    },
    pruneInvalidDraftsForSectionFields: (key, fieldPaths) => {
      set((state) => {
        const prevForPage = state.invalidDrafts[key];
        let removedAny = false;
        const nextForPage = { ...prevForPage };
        for (const fieldPath of fieldPaths) {
          if (fieldPath in nextForPage) {
            delete nextForPage[fieldPath];
            removedAny = true;
          }
        }
        if (!removedAny) return state;
        return {
          invalidDrafts: { ...state.invalidDrafts, [key]: nextForPage },
          invalidDraftRevisions: incrementInvalidDraftRevision(state.invalidDraftRevisions, key),
        };
      });
    },
    clearAllInvalidDrafts: () => {
      set((state) => ({
        invalidDrafts: createEmptyInvalidDraftsCache(),
        invalidDraftRevisions: incrementAllInvalidDraftRevisions(state.invalidDraftRevisions),
      }));
    },
    restoreInvalidDrafts: (invalidDrafts, invalidDraftRevisions) => {
      assertInvalidDraftsKeyCoverage(invalidDrafts);
      set({
        invalidDrafts: { ...invalidDrafts },
        invalidDraftRevisions: { ...invalidDraftRevisions },
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
