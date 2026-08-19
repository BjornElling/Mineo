import React from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { APP_ROUTES } from '../config/pageNavigation';
import { SaveValidationError, saveToFile } from '../utils/fileSave';
import { loadFromFile, loadFromFileHandle } from '../utils/fileLoad';
import { resolveDefaultDirectoryHandle } from '../utils/fileHelpers';
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
import {
  applyAuthoritativeLoadSnapshot,
  synchronizeLoadMetadata,
  type PersistenceLoadApplyResult,
} from '../utils/persistenceLoadApply';
import type { SaveSnapshot } from '../utils/fileSaveTypes';
import { focusFirstBlockingRejectedField } from '../inputCore/react/saveBlockedFocus';
import { getProductionInputCatalog } from '../inputCore/catalog/productionCatalog';
import type { CaseOperations } from '../inputCore/react/useCaseOperations';
import type { ResetResidue } from '../persistence/caseResetOperations';
import type { CriticalActionCoordinator } from '../inputCore/runtime/criticalActionCoordinator';
import { logWarning } from '../utils/logger';
import { FileSelectionError } from '../utils/fileLoadSource';

// Shellens use-case for save/load/`Slet alt` mod input-runtime:
//  - `.eo`-save går gennem `ops.file.evaluateSave()` (rejected råinput blokerer; canonical bounds-fejl kan gemmes,
//    §1.6), ikke gennem en field-error-store-scanning.
//  - Load/`Slet alt` routes gennem `CriticalActionCoordinator` og den ene replacement-command
//    (`ops.file.applyLoadedSnapshot` / `ops.reset.clearAll`).
//  - §1.4 har INGEN `block`-policy for load: `prepare('load')` settler ikke og blokerer
//    aldrig. Fokus-før-handling fanges her i use-casen via `document.activeElement`, fordi `prepare`
//    ikke længere returnerer et `focusTargetBeforeAction`.
//  - `Slet alt` fanger den IKKE: dens bekræftelse er `ConfirmationDialog`, som selv ejer fokus-restoren
//    gennem `useDialogFocusRestore`. En fangst her ville være en parallel restore-vej.

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

/**
 * `Slet alt`-bekræftelsens tilstand. Skilt fra `LoadFlowState`, fordi de to flows har hver sin
 * livscyklus: load reserverer filoperationslåsen FØR sin dialog (filen er allerede læst og skal ikke
 * kunne krydses), mens reset først reserverer den ved bekræftelsen – der er intet at beskytte, så længe
 * brugeren blot bliver spurgt. De kan derfor ikke slås sammen til én fase uden at give den ene flows
 * låseregel til den anden. At begge er åbne samtidig er umuligt: `Slet alt` afvises, mens en filhandling
 * kører (`beginFileOperation`), og PWA-køen holdes tilbage, mens bekræftelsen står åben.
 */
type ResetFlowState =
  | { phase: 'idle' }
  | { phase: 'confirming' };

export type PwaLoadOutcome = 'busy' | 'cancelled' | 'preflight' | 'awaitingUser' | 'applied' | 'error';

type FileOperationKind = 'save' | 'manual-load' | 'pwa-load' | 'reset';

/**
 * Den injicerede filkilde til den fælles load-shell. Alt, hvad de to entrypoints deler, ligger i
 * `runLoadShell`; dette er præcis det, der sagligt adskiller manuel filvælger fra PWA-launch.
 */
type LoadShellSource = Readonly<{
  kind: Extract<FileOperationKind, 'manual-load' | 'pwa-load'>;
  /** Manuel load er en brugergestus og skal oplyse "en filhandling er i gang"; PWA-launch sker uopfordret. */
  showBusyWarning: boolean;
  /** Præfiks i console-loggen ved uventede fejl, så de to kilder fortsat kan skelnes i en fejlrapport. */
  errorLogLabel: string;
  load: () => Promise<LoadFileResult>;
  /** Bygges først ved succes, fordi PWA-fladens besked afhænger af antallet af ignorerede filer. */
  successOverlay: () => OverlayData;
}>;

type UseFileSaveLoadArgs = {
  settings: AppSettings;
  navigate: NavigateFunction;
  /** Case-portene (`.eo`-save-evaluering, load-apply, `hasAnyData`, `Slet alt`). */
  ops: CaseOperations;
  /** Kritisk-handlings-barrieren fra samme binding som portene (settle/replace/no-op, §1.4). */
  criticalActions: CriticalActionCoordinator;
  /** Markér den gemte revision som ny "unsaved changes"-baseline (§ unsaved-guard). Modtager save-tokenets inputrevision. */
  markSaved: (revision: number) => void;
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
  /** Åbner `Slet alt`-bekræftelsen. Sletter intet selv – bekræftelsen sker i `handleConfirmSletAlt`. */
  handleSletAlt: () => void;
  /** Er `Slet alt`-bekræftelsen åben? Driver dialogen og holder PWA-køen tilbage. */
  pendingResetConfirmation: boolean;
  /** Lukker `Slet alt`-bekræftelsen uden at slette noget. */
  dismissPendingReset: () => void;
  /** Gennemfører den bekræftede `Slet alt`. `false` = ikke gennemført, så dialogen kan prøve igen. */
  handleConfirmSletAlt: () => Promise<boolean>;
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
  if (error instanceof FileSelectionError) {
    return { message: error.message, expected: true };
  }

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

/**
 * Beskeden ved en `Slet alt`, hvor sagsinputtet ER ryddet, men en tilknyttet oprydning ikke kunne verificeres.
 * Den skal sige begge dele: hvad der bevisligt er slettet, og hvad der kan bestå – appen må ikke
 * love "alt data slettet", når en rest kan hydrere ind i den næste sag.
 */
const buildResetResidueMessage = (residue: readonly ResetResidue[]): string => {
  const hasFileHandle = residue.some((entry) => entry.kind === 'fileHandle');
  const sessionKeyCount = residue.filter((entry) => entry.kind === 'sessionStorageKey').length;
  const parts = [
    hasFileHandle ? 'et tidligere filhåndtag til direkte Gem' : null,
    sessionKeyCount > 0 ? `${sessionKeyCount} sagsnær(e) hjælpeværdi(er) i browserens midlertidige lager` : null,
  ].filter((part): part is string => part !== null);

  return [
    'Alle indtastninger er slettet, men oprydningen kunne ikke gennemføres helt.',
    '',
    `Følgende kan bestå: ${parts.join(' og ')}.`,
    'Luk browserfanen og åbn Mineo igen, hvis en tidligere sags oplysninger dukker op.',
  ].join('\n');
};

/** Fanger det aktuelt fokuserede element FØR en kritisk handling (`prepare` bærer det ikke længere). */
const captureActiveElement = (): HTMLElement | null =>
  document.activeElement instanceof HTMLElement ? document.activeElement : null;

export const useFileSaveLoad = ({
  settings,
  navigate,
  ops,
  criticalActions,
  markSaved,
  showOverlay,
}: UseFileSaveLoadArgs): UseFileSaveLoadResult => {
  const [loadFlow, setLoadFlow] = React.useState<LoadFlowState>({ phase: 'idle' });
  const loadFlowRef = React.useRef<LoadFlowState>({ phase: 'idle' });
  const [resetFlow, setResetFlow] = React.useState<ResetFlowState>({ phase: 'idle' });
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

  /**
   * Dialogerne skifter fase i samme brugerhandling (preflight → overskriv → apply). MUI kan nå at
   * levere bekræftelses-callbacken fra portalen, før React har erstattet callback-closuren med næste render.
   * Ref'en opdateres derfor synkront sammen med render-state: den autoritative beslutning læser altid den
   * aktuelle pending fil, mens `loadFlow` fortsat er den eneste kilde til, hvad UI'et viser.
   */
  const transitionLoadFlow = React.useCallback((next: LoadFlowState): void => {
    loadFlowRef.current = next;
    setLoadFlow(next);
  }, []);

  // Load-apply routes gennem replacement-grænsen: `ops.file.applyLoadedSnapshot` udsteder den ene
  // autoritative `replaceCase`-command, indpakket i coordinatorens `applyReplacement` (no-settle, draften
  // kasseres først efter et succesfuldt apply, §1.4/§7).
  //
  // De to faser er BEVIDST adskilt: kun den synkrone apply ligger inde i replacement-barrieren, hvor
  // draft-discard hører til. Metadata-/filhåndtags-/PWA-synkroniseringen (§4.1) er asynkron og ejer ikke
  // sagsinput; lå den inde i barrieren, kunne brugeren åbne og redigere et felt i den netop indlæste sag,
  // mens dens awaits kørte – og den nye draft blev derefter kasseret.
  const applyLoadedSnapshot = React.useCallback(async (result: ApplicableLoadFileResult): Promise<PersistenceLoadApplyResult> => {
    await criticalActions.applyReplacement(() => applyAuthoritativeLoadSnapshot({
      result,
      applySnapshot: ops.file.applyLoadedSnapshot,
    }));
    return synchronizeLoadMetadata(result);
  }, [criticalActions, ops.file]);

  const requestApplyLoadedSnapshot = React.useCallback(async (
    result: ApplicableLoadFileResult,
    overlayData: OverlayData,
    navigateToStamdataAfterApply: boolean,
  ): Promise<'applied' | 'awaitingUser'> => {
    if (ops.file.hasAnyData()) {
      transitionLoadFlow({ phase: 'overwrite', result, overlay: overlayData, navigateToStamdataAfterApply });
      return 'awaitingUser';
    }

    const applyResult = await applyLoadedSnapshot(result);
    showOverlay(applyResult.status === 'applied-with-metadata-error'
      ? { message: applyResult.message, type: 'warning' }
      : overlayData);
    if (navigateToStamdataAfterApply) {
      navigate(APP_ROUTES.stamdata, { replace: true });
    }
    return 'applied';
  }, [applyLoadedSnapshot, navigate, ops.file, showOverlay, transitionLoadFlow]);

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

      // En helt urørt sag gemmes ikke. Målestokken er den ENE data-presence-forespørgsel, `hasAnyData()`
      // (`settledInputHasAnyData`), som måler mod NY-SAGS-baseline – ikke mod tomhed. En ny sag er nemlig
      // ikke tom: den bærer domænets og brugerens erklærede standardværdier (satsår, lønperiode, bilagsvalg,
      // udkast-stempel), og de er programmets svar, ikke brugerens.
      //
      // Gaten ligger HER og ikke i `fileSave.ts`, fordi kun runtimen kender ny-sags-baselinen. `fileSave.ts`
      // ser udelukkende det schema-parsede snapshot og kan derfor ikke skelne "brugeren har intet indtastet"
      // fra "brugeren har bevidst valgt netop standardværdierne". Dens tidligere `hasRealData()`-tjek
      // regnede hver `false` og hvert standardtal som brugerdata og sagde derfor ja til en tom standardsag.
      if (!ops.file.hasAnyData()) {
        showOverlay({ message: 'Ingen data fundet at gemme', type: 'warning' });
        return;
      }

      // §3.9: evaluér `.eo`-save mod et frisk kildesnapshot. Blokeres KUN af aktivt relevant rejected råinput;
      // canonical bounds/rule-fejl og manglende felter tillader save (§1.6).
      const saveOutcome = ops.file.evaluateSave();
      if (saveOutcome.status === 'blocked') {
        void focusFirstBlockingRejectedField(
          saveOutcome.rejectedAddresses,
          navigate,
          getProductionInputCatalog().resolveFieldLocation
        );
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

      // Critical-action-kontrakten §5: friskheds-kontrollen skal ligge efter AL target-/picker-resolution og
      // umiddelbart før den første skrivning. Fil-pickeren ligger inde i `saveToFile`, så kontrollen injiceres
      // dér som callback – ikke her før kaldet, hvor den ville kunne omgås af netop pickeren.
      const result: SaveFileResult = await saveToFile(
        snapshot,
        resolvedDirectory,
        () => ops.file.isSaveSourceStillCurrent(saveOutcome.token)
      );

      if (result.status === 'cancelled') {
        focusBeforeAction?.focus();
        return;
      }

      if (result.status === 'stale') {
        // Sagen blev ændret, mens gem-dialogen var åben. Intet er skrevet; brugeren gemmer igen mod den
        // aktuelle tilstand (fail-closed frem for at skrive en ældre sag).
        focusBeforeAction?.focus();
        showOverlay({
          message: 'Gem blev afbrudt, fordi sagen blev ændret undervejs. Prøv at gemme igen.',
          type: 'warning',
        });
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
    ops.file,
    finishFileOperation,
    markSaved,
    navigate,
    settings,
    showOverlay,
  ]);

  /**
   * Den ENE load-shell-procedure. Manuel filvælger og PWA-launch er to sagligt forskellige KILDER,
   * ikke to loadflows: busy-start, `prepare('load')`, dialog-nulstilling, kildeindlæsning, preflight-forgrening,
   * apply, fejlvisning og cleanup er den samme kæde og lå før i to kopier. Kun det, der faktisk adskiller de to
   * – `LoadShellSource` – er en parameter; udfaldet returneres i PWA-fladens sprog, som den manuelle flade
   * blot ignorerer.
   */
  const runLoadShell = React.useCallback(async (source: LoadShellSource): Promise<PwaLoadOutcome> => {
    if (!beginFileOperation(source.kind, source.showBusyWarning)) return 'busy';
    let awaitsUserDecision = false;
    const focusBeforeAction = captureActiveElement();

    try {
      // §1.4: load settler ALDRIG og blokerer aldrig – den åbne draft kasseres først, hvis apply lykkes.
      // Coordinatorens `prepare('load')` er `replace`-policy; et uventet fail-closed `blocked` fokuserer målet.
      const preparation = await criticalActions.prepare('load');
      if (preparation.status === 'blocked') {
        preparation.target?.focus();
        showOverlay({
          message: LOAD_BLOCKED_BY_ACTIVE_EDITOR_MESSAGE,
          type: 'warning',
        });
        return 'error';
      }

      transitionLoadFlow({ phase: 'idle' });
      const result: LoadFileResult = await source.load();

      if (result.status === 'cancelled') {
        focusBeforeAction?.focus();
        return 'cancelled';
      }

      if (result.status === 'preflight') {
        transitionLoadFlow({ phase: 'preflight', result, navigateToStamdataAfterApply: true });
        awaitsUserDecision = true;
        return 'preflight';
      }

      const outcome = await requestApplyLoadedSnapshot(result, source.successOverlay(), true);
      awaitsUserDecision = outcome === 'awaitingUser';
      return outcome;
    } catch (error) {
      focusBeforeAction?.focus();
      const resolved = resolveLoadError(error);
      if (!resolved.expected) {
        console.error(`${source.errorLogLabel} fejlede:`, error);
      }
      showOverlay({
        message: resolved.message,
        type: 'error',
      });
      return 'error';
    } finally {
      if (!awaitsUserDecision) finishFileOperation();
    }
  }, [beginFileOperation, criticalActions, finishFileOperation, requestApplyLoadedSnapshot, showOverlay, transitionLoadFlow]);

  const handleHent = React.useCallback(async () => {
    await runLoadShell({
      kind: 'manual-load',
      showBusyWarning: true,
      errorLogLabel: 'Hent',
      load: async () => loadFromFile(await resolveDefaultDirectoryHandle(settings)),
      successOverlay: () => ({ message: 'Hentet', type: 'success' }),
    });
  }, [runLoadShell, settings]);

  const handleHentFromPwaRequest = React.useCallback(async (request: PwaFileOpenRequest): Promise<PwaLoadOutcome> => {
    return runLoadShell({
      kind: 'pwa-load',
      showBusyWarning: false,
      errorLogLabel: 'Hent (PWA)',
      load: () => loadFromFileHandle(request.fileHandle, { requestId: request.id }),
      successOverlay: () => {
        const ignoredSuffix = request.ignoredFileCount > 0
          ? `\n\nBemærk: ${request.ignoredFileCount} yderligere fil(er) blev ignoreret.`
          : '';
        return {
          message: `Hentet${ignoredSuffix}`,
          type: request.ignoredFileCount > 0 ? 'warning' : 'success',
        };
      },
    });
  }, [runLoadShell]);

  const handleLoadDespiteIssues = React.useCallback(async () => {
    const pending = loadFlowRef.current;
    if (pending.phase !== 'preflight') return;
    let awaitsOverwriteDecision = false;
    // Gå direkte fra preflight til overskrivning. Den fælles dialog beholder dermed sit
    // overlay-/historik-ejerskab gennem begge brugerbeslutninger; et kort `idle` ville lukke det
    // første overlay, hvis asynkrone history-oprydning ellers kan ramme den netop åbnede efterfølger.

    try {
      awaitsOverwriteDecision = (await requestApplyLoadedSnapshot(
        pending.result,
        { message: 'Filen er indlæst – nogle felter blev sat til standardværdier.', type: 'warning' },
        pending.navigateToStamdataAfterApply,
      )) === 'awaitingUser';
      // Uden eksisterende data gennemfører requestApplyLoadedSnapshot apply direkte. Dialogen skal først
      // lukkes EFTER den vej er fuldført; ellers kan en success-overlay stå oven på en stadig åben preflight.
      if (!awaitsOverwriteDecision) transitionLoadFlow({ phase: 'idle' });
    } catch (error) {
      transitionLoadFlow({ phase: 'idle' });
      console.error('Hent (trods fejl) fejlede:', error);
      showOverlay({
        message: asError(error).message || 'Kunne ikke hente fil',
        type: 'error',
      });
    } finally {
      if (!awaitsOverwriteDecision) finishFileOperation();
    }
  }, [finishFileOperation, requestApplyLoadedSnapshot, showOverlay, transitionLoadFlow]);

  const handleConfirmOverwriteApply = React.useCallback(async () => {
    const pending = loadFlowRef.current;
    if (pending.phase !== 'overwrite') return;
    transitionLoadFlow({ phase: 'idle' });

    try {
      const applyResult = await applyLoadedSnapshot(pending.result);
      showOverlay(applyResult.status === 'applied-with-metadata-error'
        ? { message: applyResult.message, type: 'warning' }
        : pending.overlay);
      if (pending.navigateToStamdataAfterApply) {
        navigate(APP_ROUTES.stamdata, { replace: true });
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
  }, [applyLoadedSnapshot, finishFileOperation, navigate, showOverlay, transitionLoadFlow]);

  /**
   * Åbner bekræftelsen. Handlingen er delt i to, fordi bekræftelsen er programmets egen dialog og ikke
   * længere en native `window.confirm`: den blokerede JS-tråden og kunne derfor spørge midt i kaldet.
   * Skiftet er ikke kosmetisk – `ConfirmationDialog` bærer `CONFIRMATION_DIALOG_FOCUS_MARKER`, som holder
   * en åben felteditor fra at settle, mens brugeren svarer (`critical-action-contract.md` §7: `Slet alt`
   * gennemføres UDEN settle, og draften kasseres først ved en vellykket apply).
   *
   * Fokus-restoren ved annullering ligger derfor i dialogen (`useDialogFocusRestore`), ikke her: netop
   * denne hook må ikke føre en parallel restore-vej (`keyboard-navigation.md` §Popup-fokus-restore).
   */
  const handleSletAlt = React.useCallback(() => {
    setResetFlow({ phase: 'confirming' });
  }, []);

  const dismissPendingReset = React.useCallback(() => {
    setResetFlow({ phase: 'idle' });
  }, []);

  const handleConfirmSletAlt = React.useCallback(async (): Promise<boolean> => {
    setResetFlow({ phase: 'idle' });

    // Reset er selv en fil-/sagshandling og skal dele samme lås. Uden denne
    // reservation kunne en allerede igangværende load eller Gem afslutte efter
    // reset og genindsætte data eller metadata fra den gamle operation.
    if (!beginFileOperation('reset', true)) return false;

    try {
      // §7/§1.12: `Slet alt` gennem replacement-grænsen (no-settle; draften kasseres først ved
      // succes) – dette er også recovery-vejen ud af en `writesBlocked` current-session. Porten ejer HELE
      // transaktionen: input, sagsnær UI-sessionstate og filhåndtag, og rapporterer eventuelle rester.
      const clearResult = await ops.reset.clearAll();

      // Handlingen afsluttes INDE i appen, som fil-load – samme autoritative
      // replacement-grænse skal ikke ende to forskellige steder. Den fulde `window.location`-genindlæsning er
      // fjernet, og med den behovet for at bære beskeden gennem sessionStorage og for at undertrykke
      // unsaved-guardens beforeunload-advarsel (den nulstiller selv sin baseline på `replacementGeneration`).
      showOverlay(clearResult.status === 'cleared'
        ? { message: 'Alle indtastninger slettet', type: 'info' }
        : { message: buildResetResidueMessage(clearResult.residue), type: 'warning' });
      navigate(APP_ROUTES.stamdata, { replace: true });
      return true;
    } catch (error) {
      console.error('Slet alt fejlede:', error);
      showOverlay({
        message: 'Kunne ikke slette data',
        type: 'error',
      });
      return false;
    } finally {
      finishFileOperation();
    }
  }, [beginFileOperation, finishFileOperation, navigate, ops.reset, showOverlay]);

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
    const currentFlow = loadFlowRef.current;
    const requestId = currentFlow.phase === 'idle' ? undefined : currentFlow.result.requestId;
    transitionLoadFlow({ phase: 'idle' });
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
  }, [finishFileOperation, transitionLoadFlow]);

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
    pendingResetConfirmation: resetFlow.phase === 'confirming',
    dismissPendingReset,
    handleConfirmSletAlt,
    handleLoadDespiteIssues,
    handleConfirmOverwriteApply,
    handleHentFromPwaRequest,
    fileOperationInProgress: activeFileOperation !== null,
    isFileOperationInProgress,
  };
};
