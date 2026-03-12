import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';
import Overlay from '../ui/Overlay';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import BugReportButton from '../errors/BugReportButton';
import DevtoolsIssueNotice from '../errors/DevtoolsIssueNotice';
import { saveToFile } from '../../utils/fileSave';
import { loadFromFile, loadFromFileHandle } from '../../utils/fileLoad';
import { deleteFileHandleFromIndexedDB } from '../../utils/fileHandleStorage';
import { saveFileHandleToIndexedDB } from '../../utils/fileHandleStorage';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { useAppSettings } from '../../contexts/useAppSettings';
import { useEOLoenindkomstInputErrors } from '../../hooks/useEOLoenindkomstInputErrors';
import { resolveDefaultDirectoryHandle } from '../../utils/fileHelpers';
import { getGridCoreForTable } from '../tables/gridCoreRegistry';
import type { SaveFileResult, LoadFileResult } from '../../types/fileOperations';
import { persistenceSchemas } from '../../config/persistenceRegistry';
import { UI_STORAGE_KEYS, type StorageKey } from '../../config/storageManifest';
import { sanitizeLegacyPersistedSectionForAarsloenTables } from '../../utils/aarsloenTableLegacySanitization';
import { MINEO_PWA_FILE_OPEN_EVENT, takeNextPwaFileOpenRequest, type PwaFileOpenRequest } from '../../utils/pwaLaunchQueue';
import {
  getDevtoolsIssueSnapshot,
  startDevtoolsMonitor,
  subscribeDevtoolsIssues,
  setDevtoolsRoute,
  type DevtoolsIssueSnapshot,
} from '../../utils/devtoolsMonitor';
import type { BugReportExtraSection } from '../../utils/bugReport';
import { getUserMessage, isCalculationError } from '../../utils/errorMessages';
import { EncryptionError } from '../../utils/encryption';

/**
 * Hovedlayout for applikationen
 */
interface MainLayoutProps {
  children?: React.ReactNode;
}

type OverlayData = {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
};

type PendingOverwriteApply = {
  result: LoadFileResult;
  overlay: OverlayData;
  navigateToStamdataAfterApply: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const parseFilenameBasisFromStamdata = (stamdata: unknown): { skadelidte?: string; skadestype?: string; skadesdato?: string } | null => {
  if (!isRecord(stamdata)) return null;
  const skadelidte = typeof stamdata.skadelidte === 'string' ? stamdata.skadelidte : undefined;
  const skadestype = typeof stamdata.skadestype === 'string' ? stamdata.skadestype : undefined;
  const skadesdato = typeof stamdata.skadesdato === 'string' ? stamdata.skadesdato : undefined;
  return skadelidte || skadestype || skadesdato ? { skadelidte, skadestype, skadesdato } : null;
};

type SaveCommitFlushResult = Readonly<{
  ok: boolean;
  failedGridCommitCount: number;
}>;

type GridCommitAttemptResult = Readonly<{
  failedCount: number;
  firstFailedElement: HTMLElement | null;
}>;

const NON_TEXT_EDITING_INPUT_TYPES = new Set(['checkbox', 'radio', 'range', 'button', 'submit', 'reset', 'file', 'color']);

const waitForAnimationFrame = (): Promise<void> =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const focusElementWithoutScroll = (element: HTMLElement): void => {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};

const restoreFocusIfPossible = (element: HTMLElement | null): void => {
  if (!element || !element.isConnected) return;
  if (element.matches(':disabled')) return;
  focusElementWithoutScroll(element);
};

const isOpenTextEditorElement = (element: Element | null): element is HTMLInputElement | HTMLTextAreaElement => {
  if (element instanceof HTMLTextAreaElement) {
    return !element.readOnly;
  }
  if (!(element instanceof HTMLInputElement)) {
    return false;
  }
  if (NON_TEXT_EDITING_INPUT_TYPES.has(element.type)) {
    return false;
  }
  return !element.readOnly;
};

const waitForCommitFlush = async (): Promise<void> => {
  await Promise.resolve();
  // Wait two frames to allow blur-driven commit state and post-render effects to settle.
  await waitForAnimationFrame();
  await waitForAnimationFrame();
};

const commitActiveGridEditors = (): GridCommitAttemptResult => {
  let failedCount = 0;
  let firstFailedElement: HTMLElement | null = null;
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>('table[data-mineo-table-navigation="true"]'));
  for (const table of tables) {
    const core = getGridCoreForTable(table);
    if (!core) continue;

    const editingCell = core.getEditingCell();
    if (!editingCell) continue;

    const editor = core.getEditor(editingCell);
    if (!editor) {
      continue;
    }
    if (editor.getIsLocked()) {
      failedCount += 1;
      if (firstFailedElement === null) {
        firstFailedElement = editor.getElement();
      }
      continue;
    }

    core.clearFocusPlan();
    const ok = editor.commitCurrent();
    if (!ok) {
      failedCount += 1;
      if (firstFailedElement === null) {
        firstFailedElement = editor.getElement();
      }
    }
  }
  return { failedCount, firstFailedElement };
};

const commitPendingInputBeforeSave = async (): Promise<SaveCommitFlushResult> => {
  const gridCommitResult = commitActiveGridEditors();
  const failedGridCommitCount = gridCommitResult.failedCount;

  if (failedGridCommitCount > 0) {
    const failedElement = gridCommitResult.firstFailedElement;
    if (failedElement && failedElement.isConnected) {
      focusElementWithoutScroll(failedElement);
    }
    await waitForCommitFlush();
    return {
      ok: false,
      failedGridCommitCount,
    };
  }

  const active = document.activeElement;
  if (active instanceof HTMLElement) {
    active.blur();
  }

  await waitForCommitFlush();

  return {
    ok: failedGridCommitCount === 0,
    failedGridCommitCount,
  };
};

const isOverlayType = (value: unknown): value is OverlayData['type'] => {
  return value === 'success' || value === 'error' || value === 'warning' || value === 'info';
};

const parseSessionJson = (value: string | null): unknown => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const parseNonNegativeInteger = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
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

  const issues = warning.issues.slice(0, 30).map((i) => `- ${i.path}: ${i.reason}`).join('\n');
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
    ].join('\n')
  );
};

const MainLayout: React.FC<MainLayoutProps> = React.memo(({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppSettings();
  const [overlay, setOverlay] = React.useState<OverlayData | null>(null);
  const [pendingLoadResult, setPendingLoadResult] = React.useState<LoadFileResult | null>(null);
  const [pendingOverwriteApply, setPendingOverwriteApply] = React.useState<PendingOverwriteApply | null>(null);
  const {
    getPersistedData,
    getFieldErrorsBySource,
    replaceAllPersistedData,
    clearAllData,
    lastNotice,
    lastNoticeEpoch,
    hasAnyData,
    getSectionRevision,
    authoritativeSnapshotEpoch,
  } = useFormPersistence();
  const manuelReguleringInputErrors = useEOLoenindkomstInputErrors();
  const isPwaLoadInProgressRef = React.useRef<boolean>(false);
  const pendingPwaRequestRef = React.useRef<PwaFileOpenRequest | null>(null);

  // Prioritering: Track om nuværende overlay er user-feedback (højere prioritet end system errors)
  const isUserFeedbackRef = React.useRef<boolean>(false);
  const [devtoolsSnapshot, setDevtoolsSnapshot] = React.useState<DevtoolsIssueSnapshot | null>(null);
  const [devtoolsNoticeVisible, setDevtoolsNoticeVisible] = React.useState(false);
  const dismissedDevtoolsIssueIdRef = React.useRef<number | null>(null);
  const suppressDevtoolsNoticeUntilRef = React.useRef<number>(0);
  const allowExitWithoutUnsavedWarningRef = React.useRef<boolean>(false);

  const activePage = location.pathname.substring(1) || 'stamdata';
  const combinedSectionRevision = React.useMemo(() => {
    return (Object.keys(persistenceSchemas) as StorageKey[]).reduce((sum, pageKey) => {
      return sum + getSectionRevision(pageKey);
    }, 0);
  }, [getSectionRevision]);
  const combinedSectionRevisionRef = React.useRef<number>(combinedSectionRevision);
  combinedSectionRevisionRef.current = combinedSectionRevision;
  const [savedRevisionBaseline, setSavedRevisionBaseline] = React.useState<number>(combinedSectionRevision);
  const hasUnsavedChanges = combinedSectionRevision > savedRevisionBaseline;

  React.useEffect(() => {
    setSavedRevisionBaseline(combinedSectionRevision);
  }, [authoritativeSnapshotEpoch]);

  React.useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExitWithoutUnsavedWarningRef.current) {
        return;
      }
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  const handlePageChange = React.useCallback(async (pageId: string) => {
    if (location.pathname === `/${pageId}`) {
      return;
    }

    const activeElement = document.activeElement;
    if (isOpenTextEditorElement(activeElement)) {
      isUserFeedbackRef.current = true;
      setOverlay({
        message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
        type: 'warning',
      });
      return;
    }

    try {
      const gridCommitResult = commitActiveGridEditors();
      if (gridCommitResult.failedCount > 0) {
        restoreFocusIfPossible(gridCommitResult.firstFailedElement);
        isUserFeedbackRef.current = true;
        setOverlay({
          message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
          type: 'warning',
        });
        return;
      }

      navigate(`/${pageId}`);
    } catch (error) {
      console.warn('Sideskift blev afbrudt, fordi aktivt felt ikke kunne afsluttes.', error);
      isUserFeedbackRef.current = true;
      setOverlay({
        message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
        type: 'warning',
      });
    }
  }, [location.pathname, navigate]);

  const hasBlockingInputErrors = React.useCallback((): boolean => {
    for (const pageKey of Object.keys(persistenceSchemas) as StorageKey[]) {
      const errorsBySource = getFieldErrorsBySource(pageKey);
      for (const fieldName of Object.keys(errorsBySource)) {
        const fieldSources = errorsBySource[fieldName as keyof typeof errorsBySource];
        if (!fieldSources) continue;
        for (const sourceKey of Object.keys(fieldSources)) {
          const entry = fieldSources[sourceKey as keyof typeof fieldSources] as unknown;
          if (isRecord(entry) && entry.severity === 'error') {
            return true;
          }
        }
      }
    }

    return Object.keys(manuelReguleringInputErrors).length > 0;
  }, [getFieldErrorsBySource, manuelReguleringInputErrors]);

  const applyLoadedSnapshot = React.useCallback(async (result: LoadFileResult) => {
    if (!result.snapshot) {
      throw new Error('Kunne ikke anvende indlæst data: mangler snapshot');
    }

    const fullSnapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
      acc[key as StorageKey] = result.snapshot?.[key as StorageKey];
      return acc;
    }, {} as Record<StorageKey, unknown | undefined>);

    try {
      replaceAllPersistedData(fullSnapshot);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ukendt fejl';
      throw new Error(`Indlæsning mislykkedes. Ingen data blev anvendt.\n\n${message}`);
    }

    // UI/diagnostik-metadata (ikke autoritativt input; må ikke bruges som datakilde)
    if (result.filename) {
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, result.filename);
    }
    const basis = parseFilenameBasisFromStamdata(result.snapshot.stamdata);
    if (basis) {
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, JSON.stringify(basis));
    } else {
      sessionStorage.removeItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);
    }
    if (import.meta.env.DEV && result.debugInfo) {
      sessionStorage.setItem(UI_STORAGE_KEYS.debugLastLoadInfo, JSON.stringify(result.debugInfo, null, 2));
    }
    if (result.fileHandle) {
      await saveFileHandleToIndexedDB(result.fileHandle);
    }
  }, [replaceAllPersistedData]);

  const requestApplyLoadedSnapshot = React.useCallback(async (
    result: LoadFileResult,
    overlayData: OverlayData,
    navigateToStamdataAfterApply: boolean
  ): Promise<'applied' | 'awaitingUser'> => {
    if (hasAnyData()) {
      setPendingOverwriteApply({ result, overlay: overlayData, navigateToStamdataAfterApply });
      return 'awaitingUser';
    }

    await applyLoadedSnapshot(result);
    isUserFeedbackRef.current = true;
    setOverlay(overlayData);
    if (navigateToStamdataAfterApply) {
      navigate('/stamdata', { replace: true });
    }
    return 'applied';
  }, [applyLoadedSnapshot, hasAnyData, navigate]);

  // Gem-funktionalitet
  const handleGem = React.useCallback(async () => {
    const focusTargetBeforeSave = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    try {
      const commitFlush = await commitPendingInputBeforeSave();
      const hasInputErrors = hasBlockingInputErrors();
      if (!commitFlush.ok || hasInputErrors) {
        if (commitFlush.ok) {
          restoreFocusIfPossible(focusTargetBeforeSave);
        }
        isUserFeedbackRef.current = true;
        setOverlay({
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

      // Sanitization (dev + upgrade-safety): remove/translate legacy table columns that can appear in session state (e.g. via HMR).
      const warnings: string[] = [];
      const sanitizedSnapshot: Record<StorageKey, unknown | undefined> = { ...snapshot };
      const keysToSanitize = ['aarsloen', 'erstatningsopgoerelse'] as const;
      for (const pageKey of keysToSanitize) {
        const raw = sanitizedSnapshot[pageKey];
        if (raw === undefined) continue;
        const sanitized = sanitizeLegacyPersistedSectionForAarsloenTables(pageKey, raw);
        if (sanitized.changed) {
          sanitizedSnapshot[pageKey] = sanitized.value;
          warnings.push(...sanitized.warnings);
        }
      }

      // Resolve default directory for file picker startIn
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);

      const result: SaveFileResult = await saveToFile(sanitizedSnapshot, resolvedDirectory);

      if (result.cancelled) {
        restoreFocusIfPossible(focusTargetBeforeSave);
        return;
      }

      if (result.success) {
        restoreFocusIfPossible(focusTargetBeforeSave);
        // Saved baseline tracks the exact committed snapshot used for this save operation.
        setSavedRevisionBaseline(snapshotRevision);
        isUserFeedbackRef.current = true;
        setOverlay({
          message: warnings.length > 0 ? `Gemt\n\n${warnings.slice(0, 2).join('\n')}` : 'Gemt',
          type: warnings.length > 0 ? 'warning' : 'success',
        });
      }
    } catch (error) {
      restoreFocusIfPossible(focusTargetBeforeSave);
      console.error('Gem fejlede:', error);
      isUserFeedbackRef.current = true;
      setOverlay({
        message: (error as Error)?.message || 'Kunne ikke gemme fil',
        type: 'error',
      });
    }
  }, [getPersistedData, hasBlockingInputErrors, settings]);

  // Hent-funktionalitet
  const handleHent = React.useCallback(async () => {
    const focusTargetBeforeLoad = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    try {
      setPendingLoadResult(null);
      setPendingOverwriteApply(null);

      // Resolve default directory for file picker startIn
      const resolvedDirectory = await resolveDefaultDirectoryHandle(settings);

      const result: LoadFileResult = await loadFromFile(resolvedDirectory, { settings });

      if (result.cancelled) {
        restoreFocusIfPossible(focusTargetBeforeLoad);
        return;
      }

      if (result.success) {
        if (result.preflightWarning) {
          setPendingLoadResult(result);
          return;
        }

        await requestApplyLoadedSnapshot(result, { message: 'Hentet', type: 'success' }, false);
      }
    } catch (error) {
      restoreFocusIfPossible(focusTargetBeforeLoad);
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent fejlede:', error);
      }
      isUserFeedbackRef.current = true;
      setOverlay({
        message: resolved.message,
        type: 'error',
      });
    }
  }, [requestApplyLoadedSnapshot, settings]);

  type PwaLoadOutcome = 'cancelled' | 'preflight' | 'awaitingUser' | 'applied' | 'error';

  const handleHentFromPwaRequest = React.useCallback(async (request: PwaFileOpenRequest): Promise<PwaLoadOutcome> => {
    try {
      setPendingLoadResult(null);
      setPendingOverwriteApply(null);
      const result: LoadFileResult = await loadFromFileHandle(request.fileHandle, { requestId: request.id, settings });

      if (result.cancelled) {
        return 'cancelled';
      }

      if (result.success) {
        if (result.preflightWarning) {
          setPendingLoadResult(result);
          pendingPwaRequestRef.current = request;
          return 'preflight';
        }

        const ignoredSuffix = request.ignoredFileCount > 0
          ? `\n\nBemærk: ${request.ignoredFileCount} yderligere fil(er) blev ignoreret.`
          : '';
        const outcome = await requestApplyLoadedSnapshot(
          result,
          { message: `Hentet${ignoredSuffix}`, type: request.ignoredFileCount > 0 ? 'warning' : 'success' },
          location.pathname === '/open'
        );

        pendingPwaRequestRef.current = null;
        return outcome === 'awaitingUser' ? 'awaitingUser' : 'applied';
      }

      return 'error';
    } catch (error) {
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error('Hent (PWA) fejlede:', error);
      }
      isUserFeedbackRef.current = true;
      setOverlay({
        message: resolved.message,
        type: 'error',
      });
      pendingPwaRequestRef.current = null;
      return 'error';
    }
  }, [location.pathname, requestApplyLoadedSnapshot]);

  const processNextPwaFileOpenRequest = React.useCallback(() => {
    if (isPwaLoadInProgressRef.current) return;
    if (pendingLoadResult !== null) return;
    if (pendingOverwriteApply !== null) return;

    const request = takeNextPwaFileOpenRequest();
    if (!request) return;

    isPwaLoadInProgressRef.current = true;

    void handleHentFromPwaRequest(request)
      .then((outcome) => {
        isPwaLoadInProgressRef.current = false;
        if (outcome !== 'preflight' && outcome !== 'awaitingUser') {
          processNextPwaFileOpenRequest();
        }
      })
      .catch(() => {
        isPwaLoadInProgressRef.current = false;
        processNextPwaFileOpenRequest();
      });
  }, [handleHentFromPwaRequest, pendingLoadResult, pendingOverwriteApply]);

  React.useEffect(() => {
    const handler = () => {
      if (pendingLoadResult !== null || pendingOverwriteApply !== null) {
        const dropped = takeNextPwaFileOpenRequest();
        if (dropped) {
          isUserFeedbackRef.current = true;
          setOverlay({ message: 'Ny fil blev forsøgt åbnet – prøv igen når du er færdig', type: 'warning' });
        }
        return;
      }
      processNextPwaFileOpenRequest();
    };
    window.addEventListener(MINEO_PWA_FILE_OPEN_EVENT, handler);
    return () => {
      window.removeEventListener(MINEO_PWA_FILE_OPEN_EVENT, handler);
    };
  }, [pendingLoadResult, pendingOverwriteApply, processNextPwaFileOpenRequest]);

  React.useEffect(() => {
    if (pendingLoadResult !== null) return;
    if (pendingOverwriteApply !== null) return;
    processNextPwaFileOpenRequest();
  }, [pendingLoadResult, pendingOverwriteApply, processNextPwaFileOpenRequest]);

  const pendingPreflight = pendingLoadResult?.preflightWarning;
  const pendingPreflightBugReportError = React.useMemo(() => {
    return pendingLoadResult ? buildPreflightBugReportError(pendingLoadResult) : null;
  }, [pendingLoadResult]);

  const handleLoadDespiteIssues = React.useCallback(async () => {
    const result = pendingLoadResult;
    if (!result) return;
    setPendingLoadResult(null);
    setPendingOverwriteApply(null);
    pendingPwaRequestRef.current = null;

    try {
      await requestApplyLoadedSnapshot(result, { message: 'Hentet (med fejl)', type: 'warning' }, location.pathname === '/open');
    } catch (error) {
      console.error('Hent (trods fejl) fejlede:', error);
      isUserFeedbackRef.current = true;
      setOverlay({
        message: (error as Error)?.message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, [location.pathname, pendingLoadResult, requestApplyLoadedSnapshot]);

  const handleConfirmOverwriteApply = React.useCallback(async () => {
    const pending = pendingOverwriteApply;
    if (!pending) return;
    setPendingOverwriteApply(null);
    pendingPwaRequestRef.current = null;

    try {
      await applyLoadedSnapshot(pending.result);
      isUserFeedbackRef.current = true;
      setOverlay(pending.overlay);
      if (pending.navigateToStamdataAfterApply) {
        navigate('/stamdata', { replace: true });
      }
    } catch (error) {
      console.error('Overskriv og hent fejlede:', error);
      isUserFeedbackRef.current = true;
      setOverlay({
        message: (error as Error)?.message || 'Kunne ikke hente fil',
        type: 'error',
      });
    }
  }, [applyLoadedSnapshot, navigate, pendingOverwriteApply]);

  // Persistence-notices (fx versionsmismatch og korrupt storage)
  React.useEffect(() => {
    if (!lastNotice) return;
    isUserFeedbackRef.current = true;
    setOverlay({ message: lastNotice.message, type: lastNotice.type });
  }, [lastNoticeEpoch, lastNotice]);

  // Slet alt-funktionalitet
  const handleSletAlt = React.useCallback(async () => {
    const focusTargetBeforeDeleteAll = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const confirmed = window.confirm(
      'ADVARSEL: Dette vil slette alle indtastede oplysninger!\n\nEr du sikker på at du vil fortsætte?'
    );

    if (!confirmed) {
      restoreFocusIfPossible(focusTargetBeforeDeleteAll);
      return;
    }

    try {
      clearAllData();

      sessionStorage.removeItem(UI_STORAGE_KEYS.lastSavedFilename);
      sessionStorage.removeItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);

      await deleteFileHandleFromIndexedDB();

      sessionStorage.setItem(UI_STORAGE_KEYS.pendingOverlay, JSON.stringify({
        message: 'Alt data slettet',
        type: 'info',
        isUserFeedback: true,
      }));

      allowExitWithoutUnsavedWarningRef.current = true;
      window.location.href = '/stamdata';
    } catch (error) {
      restoreFocusIfPossible(focusTargetBeforeDeleteAll);
      allowExitWithoutUnsavedWarningRef.current = false;
      console.error('Slet alt fejlede:', error);
      isUserFeedbackRef.current = true;
      setOverlay({
        message: 'Kunne ikke slette data',
        type: 'error',
      });
    }
  }, [clearAllData]);

  // Tjek for pending overlay efter reload
  React.useEffect(() => {
    const pendingOverlay = sessionStorage.getItem(UI_STORAGE_KEYS.pendingOverlay);
    if (pendingOverlay) {
      try {
        const overlayData = JSON.parse(pendingOverlay);

        if (
          overlayData &&
          typeof overlayData === 'object' &&
          typeof overlayData.message === 'string' &&
          isOverlayType((overlayData as { type?: unknown }).type)
        ) {
          if (overlayData.isUserFeedback) {
            isUserFeedbackRef.current = true;
          }

          setOverlay({
            message: overlayData.message,
            type: (overlayData as { type: OverlayData['type'] }).type,
          });
        } else {
          console.error('Ugyldig pending overlay struktur:', overlayData);
        }

        sessionStorage.removeItem(UI_STORAGE_KEYS.pendingOverlay);
      } catch (error) {
        console.error('Kunne ikke parse pending overlay:', error);
        sessionStorage.removeItem(UI_STORAGE_KEYS.pendingOverlay);
      }
    }
  }, []);

  // Ctrl+S keyboard shortcut for gem
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleGem();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleGem]);

  React.useEffect(() => {
    dismissedDevtoolsIssueIdRef.current = parseNonNegativeInteger(
      sessionStorage.getItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId),
    );

    const stop = startDevtoolsMonitor();
    const unsubscribe = subscribeDevtoolsIssues((snapshot, issue) => {
      const now = Date.now();
      if (now < suppressDevtoolsNoticeUntilRef.current) {
        return;
      }
      const dismissedId = dismissedDevtoolsIssueIdRef.current;
      if (dismissedId !== null && issue.id <= dismissedId) {
        return;
      }
      setDevtoolsSnapshot(snapshot);
      setDevtoolsNoticeVisible(true);
    });

    const initial = getDevtoolsIssueSnapshot();
    const dismissedId = dismissedDevtoolsIssueIdRef.current;
    const hasNewIssues = initial.issues.some((issue) => dismissedId === null || issue.id > dismissedId);
    if (hasNewIssues) {
      setDevtoolsSnapshot(initial);
      setDevtoolsNoticeVisible(true);
    }

    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  React.useEffect(() => {
    const route = `${location.pathname}${location.search}${location.hash}`;
    setDevtoolsRoute(route);
  }, [location.hash, location.pathname, location.search]);

  const buildDevtoolsReportExtras = React.useCallback((): BugReportExtraSection[] => {
    const persistedSnapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
      const pageKey = key as StorageKey;
      acc[pageKey] = getPersistedData(pageKey) ?? null;
      return acc;
    }, {} as Record<StorageKey, unknown>);

    const fieldErrorsSnapshot = Object.keys(persistenceSchemas).reduce((acc, key) => {
      const pageKey = key as StorageKey;
      acc[pageKey] = getFieldErrorsBySource(pageKey);
      return acc;
    }, {} as Record<StorageKey, unknown>);

    const uiMeta = {
      lastSavedFilename: sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename),
      lastSavedFilenameBasis: parseSessionJson(sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis)),
      lastLoadDebugInfo: parseSessionJson(sessionStorage.getItem(UI_STORAGE_KEYS.debugLastLoadInfo)),
      route: {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
    };

    return [
      { title: 'DevTools hændelser', data: getDevtoolsIssueSnapshot() },
      { title: 'UI metadata', data: uiMeta },
      // getPersistedData() is intended to return schema-validated, canonical values from persistence.
      { title: 'Persisted brugerinput (schema-valideret)', data: persistedSnapshot },
      { title: 'Field errors (by source)', data: fieldErrorsSnapshot },
    ];
  }, [getFieldErrorsBySource, getPersistedData, location.hash, location.pathname, location.search]);

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <SideMenu
        activePage={activePage}
        onPageChange={handlePageChange}
        onGem={handleGem}
        onHent={handleHent}
        onSletAlt={handleSletAlt}
      />
      <Container>{children}</Container>

      <ConfirmationDialog
        open={pendingLoadResult !== null}
        title="Advarsel før indlæsning"
        message={
          pendingPreflight
            ? (
              <Box>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  Filen kan ikke indlæses fuldt ud. Du kan vælge at indlæse de dele der kan indlæses.
                </Typography>
                <Typography variant="body2">
                  Forventet: {pendingPreflight.expectedCount ?? 'ukendt'} · Indlæst: {pendingPreflight.loadedCount} · Fejlede: {pendingPreflight.failedCount ?? 'ukendt'}
                </Typography>
                <Typography variant="body2" sx={{ marginTop: 1, marginBottom: 0.5 }}>
                  Hvad fejlede:
                </Typography>
                <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                  {pendingPreflight.issues.slice(0, 12).map((issue) => (
                    <li key={`${issue.path}-${issue.reason}`}>
                      <Typography variant="body2">{issue.path}: {issue.reason}</Typography>
                    </li>
                  ))}
                  {pendingPreflight.issues.length > 12 && (
                    <li>
                      <Typography variant="body2">... +{pendingPreflight.issues.length - 12} flere</Typography>
                    </li>
                  )}
                </Box>
              </Box>
            )
            : 'Filen kan ikke indlæses fuldt ud.'
        }
        cancelText="Stop og gør intet"
        confirmText="Indlæs trods fejl"
        confirmColor="primary"
        onCancel={() => {
          pendingPwaRequestRef.current = null;
          setPendingLoadResult(null);
        }}
        onConfirm={handleLoadDespiteIssues}
        extraActions={
          pendingPreflightBugReportError
            ? (
              <BugReportButton
                variant="outlined"
                label="Send fejloplysninger"
                context={{ source: 'Hent fil: preflight', error: pendingPreflightBugReportError }}
              />
            )
            : null
        }
      />

      <ConfirmationDialog
        open={pendingOverwriteApply !== null}
        title="Overskriv eksisterende data?"
        message="Der findes allerede indtastede oplysninger i Mineo. Hvis du fortsætter, bliver de erstattet af data fra filen."
        cancelText="Stop og gør intet"
        confirmText="Overskriv"
        confirmColor="error"
        onCancel={() => {
          pendingPwaRequestRef.current = null;
          setPendingOverwriteApply(null);
        }}
        onConfirm={handleConfirmOverwriteApply}
      />

      {overlay && (
        <Overlay
          message={overlay.message}
          type={overlay.type}
          onClose={() => {
            setOverlay(null);
            isUserFeedbackRef.current = false;
          }}
        />
      )}

      {devtoolsSnapshot && devtoolsNoticeVisible && (
        <DevtoolsIssueNotice
          snapshot={devtoolsSnapshot}
          onDismiss={() => {
            const lastIssueId = devtoolsSnapshot.lastIssue?.id ?? null;
            dismissedDevtoolsIssueIdRef.current = lastIssueId;
            if (lastIssueId !== null) {
              sessionStorage.setItem(UI_STORAGE_KEYS.devtoolsLastSeenIssueId, String(lastIssueId));
            }
            suppressDevtoolsNoticeUntilRef.current = Date.now() + 1000;
            setDevtoolsNoticeVisible(false);
          }}
          getExtraSections={buildDevtoolsReportExtras}
        />
      )}

    </Box>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
