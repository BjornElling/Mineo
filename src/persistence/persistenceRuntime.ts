import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import { PERSISTED_SECTION_KEYS } from '../config/persistenceRegistry';
import {
  assignFormPersistenceSection,
  createEmptyFormPersistenceSections,
  formPersistenceStore,
} from '../stores/formPersistenceStore';
import { clearResolvedFieldErrorsCache } from '../stores/formPersistenceReadModel';
import { buildSessionStorageHydrationPlan } from '../utils/persistenceSessionHydration';

export type PersistenceStartupNotice = Readonly<{
  message: string;
  type: 'warning' | 'error';
}>;

export type PersistenceRuntime = Readonly<{
  notice: PersistenceStartupNotice | null;
  keysToRemove: readonly string[];
}>;

/**
 * Initialiserer persistence-runtime atomisk, før React får adgang til committed state.
 *
 * Funktionen skal kaldes præcis én gang pr. app-root, efter variantens storage-namespace
 * er fastlagt og før `root.render`. Den returnerede runtime gives uændret til
 * `FormPersistenceProvider`; en provider-remount må aldrig genlæse sessionStorage.
 */
export const initializePersistenceRuntime = (): PersistenceRuntime => {
  const plan = buildSessionStorageHydrationPlan();
  const sections = createEmptyFormPersistenceSections();
  for (const pageKey of PERSISTED_SECTION_KEYS) {
    assignFormPersistenceSection(sections, pageKey, plan.sections[pageKey]);
  }

  formPersistenceStore.getState().hydrate(
    sections,
    { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION },
    plan.invalidDrafts,
  );
  clearResolvedFieldErrorsCache();

  return Object.freeze({
    notice: plan.notice,
    keysToRemove: Object.freeze([...plan.keysToRemove]),
  });
};
