import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import { useFormPersistence } from '../contexts/FormPersistenceContext';

/**
 * Selector-style hook for a single persisted section.
 *
 * Returns the exact persisted section reference for the given key.
 * Intended to keep consumers aligned to per-section changes only.
 */
export const usePersistedSection = <K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
  const { getPersistedData } = useFormPersistence();
  const value = getPersistedData(pageKey);
  return React.useMemo(() => value, [value]);
};
