import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { PERSISTED_SECTION_KEYS, type PersistedSectionMap } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';
import {
  formPersistenceStore,
} from '../stores/formPersistenceStore';
import { clearResolvedFieldErrorsCache } from '../stores/formPersistenceReadModel';
import { buildSessionStorageHydrationPlan } from '../utils/persistenceSessionHydration';

export type PersistenceStartupNotice = Readonly<{
  message: string;
  type: 'warning' | 'error';
}>;

export type PersistenceRuntime = Readonly<{
  store: typeof formPersistenceStore;
  notice: PersistenceStartupNotice | null;
  keysToRemove: readonly string[];
}>;

type PersistedCache = { [K in StorageKey]: PersistedSectionMap[K] | null };

const createEmptyPersistedCache = (): PersistedCache => {
  return PERSISTED_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as PersistedCache);
};

const assignCacheValue = <K extends StorageKey>(
  target: PersistedCache,
  key: K,
  value: PersistedSectionMap[K] | null,
): void => {
  target[key] = value;
};

/**
 * Initialiserer persistence-runtime atomisk, før React får adgang til committed state.
 *
 * Funktionen skal kaldes præcis én gang pr. app-root, efter variantens storage-namespace
 * er fastlagt og før `root.render`. Den returnerede runtime gives uændret til
 * `FormPersistenceProvider`; en provider-remount må aldrig genlæse sessionStorage.
 */
export const initializePersistenceRuntime = (): PersistenceRuntime => {
  const plan = buildSessionStorageHydrationPlan();
  const sections = createEmptyPersistedCache();
  for (const pageKey of PERSISTED_SECTION_KEYS) {
    assignCacheValue(sections, pageKey, plan.sections[pageKey]);
  }

  formPersistenceStore.getState().hydrate(
    sections,
    { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
    plan.invalidDrafts,
  );
  clearResolvedFieldErrorsCache();

  return Object.freeze({
    store: formPersistenceStore,
    notice: plan.notice,
    keysToRemove: Object.freeze([...plan.keysToRemove]),
  });
};
