import React from 'react';
import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import type { FieldErrorsForSection, FormFieldError } from '../types/fieldErrors';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import {
  getAuthoritativeSnapshotEpochSnapshot,
  getCommittedChangeCounterSnapshot,
  getFieldErrorRevisionSnapshot,
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftForFieldSnapshot,
  getInvalidDraftsForSectionSnapshot,
  getPersistenceHydratedSnapshot,
  getPersistedSectionSnapshot,
  getResolvedFieldErrorsSnapshot,
  getSectionRevisionSnapshot,
} from '../stores/formPersistenceReadModel';

export {
  clearResolvedFieldErrorsCache,
  getAuthoritativeSnapshotEpochSnapshot,
  getCommittedChangeCounterSnapshot,
  getFieldErrorRevisionSnapshot,
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftForFieldSnapshot,
  getInvalidDraftsForSectionSnapshot,
  getPersistenceHydratedSnapshot,
  getPersistedSectionSnapshot,
  getResolvedFieldErrorsSnapshot,
  getSectionRevisionSnapshot,
} from '../stores/formPersistenceReadModel';

const subscribeToFormPersistenceStore = formPersistenceStore.subscribe;

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

export const useInvalidDraftsForSectionSelector = (pageKey: StorageKey): Record<string, string> => {
  return React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getInvalidDraftsForSectionSnapshot(pageKey),
    () => getInvalidDraftsForSectionSnapshot(pageKey)
  );
};

/**
 * Reaktiv læsning af ét felts afsluttede ugyldige input (`invalidDrafts`).
 *
 * Tager bevidst `undefined`-binding (pageKey/fieldPath), så generiske input-komponenter kan kalde
 * hooken ubetinget, også når de bruges uden for en persisteret form (returnerer da altid `undefined`).
 * Storen er en modul-singleton, så ingen context kræves — hooken er sikker uden for FormPersistenceProvider.
 */
export const useInvalidDraftForFieldSelector = (
  pageKey: StorageKey | undefined,
  fieldPath: string | undefined
): string | undefined => {
  const getSnapshot = (): string | undefined =>
    pageKey !== undefined && fieldPath !== undefined
      ? getInvalidDraftForFieldSnapshot(pageKey, fieldPath)
      : undefined;
  return React.useSyncExternalStore(subscribeToFormPersistenceStore, getSnapshot, getSnapshot);
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
    getCommittedChangeCounterSnapshot,
    getCommittedChangeCounterSnapshot
  );
};
