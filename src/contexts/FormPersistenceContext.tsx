import React from 'react';
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
import { PERSISTED_SECTION_KEYS, persistenceSchemas, type PersistedSectionMap } from '../config/persistenceRegistry';
import { nullToUndefinedDeep } from '../utils/nullToUndefinedDeep';
import { countFilledFields } from '../utils/dataCollection';
import { setDevtoolsProviderState } from '../utils/devtoolsMonitor';
import { formPersistenceStore, type FieldErrorCache, type FieldErrorRevisionMap, type FormPersistenceMeta, type SectionRevisionMap } from '../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../stores/undoRedoStore';
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
  clearResolvedFieldErrorsCache,
} from '../stores/formPersistenceReadModel';
import { formatZodIssues } from '../utils/zodIssueFormatting';

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

const getFieldCount = (value: unknown): number => {
  return typeof value === 'object' && value !== null ? Object.keys(value).length : 0;
};

const PERSISTENCE_DEBUG_MIN_INTERVAL_MS = 1000;

type PersistedCache = { [K in StorageKey]: PersistedSectionMap[K] | null };

const createEmptyPersistedCache = (): PersistedCache => {
  return PERSISTED_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as PersistedCache);
};

const assignCacheValue = <K extends StorageKey>(target: PersistedCache, key: K, value: PersistedSectionMap[K] | null): void => {
  target[key] = value;
};

type StoreRollbackSnapshot = {
  sections: PersistedCache;
  sectionRevisions: SectionRevisionMap;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  authoritativeSnapshotEpoch: number;
  meta: FormPersistenceMeta;
};

const captureStoreRollbackSnapshot = (): StoreRollbackSnapshot => {
  const state = formPersistenceStore.getState();
  return {
    sections: state.sections as PersistedCache,
    sectionRevisions: state.sectionRevisions,
    fieldErrors: state.fieldErrors,
    fieldErrorRevisions: state.fieldErrorRevisions,
    authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
    meta: state.meta,
  };
};

const restoreStoreRollbackSnapshot = (snapshot: StoreRollbackSnapshot): void => {
  formPersistenceStore.getState().rollbackSections(
    snapshot.sections,
    snapshot.sectionRevisions,
    snapshot.authoritativeSnapshotEpoch,
    snapshot.meta
  );
  formPersistenceStore.getState().restoreFieldErrors(snapshot.fieldErrors, snapshot.fieldErrorRevisions);
};

/**
 * Provider komponent der wrapper hele applikationen
 */
export const FormPersistenceProvider = ({ children }: { children: React.ReactNode }) => {
  const debugSaveStateRef = React.useRef<Map<string, { lastLogAt: number; lastFieldCount: number }>>(
    new Map()
  );
  const [initOnce] = React.useState<{
    initialSections: PersistedCache;
    keysToRemove: string[];
    notice: { message: string; type: 'warning' | 'error' } | null;
  }>(() => {
    const plan = buildSessionStorageHydrationPlan();
    const nextCache = createEmptyPersistedCache();
    for (const pageKey of PERSISTED_SECTION_KEYS) {
      assignCacheValue(nextCache, pageKey, plan.sections[pageKey]);
    }
    formPersistenceStore.getState().hydrate(
      nextCache,
      { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION }
    );
    clearResolvedFieldErrorsCache();
    return {
      initialSections: nextCache,
      keysToRemove: plan.keysToRemove,
      notice: plan.notice,
    };
  });

  const [noticeState, setNoticeState] = React.useState<{ epoch: number; notice: { message: string; type: 'warning' | 'error' } | null }>(() => ({
    epoch: 0,
    notice: initOnce.notice,
  }));

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
    const entry = existing ?? { lastLogAt: 0, lastFieldCount: fieldCount };
    entry.lastFieldCount = fieldCount;

    if (now - entry.lastLogAt >= PERSISTENCE_DEBUG_MIN_INTERVAL_MS) {
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
  const persistData = React.useCallback(<K extends StorageKey>(
    pageKey: K,
    data: PersistedSectionMap[K],
    options?: { undoOrigin?: HistoryFrameOrigin }
  ): boolean => {
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
        version: PERSISTED_DATA_VERSION,
        timestamp: Date.now(),
        data: persistedSectionData,
      };

      const previousStorageValue = readSessionStorageValue(storageKey);
      const rollbackSnapshot = captureStoreRollbackSnapshot();
      try {
        writeSessionStorageValue(storageKey, JSON.stringify(persistedData));
        if (options?.undoOrigin) {
          undoRedoStore.getState().capture(options.undoOrigin);
        }
        formPersistenceStore.getState().commitSection(pageKey, postSerializeValidated.data as PersistedSectionMap[K], {
          schemaFingerprint: PERSISTED_DATA_VERSION,
        });
      } catch (error) {
        if (previousStorageValue === null) {
          removeSessionStorageValue(storageKey);
        } else {
          writeSessionStorageValue(storageKey, previousStorageValue);
        }
        restoreStoreRollbackSnapshot(rollbackSnapshot);
        throw error;
      }
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
    for (const key of PERSISTED_SECTION_KEYS) {
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
    const nextCache = createEmptyPersistedCache();

    for (const pageKey of PERSISTED_SECTION_KEYS) {
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
        version: PERSISTED_DATA_VERSION,
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
        { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION, lastCommittedAt: Date.now() }
      );
      clearResolvedFieldErrorsCache();
      undoRedoStore.getState().clear();
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
      clearResolvedFieldErrorsCache();
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      throw new Error(`Kunne ikke anvende snapshot atomisk: ${message}`);
    }
  }, []);

  /**
   * Slet data for en specifik side
   */
  const clearPageData = React.useCallback((pageKey: StorageKey) => {
    const storageKey = getStorageKey(pageKey);
    let previousStorageValue: string | null = null;
    let rollbackSnapshot: StoreRollbackSnapshot | null = null;
    try {
      previousStorageValue = readSessionStorageValue(storageKey);
      rollbackSnapshot = captureStoreRollbackSnapshot();
      removeSessionStorageValue(storageKey);
      formPersistenceStore.getState().clearSection(pageKey, {
        schemaFingerprint: PERSISTED_DATA_VERSION,
      });
      formPersistenceStore.getState().clearFieldErrorsForSection(pageKey);
    } catch (error) {
      if (rollbackSnapshot) {
        if (previousStorageValue === null) {
          removeSessionStorageValue(storageKey);
        } else {
          writeSessionStorageValue(storageKey, previousStorageValue);
        }
        restoreStoreRollbackSnapshot(rollbackSnapshot);
      }
      emitUserNotice(`Kunne ikke slette data for '${pageKey}'. Ingen data blev ændret.`, 'error');
      console.error(`[Persistence] Fejl ved sletning af data for '${pageKey}':`, error);
    }
  }, [emitUserNotice]);

  /**
   * Slet alle gemte Mineo data
   *
   * Bruger manifest til kun at slette kendte keys.
   */
  const clearAllData = React.useCallback(() => {
    const backup = new Map<string, string | null>();
    let rollbackSnapshot: StoreRollbackSnapshot | null = null;
    try {
      // Kun domæne-data keys — UI-state (filnavn, sidebar, overlay) bevares bevidst.
      const domainKeys = getDomainStorageKeys();
      for (const key of domainKeys) {
        backup.set(key, readSessionStorageValue(key));
      }
      rollbackSnapshot = captureStoreRollbackSnapshot();
      domainKeys.forEach(key => {
        removeSessionStorageValue(key);
      });
      formPersistenceStore.getState().clearAll({ hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION, lastCommittedAt: Date.now() });
      clearResolvedFieldErrorsCache();
      undoRedoStore.getState().clear();
    } catch (error) {
      if (rollbackSnapshot) {
        for (const [key, value] of backup.entries()) {
          if (value === null) {
            removeSessionStorageValue(key);
          } else {
            writeSessionStorageValue(key, value);
          }
        }
        restoreStoreRollbackSnapshot(rollbackSnapshot);
      }
      emitUserNotice('Kunne ikke slette alle sagsdata. Ingen data blev ændret.', 'error');
      console.error('[Persistence] Fejl ved sletning af alle data:', error);
    }
  }, [emitUserNotice]);

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
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean; invalidDraft?: string } | null
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
      noticeState.notice,
      noticeState.epoch,
    ]
  );

  return (
    <FormPersistenceContext.Provider value={value}>
      {children}
    </FormPersistenceContext.Provider>
  );
};
