import React from 'react';
import { type StorageKey, getKnownStorageKeys, getStorageKey } from '../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../config/persistenceVersion';
import {
  type ReplaceAllPersistedData,
} from './FormPersistenceContext.shared';
import type { InvalidDraftClear } from '../types/invalidDrafts';
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
import {
  assignFormPersistenceSection,
  createEmptyFormPersistenceSections,
  formPersistenceStore,
  type InvalidDraftsCache,
} from '../stores/formPersistenceStore';
import { undoRedoStore, type HistoryFrameOrigin } from '../stores/undoRedoStore';
import { runAtomicPersistenceMutation } from '../utils/persistenceStoreRollback';
import {
  listSessionStorageKeys,
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
import type { PersistenceRuntime } from '../persistence/persistenceRuntime';

export { initializePersistenceRuntime } from '../persistence/persistenceRuntime';
export type { PersistenceRuntime } from '../persistence/persistenceRuntime';

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

/**
 * Provider komponent der wrapper hele applikationen
 */
export const FormPersistenceProvider = ({
  children,
  runtime,
}: {
  children: React.ReactNode;
  runtime: PersistenceRuntime;
}) => {
  const [noticeState, setNoticeState] = React.useState<{ epoch: number; notice: { message: string; type: 'warning' | 'error' } | null }>(() => ({
    epoch: 0,
    notice: runtime.notice,
  }));

  React.useEffect(() => {
    for (const key of runtime.keysToRemove) {
      removeSessionStorageValue(key);
    }
  }, [runtime]);

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
    return countFilledFields(formPersistenceStore.getState().sections) > 0;
  }, []);

  // Undo-frame-coalescing (ét felt-commit → præcis ÉN frame) ejes nu af undoRedoStore
  // (captureValueCommit / captureCoalescing / consumeCoalesceMarker); det er undo-semantik.

  const computeNextInvalidDrafts = React.useCallback(
    (changes: readonly { pageKey: StorageKey; fieldPath: string; draft: string | null }[]): InvalidDraftsCache => {
      const current = formPersistenceStore.getState().invalidDrafts;
      let next = current;

      for (const { pageKey, fieldPath, draft } of changes) {
        const section = { ...next[pageKey] };
        if (draft === null || draft === '') {
          delete section[fieldPath];
        } else {
          section[fieldPath] = draft;
        }
        next = { ...next, [pageKey]: section };
      }

      return next;
    },
    []
  );

  const writeInvalidDraftChanges = React.useCallback(
    (
      changes: readonly { pageKey: StorageKey; fieldPath: string; draft: string | null }[],
      options?: { undoOrigin?: HistoryFrameOrigin }
    ): boolean => {
      try {
        const effectiveChanges = changes.filter(({ pageKey, fieldPath, draft }) => {
          const current = getInvalidDraftForFieldSnapshot(pageKey, fieldPath) ?? null;
          const normalized = draft === null || draft === '' ? null : draft;
          return current !== normalized;
        });

        if (effectiveChanges.length === 0) {
          if (options?.undoOrigin) undoRedoStore.getState().consumeCoalesceMarker(options.undoOrigin.fieldPath);
          return true;
        }

        const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
        const nextCache = computeNextInvalidDrafts(effectiveChanges);
        runAtomicPersistenceMutation({
          operation: 'writeInvalidDrafts',
          affectedStorageKeys: [invalidDraftsStorageKey],
          captureUndo: true,
          mutate: () => {
            writeInvalidDraftsToStorage(nextCache);
            if (options?.undoOrigin) {
              undoRedoStore.getState().captureCoalescing(options.undoOrigin);
            }
            formPersistenceStore.getState().setInvalidDrafts(effectiveChanges);
          },
        });
        return true;
      } catch (error) {
        console.error('[Persistence] Fejl ved skrivning af invalid drafts:', error);
        emitUserNotice('Kunne ikke gemme det aktuelle input pga. en intern fejl.', 'error');
        return false;
      }
    },
    [computeNextInvalidDrafts, emitUserNotice]
  );

  /**
   * Skriv/ryd ét felts afsluttede ugyldige input (`invalidDrafts`). Atomisk på tværs af store +
   * sessionStorage med rollback, efter samme fail-closed-mønster som persistData.
   *
   * `undoOrigin` opretter en undo/redo-frame, så både et nyt ugyldigt input OG en rydning af det kan
   * undo'es. Captures coalesces pr. synkront commit-flow (asymmetrisk markør, se ovenfor), så et felt-commit
   * der både rører sektionen og rydder draften kun giver ÉN frame — og en rydning hvis sektion-commit
   * er en no-op stadig får sin egen frame (ellers ville undo springe rydningen over).
   */
  const writeInvalidDraft = React.useCallback(
    (pageKey: StorageKey, fieldPath: string, draft: string | null, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
      return writeInvalidDraftChanges([{ pageKey, fieldPath, draft }], options);
    },
    [writeInvalidDraftChanges]
  );

  /**
   * Gem data i sessionStorage med versionering
   *
   * Wrapper data i PersistedData struktur med version og timestamp.
   */
  const persistData = React.useCallback(<K extends StorageKey>(
    pageKey: K,
    data: PersistedSectionMap[K],
    options?: {
      undoOrigin?: HistoryFrameOrigin;
      clearInvalidDraft?: InvalidDraftClear;
      clearInvalidDrafts?: readonly InvalidDraftClear[];
    }
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
      let valueIsNoop = false;
      if (currentSnapshot !== null) {
        const currentSerialized = serializeFormValues(currentSnapshot);
        const nextSerializedFingerprint = JSON.stringify(built.persistedData.data);
        const currentSerializedFingerprint = JSON.stringify(currentSerialized);
        valueIsNoop = currentSerializedFingerprint === nextSerializedFingerprint;
      }

      const clearInvalidDrafts = [
        ...(options?.clearInvalidDraft ? [options.clearInvalidDraft] : []),
        ...(options?.clearInvalidDrafts ?? []),
      ].filter(
        (clear, index, all) => all.findIndex(
          (candidate) => candidate.pageKey === clear.pageKey && candidate.fieldPath === clear.fieldPath
        ) === index
      );

      // Værdi-commit er en no-op (uændret sektion). Er der en parret invalidDraft-clear, skal den stadig
      // udføres — som sin egen transaktion med sin egen undo-frame (standalone clear). Ellers ren no-op.
      if (valueIsNoop) {
        if (clearInvalidDrafts.length > 0) {
          return writeInvalidDraftChanges(
            clearInvalidDrafts.map((clear) => ({ ...clear, draft: null })),
            { undoOrigin: options?.undoOrigin }
          );
        }
        return true;
      }

      if (clearInvalidDrafts.length > 0) {
        // ATOMISK finalize (greenfield draft/commit §4.4): sektionsværdi committes OG feltets afsluttede
        // ugyldige input ryddes i ÉN transaktion over BEGGE storage-nøgler, med ÉT undo-frame og ÉN revision-
        // progression. Erstatter det tidligere par (persistData + separat clearInvalidDraft) og gør
        // undo-coalescing overflødig. Forward-paritet med den allerede-atomiske restore-sti.
        const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
        const invalidDraftChanges = clearInvalidDrafts.map((clear) => ({ ...clear, draft: null as null }));
        const nextInvalidDrafts = computeNextInvalidDrafts(invalidDraftChanges);
        runAtomicPersistenceMutation({
          operation: 'finalizeEdit',
          affectedStorageKeys: [storageKey, invalidDraftsStorageKey],
          captureUndo: true,
          mutate: () => {
            writeSessionStorageValue(storageKey, built.serialized);
            writeInvalidDraftsToStorage(nextInvalidDrafts);
            if (options?.undoOrigin) {
              undoRedoStore.getState().capture(options.undoOrigin);
            }
            formPersistenceStore.getState().finalizeEdit({
              sectionKey: pageKey,
              sectionValue: built.validatedData,
              invalidDraftChanges,
              metaPatch: { lastCommittedAt: Date.now() },
            });
          },
        });
        return true;
      }

      runAtomicPersistenceMutation({
        operation: 'persistData',
        affectedStorageKeys: [storageKey],
        captureUndo: true,
        mutate: () => {
          writeSessionStorageValue(storageKey, built.serialized);
          if (options?.undoOrigin) {
            // Ren værdi-commit uden atomisk parret clear. Den bruges stadig af TABELCELLERs value-commit
            // (celle-stien rydder sin fuldt kvalificerede invalidDraft separat, indtil Fase 4/Trin III-IV
            // konsoliderer grid-finalize) samt af immediate-commit-widgets. Marker derfor value-commit'et,
            // så en efterfølgende parret clear i samme flow coalescer til ét frame (undo-frame-semantik).
            // Felt-stien går IKKE her længere — den bruger den atomiske finalize-gren ovenfor med ét capture.
            undoRedoStore.getState().captureValueCommit(options.undoOrigin);
          }
          formPersistenceStore.getState().commitSection(pageKey, built.validatedData, {
            lastCommittedAt: Date.now(),
          });
        },
      });
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
  }, [computeNextInvalidDrafts, emitUserNotice, writeInvalidDraftChanges]);

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

  /**
   * Ryd forældreløse celle-`invalidDrafts` i én sektion (drafts hvis række/scope er slettet, så ingen
   * monteret celle længere kan rydde dem — ellers blokerer de Gem som et spøgelses-mål uden synligt felt).
   *
   * Atomisk på tværs af store + sessionStorage med samme fail-closed rollback som `writeInvalidDraft`,
   * men fanger BEVIDST ingen undo-frame: det er housekeeping (parallel til `useTableCellErrorTracker`s
   * read-time-filtrering), og selve sletningens egen frame bærer allerede draften, så undo gendanner den.
   */
  const reconcileInvalidDrafts = React.useCallback(
    (pageKey: StorageKey, isOrphan: (fieldPath: string) => boolean): boolean => {
      try {
        const current = formPersistenceStore.getState().invalidDrafts[pageKey];
        const orphans = Object.keys(current).filter(isOrphan);
        if (orphans.length === 0) return true;

        const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
        const nextSection = { ...current };
        for (const fieldPath of orphans) {
          delete nextSection[fieldPath];
        }
        const nextCache = { ...formPersistenceStore.getState().invalidDrafts, [pageKey]: nextSection };
        runAtomicPersistenceMutation({
          operation: 'reconcileInvalidDrafts',
          affectedStorageKeys: [invalidDraftsStorageKey],
          mutate: () => {
            writeInvalidDraftsToStorage(nextCache);
            formPersistenceStore.getState().pruneInvalidDraftsForSectionFields(pageKey, orphans);
          },
        });
        return true;
      } catch (error) {
        console.error(`[Persistence] Fejl ved oprydning af forældreløse invalid drafts for '${pageKey}':`, error);
        emitUserNotice(`Kunne ikke rydde forældede input for '${pageKey}' pga. en intern fejl.`, 'error');
        return false;
      }
    },
    [emitUserNotice]
  );

  const replaceAllPersistedData = React.useCallback<ReplaceAllPersistedData>((snapshot) => {
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

    const now = Date.now();
    const toWrite: Array<{ storageKey: string; value: string }> = [];
    const nextCache = createEmptyFormPersistenceSections();

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
      assignFormPersistenceSection(nextCache, pageKey, built.validatedData);
    }

    try {
      runAtomicPersistenceMutation({
        operation: 'replaceAllPersistedData',
        affectedStorageKeys: keysToReplace,
        captureUndo: true,
        mutate: () => {
          for (const key of keysToReplace) {
            removeSessionStorageValue(key);
          }
          for (const { storageKey, value } of toWrite) {
            writeSessionStorageValue(storageKey, value);
          }
          formPersistenceStore.getState().replaceSectionsAndClearFieldErrors(
            nextCache,
            { hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION, lastCommittedAt: Date.now() }
          );
          clearResolvedFieldErrorsCache();
          undoRedoStore.getState().clear();
        },
      });
    } catch (error) {
      throw new Error(`Kunne ikke anvende snapshot atomisk: ${asError(error).message}`);
    }
  }, []);

  /**
   * Slet data for en specifik side
   */
  const clearPageData = React.useCallback((pageKey: StorageKey, options?: { undoOrigin?: HistoryFrameOrigin }): boolean => {
    try {
      const storageKey = getStorageKey(pageKey);
      const invalidDraftsStorageKey = getInvalidDraftsStorageKey();
      const current = formPersistenceStore.getState();
      const hasStateChange = current.sections[pageKey] !== null
        || Object.keys(current.fieldErrors[pageKey]).length > 0
        || Object.keys(current.invalidDrafts[pageKey]).length > 0;
      const nextInvalidDrafts = { ...current.invalidDrafts, [pageKey]: {} };
      runAtomicPersistenceMutation({
        operation: 'clearPageData',
        affectedStorageKeys: [storageKey, invalidDraftsStorageKey],
        captureUndo: hasStateChange && options?.undoOrigin !== undefined,
        mutate: () => {
          removeSessionStorageValue(storageKey);
          writeInvalidDraftsToStorage(nextInvalidDrafts);
          if (hasStateChange && options?.undoOrigin) {
            undoRedoStore.getState().capture(options.undoOrigin);
          }
          formPersistenceStore.getState().resetSection(pageKey, {
            lastCommittedAt: Date.now(),
          });
          clearResolvedFieldErrorsCache();
        },
      });
      return true;
    } catch (error) {
      emitUserNotice(`Kunne ikke slette data for '${pageKey}'. Ingen data blev ændret.`, 'error');
      console.error(`[Persistence] Fejl ved sletning af data for '${pageKey}':`, error);
      return false;
    }
  }, [emitUserNotice]);

  /**
   * Slet alle gemte Mineo-data og Mineo-ejet session-UI-state.
   *
   * Bruger manifest til kun at slette kendte keys.
   */
  const clearAllData = React.useCallback(() => {
    try {
      // Slet alt skal føles som en frisk browser-session for Mineo. Derfor ryddes også UI-sessionstate
      // som aktive faner; ellers kan brugeren lande på en tidligere fane efter et fuldt reset.
      const storageKeys = getKnownStorageKeys(listSessionStorageKeys());
      runAtomicPersistenceMutation({
        operation: 'clearAllData',
        affectedStorageKeys: storageKeys,
        captureUndo: true,
        mutate: () => {
          storageKeys.forEach(key => {
            removeSessionStorageValue(key);
          });
          formPersistenceStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION, lastCommittedAt: Date.now() });
          clearResolvedFieldErrorsCache();
          undoRedoStore.getState().clear();
        },
      });
    } catch (error) {
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
      reconcileInvalidDrafts,
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
      reconcileInvalidDrafts,
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
