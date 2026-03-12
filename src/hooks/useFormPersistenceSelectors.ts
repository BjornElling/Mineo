import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { FieldErrorsForSection } from '../types/fieldErrors';
import { formPersistenceStore } from '../stores/formPersistenceStore';

const subscribeToFormPersistenceStore = formPersistenceStore.subscribe;

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
