import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';
import Overlay from '../ui/Overlay';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import BugReportButton from '../errors/BugReportButton';
import DevtoolsIssueNotice from '../errors/DevtoolsIssueNotice';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { useAppSettings } from '../../contexts/useAppSettings';
import { prepareForCriticalDataReplacement } from '../../utils/commitFlush';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';
import {
  getFieldErrorsBySourceSnapshot,
  getInvalidDraftsForSectionSnapshot,
  useAuthoritativeSnapshotEpochSelector,
  useCombinedSectionRevisionSelector,
} from '../../hooks/useFormPersistenceSelectors';
import { clearPendingPwaFileOpenRequest } from '../../utils/pwaLaunchQueue';
import {
  readOptionalSessionStorageValue,
  removeOptionalSessionStorageValue,
} from '../../utils/safeSessionStorage';
import { useDevtoolsMonitoring } from '../../hooks/useDevtoolsMonitoring';
import { useFileSaveLoad, type OverlayData } from '../../hooks/useFileSaveLoad';
import { usePwaLaunchQueue } from '../../hooks/usePwaLaunchQueue';
import { useUndoRedoShortcuts } from '../../hooks/useUndoRedoShortcuts';
import { getFirstBlockingInputErrorTarget } from '../../utils/saveBlockedFocus';
import { clearLastUndoFocus } from '../../utils/undoFocusTracker';

/**
 * Hovedlayout for applikationen
 */
interface MainLayoutProps {
  children?: React.ReactNode;
}

const isOverlayType = (value: unknown): value is OverlayData['type'] => {
  return value === 'success' || value === 'error' || value === 'warning' || value === 'info';
};

const MainLayout = React.memo(({ children }: MainLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppSettings();
  const [overlay, setOverlay] = React.useState<OverlayData | null>(null);
  const {
    getPersistedData,
    getFieldErrorsBySource,
    replaceAllPersistedData,
    clearAllData,
    lastNotice,
    lastNoticeEpoch,
    hasAnyData,
  } = useFormPersistence();
  const authoritativeSnapshotEpoch = useAuthoritativeSnapshotEpochSelector();
  const combinedSectionRevision = useCombinedSectionRevisionSelector();

  // Global undo/redo-tastatur + focus-tracker (delt med standalone MinProcesrente).
  // Mineo er multi-side, så vi injicerer React Routers navigate til restore.
  useUndoRedoShortcuts(navigate);

  React.useEffect(() => {
    clearLastUndoFocus();
  }, [location.pathname]);

  const showOverlay = React.useCallback((overlayData: OverlayData) => {
    setOverlay(overlayData);
  }, []);

  const {
    devtoolsSnapshot,
    devtoolsNoticeVisible,
    dismissDevtools,
    getExtraSections: buildDevtoolsReportExtras,
  } = useDevtoolsMonitoring({ getPersistedData, getFieldErrorsBySource, location });

  const activePage = location.pathname.substring(1) || 'stamdata';
  const {
    combinedSectionRevisionRef,
    markSaved,
    allowExitWithoutWarning,
  } = useUnsavedChangesGuard({ combinedSectionRevision, authoritativeSnapshotEpoch });

  const handlePageChange = React.useCallback(async (pageId: string) => {
    if (location.pathname === `/${pageId}`) {
      return;
    }

    // Sideskift er en kritisk handling på linje med save/load: brug den fælles commit-flush-guard,
    // så et igangværende felt-commit (åben tekst-editor, åben grid-celle ELLER et blur-deferred
    // commit) garanteret er afsluttet før navigation unmounter den gamle side. Tidligere blurrede
    // navigation ikke det aktive felt og ventede ikke på commit-flush, hvilket kunne tabe et netop
    // indtastet felt ved sideskift (jf. runtime data-integritet).
    try {
      const guard = await prepareForCriticalDataReplacement();
      if (!guard.ok) {
        setOverlay({
          message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
          type: 'warning',
        });
        return;
      }

      navigate(`/${pageId}`);
    } catch (error) {
      console.warn('Sideskift blev afbrudt, fordi aktivt felt ikke kunne afsluttes.', error);
      setOverlay({
        message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
        type: 'warning',
      });
    }
  }, [location.pathname, navigate]);

  const getFirstBlockingInputError = React.useCallback(() => {
    // Bevidst designvalg:
    // Gem blokeres kun af ikke-committable fejl. UI-fejl på allerede committede værdier
    // (fx dato/tal uden for bounds) skal fortsat vises med rød markering, men må gemmes.
    return getFirstBlockingInputErrorTarget(getFieldErrorsBySourceSnapshot, getInvalidDraftsForSectionSnapshot);
  }, []);

  const {
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
  } = useFileSaveLoad({
    settings,
    navigate,
    combinedSectionRevisionRef,
    markSaved,
    getFirstBlockingInputError,
    currentPathname: location.pathname,
    getPersistedData,
    replaceAllPersistedData,
    clearAllData,
    hasAnyData,
    allowExitWithoutWarning,
    showOverlay,
  });

  usePwaLaunchQueue({
    locationPathname: location.pathname,
    pendingLoadResultOpen: pendingLoadResult !== null,
    pendingOverwriteApplyOpen: pendingOverwriteApply !== null,
    handleHentFromPwaRequest,
    showOverlay,
  });

  // Persistence-notices (fx versionsmismatch og korrupt storage).
  // `lastNoticeEpoch` er den monotone trigger; provideren bumper epoch og notice-objektet
  // i samme setState (se FormPersistenceContext.emitUserNotice), så notice-identitet er stabil
  // pr. epoch og kan ikke ændre sig uafhængigt af epoch. Begge i deps er derfor sikkert.
  React.useEffect(() => {
    if (!lastNotice) return;
    setOverlay({ message: lastNotice.message, type: lastNotice.type });
  }, [lastNoticeEpoch, lastNotice]);

  // Tjek for pending overlay efter reload
  React.useEffect(() => {
    const pendingOverlay = readOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay);
    if (pendingOverlay) {
      try {
        const overlayData = JSON.parse(pendingOverlay);

        if (
          overlayData &&
          typeof overlayData === 'object' &&
          typeof overlayData.message === 'string' &&
          isOverlayType((overlayData as { type?: unknown }).type)
        ) {
          setOverlay({
            message: overlayData.message,
            type: (overlayData as { type: OverlayData['type'] }).type,
          });
        } else {
          console.error('Ugyldig pending overlay struktur:', overlayData);
        }

        removeOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay);
      } catch (error) {
        console.error('Kunne ikke parse pending overlay:', error);
        removeOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay);
      }
    }
  }, []);

  // Global keyboard shortcut for gem. Undo/redo håndteres af useUndoRedoShortcuts.
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
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{issue.path}: {issue.reason}</Typography>
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
          void clearPendingPwaFileOpenRequest();
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
          void clearPendingPwaFileOpenRequest();
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
          }}
        />
      )}

      {devtoolsSnapshot && devtoolsNoticeVisible && (
        <DevtoolsIssueNotice
          snapshot={devtoolsSnapshot}
          onDismiss={dismissDevtools}
          getExtraSections={buildDevtoolsReportExtras}
        />
      )}

    </Box>
  );
});

MainLayout.displayName = 'MainLayout';

export default MainLayout;
