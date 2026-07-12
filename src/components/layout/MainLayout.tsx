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
import { CriticalActionProvider, useCriticalActionCoordinator } from '../../criticalActions/CriticalActionContext';

/**
 * Hovedlayout for applikationen
 */
interface MainLayoutProps {
  children?: React.ReactNode;
}

const isOverlayType = (value: unknown): value is OverlayData['type'] => {
  return value === 'success' || value === 'error' || value === 'warning' || value === 'info';
};

const MainLayoutContent = React.memo(({ children }: MainLayoutProps) => {
  const criticalActions = useCriticalActionCoordinator();
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

    // Sideskift er en kritisk handling på linje med save/load. Coordinatoren blokerer en åben
    // form-editor, committer en åben grid-editor og afventer eksplicit pending tabelpersistens,
    // før navigation kan unmounte siden (jf. runtime data-integritet).
    try {
      const preparation = await criticalActions.prepare('navigate');
      if (preparation.status === 'blocked') {
        preparation.target?.focus();
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
  }, [criticalActions, location.pathname, navigate]);

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
        title="Nogle felter blev sat til standardværdier"
        message={
          pendingPreflight
            ? (
              <Box>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  De følgende oplysninger er ændret i programmets kode på en måde, så de gemte værdier i filen ikke kunne indlæses. De er i stedet sat til programmets standardværdier. Resten af filen er indlæst som normalt.
                </Typography>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  Du kan fortsætte og indlæse filen, men gennemgå gerne de berørte felter bagefter.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Indlæst fra filen: {pendingPreflight.loadedCount}
                  {pendingPreflight.expectedCount !== undefined ? ` af ${pendingPreflight.expectedCount}` : ''} felter
                  {pendingPreflight.failedCount !== undefined ? ` · Sat til standardværdi: ${pendingPreflight.failedCount}` : ''}
                </Typography>
                <Typography variant="body2" sx={{ marginTop: 1, marginBottom: 0.5, fontWeight: 500 }}>
                  Berørte felter:
                </Typography>
                <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                  {pendingPreflight.issues.slice(0, 12).map((issue) => (
                    <li key={`${issue.path}-${issue.reason}`}>
                      <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                        {/* Strippede felter forklares allerede af den fælles tekst øverst → vis kun navnet.
                            Droppede/ukendte sektioner har en reelt anden årsag → behold den. */}
                        {issue.kind === 'strippedUnknownField' ? issue.path : `${issue.path}: ${issue.reason}`}
                      </Typography>
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
            : 'Nogle af filens felter kunne ikke indlæses og blev sat til standardværdier.'
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

MainLayoutContent.displayName = 'MainLayoutContent';

const MainLayout = React.memo((props: MainLayoutProps) => (
  <CriticalActionProvider>
    <MainLayoutContent {...props} />
  </CriticalActionProvider>
));

MainLayout.displayName = 'MainLayout';

export default MainLayout;
