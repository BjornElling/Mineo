import { createStore } from 'zustand/vanilla';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';

export type FormPersistenceSections = {
  stamdata: PersistedSectionMap['stamdata'] | null;
  satser: PersistedSectionMap['satser'] | null;
  aarsloen: PersistedSectionMap['aarsloen'] | null;
  renteberegning: PersistedSectionMap['renteberegning'] | null;
  varigemen: PersistedSectionMap['varigemen'] | null;
  erstatningsopgoerelse: PersistedSectionMap['erstatningsopgoerelse'] | null;
};

export type FormPersistenceMeta = {
  hydrated: boolean;
  schemaFingerprint: string;
  lastCommittedAt?: number;
};

export type FormPersistenceStoreState = {
  sections: FormPersistenceSections;
  meta: FormPersistenceMeta;
  hydrate: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  commitSection: <K extends keyof FormPersistenceSections>(key: K, next: FormPersistenceSections[K] | null, metaPatch?: Partial<FormPersistenceMeta>) => void;
  clearSection: <K extends keyof FormPersistenceSections>(key: K, metaPatch?: Partial<FormPersistenceMeta>) => void;
  replaceSections: (next: FormPersistenceSections, meta: FormPersistenceMeta) => void;
  clearAll: (meta: FormPersistenceMeta) => void;
  __setSectionUnsafe: <K extends keyof FormPersistenceSections>(key: K, next: FormPersistenceSections[K] | null) => void;
  __setMetaUnsafe: (next: Partial<FormPersistenceMeta>) => void;
};

const EMPTY_SECTIONS: FormPersistenceSections = {
  stamdata: null,
  satser: null,
  aarsloen: null,
  renteberegning: null,
  varigemen: null,
  erstatningsopgoerelse: null,
};

const REQUIRED_SECTION_KEYS = Object.keys(persistenceSchemas).sort();

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

const resolveMeta = (prev: FormPersistenceMeta, metaPatch?: Partial<FormPersistenceMeta>): FormPersistenceMeta => {
  const next: FormPersistenceMeta = {
    ...prev,
    ...metaPatch,
    hydrated: true,
    schemaFingerprint: PERSISTED_DATA_VERSION,
  };
  return next;
};

const createFormPersistenceStore = () =>
  createStore<FormPersistenceStoreState>((set, get) => ({
    sections: { ...EMPTY_SECTIONS },
    meta: { hydrated: false, schemaFingerprint: PERSISTED_DATA_VERSION },
    hydrate: (next, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      set({ sections: { ...next }, meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION } });
    },
    commitSection: (key, next, metaPatch) => {
      assertSectionValid(key, next);
      assertMetaPatchFingerprint(metaPatch);
      set((state) => ({
        sections: { ...state.sections, [key]: next },
        meta: resolveMeta(state.meta, { ...metaPatch, lastCommittedAt: Date.now() }),
      }));
    },
    clearSection: (key, metaPatch) => {
      assertMetaPatchFingerprint(metaPatch);
      set((state) => ({
        sections: { ...state.sections, [key]: null },
        meta: resolveMeta(state.meta, { ...metaPatch, lastCommittedAt: Date.now() }),
      }));
    },
    replaceSections: (next, meta) => {
      assertKeyCoverage(next);
      assertMetaFingerprintMatch(meta);
      assertAllSectionsValid(next);
      set({ sections: { ...next }, meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION } });
    },
    clearAll: (meta) => {
      assertMetaFingerprintMatch(meta);
      set({ sections: { ...EMPTY_SECTIONS }, meta: { ...meta, hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION } });
    },
    __setSectionUnsafe: (key, next) => set((state) => ({ sections: { ...state.sections, [key]: next } })),
    __setMetaUnsafe: (next) => set((state) => ({ meta: { ...state.meta, ...next } })),
  }));

export const formPersistenceStore = createFormPersistenceStore();
export const __createTestStore = createFormPersistenceStore;
