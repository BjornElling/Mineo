import React from 'react';
import type { MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { SaveValidationError, saveToFile } from '../utils/fileSave';
import { loadFromFile, loadFromFileHandle } from '../utils/fileLoad';
import { deleteFileHandleFromIndexedDB } from '../utils/fileHandleStorage';
import { resolveDefaultDirectoryHandle } from '../utils/fileHelpers';
import {
  commitPendingInputBeforeSave,
  prepareForCriticalDataReplacement,
  restoreFocusIfPossible,
} from '../utils/commitFlush';
import { persistenceSchemas } from '../config/persistenceRegistry';
import { UI_STORAGE_KEYS, type StorageKey } from '../config/storageManifest';
import type { LoadFileResult, SaveFileResult } from '../types/fileOperations';
import { type PwaFileOpenRequest } from '../utils/pwaLaunchQueue';
import { getUserMessage, isCalculationError } from '../utils/errorMessages';
import { EncryptionError } from '../utils/encryption';
import type { AppSettings } from '../settings/appSettingsSchema';
import { executePersistenceLoadApply } from '../utils/persistenceLoadApply';
import {
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../utils/safeSessionStorage';

export type OverlayData = {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
};

export type PendingOverwriteApply = {
  result: LoadFileResult;
  overlay: OverlayData;
  navigateToStamdataAfterApply: boolean;
};

export type PendingLoadApply = {
  result: LoadFileResult;
  navigateToStamdataAfterApply: boolean;
};

export type PwaLoadOutcome = 'cancelled' | 'preflight' | 'awaitingUser' | 'applied' | 'error';

type UseFileSaveLoadArgs = {
  settings: AppSettings;
  navigate: NavigateFunction;
  combinedSectionRevisionRef: MutableRefObject<number>;
  markSaved: (revision: number) => void;
  hasBlockingInputErrors: () => boolean;
  getPersistedData: <K extends StorageKey>(pageKey: K) => unknown;
  replaceAllPersistedData: (snapshot: Record<StorageKey, unknown | undefined>) => void;
  clearAllData: () => void;
  hasAnyData: () => boolean;
  allowExitWithoutWarning: () => void;
  showOverlay: (overlay: OverlayData) => void;
  markUserFeedback: () => void;
};

type UseFileSaveLoadResult = {
  pendingLoadResult: PendingLoadApply | null;
  setPendingLoadResult: React.Dispatch<React.SetStateAction<PendingLoadApply | null>>;
  pendingOverwriteApply: PendingOverwriteApply | null;
  setPendingOverwriteApply: React.Dispatch<React.SetStateAction<PendingOverwriteApply | null>>;
  pendingPreflight: LoadFileResult['preflightWarning'] | undefined;
  pendingPreflightBugReportError: Error | null;
  handleGem: () => Promise<void>;
  handleHent: () => Promise<void>;
  handleSletAlt: () => Promise<void>;
  handleLoadDespiteIssues: () => Promise<void>;
  handleConfirmOverwriteApply: () => Promise<void>;
  handleHentFromPwaRequest: (request: PwaFileOpenRequest) => Promise<PwaLoadOutcome>;
};

const LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE = 'Kan ikke indlæse fil: afslut eller ret det aktive felt først.';

const resolveSaveError = (error: unknown): OverlayData => {
  if (error instanceof SaveValidationError) {
    return {
      message: error.message,
      type: 'warning',
    };
  }

  return {
    message: (error as Error)?.message || 'Kunne ikke gemme fil',
    type: 'error',
  };
};

const resolveLoadError = (error: unknown): { message: string; expected: boolean } => {
  if (error instanceof Error && isCalculationError(error) && error.code === 'FILE_LOAD_FAILED') {
    const expected = error.cause instanceof EncryptionError;
    return { message: getUserMessage(error), expected };
  }
  if (error instanceof Error) {
    return { message: error.message || 'Kunne ikke hente fil', expected: false };
  }
  return { message: 'Kunne ikke hente fil', expected: false };
};

const buildPreflightBugReportError = (result: LoadFileResult): Error => {
  const warning = result.preflightWarning;
  if (!warning) {
    return new Error('Hent fil: Ingen preflight advarsel (uventet).');
  }

  const issues = warning.issues.slice(0, 30).map((issue) => `- ${issue.path}: ${issue.reason}`).join('\n');
  const suffix = warning.issues.length > 30 ? `\n... +${warning.issues.length - 30} flere` : '';
  const expected = warning.expectedCount ?? -1;
  const failed = warning.failedCount ?? -1;

  return new Error(
    [
      'Hent fil: Preflight advarsel',
      `Fil: ${result.filename ?? '(ukendt)'}`,
      `Forventet: ${expected === -1 ? 'ukendt' : String(expected)}`,
      `Indlæst: ${String(warning.loadedCount)}`,
      `Fejlede: ${failed === -1 ? 'ukendt' : String(failed)}`,
      '',
      'Problemer:',
      issues + suffix,
    ].join('\n'),
  );
};

export const useFileSaveLoad = ({
  settings,
  navigate,
  combinedSectionRevisionRef,
  markSaved,
  hasBlockingInputErrors,
  getPersistedData,
  replaceAllPersistedData,
  clearAllData,
  hasAnyData,
  allowExitWithoutWarning,
  showOverlay,
  markUserFeedback,
}: UseFileSaveLoadArgs): UseFileSaveLoadResult => {
  const [pendingLoadResult, setPendingLoadResult] = React.useState<PendingLoadApply | null>(null);
  const [pendingOverwriteApply, setPendingOverwriteApply] = React.useState<PendingOverwriteApply | null>(null);

  const applyLoadedSnapshot = React.useCallback(async (result: LoadFileResult) => {
    await executePersistenceLoadApply({
      result,
      replaceAllPersistedData,
    });
  }, [replaceAllPersistedData]);

  const requestApplyLoadedSnapshot = React.useCallback(async (
    result: LoadFileResult,
    overlayData: OverlayData,
    navigateToStamdataAfterApply: boolean,
  ): Promise<'applied' | 'awaitingUser'> => {
    if (hasAnyData()) {
      setPendingOverwriteApply({ result, overlay: overlayData, navigateToStamdataAfterApply });
      return 'awaitingUser';
    }

    await applyLoadedSnapshot(result);
    markUserFeedback();
    showOverlay(overlayData);
    if (navigateToStamdataAfterApply) {
      navigate('/stamdata', { replace: true });
    }
    return 'applied';
  }, [applyLoadedSnapshot, hasAnyData, markUserFeedback, navigate, showOverlay]);

  const handleGem = React.useCallback(async () => {
    const focusTargetBeforeSave = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    try {
      const commitFlush = await commitPendingInputBeforeSave();
      const hasInputErrors = hasBlockingInputErrors();
      if (!commitFlush.ok || hasInputErrors) {
        if (commitFlush.ok) {
          restoreFocusIfPossible(focusTargetBeforeSave);
        }
        markUserFeedback();
        showOverlay({
          message: 'Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.',
          type: 'warning',
        });
        return;
      }

      const snapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
        const pageKey = key as StorageKey;
        const value = getPersistedData(pageKey);
        acc[pageKey] = value ?? undefined;
        return acc;
      }, {} as Record<StorageKey, unknown | undefined>);
      const snapshotRevision = combinedSectionRevisionRef.current;
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);
      const result: SaveFileResult = await saveToFile(snapshot, resolvedDirectory);

      if (result.cancelled) {
        restoreFocusIfPossible(focusTargetBeforeSave);
        return;
      }

      if (result.success) {
        restoreFocusIfPossible(focusTargetBeforeSave);
        markSaved(snapshotRevision);
        markUserFeedback();
        showOverlay({
          message: result.warning ? `Gemt med advarsel\n\n${result.warning}` : 'Gemt',
          type: result.warning ? 'warning' : 'success',
        });
      }
    } catch (error) {
      restoreFocusIfPossible(focusTargetBeforeSave);
      const overlay = resolveSaveError(error);
      if (!(error instanceof SaveValidationError)) {
        console.error('Gem fejlede:', error);
      }
      markUserFeedback();
      showOverlay(overlay);
    }
  }, [combinedSectionRevisionRef, getPersistedData, hasBlockingInputErrors, markSaved, markUserFeedback, settings, showOverlay]);

  const handleHent = React.useCallback(async () => {
    const loadGuard = await prepareForCriticalDataReplacement();
    if (!loadGuard.ok) {
      markUserFeedback();
      showOverlay({
        message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
        type: 'warning',
      });
      return;
    }

    try {
      setPendingLoadResult(null);
      setPendingOverwriteApply(null);
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);
      const result: LoadFileResult = await loadFromFile(resolvedDirectory);

      if (result.cancelled) {
        restoreFocusIfPossible(loadGuard.focusTargetBeforeAction);
        return;
      }

      if (result.success) {
        if (result.preflightWarning) {
          setPendingLoadResult({ result, navigateToStamdataAfterApply: true });
          return;
        }

        await requestApplyLoadedSnapshot(result, { message: 'Hentet', type: 'success' }, true);
      }
    } catch (error) {
      restoreFocusIfPossible(loadGuard.focusTargetBeforeAction);
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent fejlede:', error);
      }
      markUserFeedback();
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
    }
  }, [markUserFeedback, requestApplyLoadedSnapshot, settings, showOverlay]);

  const handleHentFromPwaRequest = React.useCallback(async (request: PwaFileOpenRequest): Promise<PwaLoadOutcome> => {
    const loadGuard = await prepareForCriticalDataReplacement();
    if (!loadGuard.ok) {
      markUserFeedback();
      showOverlay({
        message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
        type: 'warning',
      });
      return 'error';
    }

    try {
      setPendingLoadResult(null);
      setPendingOverwriteApply(null);
      const result: LoadFileResult = await loadFromFileHandle(request.fileHandle, { requestId: request.id });

      if (result.cancelled) {
        restoreFocusIfPossible(loadGuard.focusTargetBeforeAction);
        return 'cancelled';
      }

      if (result.success) {
        if (result.preflightWarning) {
          setPendingLoadResult({ result, navigateToStamdataAfterApply: true });
          return 'preflight';
        }

        const ignoredSuffix = request.ignoredFileCount > 0
          ? `\n\nBemærk: ${request.ignoredFileCount} yderligere fil(er) blev ignoreret.`
          : '';
        const outcome = await requestApplyLoadedSnapshot(
          result,
          { message: `Hentet${ignoredSuffix}`, type: request.ignoredFileCount > 0 ? 'warning' : 'success' },
          true,
        );
        return outcome === 'awaitingUser' ? 'awaitingUser' : 'applied';
      }

      return 'error';
    } catch (error) {
      restoreFocusIfPossible(loadGuard.focusTargetBeforeAction);
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent (PWA) fejlede:', error);
      }
      markUserFeedback();
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
      return 'error';
    }
  }, [markUserFeedback, requestApplyLoadedSnapshot, showOverlay]);

  const handleLoadDespiteIssues = React.useCallback(async () => {
    const pending = pendingLoadResult;
    if (!pending) return;
    setPendingLoadResult(null);
    setPendingOverwriteApply(null);

    try {
      await requestApplyLoadedSnapshot(
        pending.result,
        { message: 'Hentet (med fejl)', type: 'warning' },
        pending.navigateToStamdataAfterApply,
      );
    } catch (error) {
      console.error('Hent (trods fejl) fejlede:', error);
      markUserFeedback();
      showOverlay({
        message: (error as Error)?.message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, [markUserFeedback, pendingLoadResult, requestApplyLoadedSnapshot, showOverlay]);

  const handleConfirmOverwriteApply = React.useCallback(async () => {
    const pending = pendingOverwriteApply;
    if (!pending) return;
    setPendingOverwriteApply(null);

    try {
      await applyLoadedSnapshot(pending.result);
      markUserFeedback();
      showOverlay(pending.overlay);
      if (pending.navigateToStamdataAfterApply) {
        navigate('/stamdata', { replace: true });
      }
    } catch (error) {
      console.error('Overskriv og hent fejlede:', error);
      markUserFeedback();
      showOverlay({
        message: (error as Error)?.message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, [applyLoadedSnapshot, markUserFeedback, navigate, pendingOverwriteApply, showOverlay]);

  const handleSletAlt = React.useCallback(async () => {
    const focusTargetBeforeDeleteAll = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const confirmed = window.confirm(
      'ADVARSEL: Dette vil slette alle indtastede oplysninger!\n\nEr du sikker på at du vil fortsætte?',
    );

    if (!confirmed) {
      restoreFocusIfPossible(focusTargetBeforeDeleteAll);
      return;
    }

    try {
      clearAllData();
      removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename);
      removeOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilenameBasis);
      await deleteFileHandleFromIndexedDB();
      writeOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay, JSON.stringify({
        message: 'Alt data slettet',
        type: 'info',
        isUserFeedback: true,
      }));
      allowExitWithoutWarning();
      window.location.href = '/stamdata';
    } catch (error) {
      restoreFocusIfPossible(focusTargetBeforeDeleteAll);
      console.error('Slet alt fejlede:', error);
      markUserFeedback();
      showOverlay({
        message: 'Kunne ikke slette data',
        type: 'error',
      });
    }
  }, [allowExitWithoutWarning, clearAllData, markUserFeedback, showOverlay]);

  const pendingPreflight = pendingLoadResult?.result.preflightWarning;
  const pendingPreflightBugReportError = React.useMemo(() => {
    return pendingLoadResult ? buildPreflightBugReportError(pendingLoadResult.result) : null;
  }, [pendingLoadResult]);

  return {
    pendingLoadResult,
    setPendingLoadResult,
    pendingOverwriteApply,
    setPendingOverwriteApply,
    pendingPreflight,
    pendingPreflightBugReportError,
    handleGem,
    handleHent,
    handleSletAlt,
    handleLoadDespiteIssues,
    handleConfirmOverwriteApply,
    handleHentFromPwaRequest,
  };
};
