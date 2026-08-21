import React from 'react';
import { Box, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import SideMenu from './SideMenu';
import Container from './Container';
import Overlay from '../ui/Overlay';
import { hasOpenOverlay } from '../ui/overlayBehavior';
import ConfirmationDialog from '../ui/ConfirmationDialog';
import BugReportButton from '../errors/BugReportButton';
import DevtoolsIssueNotice from '../errors/DevtoolsIssueNotice';
import LazyChunkRecoveryNotice from '../system/LazyChunkRecoveryNotice';
import { useAppSettings } from '../../contexts/useAppSettings';
import { useUnsavedChangesGuard } from '../../hooks/useUnsavedChangesGuard';
import type { PersistedSectionKey } from '../../config/persistenceRegistry';
import { useDevtoolsMonitoring } from '../../hooks/useDevtoolsMonitoring';
import { useFileSaveLoad, type OverlayData } from '../../hooks/useFileSaveLoad';
import { usePwaLaunchQueue } from '../../hooks/usePwaLaunchQueue';
import { setActiveTabForPage } from '../../hooks/usePersistedActiveTab';
import { getRouteForMenuPageKey, routeToPageId, type MenuPageKey } from '../../config/pageNavigation';
import { scheduleHistoryTargetRestore } from '../../inputCore/react/historyRestoreTarget';
import { useContentUiScale } from '../../hooks/useContentUiScale';
import { CONTENT_GUTTER_CSS, CONTENT_UI_SCALE_POLICY } from '../../utils/uiScale';
import type { HistoryOrigin } from '../../inputCore/inputHistory';
import {
  getProductionInputRuntimeStartup,
  useAutomationIntrospectionBridge,
  useCaseOperations,
  useCriticalInputActions,
  useInputDiagnostics,
  useUndoRedoShortcuts,
  useSettledSnapshot,
} from '../../inputCore/react';

/**
 * Hovedlayout for applikationen.
 *
 * Shellen læser og skriver KUN gennem input-runtime. Case-operationer går gennem
 * `useCaseOperations`-portene, den kritiske
 * handlingsbarriere gennem `useCriticalInputActions`, og undo/redo gennem `useUndoRedoShortcuts`.
 */
interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayoutContent = React.memo(({ children }: MainLayoutProps) => {
  const contentScale = useContentUiScale();
  const diagnostics = useInputDiagnostics();
  // Maskinlæsbar udlæsning af issue-/rejected-tilstanden til e2e og den eksterne interaktionsaudit.
  // Ren read-only og elimineret af dead-code-fjernelsen i produktionsbuildet (§DEV-gate i modulet).
  useAutomationIntrospectionBridge();
  const criticalActions = useCriticalInputActions();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useAppSettings();
  const ops = useCaseOperations(settings);
  /**
   * Beskeden OG dens identitet.
   *
   * Identiteten er ikke pynt: den er det, der giver hver ny besked sin egen nedtælling og sin egen
   * indtoning. `Overlay`s timere startes af en effekt, der kun afhænger af beskedens TYPE, så to
   * beskeder af samme type i træk delte den førstes nedtælling – den anden arvede resttiden. Kom den
   * anden besked under udtoningen, blev den tegnet gennemsigtig og lukkede sig selv umiddelbart
   * efter, altså helt usynligt. Det ramte præcis den bruger, der trykkede igen, fordi han ikke nåede
   * at læse svaret første gang.
   *
   * Løsningen ligger her frem for inde i `Overlay`, fordi det er den samme regel som for «peg på
   * dette felt»-markeringen (`keyboard-navigation.md`): udløser brugeren det samme to gange, skal der
   * komme et synligt svar begge gange. Et deklarativt reset inde i komponenten kan ikke skelne «samme
   * besked igen» fra «en re-render af den samme besked»; en monotont voksende nøgle kan, og den gør
   * `Overlay` til en frisk instans med friske timere – også når type OG tekst er identiske.
   */
  const [overlay, setOverlay] = React.useState<{ id: number; data: OverlayData } | null>(null);
  const overlayIdRef = React.useRef(0);
  const presentOverlay = React.useCallback((data: OverlayData) => {
    overlayIdRef.current += 1;
    setOverlay({ id: overlayIdRef.current, data });
  }, []);

  // Den aktuelle afsluttede revision og autoritative replacement-generation driver unsaved-guardens
  // baseline (§3.7). Replacement-generation hæves af load/reset/`Slet alt`.
  const { revision, replacementGeneration } = useSettledSnapshot();

  // Global undo/redo-tastatur (inputkernens history via coordinatoren; åben editor = stille no-op, §1.4). Efter en
  // gennemført restore navigerer vi til origin-lokationens route/fane og re-fokuserer feltet, ændringen kom fra
  // (§3.7) i denne rækkefølge: (1) sæt aktiv fane, (2) navigér til route, (3) planlæg fokusrestore.
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
    presentOverlay(overlayData);
  }, [presentOverlay]);

  // Devtools-/bugrapport-diagnostik læser gennem den NAVNGIVNE diagnostikprojektion (§3.4). Shellen griber
  // ikke selv ned i rå `sections`: opslaget ejes af `inputDiagnosticsProjection`, som er bundet til præcis den
  // runtime, React-træet viser. Ren read-only – der er ingen skrivevej herfra.
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

  // Kanonisk omvendt opslag. Den håndrullede `substring(1) || 'stamdata'` duplikerede
  // `routeToPageId` – inkl. dens startside-fallback – i en fil der allerede importerede den.
  const activePage = routeToPageId(location.pathname);
  const { markSaved } = useUnsavedChangesGuard({
    combinedSectionRevision: Number(revision),
    authoritativeSnapshotEpoch: replacementGeneration,
  });

  const handlePageChange = React.useCallback(async (pageId: MenuPageKey) => {
    // Routen slås OP i det kanoniske inventar. `/${pageId}`-interpolationen var mekanismen bag
    // sidemenuens drift: den gjorde enhver streng til en gyldig route, så en omdøbt side gav en
    // menupost der navigerede til ingenting.
    const targetRoute = getRouteForMenuPageKey(pageId);
    if (location.pathname === targetRoute) {
      return;
    }

    // Sideskift er en kritisk handling på linje med save/load (§1.4): coordinatoren settler begge flader og
    // fortsætter navigationen – også ved et fejlende settle. Kun et fail-closed `blocked` (uventet settle-fejl)
    // fokuserer det aktive felt og stopper navigationen.
    try {
      const preparation = await criticalActions.prepare('navigate');
      if (preparation.status === 'blocked') {
        preparation.target?.focus();
        presentOverlay({
          message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
          type: 'warning',
        });
        return;
      }

      navigate(targetRoute);
    } catch (error) {
      console.warn('Sideskift blev afbrudt, fordi aktivt felt ikke kunne afsluttes.', error);
      presentOverlay({
        message: 'Kan ikke skifte side: afslut eller ret det aktive felt først.',
        type: 'warning',
      });
    }
  }, [criticalActions, location.pathname, navigate, presentOverlay]);

  // Restore-målet for `Slet alt`-bekræftelsen. Se dialogen nedenfor for hvorfor den skal være eksplicit.
  const sletAltButtonRef = React.useRef<HTMLButtonElement>(null);

  const {
    pendingLoadResult,
    pendingOverwriteApply,
    dismissPendingLoad,
    pendingPreflight,
    pendingPreflightBugReportError,
    handleGem,
    handleHent,
    handleSletAlt,
    pendingResetConfirmation,
    dismissPendingReset,
    handleConfirmSletAlt,
    handleLoadDespiteIssues,
    handleConfirmOverwriteApply,
    handleHentFromPwaRequest,
    fileOperationInProgress,
    isFileOperationInProgress,
  } = useFileSaveLoad({
    settings,
    navigate,
    ops,
    criticalActions,
    markSaved,
    showOverlay,
  });
  const visiblePreflight = pendingLoadResult === null ? undefined : pendingPreflight;

  const {
    pendingPwaConfirmation,
    confirmQueuedPwaFileOpen,
    ignoreQueuedPwaFileOpen,
  } = usePwaLaunchQueue({
    locationPathname: location.pathname,
    pendingLoadResultOpen: pendingLoadResult !== null,
    pendingOverwriteApplyOpen: pendingOverwriteApply !== null,
    pendingResetConfirmationOpen: pendingResetConfirmation,
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
    presentOverlay({ message: startup.notice.message, type: startup.notice.type });
  }, [presentOverlay]);

  // Global keyboard shortcut for gem. Undo/redo håndteres af useUndoRedoShortcuts.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        // Overlayet ejer tastaturet, så længe det er åbent (`keyboard-navigation.md`
        // §Overlay-adfærd). Uden dette startede Ctrl+S et helt gem – med filvælger og det hele –
        // BAG en åben bekræftelsesdialog, som blev stående og spurgte om noget andet.
        // Samme regel som undo/redo i `useUndoRedoShortcuts`; ingen `preventDefault()`, når
        // tasten ikke er vores.
        if (hasOpenOverlay()) return;
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
        sletAltButtonRef={sletAltButtonRef}
        contentScale={contentScale}
      />
      <Container
        enableContentScale
        // Arbejdsfladens ydre luft: samme gutter hele vejen rundt. Gutterne ligger uden for
        // zoom-roden og ganges derfor med skalaen i CSS – det er netop de to vandrette afstande,
        // pladsregnskabet i `CONTENT_UI_SCALE_POLICY` afsætter. Den lodrette luft skaleres med,
        // fordi en fast luft foroven ville stå dobbelt så høj som luften i siderne ved mindste
        // skala; Kontroltabellens klæbende tabelhoved kompenserer desuden for præcis denne
        // værdi inde fra zoom-roden og kan kun ramme, når de to følger samme skala.
        scrollSx={{ padding: CONTENT_GUTTER_CSS }}
        // MUI fortolker numeriske padding-værdier som spacing-trin. Pixel-enheden er nødvendig,
        // ellers bliver indrykningen ganget med otte. Værdien er uskaleret: `main` ER zoom-roden.
        contentSx={{ paddingLeft: `${CONTENT_UI_SCALE_POLICY.contentIndentPx}px` }}
      >
        <LazyChunkRecoveryNotice
          onReloadBlocked={() => {
            presentOverlay({
              message: 'Kan ikke genindlæse endnu: afslut eller ret det aktive felt først.',
              type: 'warning',
            });
          }}
        />
        {children}
      </Container>

      <ConfirmationDialog
        // Preflight og overskrivning er to beslutninger i SAMME load-flow. Én dialoginstans bevarer
        // overlayets history-ejerskab ved faseskiftet: to instanser kunne få den udfasende dialogs
        // asynkrone `history.back()` til at lukke den netop åbnede overskrivelsesdialog.
        open={pendingLoadResult !== null || pendingOverwriteApply !== null}
        confirmationKey={pendingLoadResult !== null ? 'load-preflight' : 'load-overwrite'}
        title={pendingLoadResult !== null
          ? 'Nogle felter blev sat til standardværdier'
          : 'Erstat de aktuelle indtastninger?'}
        message={
          pendingLoadResult !== null
            ? (
              <Box>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  De følgende oplysninger er ændret i programmets kode på en måde, så de gemte værdier i filen ikke kunne indlæses. De er i stedet sat til programmets standardværdier. Resten af filen er indlæst som normalt.
                </Typography>
                <Typography variant="body2" sx={{ marginBottom: 1 }}>
                  Du kan fortsætte og indlæse filen, men gennemgå gerne de berørte felter bagefter.
                </Typography>
                {visiblePreflight ? (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      Indlæst fra filen: {visiblePreflight.loadedCount}
                      {visiblePreflight.expectedCount !== undefined ? ` af ${visiblePreflight.expectedCount}` : ''} felter
                      {visiblePreflight.failedCount !== undefined ? ` · Sat til standardværdi: ${visiblePreflight.failedCount}` : ''}
                    </Typography>
                    <Typography variant="body2" sx={{ marginTop: 1, marginBottom: 0.5, fontWeight: 500 }}>
                      Berørte felter:
                    </Typography>
                    <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                      {visiblePreflight.issues.slice(0, 12).map((issue) => (
                        <li key={`${issue.path}-${issue.reason}`}>
                          <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                            {/* Strippede felter forklares allerede af den fælles tekst øverst → vis kun navnet.
                                Droppede/ukendte sektioner har en reelt anden årsag → behold den. */}
                            {issue.kind === 'strippedUnknownField' ? issue.path : `${issue.path}: ${issue.reason}`}
                          </Typography>
                        </li>
                      ))}
                      {visiblePreflight.issues.length > 12 && (
                        <li>
                          <Typography variant="body2">... +{visiblePreflight.issues.length - 12} flere</Typography>
                        </li>
                      )}
                    </Box>
                  </>
                ) : 'Nogle af filens felter kunne ikke indlæses og blev sat til standardværdier.'}
              </Box>
            )
            : 'Der findes allerede indtastede oplysninger i Mineo. Hvis du fortsætter, bliver de erstattet af oplysningerne fra filen. Indholdet i gemte .eo-filer ændres ikke.'
        }
        cancelText={pendingLoadResult !== null ? 'Stop og gør intet' : 'Annuller'}
        confirmText={pendingLoadResult !== null ? 'Indlæs trods fejl' : 'Erstat'}
        confirmColor={pendingLoadResult !== null ? 'primary' : 'error'}
        onCancel={dismissPendingLoad}
        onConfirm={pendingLoadResult !== null ? handleLoadDespiteIssues : handleConfirmOverwriteApply}
        extraActions={
          pendingLoadResult !== null && pendingPreflightBugReportError
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

      {/* `Slet alt`. Fokus SKAL føres eksplicit tilbage til menuknappen: sidemenuen kalder
          `preventDefault()` i `onMouseDown` for at bevare felt-fokus, så knappen står aldrig som
          `activeElement`, og restoren ville ellers falde tilbage på et vilkårligt mål
          (`keyboard-navigation.md` §Popup-fokus-restore, målprioritet 1). */}
      <ConfirmationDialog
        open={pendingResetConfirmation}
        title="Slet alt"
        message={(
          <>
            ADVARSEL: Dette sletter alle ikke-gemte indtastninger i Mineo!
            <br />
            <br />
            Indholdet i gemte .eo-filer ændres ikke.
            <br />
            <br />
            Er du sikker på at du vil fortsætte?
          </>
        )}
        cancelText="Annuller"
        confirmText="Ja, slet"
        confirmColor="error"
        onCancel={dismissPendingReset}
        onConfirm={handleConfirmSletAlt}
        restoreFocusTo={sletAltButtonRef}
      />

      <ConfirmationDialog
        open={pendingPwaConfirmation !== null}
        title="En anden fil er klar til at blive indlæst"
        message={
          pendingPwaConfirmation
            ? `Filen “${pendingPwaConfirmation.fileName}” blev åbnet, mens en anden filhandling var i gang. Vil du indlæse den nu?`
            : ''
        }
        cancelText="Annuller"
        confirmText="Indlæs fil"
        confirmColor="primary"
        onCancel={ignoreQueuedPwaFileOpen}
        onConfirm={confirmQueuedPwaFileOpen}
      />

      {overlay && (
        <Overlay
          // Nøglen ER mekanismen bag «hver besked får sin egen nedtælling»: en ny identitet giver en
          // frisk `Overlay`-instans med friske timere og en frisk indtoning, også når type og tekst er
          // identiske med den forrige. Fjernes den, arver den anden besked den førstes resttid.
          key={overlay.id}
          message={overlay.data.message}
          type={overlay.data.type}
          onClose={() => {
            // Kun DENNE besked må rydde tilstanden. Uden id-prøven kunne den udgående beskeds
            // forsinkede `onClose` (fade-ud'et er 300 ms) rydde en NYERE besked, der er ankommet
            // i mellemtiden – altså genskabe præcis det, rettelsen fjerner.
            setOverlay((current) => (current !== null && current.id === overlay.id ? null : current));
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
