import type { StorageKey } from '../config/storageManifest';
import type { PersistedSectionMap } from '../config/persistenceRegistry';
import {
  type FieldErrorBySource,
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

/**
 * Cache for den flettede by-source-model (rå fieldErrors + syntetiske `invalid-draft`-fejl).
 * Reference-stabil (bruges direkte af useSyncExternalStore), nøglet på de to rå referencer +
 * begge revisioner. Ryddes sammen med resolvedFieldErrorsCache.
 */
const mergedBySourceCache = new Map<
  StorageKey,
  {
    rawBySource: FieldErrorsForSection<StorageKey>;
    invalidDrafts: Record<string, string>;
    fieldErrorRevision: number;
    invalidDraftRevision: number;
    merged: FieldErrorsForSection<StorageKey>;
  }
>();

export const clearResolvedFieldErrorsCache = (): void => {
  resolvedFieldErrorsCache.clear();
  mergedBySourceCache.clear();
};

export const getPersistedSectionSnapshot = <K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
  return formPersistenceStore.getState().sections[pageKey] as PersistedSectionMap[K] | null;
};

/**
 * Bygger den syntetiske `invalid-draft`-feltfejl for en ikke-committbar rå draft. Beskeden er bevidst
 * generisk (afledt af råstrengen), da read-modellen ikke har feltets parse-funktion; blokeringen er
 * altid korrekt (den udledes af draftens eksistens), og teksten er ren visning.
 */
const buildInvalidDraftFieldError = (rawDraft: string): FormFieldError => ({
  message: `Ugyldig værdi: "${rawDraft}"`,
  severity: 'error',
  source: 'invalid-draft',
  blocksSave: true,
});

export const getFieldErrorsBySourceSnapshot = <K extends StorageKey>(pageKey: K): FieldErrorsForSection<K> => {
  const state = formPersistenceStore.getState();
  const rawBySource = state.fieldErrors[pageKey] as FieldErrorsForSection<K>;
  const invalidDrafts = state.invalidDrafts[pageKey];

  // Ingen ikke-committbare drafts → returnér den rå store-reference uændret (reference-stabil, ingen churn).
  if (Object.keys(invalidDrafts).length === 0) {
    return rawBySource;
  }

  const fieldErrorRevision = getFieldErrorRevisionSnapshot(pageKey);
  const invalidDraftRevision = getInvalidDraftRevisionSnapshot(pageKey);
  const cached = mergedBySourceCache.get(pageKey);
  if (
    cached &&
    cached.rawBySource === rawBySource &&
    cached.invalidDrafts === invalidDrafts &&
    cached.fieldErrorRevision === fieldErrorRevision &&
    cached.invalidDraftRevision === invalidDraftRevision
  ) {
    return cached.merged as FieldErrorsForSection<K>;
  }

  // Flet: en `invalid-draft`-source pr. fieldPath med en ikke-committbar rå draft. En eksisterende
  // committet fejl (input/rule/schema) for samme felt bevares side om side; resolver-prioriteten
  // giver `invalid-draft` forrang.
  const merged: FieldErrorsForSection<K> = { ...(rawBySource as Record<string, FieldErrorBySource>) };
  for (const [fieldPath, rawDraft] of Object.entries(invalidDrafts)) {
    const existing = (merged as Record<string, FieldErrorBySource>)[fieldPath];
    (merged as Record<string, FieldErrorBySource>)[fieldPath] = {
      ...existing,
      'invalid-draft': buildInvalidDraftFieldError(rawDraft),
    };
  }

  mergedBySourceCache.set(pageKey, {
    rawBySource: rawBySource as FieldErrorsForSection<StorageKey>,
    invalidDrafts,
    fieldErrorRevision,
    invalidDraftRevision,
    merged: merged as FieldErrorsForSection<StorageKey>,
  });
  return merged;
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

export const getInvalidDraftRevisionSnapshot = (pageKey: StorageKey): number => {
  return formPersistenceStore.getState().invalidDraftRevisions[pageKey] ?? 0;
};

export const getResolvedFieldErrorsSnapshot = <K extends StorageKey>(
  pageKey: K
): Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> => {
  const bySource = getFieldErrorsBySourceSnapshot(pageKey);
  // Backstop-revision dækker BÅDE fieldErrors OG invalidDrafts, så en ændring i en af dem (også når
  // bySource-referencen tilfældigt skulle genbruges) altid invaliderer den resolved cache.
  const revision = getFieldErrorRevisionSnapshot(pageKey) + getInvalidDraftRevisionSnapshot(pageKey);
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
