import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import {
  type FieldErrorsForSection,
  type FormFieldError,
  resolveActiveFieldError,
} from '../types/fieldErrors';
import { formPersistenceStore } from './formPersistenceStore';

const resolvedFieldErrorsCache = new Map<
  StorageKey,
  {
    bySource: FieldErrorsForSection<StorageKey>;
    revision: number;
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

export const getInvalidDraftsForSectionSnapshot = (pageKey: StorageKey): Record<string, string> => {
  return formPersistenceStore.getState().invalidDrafts[pageKey];
};

export const getInvalidDraftForFieldSnapshot = (pageKey: StorageKey, fieldPath: string): string | undefined => {
  return formPersistenceStore.getState().invalidDrafts[pageKey][fieldPath];
};

export const getResolvedFieldErrorsSnapshot = <K extends StorageKey>(
  pageKey: K
): Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> => {
  const bySource = getFieldErrorsBySourceSnapshot(pageKey);
  const revision = getFieldErrorRevisionSnapshot(pageKey);
  const cached = resolvedFieldErrorsCache.get(pageKey);
  // Cachen invalideres på BÅDE reference-identitet OG revision: revisionen er en backstop, så en
  // glemt clearResolvedFieldErrorsCache() ved restore ikke kan servere stale resolved errors, selv
  // hvis bySource-referencen tilfældigt skulle genbruges.
  if (cached && cached.bySource === bySource && cached.revision === revision) {
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
    revision,
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

export const getCommittedChangeCounterSnapshot = (): number => {
  return formPersistenceStore.getState().committedChangeCounter;
};
