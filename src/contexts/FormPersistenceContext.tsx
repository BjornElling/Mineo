import React from 'react';
import {
  type StorageKey,
  getStorageKey,
} from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
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
import { PERSISTED_SECTION_KEYS, type PersistedSectionMap } from '../config/persistenceRegistry';
import { buildPersistedSection } from '../utils/buildPersistedSection';
import { countFilledFields } from '../utils/dataCollection';
import { setDevtoolsProviderState } from '../utils/devtoolsMonitor';
import { formPersistenceStore, type InvalidDraftsCache } from '../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../stores/undoRedoStore';
import {
  captureStoreRollbackSnapshot,
  captureUndoRedoRollbackSnapshot,
  restoreStoreRollbackSnapshot,
  restoreUndoRedoRollbackSnapshot,
  type StoreRollbackSnapshot,
} from '../utils/persistenceStoreRollback';
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

  /**
   * Læs schema-valideret persisted data (ingen side-effects).
   */
  const getPersistedData = React.useCallback(<K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null => {
    return getPersistedSectionSnapshot(pageKey);
  }, []);

  const hasAnyData = React.useCallback((): boolean => {
    return countFilledFields(formPersistenceStore.getState().sections as PersistedCache) > 0;
  }, []);

  // ASYMMETRISK coalescing af undo-captures for ÉT felt-commit, så det giver præcis ÉN frame.
  //
  // Et felt-commit kan røre BÅDE `sections` (persistData) og `invalidDrafts` (writeInvalidDraft): fx
  // committer useDraftField/immediate-Delete altid onCommit (setValues) EFTERFULGT af clearInvalidDraft.
  // - persistData (value-commit) fanger ALTID sin egen frame (to forskellige value-commits = to frames;
  //   fx to radio-klik på samme felt skal kunne undo'es hver for sig).
  // - Den EFTERFØLGENDE writeInvalidDraft (commit-invalid/clear) på SAMME fieldPath i samme synkrone flow
  //   rider på value-commit'ets frame (coalesces). Men hvis value-commit'et var en no-op (committed værdi
  //   uændret → ingen frame), fanger writeInvalidDraft sin EGEN frame — ellers ville en rydning helt uden
  //   sektionsændring slet ikke blive fanget, og undo ville springe den over og gendanne den gamle ugyldige
  //   værdi (rapporteret bug).
  // Markøren sættes af persistData og forbruges (ryddes) af det parrede writeInvalidDraft i samme flow;
  // microtask-reset er en backstop for ikke-parrede value-commits (radio/toggle/dropdown uden invalidDraft).
  const pendingValueCommitFieldPathRef = React.useRef<string | null>(null);
  const markValueCommitCaptured = React.useCallback((fieldPath: string | null): void => {
    pendingValueCommitFieldPathRef.current = fieldPath;
    queueMicrotask(() => {
      pendingValueCommitFieldPathRef.current = null;
    });
  }, []);
  // Returnerer true hvis dette invalidDraft-capture skal SPRINGES OVER (rider på et value-commits frame
  // fra samme flow). Forbruger (rydder) markøren ved match, så den ikke fejlagtigt coalescer en senere handling.
  const consumeValueCommitCoalesce = React.useCallback((fieldPath: string | null): boolean => {
    if (pendingValueCommitFieldPathRef.current !== null && pendingValueCommitFieldPathRef.current === fieldPath) {
      pendingValueCommitFieldPathRef.current = null;
      return true;
    }
    return false;
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

      const built = buildPersistedSection(pageKey, data, Date.now());
      if (!built.ok) {
        if (built.stage === 'config') {
          // Bør aldrig ske, fordi persistenceSchemas er nøglet på StorageKey; beskytter mod hot-reload / delvis modul-state.
          console.error(`[Persistence] Missing schema for '${pageKey}'. Cannot persist data.`, { pageKey });
          emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern konfigurationsfejl.`, 'error');
          return false;
        }
        if (built.stage === 'schema') {
          const issues = formatZodIssues(built.error!.issues, 3);
          console.error(`[Persistence] Schema mismatch for '${pageKey}':\n${issues}`, {
            pageKey,
            issues: built.error!.issues,
          });
          emitUserNotice(
            `Kunne ikke gemme data for '${pageKey}' fordi data ikke matcher schema.\n${issues}`,
            'error'
          );
          return false;
        }
        // built.stage === 'post-serialize'
        emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern serialiseringsfejl.`, 'error');
        return false;
      }

      const currentSnapshot = getPersistedSectionSnapshot(pageKey);
      if (currentSnapshot !== null) {
        const currentSerialized = serializeFormValues(currentSnapshot);
        const nextSerializedFingerprint = JSON.stringify(built.persistedData.data);
        const currentSerializedFingerprint = JSON.stringify(currentSerialized);
        if (currentSerializedFingerprint === nextSerializedFingerprint) {
          return true;
        }
      }

      const previousStorageValue = readSessionStorageValue(storageKey);
      const rollbackSnapshot = captureStoreRollbackSnapshot();
      const undoRollbackSnapshot = captureUndoRedoRollbackSnapshot();
      try {
        writeSessionStorageValue(storageKey, built.serialized);
        if (options?.undoOrigin) {
          // Value-commit fanger ALTID sin egen frame; markér den, så en parret invalidDraft-clear i samme
          // flow rider på den i stedet for at fange en ekstra.
          undoRedoStore.getState().capture(options.undoOrigin);
          markValueCommitCaptured(options.undoOrigin.fieldPath);
        }
        formPersistenceStore.getState().commitSection(pageKey, built.validatedData, {
          lastCommittedAt: Date.now(),
        });
      } catch (error) {
        const rollbackFailures: Error[] = [];
        attemptRollbackStep(rollbackFailures, () => restoreStorageValue(storageKey, previousStorageValue));
        attemptRollbackStep(rollbackFailures, () => restoreStoreRollbackSnapshot(rollbackSnapshot));
        attemptRollbackStep(rollbackFailures, () => restoreUndoRedoRollbackSnapshot(undoRollbackSnapshot));
        throw createRollbackError('persistData', error, rollbackFailures);
      }
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
  }, [markValueCommitCaptured, emitUserNotice]);

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
   * `undoOrigin` opretter en undo/redo-frame, så både et nyt ugyldigt input OG en rydning af det kan
   * undo'es. Captures coalesces pr. synkront commit-flow (asymmetrisk markør, se ovenfor), så et felt-commit
   * der både rører sektionen og rydder draften kun giver ÉN frame — og en rydning hvis sektion-commit
   * er en no-op stadig får sin egen frame (ellers ville undo springe rydningen over).
   */
  const writeInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, draft: string | null, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
      try {
        const currentForField = getInvalidDraftForFieldSnapshot(pageKey, fieldPath);
        const normalizedDraft = draft === null || draft === '' ? null : draft;
        if ((currentForField ?? null) === normalizedDraft) {
          // No-op (fx en valid-commits parrede clear hvor feltet ingen rå draft havde). Forbrug en evt.
          // matchende value-commit-markør, så den ikke dingler og fejlagtigt coalescer en senere handling.
          if (options?.undoOrigin) consumeValueCommitCoalesce(options.undoOrigin.fieldPath);
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
            // Rid på et parret value-commits frame fra samme flow (coalesce); ellers fang vores egen.
            if (!consumeValueCommitCoalesce(options.undoOrigin.fieldPath)) {
              undoRedoStore.getState().capture(options.undoOrigin);
            }
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
    [consumeValueCommitCoalesce, computeNextInvalidDrafts, emitUserNotice]
  );

  const commitInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, rawDraft: string, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
      return writeInvalidDraft(pageKey, fieldPath, rawDraft, options);
    },
    [writeInvalidDraft]
  );

  const clearInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
      return writeInvalidDraft(pageKey, fieldPath, null, options);
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

      const built = buildPersistedSection(pageKey, raw, now);
      if (!built.ok) {
        const issues = built.error ? formatZodIssues(built.error.issues, 2) : '';
        if (built.stage === 'post-serialize') {
          throw new Error(`Kan ikke anvende snapshot: '${pageKey}' fejler efter serialisering.\n${issues}`);
        }
        throw new Error(`Kan ikke anvende snapshot: '${pageKey}' matcher ikke schema.\n${issues}`);
      }
      toWrite.push({ storageKey: getStorageKey(pageKey), value: built.serialized });
      assignCacheValue(nextCache, pageKey, built.validatedData);
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
