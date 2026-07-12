import React from 'react';
import type { MutableRefObject } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { SaveValidationError, saveToFile } from '../utils/fileSave';
import { loadFromFile, loadFromFileHandle } from '../utils/fileLoad';
import { deleteFileHandleFromIndexedDB } from '../utils/fileHandleStorage';
import { resolveDefaultDirectoryHandle } from '../utils/fileHelpers';
import { restoreFocusIfPossible } from '../utils/focusUtils';
import { PERSISTED_SECTION_KEYS, type PersistedSectionMap } from '../config/persistenceRegistry';
import { UI_STORAGE_KEYS, type StorageKey } from '../config/storageManifest';
import type {
  ApplicableLoadFileResult,
  LoadFileResult,
  LoadPreflightWarning,
  PreflightFileResult,
  SaveFileResult,
} from '../types/fileOperations';
import { type PwaFileOpenRequest } from '../utils/pwaLaunchQueue';
import { getUserMessage, isCalculationError } from '../utils/errorMessages';
import { asError } from '../utils/typeGuards';
import { EncryptionError } from '../utils/encryption';
import type { AppSettings } from '../settings/appSettingsSchema';
import type { ReplaceAllPersistedData } from '../contexts/FormPersistenceContext.shared';
import { executePersistenceLoadApply, type PersistenceLoadApplyResult } from '../utils/persistenceLoadApply';
import type { SaveSnapshot } from '../utils/fileSaveTypes';
import {
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../utils/safeSessionStorage';
import {
  navigateToBlockingInputError,
  type BlockingInputErrorTarget,
} from '../utils/saveBlockedFocus';
import { useCriticalActionCoordinator } from '../criticalActions/CriticalActionContext';
import type { CriticalActionFocusTarget } from '../criticalActions/criticalActionCoordinator';

export type OverlayData = {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
};

export type PendingOverwriteApply = {
  result: ApplicableLoadFileResult;
  overlay: OverlayData;
  navigateToStamdataAfterApply: boolean;
};

export type PendingLoadApply = {
  result: PreflightFileResult;
  navigateToStamdataAfterApply: boolean;
};

/**
 * Load-flowets tilstandsmaskine. Preflight- og overwrite-bekræftelse var tidligere to uafhængige
 * nullable states, hvis kombination (begge sat) er en umulig UI-tilstand. Én diskrimineret kilde
 * gør den ugyldige kombination urepræsenterbar: flowet er altid præcis én af `idle | preflight |
 * overwrite`. De to dialoger afledes read-only herfra (se `pendingLoadResult`/`pendingOverwriteApply`).
 */
type LoadFlowState =
  | { phase: 'idle' }
  | { phase: 'preflight'; result: PreflightFileResult; navigateToStamdataAfterApply: boolean }
  | { phase: 'overwrite'; result: ApplicableLoadFileResult; overlay: OverlayData; navigateToStamdataAfterApply: boolean };

export type PwaLoadOutcome = 'cancelled' | 'preflight' | 'awaitingUser' | 'applied' | 'error';

type UseFileSaveLoadArgs = {
  settings: AppSettings;
  navigate: NavigateFunction;
  combinedSectionRevisionRef: MutableRefObject<number>;
  markSaved: (revision: number) => void;
  getFirstBlockingInputError: () => BlockingInputErrorTarget | null;
  currentPathname: string;
  getPersistedData: <K extends StorageKey>(pageKey: K) => PersistedSectionMap[K] | null;
  replaceAllPersistedData: ReplaceAllPersistedData;
  clearAllData: () => void;
  hasAnyData: () => boolean;
  allowExitWithoutWarning: () => void;
  showOverlay: (overlay: OverlayData) => void;
};

type UseFileSaveLoadResult = {
  pendingLoadResult: PendingLoadApply | null;
  pendingOverwriteApply: PendingOverwriteApply | null;
  /** Afviser den aktive load-dialog (preflight eller overwrite) og fører flowet tilbage til idle. */
  dismissPendingLoad: () => void;
  pendingPreflight: LoadPreflightWarning | undefined;
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
    message: asError(error).message || 'Kunne ikke gemme fil',
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

const buildPreflightBugReportError = (result: PreflightFileResult): Error => {
  const warning = result.preflightWarning;

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
  getFirstBlockingInputError,
  currentPathname,
  getPersistedData,
  replaceAllPersistedData,
  clearAllData,
  hasAnyData,
  allowExitWithoutWarning,
  showOverlay,
}: UseFileSaveLoadArgs): UseFileSaveLoadResult => {
  const criticalActions = useCriticalActionCoordinator();
  const [loadFlow, setLoadFlow] = React.useState<LoadFlowState>({ phase: 'idle' });

  const applyLoadedSnapshot = React.useCallback(async (result: ApplicableLoadFileResult): Promise<PersistenceLoadApplyResult> => {
    return executePersistenceLoadApply({
      result,
      replaceAllPersistedData,
    });
  }, [replaceAllPersistedData]);

  const requestApplyLoadedSnapshot = React.useCallback(async (
    result: ApplicableLoadFileResult,
    overlayData: OverlayData,
    navigateToStamdataAfterApply: boolean,
  ): Promise<'applied' | 'awaitingUser'> => {
    if (hasAnyData()) {
      setLoadFlow({ phase: 'overwrite', result, overlay: overlayData, navigateToStamdataAfterApply });
      return 'awaitingUser';
    }

    const applyResult = await applyLoadedSnapshot(result);
    showOverlay(applyResult.status === 'applied-with-metadata-error'
      ? { message: applyResult.message, type: 'warning' }
      : overlayData);
    if (navigateToStamdataAfterApply) {
      navigate('/stamdata', { replace: true });
    }
    return 'applied';
  }, [applyLoadedSnapshot, hasAnyData, navigate, showOverlay]);

  const handleGem = React.useCallback(async () => {
    let focusTargetBeforeAction: CriticalActionFocusTarget | null = null;
    try {
      const preparation = await criticalActions.prepare('save');
      focusTargetBeforeAction = preparation.focusTargetBeforeAction;
      const blockingInputError = getFirstBlockingInputError();
      if (preparation.status === 'blocked' || blockingInputError !== null) {
        if (preparation.status === 'blocked') {
          preparation.target?.focus();
        } else {
          void navigateToBlockingInputError(blockingInputError, currentPathname, navigate);
        }
        showOverlay({
          message: 'Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.',
          type: 'warning',
        });
        return;
      }

      const snapshot = PERSISTED_SECTION_KEYS.reduce((acc, pageKey) => {
        const value = getPersistedData(pageKey);
        (acc as Record<StorageKey, unknown | undefined>)[pageKey] = value ?? undefined;
        return acc;
      }, {} as SaveSnapshot);
      const snapshotRevision = combinedSectionRevisionRef.current;
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);
      const result: SaveFileResult = await saveToFile(snapshot, resolvedDirectory);

      if (result.status === 'cancelled') {
        preparation.focusTargetBeforeAction?.focus();
        return;
      }

      preparation.focusTargetBeforeAction?.focus();
      markSaved(snapshotRevision);
      showOverlay({
        message: result.warning ? `Gemt med advarsel\n\n${result.warning}` : 'Gemt',
        type: result.warning ? 'warning' : 'success',
      });
    } catch (error) {
      focusTargetBeforeAction?.focus();
      const overlay = resolveSaveError(error);
      if (!(error instanceof SaveValidationError)) {
        console.error('Gem fejlede:', error);
      }
      showOverlay(overlay);
    }
  }, [
    combinedSectionRevisionRef,
    criticalActions,
    currentPathname,
    getFirstBlockingInputError,
    getPersistedData,
    markSaved,
    navigate,
    settings,
    showOverlay,
  ]);

  const handleHent = React.useCallback(async () => {
    const preparation = await criticalActions.prepare('load');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      showOverlay({
        message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
        type: 'warning',
      });
      return;
    }

    try {
      setLoadFlow({ phase: 'idle' });
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);
      const result: LoadFileResult = await loadFromFile(resolvedDirectory);

      if (result.status === 'cancelled') {
        preparation.focusTargetBeforeAction?.focus();
        return;
      }

      if (result.status === 'preflight') {
        setLoadFlow({ phase: 'preflight', result, navigateToStamdataAfterApply: true });
        return;
      }

      await requestApplyLoadedSnapshot(result, { message: 'Hentet', type: 'success' }, true);
    } catch (error) {
      preparation.focusTargetBeforeAction?.focus();
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent fejlede:', error);
      }
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
    }
  }, [criticalActions, requestApplyLoadedSnapshot, settings, showOverlay]);

  const handleHentFromPwaRequest = React.useCallback(async (request: PwaFileOpenRequest): Promise<PwaLoadOutcome> => {
    const preparation = await criticalActions.prepare('load');
    if (preparation.status === 'blocked') {
      preparation.target?.focus();
      showOverlay({
        message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
        type: 'warning',
      });
      return 'error';
    }

    try {
      setLoadFlow({ phase: 'idle' });
      const result: LoadFileResult = await loadFromFileHandle(request.fileHandle, { requestId: request.id });

      if (result.status === 'cancelled') {
        preparation.focusTargetBeforeAction?.focus();
        return 'cancelled';
      }

      if (result.status === 'preflight') {
        setLoadFlow({ phase: 'preflight', result, navigateToStamdataAfterApply: true });
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
    } catch (error) {
      preparation.focusTargetBeforeAction?.focus();
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent (PWA) fejlede:', error);
      }
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
      return 'error';
    }
  }, [criticalActions, requestApplyLoadedSnapshot, showOverlay]);

  const handleLoadDespiteIssues = React.useCallback(async () => {
    if (loadFlow.phase !== 'preflight') return;
    const pending = loadFlow;
    // Tilbage til idle; requestApplyLoadedSnapshot kan derefter selv føre flowet videre til
    // overwrite-bekræftelse, hvis der allerede findes data.
    setLoadFlow({ phase: 'idle' });

    try {
      await requestApplyLoadedSnapshot(
        pending.result,
        { message: 'Filen er indlæst — nogle felter blev sat til standardværdier.', type: 'warning' },
        pending.navigateToStamdataAfterApply,
      );
    } catch (error) {
      console.error('Hent (trods fejl) fejlede:', error);
      showOverlay({
        message: asError(error).message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, [loadFlow, requestApplyLoadedSnapshot, showOverlay]);

  const handleConfirmOverwriteApply = React.useCallback(async () => {
    if (loadFlow.phase !== 'overwrite') return;
    const pending = loadFlow;
    setLoadFlow({ phase: 'idle' });

    try {
      const applyResult = await applyLoadedSnapshot(pending.result);
      showOverlay(applyResult.status === 'applied-with-metadata-error'
        ? { message: applyResult.message, type: 'warning' }
        : pending.overlay);
      if (pending.navigateToStamdataAfterApply) {
        navigate('/stamdata', { replace: true });
      }
    } catch (error) {
      console.error('Overskriv og hent fejlede:', error);
      showOverlay({
        message: asError(error).message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, [applyLoadedSnapshot, navigate, loadFlow, showOverlay]);

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
      }));
      allowExitWithoutWarning();
      window.location.href = '/stamdata';
    } catch (error) {
      restoreFocusIfPossible(focusTargetBeforeDeleteAll);
      console.error('Slet alt fejlede:', error);
      showOverlay({
        message: 'Kunne ikke slette data',
        type: 'error',
      });
    }
  }, [allowExitWithoutWarning, clearAllData, showOverlay]);

  // De to dialog-states afledes read-only fra den ene tilstandsmaskine, så de aldrig kan være
  // sat samtidigt (den ugyldige kombination er urepræsenterbar).
  const pendingLoadResult: PendingLoadApply | null = loadFlow.phase === 'preflight'
    ? { result: loadFlow.result, navigateToStamdataAfterApply: loadFlow.navigateToStamdataAfterApply }
    : null;
  const pendingOverwriteApply: PendingOverwriteApply | null = loadFlow.phase === 'overwrite'
    ? {
        result: loadFlow.result,
        overlay: loadFlow.overlay,
        navigateToStamdataAfterApply: loadFlow.navigateToStamdataAfterApply,
      }
    : null;

  const dismissPendingLoad = React.useCallback(() => {
    setLoadFlow({ phase: 'idle' });
  }, []);

  const pendingPreflight = loadFlow.phase === 'preflight' ? loadFlow.result.preflightWarning : undefined;
  const pendingPreflightBugReportError = React.useMemo(() => {
    return loadFlow.phase === 'preflight' ? buildPreflightBugReportError(loadFlow.result) : null;
  }, [loadFlow]);

  return {
    pendingLoadResult,
    pendingOverwriteApply,
    dismissPendingLoad,
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
