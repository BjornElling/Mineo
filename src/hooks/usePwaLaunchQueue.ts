import React from 'react';
import type { PwaLoadOutcome } from './useFileSaveLoad';
import {
  clearPendingPwaFileOpenRequest,
  getPendingPwaFileOpenRequest,
  Mineo_PWA_FILE_OPEN_EVENT,
  type PwaFileOpenRequest,
} from '../utils/pwaLaunchQueue';
import { APP_SYSTEM_PAGE_DEFINITIONS } from '../config/pageNavigation';
import { logWarning } from '../utils/logger';
import { asError } from '../utils/typeGuards';

const PWA_OPEN_REQUEST_RETRY_INTERVAL_MS = 100;
const PWA_OPEN_REQUEST_RETRY_WINDOW_MS = 3000;

type PendingPwaConfirmation = Readonly<{
  requestId: string;
  fileName: string;
}>;

type UsePwaLaunchQueueArgs = {
  locationPathname: string;
  pendingLoadResultOpen: boolean;
  pendingOverwriteApplyOpen: boolean;
  fileOperationInProgress: boolean;
  isFileOperationInProgress: () => boolean;
  handleHentFromPwaRequest: (request: PwaFileOpenRequest) => Promise<PwaLoadOutcome>;
};

type UsePwaLaunchQueueResult = {
  pendingPwaConfirmation: PendingPwaConfirmation | null;
  confirmQueuedPwaFileOpen: () => void;
  ignoreQueuedPwaFileOpen: () => void;
};

export const usePwaLaunchQueue = ({
  locationPathname,
  pendingLoadResultOpen,
  pendingOverwriteApplyOpen,
  fileOperationInProgress,
  isFileOperationInProgress,
  handleHentFromPwaRequest,
}: UsePwaLaunchQueueArgs): UsePwaLaunchQueueResult => {
  const isPwaLoadInProgressRef = React.useRef(false);
  const [pwaLoadInProgress, setPwaLoadInProgress] = React.useState(false);
  const activePwaRequestIdRef = React.useRef<string | null>(null);
  const queuedWhileBusyRef = React.useRef(false);
  const pendingConfirmationRef = React.useRef<PendingPwaConfirmation | null>(null);
  const [pendingPwaConfirmation, setPendingPwaConfirmation] =
    React.useState<PendingPwaConfirmation | null>(null);
  // Sidste request-id vi faktisk har forsøgt at loade. Auto-retry-timeren må kun fange
  // requests, der ankom før event-listeneren var klar; et eksplicit event kan genforsøge.
  const lastAttemptedRequestIdRef = React.useRef<string | null>(null);

  const updatePendingConfirmation = React.useCallback((request: PwaFileOpenRequest | null): void => {
    const confirmation = request
      ? { requestId: request.id, fileName: request.fileName }
      : null;
    pendingConfirmationRef.current = confirmation;
    setPendingPwaConfirmation(confirmation);
  }, []);

  const queueLatestRequest = React.useCallback((request: PwaFileOpenRequest): void => {
    queuedWhileBusyRef.current = true;
    // Hvis bekræftelsen allerede er synlig, opdateres den straks til den seneste request.
    // Ellers vises den først, når den aktive filhandling og dens dialoger er helt afsluttet.
    if (pendingConfirmationRef.current !== null) {
      updatePendingConfirmation(request);
    }
  }, [updatePendingConfirmation]);

  const processNextPwaFileOpenRequest = React.useCallback((allowAlreadyAttempted = false): void => {
    if (isPwaLoadInProgressRef.current || isFileOperationInProgress()) return;
    if (pendingLoadResultOpen || pendingOverwriteApplyOpen) return;
    if (queuedWhileBusyRef.current || pendingConfirmationRef.current !== null) return;

    const request = getPendingPwaFileOpenRequest();
    if (!request) return;
    if (activePwaRequestIdRef.current === request.id) return;
    if (!allowAlreadyAttempted && request.id === lastAttemptedRequestIdRef.current) return;

    activePwaRequestIdRef.current = request.id;
    lastAttemptedRequestIdRef.current = request.id;
    isPwaLoadInProgressRef.current = true;
    setPwaLoadInProgress(true);

    void handleHentFromPwaRequest(request)
      .then((outcome) => {
        if (outcome === 'busy') {
          queueLatestRequest(getPendingPwaFileOpenRequest() ?? request);
        }
      })
      .finally(() => {
        activePwaRequestIdRef.current = null;
        isPwaLoadInProgressRef.current = false;
        setPwaLoadInProgress(false);
      });
  }, [
    handleHentFromPwaRequest,
    isFileOperationInProgress,
    pendingLoadResultOpen,
    pendingOverwriteApplyOpen,
    queueLatestRequest,
  ]);

  const promoteQueuedRequest = React.useCallback((): void => {
    if (!queuedWhileBusyRef.current) return;
    if (isPwaLoadInProgressRef.current || isFileOperationInProgress()) return;
    if (pendingLoadResultOpen || pendingOverwriteApplyOpen) return;

    const request = getPendingPwaFileOpenRequest();
    if (!request) {
      queuedWhileBusyRef.current = false;
      updatePendingConfirmation(null);
      return;
    }
    updatePendingConfirmation(request);
  }, [
    isFileOperationInProgress,
    pendingLoadResultOpen,
    pendingOverwriteApplyOpen,
    updatePendingConfirmation,
  ]);

  const confirmQueuedPwaFileOpen = React.useCallback((): void => {
    const confirmedRequestId = pendingConfirmationRef.current?.requestId;
    updatePendingConfirmation(null);
    queuedWhileBusyRef.current = false;

    const latestRequest = getPendingPwaFileOpenRequest();
    if (!latestRequest) return;
    // Seneste request vinder også ved et event i samme øjeblik som brugerens klik.
    if (confirmedRequestId !== latestRequest.id) {
      lastAttemptedRequestIdRef.current = null;
    }
    processNextPwaFileOpenRequest(true);
  }, [processNextPwaFileOpenRequest, updatePendingConfirmation]);

  const ignoreQueuedPwaFileOpen = React.useCallback((): void => {
    const ignoredRequestId = pendingConfirmationRef.current?.requestId;
    updatePendingConfirmation(null);
    queuedWhileBusyRef.current = false;
    void clearPendingPwaFileOpenRequest(ignoredRequestId).catch((error: unknown) => {
      logWarning('Kunne ikke rydde ignoreret PWA-fil-request', {
        context: 'usePwaLaunchQueue.ignoreQueuedRequest',
        data: { errorMessage: asError(error).message },
      });
    });
  }, [updatePendingConfirmation]);

  React.useEffect(() => {
    const handler = (): void => {
      const request = getPendingPwaFileOpenRequest();
      if (!request) return;

      if (
        isFileOperationInProgress()
        || isPwaLoadInProgressRef.current
        || pendingLoadResultOpen
        || pendingOverwriteApplyOpen
        || pendingConfirmationRef.current !== null
      ) {
        queueLatestRequest(request);
        return;
      }
      processNextPwaFileOpenRequest(true);
    };

    window.addEventListener(Mineo_PWA_FILE_OPEN_EVENT, handler);
    return () => {
      window.removeEventListener(Mineo_PWA_FILE_OPEN_EVENT, handler);
    };
  }, [
    isFileOperationInProgress,
    pendingLoadResultOpen,
    pendingOverwriteApplyOpen,
    processNextPwaFileOpenRequest,
    queueLatestRequest,
  ]);

  React.useEffect(() => {
    promoteQueuedRequest();
    if (
      fileOperationInProgress
      || pwaLoadInProgress
      || pendingLoadResultOpen
      || pendingOverwriteApplyOpen
      || queuedWhileBusyRef.current
    ) return;
    processNextPwaFileOpenRequest();
  }, [
    fileOperationInProgress,
    pwaLoadInProgress,
    pendingLoadResultOpen,
    pendingOverwriteApplyOpen,
    processNextPwaFileOpenRequest,
    promoteQueuedRequest,
  ]);

  React.useEffect(() => {
    if (locationPathname !== APP_SYSTEM_PAGE_DEFINITIONS.openEo.route) return;
    if (pendingLoadResultOpen || pendingOverwriteApplyOpen) return;

    const startedAt = Date.now();
    let timeoutId: number | null = null;
    let cancelled = false;

    const tick = (): void => {
      if (cancelled) return;
      const request = getPendingPwaFileOpenRequest();
      if (request && request.id !== lastAttemptedRequestIdRef.current) {
        if (isFileOperationInProgress() || isPwaLoadInProgressRef.current) {
          queueLatestRequest(request);
        } else if (!pendingLoadResultOpen && !pendingOverwriteApplyOpen) {
          processNextPwaFileOpenRequest();
        }
      }

      if (Date.now() - startedAt >= PWA_OPEN_REQUEST_RETRY_WINDOW_MS) return;
      timeoutId = window.setTimeout(tick, PWA_OPEN_REQUEST_RETRY_INTERVAL_MS);
    };

    timeoutId = window.setTimeout(tick, PWA_OPEN_REQUEST_RETRY_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [
    isFileOperationInProgress,
    locationPathname,
    pendingLoadResultOpen,
    pendingOverwriteApplyOpen,
    processNextPwaFileOpenRequest,
    queueLatestRequest,
  ]);

  return {
    pendingPwaConfirmation,
    confirmQueuedPwaFileOpen,
    ignoreQueuedPwaFileOpen,
  };
};
