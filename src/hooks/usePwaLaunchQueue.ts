import React from 'react';
import {
  clearPendingPwaFileOpenRequest,
  getPendingPwaFileOpenRequest,
  Mineo_PWA_FILE_OPEN_EVENT,
  type PwaFileOpenRequest,
} from '../utils/pwaLaunchQueue';
import { logWarning } from '../utils/logger';
import { asError } from '../utils/typeGuards';

const PWA_OPEN_REQUEST_RETRY_INTERVAL_MS = 100;
const PWA_OPEN_REQUEST_RETRY_WINDOW_MS = 3000;

type UsePwaLaunchQueueArgs = {
  locationPathname: string;
  pendingLoadResultOpen: boolean;
  pendingOverwriteApplyOpen: boolean;
  handleHentFromPwaRequest: (request: PwaFileOpenRequest) => Promise<unknown>;
  showOverlay: (overlay: { message: string; type: 'success' | 'error' | 'warning' | 'info' }) => void;
};

export const usePwaLaunchQueue = ({
  locationPathname,
  pendingLoadResultOpen,
  pendingOverwriteApplyOpen,
  handleHentFromPwaRequest,
  showOverlay,
}: UsePwaLaunchQueueArgs): void => {
  const isPwaLoadInProgressRef = React.useRef<boolean>(false);
  const activePwaRequestIdRef = React.useRef<string | null>(null);
  // Sidste request-id vi faktisk har FORSØGT at loade (succes eller fejl). Auto-retry-timeren
  // bruger den til kun at fyre for endnu-ikke-forsøgte requests (dens egentlige formål: at fange
  // en request der dukkede op før event-listeneren var klar ved opstart). Et eksplicit nyt event
  // (bruger-retry) går uden om timeren og gennem event-handleren, så den slags retry virker stadig.
  // Uden denne deling kunne timeren auto-genforsøge en netop fejlet load samtidig med et event-retry
  // → dobbelt-load af samme request (flaky test + reel race, jf. review 9.3 UF-2).
  const lastAttemptedRequestIdRef = React.useRef<string | null>(null);

  const processNextPwaFileOpenRequest = React.useCallback(() => {
    if (isPwaLoadInProgressRef.current) return;
    if (pendingLoadResultOpen) return;
    if (pendingOverwriteApplyOpen) return;

    const request = getPendingPwaFileOpenRequest();
    if (!request) return;
    if (activePwaRequestIdRef.current === request.id) return;

    activePwaRequestIdRef.current = request.id;
    lastAttemptedRequestIdRef.current = request.id;
    isPwaLoadInProgressRef.current = true;

    void handleHentFromPwaRequest(request)
      .finally(() => {
        activePwaRequestIdRef.current = null;
        isPwaLoadInProgressRef.current = false;
      });
  }, [handleHentFromPwaRequest, pendingLoadResultOpen, pendingOverwriteApplyOpen]);

  React.useEffect(() => {
    const handler = () => {
      if (pendingLoadResultOpen || pendingOverwriteApplyOpen) {
        const dropped = getPendingPwaFileOpenRequest();
        if (dropped) {
          // Best-effort oprydning af den droppede request; en IndexedDB-fejl her er
          // ikke-fatal (selve sagsdata røres ikke), men må ikke blive en unhandled rejection.
          void clearPendingPwaFileOpenRequest().catch((error: unknown) => {
            logWarning('Kunne ikke rydde droppet PWA-fil-request', {
              context: 'usePwaLaunchQueue.dropPendingRequest',
              data: { errorMessage: asError(error).message },
            });
          });
          showOverlay({ message: 'Ny fil blev forsøgt åbnet – prøv igen når du er færdig', type: 'warning' });
        }
        return;
      }
      processNextPwaFileOpenRequest();
    };

    window.addEventListener(Mineo_PWA_FILE_OPEN_EVENT, handler);
    return () => {
      window.removeEventListener(Mineo_PWA_FILE_OPEN_EVENT, handler);
    };
  }, [pendingLoadResultOpen, pendingOverwriteApplyOpen, processNextPwaFileOpenRequest, showOverlay]);

  React.useEffect(() => {
    if (pendingLoadResultOpen || pendingOverwriteApplyOpen) return;
    processNextPwaFileOpenRequest();
  }, [pendingLoadResultOpen, pendingOverwriteApplyOpen, processNextPwaFileOpenRequest]);

  React.useEffect(() => {
    if (locationPathname !== '/open') return;
    if (pendingLoadResultOpen || pendingOverwriteApplyOpen) return;

    const startedAt = Date.now();
    let timeoutId: number | null = null;
    let cancelled = false;

    const tick = (): void => {
      if (cancelled) return;
      if (pendingLoadResultOpen || pendingOverwriteApplyOpen) return;
      const request = getPendingPwaFileOpenRequest();
      // Auto-retry kun for en request vi ikke allerede har forsøgt. En fejlet load genforsøges
      // ikke automatisk — den venter på et nyt event (bruger-retry).
      if (request && request.id !== lastAttemptedRequestIdRef.current) {
        processNextPwaFileOpenRequest();
      }

      if (Date.now() - startedAt >= PWA_OPEN_REQUEST_RETRY_WINDOW_MS) {
        return;
      }

      timeoutId = window.setTimeout(tick, PWA_OPEN_REQUEST_RETRY_INTERVAL_MS);
    };

    timeoutId = window.setTimeout(tick, PWA_OPEN_REQUEST_RETRY_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [locationPathname, pendingLoadResultOpen, pendingOverwriteApplyOpen, processNextPwaFileOpenRequest]);
};
