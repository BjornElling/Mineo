import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import { useFormPersistence } from '../contexts/useFormPersistence';

/**
 * Selector-style hook for a single persisted section.
 *
 * @deprecated Brug usePersistedSectionSelector fra hooks/useFormPersistenceSelectors i stedet.
 * Denne hook går via React context og re-rendrer ved enhver store-ændring.
 * usePersistedSectionSelector er kanonisk og re-rendrer kun ved ændringer i den specifikke sektion.
 */
export const usePersistedSection = <K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
  const { getPersistedData } = useFormPersistence();
  return getPersistedData(pageKey);
};


