import React from 'react';
import type { ZodIssue } from 'zod';
import { type StorageKey, getStorageKey, getAllMineoKeys, getDomainStorageKeys } from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import type { PersistedData } from '../types/persistence';
import { FormPersistenceContext } from './FormPersistenceContext.shared';
import {
  type FieldErrorsForSection,
  type FormFieldError,
  type FieldErrorSeverity,
  type FieldErrorSource,
  resolveActiveFieldError,
} from '../types/fieldErrors';
import { serializeFormValues } from '../utils/serialization';
import { persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import { nullToUndefinedDeep } from '../utils/nullToUndefinedDeep';
import { countFilledFields } from '../utils/dataCollection';
import { setDevtoolsProviderState } from '../utils/devtoolsMonitor';
import { formPersistenceStore } from '../stores/formPersistenceStore';
import {
  runAllDomainCleanups,
  saveDomainSnapshots,
  restoreDomainSnapshots,
} from '../stores/domainCleanupRegistry';

// Persisted sections are handled via an internal Zustand store; FormPersistenceContext is a facade and not the SoT for committed inputs.

/**
 * FormPersistenceContext
 *
 * Håndterer automatisk persistence af formular-data ved hjælp af sessionStorage.
 * Data bevares når man navigerer mellem sider, men slettes når browseren lukkes.
 *
 * Features:
 * - Type-safe storage keys via manifest
 * - Versionering af data
 */

/**
 * Nuværende data format version
 */
const CURRENT_VERSION = PERSISTED_DATA_VERSION;

/**
 * Type guard for PersistedData wrapper-struktur
 *
 * Validerer at stored data har korrekt format (version, timestamp, data).
 * Beskytter mod korrupt storage data.
 */
function isPersistedData(value: unknown): value is PersistedData {
  if (!value || typeof value !== 'object') return false;

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.version === 'string' &&
    typeof obj.timestamp === 'number' &&
    'data' in obj
  );
}

const formatZodIssues = (issues: ZodIssue[], max: number): string => {
  return issues
    .slice(0, max)
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `${path}: ${issue.message}`;
    })
    .join('\n');
};

const getFieldCount = (value: unknown): number => {
  return typeof value === 'object' && value !== null ? Object.keys(value).length : 0;
};

const PERSISTENCE_DEBUG_MIN_INTERVAL_MS = 1000;

type PersistedCache = { [K in StorageKey]: PersistedSectionMap[K] | null };

const assignCacheValue = (target: PersistedCache, key: StorageKey, value: unknown | null): void => {
  // Safe because `value` is always produced by the schema for `key` (or null for cleared).
  (target as unknown as Record<StorageKey, unknown | null>)[key] = value;
};

/**
 * Provider komponent der wrapper hele applikationen
 */
export const FormPersistenceProvider = ({ children }: { children: React.ReactNode }) => {
  const debugSaveStateRef = React.useRef<Map<string, { lastLogAt: number; pendingCount: number; lastFieldCount: number }>>(
    new Map()
  );
  const createEmptyCache = React.useCallback((): PersistedCache => {
    return Object.keys(persistenceSchemas).reduce((acc, key) => {
      acc[key as StorageKey] = null;
      return acc;
    }, {} as PersistedCache);
  }, []);

  const initPlanRef = React.useRef<{
    keysToRemove: string[];
    shouldGlobalClear: boolean;
    notice: { message: string; type: 'warning' | 'error' } | null;
  } | null>(null);
  const initialSectionsRef = React.useRef<PersistedCache | null>(null);
  if (initialSectionsRef.current === null) {
    const nextCache = createEmptyCache();
    const keysToRemove: string[] = [];
    let shouldGlobalClear = false;
    let notice: { message: string; type: 'warning' | 'error' } | null = null;

    const validateAndAssign = <K extends StorageKey>(pageKey: K, rawData: unknown): void => {
      const schema = persistenceSchemas[pageKey];
      const normalized = nullToUndefinedDeep(rawData);
      const validated = schema.safeParse(normalized);
      if (!validated.success) {
        keysToRemove.push(getStorageKey(pageKey));
        notice ??= { message: `Gemte data for '${pageKey}' matcher ikke denne versions schema og er ryddet.`, type: 'error' };
        return;
      }
      assignCacheValue(nextCache, pageKey, validated.data);
    };

    for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const storageKey = getStorageKey(pageKey);
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) continue;

      let parsed: unknown;
      try {
        parsed = JSON.parse(stored);
      } catch {
        keysToRemove.push(storageKey);
        notice ??= { message: `Gemte data for '${pageKey}' var korrupte og er ryddet.`, type: 'error' };
        continue;
      }

      if (!isPersistedData(parsed)) {
        keysToRemove.push(storageKey);
        notice ??= { message: `Gemte data for '${pageKey}' var korrupte og er ryddet.`, type: 'error' };
        continue;
      }

      if (parsed.version !== CURRENT_VERSION) {
        // Design choice (trust-critical): hard-fail ved mismatch og ryd ALT persisted data.
        shouldGlobalClear = true;
        notice ??= {
          message: `Gemte data er fra en anden version (${parsed.version} ≠ ${CURRENT_VERSION}) og er ryddet.`,
          type: 'error',
        };
        break;
      }

      validateAndAssign(pageKey, parsed.data);
    }

    initPlanRef.current = { keysToRemove, shouldGlobalClear, notice };
    initialSectionsRef.current = shouldGlobalClear ? createEmptyCache() : nextCache;
  }

  const [noticeState, setNoticeState] = React.useState<{ epoch: number; notice: { message: string; type: 'warning' | 'error' } | null }>(() => ({
    epoch: 0,
    notice: initPlanRef.current?.notice ?? null,
  }));

  const persistenceSnapshotRef = React.useRef<{
    sections: PersistedCache;
    sectionRevisions: ReturnType<typeof formPersistenceStore.getState>['sectionRevisions'];
    fieldErrors: ReturnType<typeof formPersistenceStore.getState>['fieldErrors'];
    fieldErrorRevisions: ReturnType<typeof formPersistenceStore.getState>['fieldErrorRevisions'];
    authoritativeSnapshotEpoch: number;
  } | null>(null);
  const getPersistenceSnapshot = React.useCallback(() => {
    const state = formPersistenceStore.getState();
    const prev = persistenceSnapshotRef.current;
    if (
      prev &&
      prev.sections === (state.sections as PersistedCache) &&
      prev.sectionRevisions === state.sectionRevisions &&
      prev.fieldErrors === state.fieldErrors &&
      prev.fieldErrorRevisions === state.fieldErrorRevisions &&
      prev.authoritativeSnapshotEpoch === state.authoritativeSnapshotEpoch
    ) {
      return prev;
    }

    const next = {
      sections: state.sections as PersistedCache,
      sectionRevisions: state.sectionRevisions,
      fieldErrors: state.fieldErrors,
      fieldErrorRevisions: state.fieldErrorRevisions,
      authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
    };
    persistenceSnapshotRef.current = next;
    return next;
  }, []);
  const persistenceSnapshot = React.useSyncExternalStore(
    formPersistenceStore.subscribe,
    getPersistenceSnapshot,
    getPersistenceSnapshot
  );
  const sections = persistenceSnapshot.sections;
  const sectionRevisions = persistenceSnapshot.sectionRevisions;
  const fieldErrors = persistenceSnapshot.fieldErrors;
  const fieldErrorRevisions = persistenceSnapshot.fieldErrorRevisions;
  const authoritativeSnapshotEpoch = persistenceSnapshot.authoritativeSnapshotEpoch;

  React.useEffect(() => {
    const store = formPersistenceStore.getState();
    store.hydrate(
      initialSectionsRef.current ?? createEmptyCache(),
      { hydrated: true, schemaFingerprint: CURRENT_VERSION }
    );
  }, [createEmptyCache]);

  React.useEffect(() => {
    const plan = initPlanRef.current;
    if (!plan) return;

    if (plan.shouldGlobalClear) {
      const keys = getAllMineoKeys();
      keys.forEach((key) => sessionStorage.removeItem(key));
      return;
    }

    for (const key of plan.keysToRemove) {
      sessionStorage.removeItem(key);
    }
  }, []);

  React.useEffect(() => {
    setDevtoolsProviderState('FormPersistenceProvider', true);
    return () => {
      setDevtoolsProviderState('FormPersistenceProvider', false);
    };
  }, []);

  const emitUserNotice = React.useCallback((message: string, type: 'warning' | 'error' = 'warning') => {
    setNoticeState((prev) => ({ epoch: prev.epoch + 1, notice: { message, type } }));
  }, []);
  const logPersistSaveDebug = React.useCallback((storageKey: string, fieldCount: number) => {
    if (!import.meta.env.DEV) return;

    const now = Date.now();
    const existing = debugSaveStateRef.current.get(storageKey);
    const entry = existing ?? { lastLogAt: 0, pendingCount: 0, lastFieldCount: fieldCount };

    entry.pendingCount += 1;
    entry.lastFieldCount = fieldCount;

    if (now - entry.lastLogAt >= PERSISTENCE_DEBUG_MIN_INTERVAL_MS) {
      entry.pendingCount = 0;
      entry.lastLogAt = now;
    }

    debugSaveStateRef.current.set(storageKey, entry);
  }, []);

  /**
   * Læs schema-valideret persisted data (ingen side-effects).
   */
  const syncSection = React.useCallback(<K extends StorageKey>(pageKey: K, next: PersistedSectionMap[K] | null) => {
    formPersistenceStore.getState().commitSection(pageKey, next, {
      schemaFingerprint: CURRENT_VERSION,
    });
  }, []);

  const getPersistedData = React.useCallback(<K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
    const value = sections[pageKey];
    return value;
  }, [sections]);

  const hasAnyData = React.useCallback((): boolean => {
    return countFilledFields(sections) > 0;
  }, [sections]);

  /**
   * Gem data i sessionStorage med versionering
   *
   * Wrapper data i PersistedData struktur med version og timestamp.
   */
  const persistData = React.useCallback(<K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K]) => {
    try {
      const storageKey = getStorageKey(pageKey);

      // Defensive runtime check: should never happen because persistenceSchemas is keyed by StorageKey,
      // but protects against hot-reload / partial module state during development.
      if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, pageKey)) {
        console.error(`[Persistence] Missing schema for '${pageKey}'. Cannot persist data.`, { pageKey });
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern konfigurationsfejl.`, 'error');
        return;
      }

      const schema = persistenceSchemas[pageKey];
      const normalized = nullToUndefinedDeep(data);
      const validated = schema.safeParse(normalized);
      if (!validated.success) {
        const issues = formatZodIssues(validated.error.issues, 3);
        console.error(`[Persistence] Schema mismatch for '${pageKey}':\n${issues}`, {
          pageKey,
          issues: validated.error.issues,
        });
        emitUserNotice(
          `Kunne ikke gemme data for '${pageKey}' fordi data ikke matcher schema.\n${issues}`,
          'error'
        );
        return;
      }

      const persistedSectionData = serializeFormValues(validated.data);
      // Trust-critical invariant: cache must match the post-serialization representation (reload-equivalent).
      const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
      if (!postSerializeValidated.success) {
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern serialiseringsfejl.`, 'error');
        return;
      }

      const persistedData: PersistedData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        data: persistedSectionData,
      };

      sessionStorage.setItem(storageKey, JSON.stringify(persistedData));
      syncSection(pageKey, postSerializeValidated.data as PersistedSectionMap[K]);
      logPersistSaveDebug(storageKey, getFieldCount(data));
    } catch (error) {
      console.error(`[Persistence] Fejl ved gemning af data for '${pageKey}':`, {
        pageKey,
        fieldCount: getFieldCount(data),
        error,
      });
      emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern fejl.`, 'error');
    }
  }, [emitUserNotice, logPersistSaveDebug, syncSection]);

  const replaceAllPersistedData = React.useCallback((snapshot: Record<StorageKey, unknown | undefined>) => {
    const prevStoreState = formPersistenceStore.getState();
    const prevSections = prevStoreState.sections as PersistedCache;
    const prevSectionRevisions = prevStoreState.sectionRevisions;
    const prevFieldErrors = prevStoreState.fieldErrors;
    const prevFieldErrorRevisions = prevStoreState.fieldErrorRevisions;
    const prevAuthoritativeSnapshotEpoch = prevStoreState.authoritativeSnapshotEpoch;
    const prevMeta = prevStoreState.meta;
    const prevDomainSnapshots = saveDomainSnapshots();
    for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
        throw new Error(`Snapshot mangler key '${key}'. Snapshot skal indeholde alle keys (brug undefined for at slette).`);
      }
    }

    // Backup og erstatning sker kun for domæne-keys — UI-state (filnavn, sidebar, overlay)
    // er uafhængig af sags-data og skal ikke berøres ved fil-load.
    const keysToReplace = getDomainStorageKeys();
    const backup = new Map<string, string | null>();
    for (const key of keysToReplace) {
      backup.set(key, sessionStorage.getItem(key));
    }

    const now = Date.now();
    const toWrite: Array<{ storageKey: string; value: string }> = [];
    const nextCache = Object.keys(persistenceSchemas).reduce((acc, k) => {
      acc[k as StorageKey] = null;
      return acc;
    }, {} as PersistedCache);

    for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const raw = snapshot[pageKey];
      if (raw === undefined) continue;

      const schema = persistenceSchemas[pageKey];
      const normalized = nullToUndefinedDeep(raw);
      const validated = schema.safeParse(normalized);
      if (!validated.success) {
        const issues = formatZodIssues(validated.error.issues, 2);
        throw new Error(`Kan ikke anvende snapshot: '${pageKey}' matcher ikke schema.\n${issues}`);
      }

      const persistedSectionData = serializeFormValues(validated.data);
      // Trust-critical invariant: cache must match the post-serialization representation.
      const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
      if (!postSerializeValidated.success) {
        const issues = formatZodIssues(postSerializeValidated.error.issues, 2);
        throw new Error(`Kan ikke anvende snapshot: '${pageKey}' fejler efter serialisering.\n${issues}`);
      }
      const persistedData: PersistedData = {
        version: CURRENT_VERSION,
        timestamp: now,
        data: persistedSectionData,
      };
      toWrite.push({ storageKey: getStorageKey(pageKey), value: JSON.stringify(persistedData) });
      assignCacheValue(nextCache, pageKey, postSerializeValidated.data);
    }

    try {
      for (const key of keysToReplace) {
        sessionStorage.removeItem(key);
      }
      for (const { storageKey, value } of toWrite) {
        sessionStorage.setItem(storageKey, value);
      }
      formPersistenceStore.getState().replaceSectionsAndClearFieldErrors(
        nextCache,
        { hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() }
      );
      runAllDomainCleanups();
    } catch (error) {
      // Defensive strategy: always execute full rollback/restore sequence,
      // even if failure happened before any in-memory mutation.
      for (const { storageKey } of toWrite) {
        sessionStorage.removeItem(storageKey);
      }
      for (const [key, value] of backup.entries()) {
        if (value === null || value === undefined) {
          sessionStorage.removeItem(key);
        } else {
          sessionStorage.setItem(key, value);
        }
      }
      formPersistenceStore.getState().rollbackSections(
        prevSections,
        prevSectionRevisions,
        prevAuthoritativeSnapshotEpoch,
        prevMeta
      );
      formPersistenceStore.getState().restoreFieldErrors(prevFieldErrors, prevFieldErrorRevisions);
      restoreDomainSnapshots(prevDomainSnapshots);
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      throw new Error(`Kunne ikke anvende snapshot atomisk: ${message}`);
    }
  }, []);

  /**
   * Slet data for en specifik side
   */
  const clearPageData = React.useCallback((pageKey: StorageKey) => {
    try {
      const storageKey = getStorageKey(pageKey);
      sessionStorage.removeItem(storageKey);
      syncSection(pageKey, null);
      formPersistenceStore.getState().clearFieldErrorsForSection(pageKey);
      runAllDomainCleanups();
    } catch (error) {
      console.error(`[Persistence] Fejl ved sletning af data for '${pageKey}':`, error);
    }
  }, [syncSection]);

  /**
   * Slet alle gemte MINEO data
   *
   * Bruger manifest til kun at slette kendte keys.
   */
  const clearAllData = React.useCallback(() => {
    try {
      // Kun domæne-data keys — UI-state (filnavn, sidebar, overlay) bevares bevidst.
      const domainKeys = getDomainStorageKeys();
      domainKeys.forEach(key => {
        sessionStorage.removeItem(key);
      });
      formPersistenceStore.getState().clearAll({ hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() });
      runAllDomainCleanups();
    } catch (error) {
      console.error('[Persistence] Fejl ved sletning af alle data:', error);
    }
  }, []);

  const getFieldErrorsBySource = React.useCallback(<K extends StorageKey,>(pageKey: K) => {
    return fieldErrors[pageKey] as FieldErrorsForSection<K>;
  }, [fieldErrors]);

  const getFieldErrors = React.useCallback(<K extends StorageKey,>(pageKey: K) => {
    const bySource = fieldErrors[pageKey] as FieldErrorsForSection<K>;
    const resolved: Partial<Record<Extract<keyof PersistedSectionMap[K], string>, FormFieldError>> = {};

    for (const fieldName of Object.keys(bySource) as Array<Extract<keyof PersistedSectionMap[K], string>>) {
      const fieldErrorsBySource = bySource[fieldName];
      if (!fieldErrorsBySource) continue;
      const active = resolveActiveFieldError(fieldErrorsBySource);
      if (!active) continue;
      resolved[fieldName] = active;
    }

    return resolved;
  }, [fieldErrors]);

  const getFieldError = React.useCallback(<K extends StorageKey,>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>
  ): FormFieldError | undefined => {
    const bySource = fieldErrors[pageKey] as FieldErrorsForSection<K>;
    const forField = bySource[fieldName];
    if (!forField) return undefined;
    return resolveActiveFieldError(forField);
  }, [fieldErrors]);

  const setFieldError = React.useCallback(<K extends StorageKey,>(
    pageKey: K,
    fieldName: Extract<keyof PersistedSectionMap[K], string>,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => {
    formPersistenceStore.getState().setFieldError(pageKey, fieldName, source, error);
  }, []);

  const clearFieldErrors = React.useCallback((pageKey: StorageKey) => {
    formPersistenceStore.getState().clearFieldErrorsForSection(pageKey);
    runAllDomainCleanups();
  }, []);

  const clearAllFieldErrors = React.useCallback(() => {
    formPersistenceStore.getState().clearAllFieldErrors();
    runAllDomainCleanups();
  }, []);

  const getSectionRevision = React.useCallback((pageKey: StorageKey) => {
    return sectionRevisions[pageKey] ?? 0;
  }, [sectionRevisions]);

  const getFieldErrorRevision = React.useCallback((pageKey: StorageKey) => {
    return fieldErrorRevisions[pageKey] ?? 0;
  }, [fieldErrorRevisions]);

  const value = React.useMemo(
    () => ({
      getPersistedData,
      persistData,
      clearPageData,
      clearAllData,
      hasAnyData,
      getFieldErrors,
      getFieldErrorsBySource,
      getFieldError,
      setFieldError,
      clearFieldErrors,
      clearAllFieldErrors,
      authoritativeSnapshotEpoch,
      getSectionRevision,
      getFieldErrorRevision,
      replaceAllPersistedData,
      lastNotice: noticeState.notice,
      lastNoticeEpoch: noticeState.epoch,
    }),
    [
      getPersistedData,
      persistData,
      clearPageData,
      clearAllData,
      hasAnyData,
      getFieldErrors,
      getFieldErrorsBySource,
      getFieldError,
      setFieldError,
      clearFieldErrors,
      clearAllFieldErrors,
      authoritativeSnapshotEpoch,
      getSectionRevision,
      getFieldErrorRevision,
      replaceAllPersistedData,
      noticeState,
    ]
  );

  return (
    <FormPersistenceContext.Provider value={value}>
      {children}
    </FormPersistenceContext.Provider>
  );
};
