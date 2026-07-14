import React from 'react';
import { PERSISTED_SECTION_KEYS, type PersistedSectionMap } from '../config/persistenceRegistry';
import { getKnownStorageKeys, type StorageKey } from '../config/storageManifest';
import { executeInputTransaction } from '../input/inputTransactionRunner';
import { cancelLegacyGridRejectedClearForAddress } from '../input/legacyGridTransactionBridge';
import { setDevtoolsProviderState } from '../utils/devtoolsMonitor';
import { countFilledFields } from '../utils/dataCollection';
import { buildPersistedSection } from '../utils/buildPersistedSection';
import { formatZodIssues } from '../utils/zodIssueFormatting';
import { listSessionStorageKeys } from '../utils/safeSessionStorage';
import { inputRuntimeStore, type HistoryFrameOrigin } from '../stores/inputRuntimeStore';
import {
  clearResolvedFieldErrorsCache,
  getFieldErrorRevisionSnapshot,
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftForFieldSnapshot,
  getInvalidDraftsForSectionSnapshot,
  getPersistedSectionSnapshot,
  getResolvedFieldErrorsSnapshot,
  getSectionRevisionSnapshot,
} from '../stores/formPersistenceReadModel';
import type {
  FieldErrorsForSection,
  FieldErrorSeverity,
  FieldErrorSource,
  FormFieldError,
} from '../types/fieldErrors';
import { resolveActiveFieldError } from '../types/fieldErrors';
import type { InvalidDraftClear } from '../types/invalidDrafts';
import { FormPersistenceContext } from './FormPersistenceContext.internal';
import type { ReplaceAllPersistedData } from './FormPersistenceContext.shared';
import type { PersistenceRuntime } from '../persistence/persistenceRuntime';

export { initializePersistenceRuntime } from '../persistence/persistenceRuntime';
export type { PersistenceRuntime } from '../persistence/persistenceRuntime';

type Notice = Readonly<{ message: string; type: 'warning' | 'error' }>;

const uniqueClears = (clears: readonly InvalidDraftClear[]): readonly InvalidDraftClear[] =>
  clears.filter((clear, index, all) => all.findIndex(
    (candidate) => candidate.pageKey === clear.pageKey && candidate.fieldPath === clear.fieldPath
  ) === index);

export const FormPersistenceProvider = ({
  children,
  runtime,
}: {
  children: React.ReactNode;
  runtime: PersistenceRuntime;
}) => {
  const [noticeState, setNoticeState] = React.useState<{ epoch: number; notice: Notice | null }>(() => ({
    epoch: 0,
    notice: runtime.notice,
  }));

  React.useEffect(() => {
    setDevtoolsProviderState('FormPersistenceProvider', true);
    return () => setDevtoolsProviderState('FormPersistenceProvider', false);
  }, []);

  const emitUserNotice = React.useCallback((message: string, type: Notice['type'] = 'warning') => {
    setNoticeState((previous) => ({ epoch: previous.epoch + 1, notice: { message, type } }));
  }, []);

  const getPersistedData = React.useCallback(<K extends StorageKey>(pageKey: K): PersistedSectionMap[K] | null =>
    getPersistedSectionSnapshot(pageKey), []);

  const hasAnyData = React.useCallback((): boolean =>
    countFilledFields(inputRuntimeStore.getState().input.sections) > 0, []);

  const writeRejectedChanges = React.useCallback((
    changes: readonly { pageKey: StorageKey; fieldPath: string; draft: string | null }[],
    options?: { undoOrigin?: HistoryFrameOrigin }
  ): boolean => {
    try {
      for (const change of changes) {
        cancelLegacyGridRejectedClearForAddress(change.pageKey, change.fieldPath);
      }
      executeInputTransaction(
        { kind: 'changeRejectedInputs', changes },
        { origin: options?.undoOrigin }
      );
      return true;
    } catch (error) {
      console.error('[Persistence] Afsluttet ugyldigt input kunne ikke gemmes.', error);
      emitUserNotice('Kunne ikke gemme det aktuelle input pga. en intern fejl.', 'error');
      return false;
    }
  }, [emitUserNotice]);

  const persistData = React.useCallback(<K extends StorageKey>(
    pageKey: K,
    data: PersistedSectionMap[K],
    options?: {
      undoOrigin?: HistoryFrameOrigin;
      clearInvalidDraft?: InvalidDraftClear;
      clearInvalidDrafts?: readonly InvalidDraftClear[];
    }
  ): boolean => {
    const built = buildPersistedSection(pageKey, data, Date.now());
    if (!built.ok) {
      const issues = built.error === undefined ? '' : formatZodIssues(built.error.issues, 3);
      console.error(`[Persistence] Sektionen '${pageKey}' kunne ikke valideres.`, built.error);
      emitUserNotice(
        `Kunne ikke gemme data for '${pageKey}' fordi data ikke matcher schema.${issues === '' ? '' : `\n${issues}`}`,
        'error'
      );
      return false;
    }

    const clears = uniqueClears([
      ...(options?.clearInvalidDraft === undefined ? [] : [options.clearInvalidDraft]),
      ...(options?.clearInvalidDrafts ?? []),
    ]);
    try {
      executeInputTransaction({
        kind: 'replaceSection',
        section: pageKey,
        value: built.validatedData,
        rejectedChanges: clears.map((clear) => ({ ...clear, draft: null })),
      }, { origin: options?.undoOrigin });
      return true;
    } catch (error) {
      console.error(`[Persistence] Data for '${pageKey}' kunne ikke gemmes.`, error);
      emitUserNotice(`Kunne ikke gemme data for '${pageKey}' pga. en intern fejl.`, 'error');
      return false;
    }
  }, [emitUserNotice]);

  const commitInvalidDraft = React.useCallback((
    pageKey: StorageKey,
    fieldPath: string,
    rawDraft: string,
    options?: { undoOrigin?: HistoryFrameOrigin }
  ): boolean => writeRejectedChanges([{ pageKey, fieldPath, draft: rawDraft }], options), [writeRejectedChanges]);

  const clearInvalidDraft = React.useCallback((
    pageKey: StorageKey,
    fieldPath: string,
    options?: { undoOrigin?: HistoryFrameOrigin }
  ): boolean => writeRejectedChanges([{ pageKey, fieldPath, draft: null }], options), [writeRejectedChanges]);

  const reconcileInvalidDrafts = React.useCallback((
    pageKey: StorageKey,
    isOrphan: (fieldPath: string) => boolean
  ): boolean => {
    const fieldPaths = Object.keys(getInvalidDraftsForSectionSnapshot(pageKey)).filter(isOrphan);
    if (fieldPaths.length === 0) return true;
    try {
      executeInputTransaction(
        { kind: 'pruneRejectedInputs', section: pageKey, fieldPaths },
        { history: 'preserve' }
      );
      return true;
    } catch (error) {
      console.error(`[Persistence] Forældede input for '${pageKey}' kunne ikke ryddes.`, error);
      emitUserNotice(`Kunne ikke rydde forældede input for '${pageKey}' pga. en intern fejl.`, 'error');
      return false;
    }
  }, [emitUserNotice]);

  const replaceAllPersistedData = React.useCallback<ReplaceAllPersistedData>((snapshot) => {
    for (const key of PERSISTED_SECTION_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
        throw new Error(`Snapshot mangler key '${key}'.`);
      }
    }
    try {
      executeInputTransaction({ kind: 'replaceCase', sections: snapshot }, { history: 'clear' });
      clearResolvedFieldErrorsCache();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Kunne ikke anvende snapshot atomisk: ${message}`);
    }
  }, []);

  const clearPageData = React.useCallback((
    pageKey: StorageKey,
    options?: { undoOrigin?: HistoryFrameOrigin }
  ): boolean => {
    try {
      executeInputTransaction({ kind: 'resetSection', section: pageKey }, { origin: options?.undoOrigin });
      clearResolvedFieldErrorsCache();
      return true;
    } catch (error) {
      console.error(`[Persistence] Data for '${pageKey}' kunne ikke slettes.`, error);
      emitUserNotice(`Kunne ikke slette data for '${pageKey}'. Ingen data blev ændret.`, 'error');
      return false;
    }
  }, [emitUserNotice]);

  const clearAllData = React.useCallback(() => {
    try {
      const storageKeys = getKnownStorageKeys(listSessionStorageKeys());
      executeInputTransaction(
        { kind: 'clearCase' },
        { history: 'clear', additionalStorageKeysToRemove: storageKeys }
      );
      clearResolvedFieldErrorsCache();
    } catch (error) {
      console.error('[Persistence] Alle sagsdata kunne ikke slettes.', error);
      emitUserNotice('Kunne ikke slette alle sagsdata. Ingen data blev ændret.', 'error');
    }
  }, [emitUserNotice]);

  const getFieldErrorsBySource = React.useCallback(<K extends StorageKey>(pageKey: K) =>
    getFieldErrorsBySourceSnapshot(pageKey) as FieldErrorsForSection<K>, []);
  const getFieldErrors = React.useCallback(<K extends StorageKey>(pageKey: K) =>
    getResolvedFieldErrorsSnapshot(pageKey) as Partial<Record<string, FormFieldError>>, []);
  const getFieldError = React.useCallback(<K extends StorageKey>(pageKey: K, fieldName: string) => {
    const errors = getFieldErrorsBySourceSnapshot(pageKey) as FieldErrorsForSection<K>;
    return errors[fieldName] === undefined ? undefined : resolveActiveFieldError(errors[fieldName]);
  }, []);
  const setFieldError = React.useCallback(<K extends StorageKey>(
    pageKey: K,
    fieldName: string,
    source: FieldErrorSource,
    error: { message: string; severity: FieldErrorSeverity; blocksSave?: boolean } | null
  ) => inputRuntimeStore.getState().setFieldError(pageKey, fieldName, source, error), []);
  const clearFieldErrors = React.useCallback((pageKey: StorageKey) =>
    inputRuntimeStore.getState().clearFieldErrorsForSection(pageKey), []);
  const clearAllFieldErrors = React.useCallback(() => inputRuntimeStore.getState().clearAllFieldErrors(), []);

  const value = React.useMemo(() => ({
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
    getInvalidDraft: getInvalidDraftForFieldSnapshot,
    getInvalidDraftsForSection: getInvalidDraftsForSectionSnapshot,
    reconcileInvalidDrafts,
    getSectionRevision: getSectionRevisionSnapshot,
    getFieldErrorRevision: getFieldErrorRevisionSnapshot,
    replaceAllPersistedData,
    lastNotice: noticeState.notice,
    lastNoticeEpoch: noticeState.epoch,
  }), [
    clearAllData, clearAllFieldErrors, clearFieldErrors, clearInvalidDraft, clearPageData,
    commitInvalidDraft, getFieldError, getFieldErrors, getFieldErrorsBySource, getPersistedData,
    hasAnyData, noticeState, persistData, reconcileInvalidDrafts, replaceAllPersistedData, setFieldError,
  ]);

  return <FormPersistenceContext.Provider value={value}>{children}</FormPersistenceContext.Provider>;
};
