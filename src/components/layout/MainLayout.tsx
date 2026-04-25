import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';
import Overlay from '../ui/Overlay';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import BugReportButton from '../errors/BugReportButton';
import DevtoolsIssueNotice from '../errors/DevtoolsIssueNotice';
import { isRecord } from '../../utils/typeGuards';
import { useFormPersistence } from '../../contexts/useFormPersistence';
import { useAppSettings } from '../../contexts/useAppSettings';
import {
  commitActiveGridEditors,
  restoreFocusIfPossible,
  isOpenTextEditorElement,
} from '../../utils/commitFlush';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import { persistenceSchemas } from '../../config/persistenceRegistry';
import { UI_STORAGE_KEYS, type StorageKey } from '../../config/storageManifest';
import {
  getFieldErrorsBySourceSnapshot,
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

  // Prioritering: Track om nuværende overlay er user-feedback (højere prioritet end system errors)
  const isUserFeedbackRef = React.useRef<boolean>(false);
  const markUserFeedback = React.useCallback(() => {
    isUserFeedbackRef.current = true;
  }, []);
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
    hasUnsavedChanges: _hasUnsavedChanges,
    combinedSectionRevisionRef,
    markSaved,
    allowExitWithoutWarning,
  } = useUnsavedChangesGuard({ combinedSectionRevision, authoritativeSnapshotEpoch });

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
      const errorsBySource = getFieldErrorsBySourceSnapshot(pageKey);
      for (const fieldName of Object.keys(errorsBySource)) {
        const fieldSources = errorsBySource[fieldName as keyof typeof errorsBySource];
        if (!fieldSources) continue;
        for (const sourceKey of Object.keys(fieldSources)) {
          const entry = fieldSources[sourceKey as keyof typeof fieldSources] as unknown;
          // Bevidst designvalg:
          // Gem blokeres kun af ikke-committable fejl. UI-fejl på allerede committede værdier
          // (fx dato/tal uden for bounds) skal fortsat vises med rød markering, men må gemmes.
          if (isRecord(entry) && entry.severity === 'error' && entry.blocksSave !== false) {
            return true;
          }
        }
      }
    }
    return false;
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
    hasBlockingInputErrors,
    getPersistedData,
    replaceAllPersistedData,
    clearAllData,
    hasAnyData,
    allowExitWithoutWarning,
    showOverlay,
    markUserFeedback,
  });

  usePwaLaunchQueue({
    locationPathname: location.pathname,
    pendingLoadResultOpen: pendingLoadResult !== null,
    pendingOverwriteApplyOpen: pendingOverwriteApply !== null,
    handleHentFromPwaRequest,
    showOverlay,
    markUserFeedback,
  });

  // Persistence-notices (fx versionsmismatch og korrupt storage)
  React.useEffect(() => {
    if (!lastNotice) return;
    isUserFeedbackRef.current = true;
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

        removeOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay);
      } catch (error) {
        console.error('Kunne ikke parse pending overlay:', error);
        removeOptionalSessionStorageValue(UI_STORAGE_KEYS.pendingOverlay);
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
        message="Der findes allerede indtastede oplysninger i MinEO. Hvis du fortsætter, bliver de erstattet af data fra filen."
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
            isUserFeedbackRef.current = false;
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
