import React from 'react';
import type { ZodIssue } from 'zod';
import {
  type StorageKey,
  getStorageKey,
  getDomainStorageKeys,
} from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import type { PersistedData } from '../types/persistence';
import {
  FormPersistenceContext,
  type ReplaceAllPersistedData,
} from './FormPersistenceContext.shared';
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
import { buildSessionStorageHydrationPlan } from '../utils/persistenceSessionHydration';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from '../utils/safeSessionStorage';
import {
  getFieldErrorRevisionSnapshot,
  getFieldErrorsBySourceSnapshot,
  getPersistedSectionSnapshot,
  getResolvedFieldErrorsSnapshot,
  getSectionRevisionSnapshot,
} from '../hooks/useFormPersistenceSelectors';

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

  const [initOnce] = React.useState<{
    initialSections: PersistedCache;
    keysToRemove: string[];
    notice: { message: string; type: 'warning' | 'error' } | null;
  }>(() => {
    const plan = buildSessionStorageHydrationPlan();
    const nextCache = createEmptyCache();
    for (const pageKey of Object.keys(plan.sections) as StorageKey[]) {
      assignCacheValue(nextCache, pageKey, plan.sections[pageKey]);
    }
    return {
      initialSections: nextCache,
      keysToRemove: plan.keysToRemove,
      notice: plan.notice,
    };
  });

  const initialSectionsRef = React.useRef<PersistedCache>(initOnce.initialSections);

  const [noticeState, setNoticeState] = React.useState<{ epoch: number; notice: { message: string; type: 'warning' | 'error' } | null }>(() => ({
    epoch: 0,
    notice: initOnce.notice,
  }));

  React.useEffect(() => {
    const store = formPersistenceStore.getState();
    store.hydrate(
      initialSectionsRef.current,
      { hydrated: true, schemaFingerprint: CURRENT_VERSION }
    );
  }, []);

  React.useEffect(() => {
    for (const key of initOnce.keysToRemove) {
      removeSessionStorageValue(key);
    }
  }, [initOnce.keysToRemove]);

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
  const getPersistedData = React.useCallback(<K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
    return getPersistedSectionSnapshot(pageKey);
  }, []);

  const hasAnyData = React.useCallback((): boolean => {
    return countFilledFields(formPersistenceStore.getState().sections as PersistedCache) > 0;
  }, []);

  /**
   * Gem data i sessionStorage med versionering
   *
   * Wrapper data i PersistedData struktur med version og timestamp.
   */
  const persistData = React.useCallback(<K extends StorageKey>(pageKey: K, data: PersistedSectionMap[K]): boolean => {
    try {
      const storageKey = getStorageKey(pageKey);

      // Defensive runtime check: should never happen because persistenceSchemas is keyed by StorageKey,
      // but protects against hot-reload / partial module state during development.
      if (!Object.prototype.hasOwnProperty.call(persistenceSchemas, pageKey)) {
        console.error(`[Persistence] Missing schema for '${pageKey}'. Cannot persist data.`, { pageKey });
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern konfigurationsfejl.`, 'error');
        return false;
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
        return false;
      }

      const persistedSectionData = serializeFormValues(validated.data);
      // Trust-critical invariant: cache must match the post-serialization representation (reload-equivalent).
      const postSerializeValidated = schema.safeParse(nullToUndefinedDeep(persistedSectionData));
      if (!postSerializeValidated.success) {
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern serialiseringsfejl.`, 'error');
        return false;
      }

      const currentSnapshot = getPersistedSectionSnapshot(pageKey);
      if (currentSnapshot !== null) {
        const currentSerialized = serializeFormValues(currentSnapshot);
        const nextSerializedFingerprint = JSON.stringify(persistedSectionData);
        const currentSerializedFingerprint = JSON.stringify(currentSerialized);
        if (currentSerializedFingerprint === nextSerializedFingerprint) {
          return true;
        }
      }

      const persistedData: PersistedData = {
        version: CURRENT_VERSION,
        timestamp: Date.now(),
        data: persistedSectionData,
      };

      writeSessionStorageValue(storageKey, JSON.stringify(persistedData));
      formPersistenceStore.getState().commitSection(pageKey, postSerializeValidated.data as PersistedSectionMap[K], {
        schemaFingerprint: CURRENT_VERSION,
      });
      logPersistSaveDebug(storageKey, getFieldCount(data));
      return true;
    } catch (error) {
      console.error(`[Persistence] Fejl ved gemning af data for '${pageKey}':`, {
        pageKey,
        fieldCount: getFieldCount(data),
        error,
      });
      emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern fejl.`, 'error');
      return false;
    }
  }, [emitUserNotice, logPersistSaveDebug]);

  const replaceAllPersistedData = React.useCallback<ReplaceAllPersistedData>((snapshot) => {
    const prevStoreState = formPersistenceStore.getState();
    const prevSections = prevStoreState.sections as PersistedCache;
    const prevSectionRevisions = prevStoreState.sectionRevisions;
    const prevFieldErrors = prevStoreState.fieldErrors;
    const prevFieldErrorRevisions = prevStoreState.fieldErrorRevisions;
    const prevAuthoritativeSnapshotEpoch = prevStoreState.authoritativeSnapshotEpoch;
    const prevMeta = prevStoreState.meta;
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
      backup.set(key, readSessionStorageValue(key));
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
        removeSessionStorageValue(key);
      }
      for (const { storageKey, value } of toWrite) {
        writeSessionStorageValue(storageKey, value);
      }
      formPersistenceStore.getState().replaceSectionsAndClearFieldErrors(
        nextCache,
        { hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() }
      );
    } catch (error) {
      // Defensive strategy: always execute full rollback/restore sequence,
      // even if failure happened before any in-memory mutation.
      for (const { storageKey } of toWrite) {
        removeSessionStorageValue(storageKey);
      }
      for (const [key, value] of backup.entries()) {
        if (value === null || value === undefined) {
          removeSessionStorageValue(key);
        } else {
          writeSessionStorageValue(key, value);
        }
      }
      formPersistenceStore.getState().rollbackSections(
        prevSections,
        prevSectionRevisions,
        prevAuthoritativeSnapshotEpoch,
        prevMeta
      );
      formPersistenceStore.getState().restoreFieldErrors(prevFieldErrors, prevFieldErrorRevisions);
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
      removeSessionStorageValue(storageKey);
      formPersistenceStore.getState().commitSection(pageKey, null, {
        schemaFingerprint: CURRENT_VERSION,
      });
      formPersistenceStore.getState().clearFieldErrorsForSection(pageKey);
    } catch (error) {
      console.error(`[Persistence] Fejl ved sletning af data for '${pageKey}':`, error);
    }
  }, []);

  /**
   * Slet alle gemte Mineo data
   *
   * Bruger manifest til kun at slette kendte keys.
   */
  const clearAllData = React.useCallback(() => {
    try {
      // Kun domæne-data keys — UI-state (filnavn, sidebar, overlay) bevares bevidst.
      const domainKeys = getDomainStorageKeys();
      domainKeys.forEach(key => {
        removeSessionStorageValue(key);
      });
      formPersistenceStore.getState().clearAll({ hydrated: true, schemaFingerprint: CURRENT_VERSION, lastCommittedAt: Date.now() });
    } catch (error) {
      console.error('[Persistence] Fejl ved sletning af alle data:', error);
    }
  }, []);

  const getFieldErrorsBySource = React.useCallback(<K extends StorageKey,>(pageKey: K) => {
    return getFieldErrorsBySourceSnapshot(pageKey) as FieldErrorsForSection<K>;
  }, []);

  const getFieldErrors = React.useCallback(<K extends StorageKey,>(pageKey: K) => {
    return getResolvedFieldErrorsSnapshot(pageKey) as Partial<Record<string, FormFieldError>>;
  }, []);

  const getFieldError = React.useCallback(<K extends StorageKey,>(
    pageKey: K,
    fieldName: string
  ): FormFieldError | undefined => {
    const bySource = getFieldErrorsBySourceSnapshot(pageKey) as FieldErrorsForSection<K>;
    const forField = bySource[fieldName];
    if (!forField) return undefined;
    return resolveActiveFieldError(forField);
  }, []);

  const setFieldError = React.useCallback(<K extends StorageKey,>(
    pageKey: K,
    fieldName: string,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => {
    formPersistenceStore.getState().setFieldError(pageKey, fieldName, source, error);
  }, []);

  const clearFieldErrors = React.useCallback((pageKey: StorageKey) => {
    formPersistenceStore.getState().clearFieldErrorsForSection(pageKey);
  }, []);

  const clearAllFieldErrors = React.useCallback(() => {
    formPersistenceStore.getState().clearAllFieldErrors();
  }, []);

  const getSectionRevision = React.useCallback((pageKey: StorageKey) => {
    return getSectionRevisionSnapshot(pageKey);
  }, []);

  const getFieldErrorRevision = React.useCallback((pageKey: StorageKey) => {
    return getFieldErrorRevisionSnapshot(pageKey);
  }, []);

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
