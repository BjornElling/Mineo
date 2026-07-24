import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { SaveValidationError, saveToFile } from '../utils/fileSave';
import { loadFromFile, loadFromFileHandle } from '../utils/fileLoad';
import { deleteFileHandleFromIndexedDB } from '../utils/fileHandleStorage';
import { resolveDefaultDirectoryHandle } from '../utils/fileHelpers';
import { restoreFocusIfPossible } from '../utils/focusUtils';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import type {
  ApplicableLoadFileResult,
  LoadFileResult,
  LoadPreflightWarning,
  PreflightFileResult,
  SaveFileResult,
} from '../types/fileOperations';
import {
  markPendingPwaFileOpenRequestHandled,
  type PwaFileOpenRequest,
} from '../utils/pwaLaunchQueue';
import { getUserMessage, isCalculationError } from '../utils/errorMessages';
import { asError } from '../utils/typeGuards';
import { EncryptionError } from '../utils/encryption';
import type { AppSettings } from '../settings/appSettingsSchema';
import { executePersistenceLoadApply, type PersistenceLoadApplyResult } from '../utils/persistenceLoadApply';
import type { SaveSnapshot } from '../utils/fileSaveTypes';
import {
  removeOptionalSessionStorageValue,
  writeOptionalSessionStorageValue,
} from '../utils/safeSessionStorage';
import { focusFirstBlockingRejectedField } from '../inputCore/react/greenfieldSaveBlockedFocus';
import type { CaseOperations } from '../inputCore/react/useCaseOperations';
import type { CriticalActionCoordinator } from '../inputCore/runtime/criticalActionCoordinator';
import { logWarning } from '../utils/logger';

// Greenfield-shell-use-case (WI-002 trin 2, §1.4/§3.9/§3.10): save/load/`Slet alt` mod greenfield-runtime.
// Det PUBLIC interface (`UseFileSaveLoadResult`) er bevaret uændret, så `MainLayout`/`usePwaLaunchQueue` og
// dialogerne er urørte. Til forskel fra legacy:
//  - `.eo`-save går gennem `ops.file.evaluateSave()` (rejected råinput blokerer; canonical bounds-fejl kan gemmes,
//    §1.6), ikke gennem en field-error-store-scanning.
//  - Load/`Slet alt` routes gennem greenfield-`CriticalActionCoordinator` + den ene replacement-command
//    (`ops.file.applyLoadedSnapshot` / `ops.reset.clearAll`), aldrig gennem legacy `replaceAllPersistedData`.
//  - Den rebasede §1.4-matrix har INGEN `block`-policy for load: `prepare('load')` settler ikke og blokerer
//    aldrig. Fokus-før-handling fanges her i use-casen via `document.activeElement`, fordi greenfield `prepare`
//    ikke længere returnerer et `focusTargetBeforeAction`.

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

export type PwaLoadOutcome = 'busy' | 'cancelled' | 'preflight' | 'awaitingUser' | 'applied' | 'error';

type FileOperationKind = 'save' | 'manual-load' | 'pwa-load';

type UseFileSaveLoadArgs = {
  settings: AppSettings;
  navigate: NavigateFunction;
  currentPathname: string;
  /** Greenfield case-porte (`.eo`-save-evaluering, load-apply, `hasAnyData`, `Slet alt`). */
  ops: CaseOperations;
  /** Greenfield kritisk-handlings-barriere fra samme binding som portene (settle/replace/no-op, §1.4). */
  criticalActions: CriticalActionCoordinator;
  /** Markér den gemte revision som ny "unsaved changes"-baseline (§ unsaved-guard). Modtager save-tokenets inputrevision. */
  markSaved: (revision: number) => void;
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
  fileOperationInProgress: boolean;
  isFileOperationInProgress: () => boolean;
};

const LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE = 'Kan ikke indlæse fil: afslut eller ret det aktive felt først.';
const FILE_OPERATION_IN_PROGRESS_MESSAGE = 'En filhandling er allerede i gang.';

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

/** Fanger det aktuelt fokuserede element FØR en kritisk handling (greenfield `prepare` bærer det ikke længere). */
const captureActiveElement = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement ? document.activeElement : null;

export const useFileSaveLoad = ({
  settings,
  navigate,
  currentPathname,
  ops,
  criticalActions,
  markSaved,
  allowExitWithoutWarning,
  showOverlay,
}: UseFileSaveLoadArgs): UseFileSaveLoadResult => {
  const [loadFlow, setLoadFlow] = React.useState<LoadFlowState>({ phase: 'idle' });
  const activeFileOperationRef = React.useRef<FileOperationKind | null>(null);
  const [activeFileOperation, setActiveFileOperation] = React.useState<FileOperationKind | null>(null);

  const beginFileOperation = React.useCallback((kind: FileOperationKind, showBusyWarning: boolean): boolean => {
    if (activeFileOperationRef.current !== null) {
      if (showBusyWarning) {
        showOverlay({ message: FILE_OPERATION_IN_PROGRESS_MESSAGE, type: 'warning' });
      }
      return false;
    }
    activeFileOperationRef.current = kind;
    setActiveFileOperation(kind);
    return true;
  }, [showOverlay]);

  const finishFileOperation = React.useCallback((): void => {
    activeFileOperationRef.current = null;
    setActiveFileOperation(null);
  }, []);

  const isFileOperationInProgress = React.useCallback(
    (): boolean => activeFileOperationRef.current !== null,
    [],
  );

  // Load-apply routes gennem greenfield-replacement-grænsen: `ops.file.applyLoadedSnapshot` udsteder den ene
  // autoritative `replaceCase`-command, indpakket i coordinatorens `applyReplacement` (no-settle, draften
  // kasseres først efter et succesfuldt apply, §1.4/§7). `executePersistenceLoadApply` ejer fortsat metadata-,
  // filhåndtags- og PWA-synkroniseringen (§4.1).
  const applyLoadedSnapshot = React.useCallback(async (result: ApplicableLoadFileResult): Promise<PersistenceLoadApplyResult> => {
    return criticalActions.applyReplacement(() => executePersistenceLoadApply({
      result,
      applySnapshot: ops.file.applyLoadedSnapshot,
    }));
  }, [criticalActions, ops.file]);

  const requestApplyLoadedSnapshot = React.useCallback(async (
    result: ApplicableLoadFileResult,
    overlayData: OverlayData,
    navigateToStamdataAfterApply: boolean,
  ): Promise<'applied' | 'awaitingUser'> => {
    if (ops.file.hasAnyData()) {
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
  }, [applyLoadedSnapshot, navigate, ops.file, showOverlay]);

  const handleGem = React.useCallback(async () => {
    if (!beginFileOperation('save', true)) return;
    const focusBeforeAction = captureActiveElement();
    try {
      // §1.4: save settler først den åbne editor. Et fail-closed `blocked` (uventet settle-fejl) fokuserer
      // settle-målet og stopper; et fejlende settle er derimod ikke en blokering (fejlen fanges af evaluateSave).
      const preparation = await criticalActions.prepare('save');
      if (preparation.status === 'blocked') {
        preparation.target?.focus();
        showOverlay({
          message: 'Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.',
          type: 'warning',
        });
        return;
      }

      // §3.9: evaluér `.eo`-save mod et frisk kildesnapshot. Blokeres KUN af aktivt relevant rejected råinput;
      // canonical bounds/rule-fejl og manglende felter tillader save (§1.6).
      const saveOutcome = ops.file.evaluateSave();
      if (saveOutcome.status === 'blocked') {
        void focusFirstBlockingRejectedField(saveOutcome.rejectedAddresses, currentPathname, navigate);
        showOverlay({
          message: 'Kan ikke gemme: Der er ugyldige felter. Ret felter med rød markering, og prøv igen.',
          type: 'warning',
        });
        return;
      }

      // `SaveSnapshot === PersistedSectionsSnapshot`, så save-projektionens snapshot går uændret til `saveToFile`.
      const snapshot: SaveSnapshot = saveOutcome.snapshot;
      const savedInputRevision = Number(saveOutcome.token.inputRevision);
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);
      const result: SaveFileResult = await saveToFile(snapshot, resolvedDirectory);

      if (result.status === 'cancelled') {
        focusBeforeAction?.focus();
        return;
      }

      focusBeforeAction?.focus();
      markSaved(savedInputRevision);
      showOverlay({
        message: result.warning ? `Gemt med advarsel\n\n${result.warning}` : 'Gemt',
        type: result.warning ? 'warning' : 'success',
      });
    } catch (error) {
      focusBeforeAction?.focus();
      const overlay = resolveSaveError(error);
      if (!(error instanceof SaveValidationError)) {
        console.error('Gem fejlede:', error);
      }
      showOverlay(overlay);
    } finally {
      finishFileOperation();
    }
  }, [
    beginFileOperation,
    criticalActions,
    currentPathname,
    ops.file,
    finishFileOperation,
    markSaved,
    navigate,
    settings,
    showOverlay,
  ]);

  const handleHent = React.useCallback(async () => {
    if (!beginFileOperation('manual-load', true)) return;
    let awaitsUserDecision = false;
    const focusBeforeAction = captureActiveElement();

    try {
      // §1.4: load settler ALDRIG og blokerer aldrig — den åbne draft kasseres først, hvis apply lykkes.
      // Coordinatorens `prepare('load')` er `replace`-policy; et uventet fail-closed `blocked` fokuserer målet.
      const preparation = await criticalActions.prepare('load');
      if (preparation.status === 'blocked') {
        preparation.target?.focus();
        showOverlay({
          message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
          type: 'warning',
        });
        return;
      }

      setLoadFlow({ phase: 'idle' });
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);
      const result: LoadFileResult = await loadFromFile(resolvedDirectory);

      if (result.status === 'cancelled') {
        focusBeforeAction?.focus();
        return;
      }

      if (result.status === 'preflight') {
        setLoadFlow({ phase: 'preflight', result, navigateToStamdataAfterApply: true });
        awaitsUserDecision = true;
        return;
      }

      awaitsUserDecision = (await requestApplyLoadedSnapshot(
        result,
        { message: 'Hentet', type: 'success' },
        true,
      )) === 'awaitingUser';
    } catch (error) {
      focusBeforeAction?.focus();
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent fejlede:', error);
      }
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
    } finally {
      if (!awaitsUserDecision) finishFileOperation();
    }
  }, [beginFileOperation, criticalActions, finishFileOperation, requestApplyLoadedSnapshot, settings, showOverlay]);

  const handleHentFromPwaRequest = React.useCallback(async (request: PwaFileOpenRequest): Promise<PwaLoadOutcome> => {
    if (!beginFileOperation('pwa-load', false)) return 'busy';
    let awaitsUserDecision = false;
    const focusBeforeAction = captureActiveElement();

    try {
      const preparation = await criticalActions.prepare('load');
      if (preparation.status === 'blocked') {
        preparation.target?.focus();
        showOverlay({
          message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
          type: 'warning',
        });
        return 'error';
      }

      setLoadFlow({ phase: 'idle' });
      const result: LoadFileResult = await loadFromFileHandle(request.fileHandle, { requestId: request.id });

      if (result.status === 'cancelled') {
        focusBeforeAction?.focus();
        return 'cancelled';
      }

      if (result.status === 'preflight') {
        setLoadFlow({ phase: 'preflight', result, navigateToStamdataAfterApply: true });
        awaitsUserDecision = true;
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
      awaitsUserDecision = outcome === 'awaitingUser';
      return outcome === 'awaitingUser' ? 'awaitingUser' : 'applied';
    } catch (error) {
      focusBeforeAction?.focus();
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent (PWA) fejlede:', error);
      }
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
      return 'error';
    } finally {
      if (!awaitsUserDecision) finishFileOperation();
    }
  }, [beginFileOperation, criticalActions, finishFileOperation, requestApplyLoadedSnapshot, showOverlay]);

  const handleLoadDespiteIssues = React.useCallback(async () => {
    if (loadFlow.phase !== 'preflight') return;
    const pending = loadFlow;
    let awaitsOverwriteDecision = false;
    // Tilbage til idle; requestApplyLoadedSnapshot kan derefter selv føre flowet videre til
    // overwrite-bekræftelse, hvis der allerede findes data.
    setLoadFlow({ phase: 'idle' });

    try {
      awaitsOverwriteDecision = (await requestApplyLoadedSnapshot(
        pending.result,
        { message: 'Filen er indlæst — nogle felter blev sat til standardværdier.', type: 'warning' },
        pending.navigateToStamdataAfterApply,
      )) === 'awaitingUser';
    } catch (error) {
      console.error('Hent (trods fejl) fejlede:', error);
      showOverlay({
        message: asError(error).message || 'Kunne ikke hente fil',
        type: 'error',
      });
    } finally {
      if (!awaitsOverwriteDecision) finishFileOperation();
    }
  }, [finishFileOperation, loadFlow, requestApplyLoadedSnapshot, showOverlay]);

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
    } finally {
      finishFileOperation();
    }
  }, [applyLoadedSnapshot, finishFileOperation, navigate, loadFlow, showOverlay]);

  const handleSletAlt = React.useCallback(async () => {
    const focusTargetBeforeDeleteAll = captureActiveElement();
    const confirmed = window.confirm(
      'ADVARSEL: Dette vil slette alle indtastede oplysninger!\n\nEr du sikker på at du vil fortsætte?',
    );

    if (!confirmed) {
      restoreFocusIfPossible(focusTargetBeforeDeleteAll);
      return;
    }

    try {
      // §7/§1.12: `Slet alt` gennem greenfield-replacement-grænsen (no-settle; draften kasseres først ved
      // succes) — dette er også recovery-vejen ud af en `writesBlocked` current-session.
      await ops.reset.clearAll();
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
  }, [allowExitWithoutWarning, ops.reset, showOverlay]);

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
    const requestId = loadFlow.phase === 'idle' ? undefined : loadFlow.result.requestId;
    setLoadFlow({ phase: 'idle' });
    finishFileOperation();
    if (requestId) {
      // Id-betinget oprydning bevarer en nyere PWA-request, som kan være ankommet,
      // mens den nu afviste fil ventede i preflight-/overskrivelsesdialogen.
      void markPendingPwaFileOpenRequestHandled(requestId).catch((error: unknown) => {
        logWarning('Kunne ikke rydde afvist PWA-fil-request', {
          context: 'useFileSaveLoad.dismissPendingLoad',
          data: { errorMessage: asError(error).message },
        });
      });
    }
  }, [finishFileOperation, loadFlow]);

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
    fileOperationInProgress: activeFileOperation !== null,
    isFileOperationInProgress,
  };
};
