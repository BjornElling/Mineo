import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import {
  type FieldErrorsForSection,
  type FormFieldError,
  resolveActiveFieldError,
} from '../types/fieldErrors';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import { persistenceSchemas } from '../config/persistenceRegistry';

const subscribeToFormPersistenceStore = formPersistenceStore.subscribe;
const resolvedFieldErrorsCache = new Map<
  StorageKey,
  {
    bySource: FieldErrorsForSection<StorageKey>;
    resolved: Partial<Record<string, FormFieldError>>;
  }
>();

export const clearResolvedFieldErrorsCache = (): void => {
  resolvedFieldErrorsCache.clear();
};

export const getPersistedSectionSnapshot = <K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
  return formPersistenceStore.getState().sections[pageKey] as PersistedSectionMap[K] | null;
};

export const getFieldErrorsBySourceSnapshot = <K extends StorageKey>(pageKey: K): FieldErrorsForSection<K> => {
  return formPersistenceStore.getState().fieldErrors[pageKey] as FieldErrorsForSection<K>;
};

export const getSectionRevisionSnapshot = (pageKey: StorageKey): number => {
  return formPersistenceStore.getState().sectionRevisions[pageKey] ?? 0;
};

export const getFieldErrorRevisionSnapshot = (pageKey: StorageKey): number => {
  return formPersistenceStore.getState().fieldErrorRevisions[pageKey] ?? 0;
};

export const getResolvedFieldErrorsSnapshot = <K extends StorageKey>(
  pageKey: K
): Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> => {
  const bySource = getFieldErrorsBySourceSnapshot(pageKey);
  const cached = resolvedFieldErrorsCache.get(pageKey);
  if (cached && cached.bySource === bySource) {
    return cached.resolved as Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>>;
  }

  const resolved: Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> = {};

  for (const fieldName of Object.keys(bySource)) {
    const fieldErrorsBySource = bySource[fieldName];
    if (!fieldErrorsBySource) continue;
    const active = resolveActiveFieldError(fieldErrorsBySource);
    if (!active) continue;
    resolved[fieldName as Extract<keyof PersistedSectionMap[K], string>] = active;
  }

  resolvedFieldErrorsCache.set(pageKey, {
    bySource: bySource as FieldErrorsForSection<StorageKey>,
    resolved: resolved as Partial<Record<string, FormFieldError>>,
  });
  return resolved;
};

export const getAuthoritativeSnapshotEpochSnapshot = (): number => {
  return formPersistenceStore.getState().authoritativeSnapshotEpoch;
};

export const getPersistenceHydratedSnapshot = (): boolean => {
  return formPersistenceStore.getState().meta.hydrated;
};

export const getCombinedSectionRevisionSnapshot = (): number => {
  return (Object.keys(persistenceSchemas) as StorageKey[]).reduce((sum, pageKey) => {
    return sum + (formPersistenceStore.getState().sectionRevisions[pageKey] ?? 0);
  }, 0);
};

export const usePersistedSectionSelector = <K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getPersistedSectionSnapshot(pageKey),
    () => getPersistedSectionSnapshot(pageKey)
  );
};

export const useFieldErrorsBySourceSelector = <K extends StorageKey>(pageKey: K): FieldErrorsForSection<K> => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getFieldErrorsBySourceSnapshot(pageKey),
    () => getFieldErrorsBySourceSnapshot(pageKey)
  );
};

export const useResolvedFieldErrorsSelector = <K extends StorageKey>(
  pageKey: K
): Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getResolvedFieldErrorsSnapshot(pageKey),
    () => getResolvedFieldErrorsSnapshot(pageKey)
  );
};

export const useSectionRevisionSelector = (pageKey: StorageKey): number => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getSectionRevisionSnapshot(pageKey),
    () => getSectionRevisionSnapshot(pageKey)
  );
};

export const useFieldErrorRevisionSelector = (pageKey: StorageKey): number => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getFieldErrorRevisionSnapshot(pageKey),
    () => getFieldErrorRevisionSnapshot(pageKey)
  );
};

export const useAuthoritativeSnapshotEpochSelector = (): number => {
  // Global store-subscription er acceptabel her, fordi useSyncExternalStore kun rerenderer
  // når selve epoch-værdien ændres. Urelaterede store-opdateringer giver kun en billig sammenligning.
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    getAuthoritativeSnapshotEpochSnapshot,
    getAuthoritativeSnapshotEpochSnapshot
  );
};

export const usePersistenceHydratedSelector = (): boolean => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    getPersistenceHydratedSnapshot,
    getPersistenceHydratedSnapshot
  );
};

export const useCombinedSectionRevisionSelector = (): number => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    getCombinedSectionRevisionSnapshot,
    getCombinedSectionRevisionSnapshot
  );
};
