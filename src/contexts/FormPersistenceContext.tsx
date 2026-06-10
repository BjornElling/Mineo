import React from 'react';
import {
  type StorageKey,
  getStorageKey,
} from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import type { PersistedData } from '../types/persistence';
import {
  type ReplaceAllPersistedData,
} from './FormPersistenceContext.shared';
import { FormPersistenceContext } from './FormPersistenceContext.internal';
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
import { formPersistenceStore, type FieldErrorCache, type FieldErrorRevisionMap, type FormPersistenceMeta, type InvalidDraftRevisionMap, type InvalidDraftsCache, type SectionRevisionMap } from '../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../stores/undoRedoStore';
import { buildSessionStorageHydrationPlan } from '../utils/persistenceSessionHydration';
import {
  readSessionStorageValue,
  removeSessionStorageValue,
  writeSessionStorageValue,
} from '../utils/safeSessionStorage';
import {
  getInvalidDraftsStorageKey,
} from '../config/storageManifest';
import { writeInvalidDraftsToStorage } from '../utils/invalidDraftsStorage';
import {
  getFieldErrorRevisionSnapshot,
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftForFieldSnapshot,
  getInvalidDraftsForSectionSnapshot,
  getPersistedSectionSnapshot,
  getResolvedFieldErrorsSnapshot,
  getSectionRevisionSnapshot,
  clearResolvedFieldErrorsCache,
} from '../stores/formPersistenceReadModel';
import { formatZodIssues } from '../utils/zodIssueFormatting';
import { asError } from '../utils/typeGuards';

// Persisterede sektioner håndteres via et internt Zustand store; FormPersistenceContext er en facade og ikke SoT for committede inputs.

/**
 * FormPersistenceContext
 *
 * Håndterer automatisk persistence af formular-data ved hjælp af sessionStorage.
 * Data bevares når man navigerer mellem sider, men slettes når browseren lukkes.
 *
 * Features:
 * - Type-sikre storage keys via manifest
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
  invalidDrafts: InvalidDraftsCache;
  invalidDraftRevisions: InvalidDraftRevisionMap;
  committedChangeCounter: number;
  authoritativeSnapshotEpoch: number;
  meta: FormPersistenceMeta;
};

type UndoRedoRollbackSnapshot = Pick<ReturnType<typeof undoRedoStore.getState>, 'past' | 'future' | 'frameSequence'>;

const captureStoreRollbackSnapshot = (): StoreRollbackSnapshot => {
  const state = formPersistenceStore.getState();
  return {
    sections: state.sections as PersistedCache,
    sectionRevisions: state.sectionRevisions,
    fieldErrors: state.fieldErrors,
    fieldErrorRevisions: state.fieldErrorRevisions,
    invalidDrafts: state.invalidDrafts,
    invalidDraftRevisions: state.invalidDraftRevisions,
    committedChangeCounter: state.committedChangeCounter,
    authoritativeSnapshotEpoch: state.authoritativeSnapshotEpoch,
    meta: state.meta,
  };
};

const captureUndoRedoRollbackSnapshot = (): UndoRedoRollbackSnapshot => {
  const state = undoRedoStore.getState();
  return {
    past: structuredClone(state.past),
    future: structuredClone(state.future),
    frameSequence: state.frameSequence,
  };
};

const restoreUndoRedoRollbackSnapshot = (snapshot: UndoRedoRollbackSnapshot): void => {
  undoRedoStore.setState({
    past: snapshot.past,
    future: snapshot.future,
    frameSequence: snapshot.frameSequence,
  });
};

const restoreStoreRollbackSnapshot = (snapshot: StoreRollbackSnapshot): void => {
  formPersistenceStore.getState().rollbackSections(
    snapshot.sections,
    snapshot.sectionRevisions,
    snapshot.committedChangeCounter,
    snapshot.authoritativeSnapshotEpoch,
    snapshot.meta
  );
  formPersistenceStore.getState().restoreFieldErrors(snapshot.fieldErrors, snapshot.fieldErrorRevisions);
  formPersistenceStore.getState().restoreInvalidDrafts(snapshot.invalidDrafts, snapshot.invalidDraftRevisions);
  clearResolvedFieldErrorsCache();
};

const restoreStorageValue = (storageKey: string, value: string | null): void => {
  if (value === null) {
    removeSessionStorageValue(storageKey);
    return;
  }
  writeSessionStorageValue(storageKey, value);
};

const attemptRollbackStep = (
  failures: Error[],
  step: () => void
): void => {
  try {
    step();
  } catch (rollbackError) {
    failures.push(asError(rollbackError));
  }
};

const createRollbackError = (operation: string, originalError: unknown, rollbackFailures: readonly Error[]): Error => {
  const originalMessage = originalError instanceof Error ? originalError.message : String(originalError);
  if (rollbackFailures.length === 0) {
    return originalError instanceof Error ? originalError : new Error(originalMessage);
  }

  const rollbackMessages = rollbackFailures.map((failure) => failure.message).join(' | ');
  return new Error(`${operation} fejlede og rollback havde ${rollbackFailures.length} fejl: ${rollbackMessages}. Oprindelig fejl: ${originalMessage}`);
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
      { hydrated: true, schemaFingerprint: PERSISTED_DATA_VERSION },
      plan.invalidDrafts
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

      // Defensivt runtime-tjek: bør aldrig ske, fordi persistenceSchemas er nøglet på StorageKey,
      // men beskytter mod hot-reload / delvis modul-state under udvikling.
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
      // Trust-kritisk invariant: cachen skal matche repræsentationen efter serialisering (reload-ækvivalent).
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
      const undoRollbackSnapshot = captureUndoRedoRollbackSnapshot();
      try {
        writeSessionStorageValue(storageKey, JSON.stringify(persistedData));
        if (options?.undoOrigin) {
          undoRedoStore.getState().capture(options.undoOrigin);
        }
        formPersistenceStore.getState().commitSection(pageKey, postSerializeValidated.data as PersistedSectionMap[K], {
          lastCommittedAt: Date.now(),
        });
      } catch (error) {
        const rollbackFailures: Error[] = [];
        attemptRollbackStep(rollbackFailures, () => restoreStorageValue(storageKey, previousStorageValue));
        attemptRollbackStep(rollbackFailures, () => restoreStoreRollbackSnapshot(rollbackSnapshot));
        attemptRollbackStep(rollbackFailures, () => restoreUndoRedoRollbackSnapshot(undoRollbackSnapshot));
        throw createRollbackError('persistData', error, rollbackFailures);
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

  /**
   * Beregn næste invalidDrafts-cache fra nuværende store + én feltændring (uden at mutere store).
   * Bruges til at skrive sessionStorage FØR store-commit, så skrivning er atomisk med rollback.
   */
  const computeNextInvalidDrafts = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, draft: string | null): InvalidDraftsCache => {
      const current = formPersistenceStore.getState().invalidDrafts;
      const section = { ...current[pageKey] };
      if (draft === null || draft === '') {
        delete section[fieldPath];
      } else {
        section[fieldPath] = draft;
      }
      return { ...current, [pageKey]: section };
    },
    []
  );

  /**
   * Skriv/ryd ét felts committede rå draft (`invalidDrafts`). Atomisk på tværs af store +
   * sessionStorage med rollback, efter samme fail-closed-mønster som persistData.
   *
   * `undoOrigin` (kun ved fejlende commit) opretter en undo/redo-frame, så et nyt ugyldigt input
   * kan undo'es. Ved rydning (vellykket commit) sendes ingen undoOrigin — rydningen rider på det
   * samtidige sektion-commits frame.
   */
  const writeInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, draft: string | null, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
      try {
        const currentForField = getInvalidDraftForFieldSnapshot(pageKey, fieldPath);
        const normalizedDraft = draft === null || draft === '' ? null : draft;
        if ((currentForField ?? null) === normalizedDraft) {
          return true;
        }

        const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
        const previousStorageValue = readSessionStorageValue(invalidDraftsStorageKey);
        const rollbackSnapshot = captureStoreRollbackSnapshot();
        const undoRollbackSnapshot = captureUndoRedoRollbackSnapshot();
        const nextCache = computeNextInvalidDrafts(pageKey, fieldPath, normalizedDraft);
        try {
          writeInvalidDraftsToStorage(nextCache);
          if (options?.undoOrigin) {
            undoRedoStore.getState().capture(options.undoOrigin);
          }
          formPersistenceStore.getState().setInvalidDraft(pageKey, fieldPath, normalizedDraft);
        } catch (error) {
          const rollbackFailures: Error[] = [];
          attemptRollbackStep(rollbackFailures, () => restoreStorageValue(invalidDraftsStorageKey, previousStorageValue));
          attemptRollbackStep(rollbackFailures, () => restoreStoreRollbackSnapshot(rollbackSnapshot));
          attemptRollbackStep(rollbackFailures, () => restoreUndoRedoRollbackSnapshot(undoRollbackSnapshot));
          throw createRollbackError('writeInvalidDraft', error, rollbackFailures);
        }
        return true;
      } catch (error) {
        console.error(`[Persistence] Fejl ved skrivning af invalid draft for '${pageKey}.${fieldPath}':`, error);
        emitUserNotice(`Kunne ikke gemme det aktuelle input for '${pageKey}' pga. en intern fejl.`, 'error');
        return false;
      }
    },
    [computeNextInvalidDrafts, emitUserNotice]
  );

  const commitInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, rawDraft: string, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
      return writeInvalidDraft(pageKey, fieldPath, rawDraft, options);
    },
    [writeInvalidDraft]
  );

  const clearInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string): boolean => {
      return writeInvalidDraft(pageKey, fieldPath, null);
    },
    [writeInvalidDraft]
  );

  const getInvalidDraft = React.useCallback((pageKey: StorageKey, fieldPath: string): string | undefined => {
    return getInvalidDraftForFieldSnapshot(pageKey, fieldPath);
  }, []);

  const getInvalidDraftsForSection = React.useCallback((pageKey: StorageKey): Record<string, string> => {
    return getInvalidDraftsForSectionSnapshot(pageKey);
  }, []);

  const replaceAllPersistedData = React.useCallback<ReplaceAllPersistedData>((snapshot) => {
    const prevStoreState = formPersistenceStore.getState();
    const prevSections = prevStoreState.sections as PersistedCache;
    const prevSectionRevisions = prevStoreState.sectionRevisions;
    const prevFieldErrors = prevStoreState.fieldErrors;
    const prevFieldErrorRevisions = prevStoreState.fieldErrorRevisions;
    const prevInvalidDrafts = prevStoreState.invalidDrafts;
    const prevInvalidDraftRevisions = prevStoreState.invalidDraftRevisions;
    const prevAuthoritativeSnapshotEpoch = prevStoreState.authoritativeSnapshotEpoch;
    const prevMeta = prevStoreState.meta;
    for (const key of PERSISTED_SECTION_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
        throw new Error(`Snapshot mangler key '${key}'. Snapshot skal indeholde alle keys (brug undefined for at slette).`);
      }
    }

    // Backup og erstatning sker kun for domæne-keys + invalidDrafts-recovery-nøglen — UI-state
    // (filnavn, sidebar, overlay) er uafhængig af sags-data og skal ikke berøres ved fil-load.
    // En indlæst .eo har per definition ingen invalidDrafts, så nøglen ryddes.
    const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
    const keysToReplace = [...PERSISTED_SECTION_KEYS.map(getStorageKey), invalidDraftsStorageKey];
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
      // Trust-kritisk invariant: cachen skal matche repræsentationen efter serialisering.
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
      // Defensiv strategi: udfør altid hele rollback/restore-sekvensen,
      // selv hvis fejlen skete før nogen in-memory-mutation.
      const rollbackFailures: Error[] = [];
      for (const { storageKey } of toWrite) {
        attemptRollbackStep(rollbackFailures, () => removeSessionStorageValue(storageKey));
      }
      for (const [key, value] of backup.entries()) {
        attemptRollbackStep(rollbackFailures, () => restoreStorageValue(key, value));
      }
      attemptRollbackStep(rollbackFailures, () => {
        formPersistenceStore.getState().rollbackSections(
          prevSections,
          prevSectionRevisions,
          prevStoreState.committedChangeCounter,
          prevAuthoritativeSnapshotEpoch,
          prevMeta
        );
        formPersistenceStore.getState().restoreFieldErrors(prevFieldErrors, prevFieldErrorRevisions);
        formPersistenceStore.getState().restoreInvalidDrafts(prevInvalidDrafts, prevInvalidDraftRevisions);
        clearResolvedFieldErrorsCache();
      });
      const message = createRollbackError('replaceAllPersistedData', error, rollbackFailures).message;
      throw new Error(`Kunne ikke anvende snapshot atomisk: ${message}`);
    }
  }, []);

  /**
   * Slet data for en specifik side
   */
  const clearPageData = React.useCallback((pageKey: StorageKey) => {
    const storageKey = getStorageKey(pageKey);
    const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
    let previousStorageValue: string | null = null;
    let previousInvalidDraftsStorageValue: string | null = null;
    let rollbackSnapshot: StoreRollbackSnapshot | null = null;
    try {
      previousStorageValue = readSessionStorageValue(storageKey);
      previousInvalidDraftsStorageValue = readSessionStorageValue(invalidDraftsStorageKey);
      rollbackSnapshot = captureStoreRollbackSnapshot();
      removeSessionStorageValue(storageKey);
      formPersistenceStore.getState().clearSection(pageKey, {
        lastCommittedAt: Date.now(),
      });
      formPersistenceStore.getState().clearFieldErrorsForSection(pageKey);
      formPersistenceStore.getState().clearInvalidDraftsForSection(pageKey);
      writeInvalidDraftsToStorage(formPersistenceStore.getState().invalidDrafts);
      clearResolvedFieldErrorsCache();
    } catch (error) {
      if (rollbackSnapshot) {
        const snapshot = rollbackSnapshot;
        const rollbackFailures: Error[] = [];
        attemptRollbackStep(rollbackFailures, () => restoreStorageValue(storageKey, previousStorageValue));
        attemptRollbackStep(rollbackFailures, () => restoreStorageValue(invalidDraftsStorageKey, previousInvalidDraftsStorageValue));
        attemptRollbackStep(rollbackFailures, () => restoreStoreRollbackSnapshot(snapshot));
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
      // Kun domæne-data keys + invalidDrafts-recovery-nøglen — UI-state (filnavn, sidebar, overlay) bevares bevidst.
      const domainKeys = [...PERSISTED_SECTION_KEYS.map(getStorageKey), getInvalidDraftsStorageKey()];
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
        const snapshot = rollbackSnapshot;
        const rollbackFailures: Error[] = [];
        for (const [key, value] of backup.entries()) {
          attemptRollbackStep(rollbackFailures, () => restoreStorageValue(key, value));
        }
        attemptRollbackStep(rollbackFailures, () => restoreStoreRollbackSnapshot(snapshot));
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
      commitInvalidDraft,
      clearInvalidDraft,
      getInvalidDraft,
      getInvalidDraftsForSection,
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
      commitInvalidDraft,
      clearInvalidDraft,
      getInvalidDraft,
      getInvalidDraftsForSection,
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
