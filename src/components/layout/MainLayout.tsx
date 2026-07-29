import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';
import Overlay from '../ui/Overlay';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import BugReportButton from '../errors/BugReportButton';
import DevtoolsIssueNotice from '../errors/DevtoolsIssueNotice';
import { useAppSettings } from '../../contexts/useAppSettings';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import type { PersistedSectionKey } from '../../config/persistenceRegistry';
import { useDevtoolsMonitoring } from '../../hooks/useDevtoolsMonitoring';
import { useFileSaveLoad, type OverlayData } from '../../hooks/useFileSaveLoad';
import { usePwaLaunchQueue } from '../../hooks/usePwaLaunchQueue';
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import { routeToPageId } from '../../config/pageNavigation';
import { scheduleHistoryTargetRestore } from '../../inputCore/react/historyRestoreTarget';
import type { HistoryOrigin } from '../../inputCore/inputHistory';
import {
  getProductionInputRuntimeStartup,
  useCaseOperations,
  useCriticalInputActions,
  useInputDiagnostics,
  useUndoRedoShortcuts,
  useSettledSnapshot,
} from '../../inputCore/react';

/**
 * Hovedlayout for applikationen.
 *
 * Greenfield-shell (WI-002 trin 3, §3.10): shellen læser og skriver KUN gennem greenfield-runtime.
 * `FormPersistenceContext`/`useFormPersistence`, legacy read-model-selectors og den legacy
 * `CriticalActionProvider` er fjernet. Case-operationer går gennem `useCaseOperations`-portene, den kritiske
 * handlingsbarriere gennem `useCriticalInputActions`, og undo/redo gennem `useUndoRedoShortcuts`.
 */
interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayoutContent = React.memo(({ children }: MainLayoutProps) => {
  const diagnostics = useInputDiagnostics();
  const criticalActions = useCriticalInputActions();
  const ops = useCaseOperations();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppSettings();
  const [overlay, setOverlay] = React.useState<OverlayData | null>(null);

  // Den aktuelle afsluttede revision + autoritativ replacement-generation driver unsaved-guardens baseline
  // (§3.7): `revision` erstatter legacy `combinedSectionRevision`, `replacementGeneration` erstatter
  // `authoritativeSnapshotEpoch` (bumpes af load/reset/`Slet alt` gennem replacement-grænsen).
  const { revision, replacementGeneration } = useSettledSnapshot();

  // Global undo/redo-tastatur (greenfield-history via coordinatoren; åben editor = stille no-op, §1.4). Efter en
  // gennemført restore navigerer vi til origin-lokationens route/fane og re-fokuserer feltet, ændringen kom fra
  // (§3.7) — SAMME rækkefølge som legacy: (1) sæt aktiv fane, (2) navigér til route, (3) planlæg fokusrestore.
  // route/fane er eksplicit typed metadata på originen (aldrig udledt af locationId/field.section).
  const handleUndoRedoRestore = React.useCallback((origin: HistoryOrigin) => {
    if (origin.route !== undefined) {
      if (origin.tabKey !== undefined && origin.tabKey !== null) {
        setActiveTabForPage(routeToPageId(origin.route), origin.tabKey);
      }
      if (location.pathname !== origin.route) {
        navigate(origin.route);
      }
    }
    // Fokusrestoren venter selv (rAF-retry) på, at målet mounter efter et evt. fane-/sideskift.
    scheduleHistoryTargetRestore(origin);
  }, [location.pathname, navigate]);
  useUndoRedoShortcuts({ onRestore: handleUndoRedoRestore });

  const showOverlay = React.useCallback((overlayData: OverlayData) => {
    setOverlay(overlayData);
  }, []);

  // Devtools-/bugrapport-diagnostik læser gennem den NAVNGIVNE diagnostikprojektion (§3.4). Shellen griber
  // ikke selv ned i rå `sections`: opslaget ejes af `inputDiagnosticsProjection`, som er bundet til præcis den
  // runtime, React-træet viser. Ren read-only — der er ingen skrivevej herfra.
  const getPersistedSectionForDevtools = React.useCallback(
    (pageKey: PersistedSectionKey): unknown => diagnostics.readSection(pageKey),
    [diagnostics],
  );
  const getFieldIssuesForDevtools = React.useCallback(
    (pageKey: PersistedSectionKey): unknown => diagnostics.readSectionIssues(pageKey),
    [diagnostics],
  );

  const {
    devtoolsSnapshot,
    devtoolsNoticeVisible,
    dismissDevtools,
    getExtraSections: buildDevtoolsReportExtras,
  } = useDevtoolsMonitoring({
    readPersistedSection: getPersistedSectionForDevtools,
    getSectionFieldIssues: getFieldIssuesForDevtools,
    location,
  });

  const activePage = location.pathname.substring(1) || 'stamdata';
  const { markSaved } = useUnsavedChangesGuard({
    combinedSectionRevision: Number(revision),
    authoritativeSnapshotEpoch: replacementGeneration,
  });

  const handlePageChange = React.useCallback(async (pageId: string) => {
    if (location.pathname === `/${pageId}`) {
      return;
    }

    // Sideskift er en kritisk handling på linje med save/load (§1.4): coordinatoren settler begge surfaces og
    // fortsætter navigationen — også ved et fejlende settle. Kun et fail-closed `blocked` (uventet settle-fejl)
    // fokuserer det aktive felt og stopper navigationen.
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

  const {
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
    fileOperationInProgress,
    isFileOperationInProgress,
  } = useFileSaveLoad({
    settings,
    navigate,
    currentPathname: location.pathname,
    ops,
    criticalActions,
    markSaved,
    showOverlay,
  });

  const {
    pendingPwaConfirmation,
    confirmQueuedPwaFileOpen,
    ignoreQueuedPwaFileOpen,
  } = usePwaLaunchQueue({
    locationPathname: location.pathname,
    pendingLoadResultOpen: pendingLoadResult !== null,
    pendingOverwriteApplyOpen: pendingOverwriteApply !== null,
    fileOperationInProgress,
    isFileOperationInProgress,
    handleHentFromPwaRequest,
  });

  // Startup-notice (§1.12): korruption/utilgængeligt lager fra den ene runtime-bootstrap vises i shellens
  // notice-overflade. Shellens læsning må ikke selv starte eller rehydrere runtime.
  React.useEffect(() => {
    const startup = getProductionInputRuntimeStartup();
    if (startup === null) return;
    if (startup.notice === null) return;
    setOverlay({ message: startup.notice.message, type: startup.notice.type });
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
        onCancel={dismissPendingLoad}
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
        onCancel={dismissPendingLoad}
        onConfirm={handleConfirmOverwriteApply}
      />

      <ConfirmationDialog
        open={pendingPwaConfirmation !== null}
        title="En anden fil er klar til at blive indlæst"
        message={
          pendingPwaConfirmation
            ? `Filen “${pendingPwaConfirmation.fileName}” blev åbnet, mens en anden filhandling var i gang. Vil du indlæse den nu?`
            : ''
        }
        cancelText="Ignorer"
        confirmText="Indlæs fil"
        confirmColor="primary"
        onCancel={ignoreQueuedPwaFileOpen}
        onConfirm={confirmQueuedPwaFileOpen}
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

const MainLayout = React.memo((props: MainLayoutProps) => <MainLayoutContent {...props} />);

MainLayout.displayName = 'MainLayout';

export default MainLayout;
