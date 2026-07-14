import * as React from 'react';

import { useGridCellEditing, useGridCellFocus, useGridCoreApi } from '../../components/tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../components/tables/gridCore/gridCoreTypes';
import { gridCellKey } from '../../components/tables/gridCore/gridCoreUtils';
import { assignRef } from '../../utils/refUtils';
import { copyWholeValueFromReadOnlyField, readClipboardText } from '../../utils/clipboardUtils';
import type { TableInputErrorInfo, TableInputErrorKind } from '../../utils/tableInputContracts';
import type { CommittedPayload } from '../../types/parserSpec';
import { useAuthoritativeSnapshotEpochSelector } from '../useFormPersistenceSelectors';
import { isRestoreFocusInProgress } from '../../utils/historyTargetRestore';
import { decideFieldResync } from '../fieldState/fieldResyncMachine';
import { elementHasPhysicalFocus } from '../fieldState/elementHasPhysicalFocus';
import { shouldDeriveInvalidDraftError } from '../fieldState/shouldDeriveInvalidDraftError';
import { useInvalidDraftSlot } from '../fieldState/useInvalidDraftSlot';
import { useCellInvalidDraftChannel } from './useCellInvalidDraftChannel';
import type { TableInputAdapter } from './tableInputAdapter';
import {
  cancelLegacyGridRejectedClear,
  withActiveLegacyGridRejectedClear,
} from '../../input/legacyGridTransactionBridge';
import {
  mapSelectionThroughDraftNormalization,
  restoreInputSelectionAfterControlledChange,
  type NormalizedSelection,
} from '../../utils/inputSelectionUtils';

export type TableInputChangeEvent<TValue> = Readonly<{ target: Readonly<{ value: TValue }> }>;

export type UseTableInputCoreOptions<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  adapter: TableInputAdapter<TModel, TCanonical, TFingerprint>;
  gridCell: GridCellCoord;
  undoFieldPathAliases?: readonly string[];
  value: TModel;
  locked?: boolean;
  onChange?: (e: TableInputChangeEvent<string>) => void;
  onBlur?: (e: TableInputChangeEvent<TModel>) => boolean | void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}>;

export type UseTableInputCoreResult = Readonly<{
  draft: string;
  renderedValue: string;
  isFocused: boolean;
  touched: boolean;
  hasError: boolean;
  errorMessage: string;
  showError: boolean;
  errorKind: TableInputErrorKind;
  isEditing: boolean;
  isReadOnly: boolean;
  cellFocused: boolean;
  inputElRef: React.RefObject<HTMLInputElement | null>;
  inputRefCallback: (el: HTMLInputElement | null) => void;
  undoFocusToken: string;
  gridCellKey: string;
  undoFieldPathAliasesAttr: string | undefined;
  /**
   * Fuldt kvalificeret `fieldPath` for cellen (`invalidDrafts`-recovery-kanalen), eller `undefined`
   * når cellen er ubunden (uden scope/provider — fx isolerede tabel-tests). Sættes som
   * `data-mineo-field-path` på inputtet, så save-gaten kan lokalisere den blokerende celle.
   */
  invalidDraftFieldPath: string | undefined;
  a11yInputId: string;
  htmlInputName: string;
  a11yErrorId: string;
  keyInitiatedEdit: boolean;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFocus: () => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleDoubleClick: () => void;
}>;

export const useTableInputCore = <TModel, TCanonical extends string, TFingerprint extends string>({
  adapter,
  gridCell,
  undoFieldPathAliases = [],
  value,
  locked = false,
  onChange,
  onBlur,
  onErrorChange,
  externalErrorMessage,
  inputRef,
}: UseTableInputCoreOptions<TModel, TCanonical, TFingerprint>): UseTableInputCoreResult => {
  const gridApi = useGridCoreApi();
  const cellFocused = useGridCellFocus(gridCell);
  const isEditing = useGridCellEditing(gridCell);
  const isReadOnly = locked || !isEditing;

  const resolvedGridCellKey = gridCellKey(gridCell);
  const undoFieldPathAliasesAttr = undoFieldPathAliases.length > 0 ? undoFieldPathAliases.join(' ') : undefined;

  // `invalidDrafts`-kanal: bundet når cellen er inde i en CellInvalidDraftScopeProvider OG en
  // FormPersistenceProvider. Ellers ubunden (lokal fallback). Kun adaptere med `useSaveError`
  // persisterer en ikke-committbar draft (og blokerer dermed Gem) — øvrige holder den lokalt.
  const channel = useCellInvalidDraftChannel(resolvedGridCellKey);
  // Destrukturér de stabile kanal-callbacks (useCallback i kanal-hooken) — selve channel-objektet
  // er en ny reference pr. render, så commit/clear-helpers nedenfor må IKKE afhænge af det (ellers
  // re-registreres grid-editoren ved hvert render).
  const {
    fieldPath: channelFieldPath,
    committedInvalidDraft: channelCommittedInvalidDraft,
    onCommitInvalid: channelCommitInvalid,
    clearInvalidDraft: channelClearInvalid,
    rejectedClear: channelRejectedClear,
  } = channel;
  const useChannel = channelFieldPath !== undefined && (adapter.useSaveError ?? false);

  // Ugyldig-draft-slot (delt med useDraftField): bundne `useSaveError`-celler læser/skriver/ryder via
  // kanalen; ubundne celler (eller adaptere uden `useSaveError`) holder en lokal fallback, så den
  // ugyldige draft ikke silent-rolles tilbage. Modsat form-stien ejer grid-cellen sin egen bundne
  // rydning (jf. commit-rækkefølgen: value-commit FØRST, dernæst clear).
  const {
    effectiveInvalidDraft,
    writeInvalidDraft,
    clearInvalidDraft: clearInvalidDraftEntry,
  } = useInvalidDraftSlot({
    bound: useChannel,
    committedInvalidDraft: channelCommittedInvalidDraft,
    onCommitInvalid: channelCommitInvalid,
    clearInvalidDraft: channelClearInvalid,
  });

  const committedDisplayValue = adapter.format(value);
  const externalSource = effectiveInvalidDraft ?? committedDisplayValue;

  const [draft, setDraft] = React.useState<string>(() => externalSource);
  const [isFocused, setIsFocused] = React.useState(false);
  const [touched, setTouched] = React.useState(() => effectiveInvalidDraft !== undefined);
  const [localVisualError, setLocalVisualError] = React.useState('');
  const [keyInitiatedEdit, setKeyInitiatedEdit] = React.useState(false);

  const inputElRef = React.useRef<HTMLInputElement | null>(null);
  const draftRef = React.useRef<string>(draft);
  const pendingSelectionRef = React.useRef<NormalizedSelection | null>(null);
  const pendingDraftCommitRef = React.useRef(false);
  // Post-commit-guard mod silent-rollback/flicker: efter et vellykket commit der ÆNDRER værdien står
  // draften optimistisk på den committede repræsentation, mens `value`-proppen (og evt. invalidDraft-
  // rydning) endnu ikke har indhentet. Resync MÅ ikke trække draften tilbage til den stale committede
  // display, før `committedDisplayValue` faktisk ændrer sig fra værdien-ved-commit. (Samme determinisme
  // som useDraftField.pendingCommitRef; nødvendig fordi native-blur-vejen lukker editoren i en
  // queueMicrotask, så `isEditing`-guarden ikke længere dækker vinduet.)
  const pendingCommitRef = React.useRef<{ formattedValueAtCommit: string } | null>(null);
  const originalValueOnEditStartRef = React.useRef<string>('');
  const originalTouchedOnEditStartRef = React.useRef(false);
  const originalLocalVisualErrorOnEditStartRef = React.useRef('');
  const keyInitiatedEditRef = React.useRef(false);
  const wasEditingRef = React.useRef(false);
  const effectiveInvalidDraftRef = React.useRef<string | undefined>(effectiveInvalidDraft);
  const touchedRef = React.useRef(touched);
  const localVisualErrorRef = React.useRef(localVisualError);
  const latestCommittedPayloadRef = React.useRef<CommittedPayload<TModel, TCanonical, TFingerprint>>(
    adapter.toCommittedPayload(value)
  );
  const latest = React.useRef({ adapter, locked, onBlur, onChange, onErrorChange });

  const undoFocusToken = React.useId();
  const a11yInputId = React.useId();
  const a11yErrorId = `${a11yInputId}-error`;

  React.useLayoutEffect(() => {
    latest.current = { adapter, locked, onBlur, onChange, onErrorChange };
  }, [adapter, locked, onBlur, onChange, onErrorChange]);

  React.useLayoutEffect(() => {
    effectiveInvalidDraftRef.current = effectiveInvalidDraft;
  }, [effectiveInvalidDraft]);

  React.useLayoutEffect(() => {
    touchedRef.current = touched;
    localVisualErrorRef.current = localVisualError;
  }, [localVisualError, touched]);

  React.useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  React.useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    if (pendingSelection === null) return;
    pendingSelectionRef.current = null;

    const el = inputElRef.current;
    restoreInputSelectionAfterControlledChange(el, pendingSelection);
  }, [draft]);

  const hasPhysicalFocus = React.useCallback((): boolean => elementHasPhysicalFocus(inputElRef.current), []);

  // Autoritativ snapshot-epoch (bumpes ved load/reset/migration/undo-redo-restore). En ændring her er
  // et autoritativt replace-event, der pr. undo-redo-kontrakten aldrig sker midt i en åben editor —
  // derfor SKAL draften resyncs selv hvis cellen aktuelt har fokus. Erstatter det tidligere
  // draftHistoryRegistry-push for tabelceller.
  const authoritativeEpoch = useAuthoritativeSnapshotEpochSelector();
  const lastAuthoritativeEpochRef = React.useRef(authoritativeEpoch);

  // Resync: når cellen ikke er aktivt redigeret, følger draften den eksterne kilde
  // (`committedInvalidDraft ?? format(value)`). Dækker committed value-ændringer (afledte kolonner,
  // andre cellers commit), F5-rehydrering og undo/redo-restore — alt via den normale store→prop-vej.
  React.useEffect(() => {
    const command = decideFieldResync(
      {
        epochChanged: authoritativeEpoch !== lastAuthoritativeEpochRef.current,
        externalSource,
        currentFormattedValue: committedDisplayValue,
        pending: pendingCommitRef.current,
        // isEditing / åben editor, fysisk fokus, eller en afventende (endnu ikke-committet) draft-ændring.
        isActivelyEditing: isEditing || hasPhysicalFocus() || pendingDraftCommitRef.current,
      }
    );
    if (command.commitEpoch) lastAuthoritativeEpochRef.current = authoritativeEpoch;
    if (command.clearPending) pendingCommitRef.current = null;
    if (command.nextDraft !== null) {
      const next = command.nextDraft;
      setDraft((prev) => (prev === next ? prev : next));
      draftRef.current = next;
      if (command.isAuthoritativeReplace) {
        setTouched(effectiveInvalidDraft !== undefined);
        keyInitiatedEditRef.current = false;
        setKeyInitiatedEdit(false);
      } else if (effectiveInvalidDraft !== undefined) {
        // En ny committed rå draft dukkede op via store (fx en sideløbende commit) — vis fejlen.
        setTouched(true);
      }
    }
  }, [authoritativeEpoch, committedDisplayValue, externalSource, effectiveInvalidDraft, hasPhysicalFocus, isEditing]);

  const resetEditingState = React.useCallback(() => {
    keyInitiatedEditRef.current = false;
    setKeyInitiatedEdit(false);
  }, []);

  // Committed visual-only fejl (fx en tilladt, men uden-for-interval værdi) udledes af den committede
  // model. Undertrykkes mens en ikke-committbar rå draft er aktiv (input-fejlen har forrang).
  const committedVisualError = React.useMemo(() => {
    if (!touched || effectiveInvalidDraft !== undefined) return '';
    return adapter.getCommittedVisualError?.(value)?.trim() ?? '';
  }, [adapter, effectiveInvalidDraft, touched, value]);

  // Reconciler local visual-fejl mod den committede værdi når cellen ikke redigeres: når feltet er
  // idle, gen-udledes fejlen direkte fra modellen (getCommittedVisualError), så en stale visual-fejl
  // ryddes når den committede værdi ikke længere er uden for interval. (Mens der redigeres bevares
  // den lokale visual-fejl, så onErrorChange kan signalere den straks ved commit, før `value` indhenter.)
  React.useLayoutEffect(() => {
    latestCommittedPayloadRef.current = adapter.toCommittedPayload(value);
    if (!isEditing && localVisualError !== '') {
      const nextVisualError = adapter.getCommittedVisualError?.(value)?.trim() ?? '';
      if (nextVisualError !== localVisualError) {
        setLocalVisualError(nextVisualError);
      }
    }
  }, [adapter, isEditing, localVisualError, value]);

  // Edit-start: når brugeren åbner editoren (ikke tast-initieret), seed draften fra committed værdi —
  // medmindre der er en bevaret ikke-committbar rå draft, som brugeren skal kunne rette.
  React.useLayoutEffect(() => {
    const wasEditing = wasEditingRef.current;
    wasEditingRef.current = isEditing;
    if (!isEditing) {
      resetEditingState();
      return;
    }
    if (wasEditing) return;
    originalTouchedOnEditStartRef.current = touchedRef.current;
    originalLocalVisualErrorOnEditStartRef.current = localVisualErrorRef.current;
    if (!keyInitiatedEditRef.current) {
      if ((adapter.preserveInvalidDraft ?? true) && effectiveInvalidDraftRef.current !== undefined) {
        originalValueOnEditStartRef.current = draftRef.current;
        return;
      }
      const committedValue = adapter.toDraftString?.(value) ?? adapter.format(value);
      originalValueOnEditStartRef.current = committedValue;
      draftRef.current = committedValue;
      setDraft(committedValue);
    }
  }, [adapter, isEditing, resetEditingState, value]);

  // Display-afledning af fejl-tilstanden.
  const inputErrorMessage = React.useMemo(() => {
    // Fejlen vises kun mens draften aktuelt VISER den ikke-committbare rå draft (ikke mens brugeren
    // taster en ny korrektion). Beskeden gen-udledes ved at re-parse råstrengen (single source of truth).
    if (!shouldDeriveInvalidDraftError(effectiveInvalidDraft, draft)) return '';
    const parsed = adapter.parse(effectiveInvalidDraft);
    return parsed.ok ? '' : parsed.errorMessage;
  }, [adapter, draft, effectiveInvalidDraft]);

  const hasInputError = inputErrorMessage !== '';
  const hasCommittedVisualError = committedVisualError !== '';

  // To visual-fejl-notioner (bevidst adskilt, jf. den tidligere imperative onErrorChange + display-gating):
  // - `visualErrorActive` (ugated): signalet til kalderen/aggregatet. Sandt straks efter et commit med
  //   visualErrorMessage — også før `value`-proppen har indhentet. Reconciles mod committed værdi af
  //   layout-effekten, så snart cellen ikke redigeres.
  // - `hasLocalVisualError` (gated): DISPLAY-tilstanden. En lokal visual-fejl undertrykkes, når adapteren
  //   kan udlede committed visual-fejl OG den committede værdi ikke længere har én (fx efter at en
  //   bounds-konfiguration er løsnet, mens editoren stadig står åben pga. et noop-commit).
  const visualErrorActive = localVisualError !== '' || hasCommittedVisualError;
  const hasLocalVisualError =
    localVisualError !== '' && (adapter.getCommittedVisualError === undefined || hasCommittedVisualError);

  const errorKind: TableInputErrorKind = hasInputError
    ? 'input'
    : hasLocalVisualError || hasCommittedVisualError
      ? 'visual'
      : 'none';
  const effectiveHasError = hasInputError || hasLocalVisualError || hasCommittedVisualError;

  // Underret kalderen (feature-tabellen) deterministisk om fejl-tilstanden, så aggregater
  // (fx EO `:loenindkomst`) og PDF/debug-gates forbliver i sync. Bruger den ugatede visual-notion, så
  // signalet ikke lagger bag `value`-proppen ved commit. (Erstatter de tidligere imperative
  // onErrorChange-kald i setLocalError/clearLocalError/setVisualError.)
  const reportedHasError = hasInputError || visualErrorActive;
  const reportedKind: TableInputErrorKind = hasInputError ? 'input' : visualErrorActive ? 'visual' : 'none';
  const lastReportedErrorInfoRef = React.useRef<TableInputErrorInfo | null>(null);
  React.useEffect(() => {
    const next: TableInputErrorInfo = { hasError: reportedHasError, kind: reportedKind };
    const prev = lastReportedErrorInfoRef.current;
    if (prev !== null && prev.hasError === next.hasError && prev.kind === next.kind) return;
    lastReportedErrorInfoRef.current = next;
    latest.current.onErrorChange?.(next);
  }, [reportedHasError, reportedKind]);

  const commitAndEmitBlur = React.useCallback(
    (rawDraft: string): boolean => {
      // Undertryk commit udløst af en undo/redo-fokus-flytning (jf. useDraftField): cellen blur'er
      // programmatisk når restore flytter fokus, og må ikke committe en forældet draft. Returnér true
      // (behandl som no-op), så kalderen ikke tror committen fejlede; draften resyncs via epoch-effekten.
      if (isRestoreFocusInProgress()) return true;
      pendingDraftCommitRef.current = false;
      setTouched(true);
      const current = latest.current;
      const parsed = current.adapter.parse(rawDraft);
      if (!parsed.ok) {
        // Ikke-committbar: bevar committed værdi; persistér/bevar den RÅ draft, så fejlvisningen
        // (draft === effektiv ugyldig draft) holder, og restore gendanner det viste input.
        pendingCommitRef.current = null;
        if (!writeInvalidDraft(rawDraft)) {
          draftRef.current = committedDisplayValue;
          setDraft(committedDisplayValue);
          return false;
        }
        setLocalVisualError('');
        draftRef.current = rawDraft;
        setDraft(rawDraft);
        return false;
      }

      // Committbar.
      const nextPayload = current.adapter.toCommittedPayload(parsed.value);
      const isNoop = nextPayload.fingerprint === latestCommittedPayloadRef.current.fingerprint;
      if (parsed.visualErrorMessage !== undefined && parsed.visualErrorMessage.trim() !== '') {
        // Parret invariant (jf. tableInputAdapter.ts): en adapter der kan returnere visualErrorMessage SKAL
        // også implementere getCommittedVisualError. Ellers rydder idle-reconcile-effekten den lokale
        // visual-fejl med det samme ved editor-luk (getCommittedVisualError?.() ?? '' → ''), så fejlen
        // forsvinder uberettiget. Fail-closed DEV-guard så en ny adapter ikke kan bryde parringen i stilhed.
        if (import.meta.env.DEV && current.adapter.getCommittedVisualError === undefined) {
          console.error(
            '[useTableInputCore] Adapter returnerer visualErrorMessage fra parse() uden at implementere ' +
              'getCommittedVisualError. Den visuelle fejl ryddes da ved editor-luk. Implementér parret getCommittedVisualError.'
          );
        }
        setLocalVisualError(parsed.visualErrorMessage);
      } else {
        setLocalVisualError('');
      }
      if (isNoop) {
        pendingCommitRef.current = null;
        // Værdi-commit er en no-op (committed værdi uændret) → intet onBlur/value-commit. Ryd alligevel en
        // evt. tilbageværende ugyldig rå draft; den fanger sin egen undo-frame, så undo ikke springer
        // rydningen over.
        return clearInvalidDraftEntry();
      }

      // Synk optimistisk til den committede repræsentation og hold resync tilbage, indtil `value`
      // (og evt. invalidDraft-rydning) har indhentet — undgår flicker til den stale committede display.
      const formattedValueAtCommit = current.adapter.format(latestCommittedPayloadRef.current.model);
      const target = current.adapter.format(parsed.value);
      draftRef.current = target;
      setDraft(target);
      // Kun nødvendigt når display'et faktisk ændrer sig; ellers ingen flicker-risiko (og guarden ville
      // ikke kunne afmeldes, fordi committedDisplayValue aldrig divergerer fra formattedValueAtCommit).
      pendingCommitRef.current = target !== formattedValueAtCommit ? { formattedValueAtCommit } : null;
      // Gridets row-pipeline persisterer i et efterfølgende React-trin. Stage derfor den præcise clear,
      // så usePersistedForm kan flette den ind i samme transaktion som sektionsværdien. Den rå ugyldige
      // tekst bliver stående, hvis værdipersistencen fejler.
      const stagedClear = useChannel
        && channelRejectedClear !== undefined
        && effectiveInvalidDraftRef.current !== undefined
        && current.onBlur !== undefined
        ? {
            ...channelRejectedClear,
            expectedRaw: effectiveInvalidDraftRef.current,
          }
        : undefined;
      try {
        const committed = stagedClear === undefined
          ? current.onBlur?.({ target: { value: nextPayload.model } })
          : withActiveLegacyGridRejectedClear({
              section: stagedClear.pageKey,
              undoFieldPath: resolvedGridCellKey,
              clear: stagedClear,
            }, () => current.onBlur?.({ target: { value: nextPayload.model } }));
        if (
          committed === false ||
          (stagedClear === undefined && !clearInvalidDraftEntry())
        ) {
          if (stagedClear !== undefined) {
            cancelLegacyGridRejectedClear(stagedClear.pageKey, stagedClear.fieldPath);
          }
          pendingCommitRef.current = null;
          draftRef.current = committedDisplayValue;
          setDraft(committedDisplayValue);
          return false;
        }
      } catch {
        if (stagedClear !== undefined) {
          cancelLegacyGridRejectedClear(stagedClear.pageKey, stagedClear.fieldPath);
        }
        pendingCommitRef.current = null;
        draftRef.current = committedDisplayValue;
        setDraft(committedDisplayValue);
        return false;
      }
      return true;
    },
    [
      channelRejectedClear,
      clearInvalidDraftEntry,
      committedDisplayValue,
      resolvedGridCellKey,
      useChannel,
      writeInvalidDraft,
    ]
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isReadOnly) return;
      const rawDraft = e.target.value ?? '';
      const normalizeDraftChange = latest.current.adapter.normalizeDraftChange;
      const nextDraft = normalizeDraftChange?.(rawDraft) ?? rawDraft;
      if (latest.current.adapter.clearTouchedOnEmptyDraft && nextDraft === '') {
        setTouched(false);
      }
      pendingSelectionRef.current = normalizeDraftChange
        ? mapSelectionThroughDraftNormalization(
            rawDraft,
            nextDraft,
            {
              selectionStart: e.currentTarget.selectionStart,
              selectionEnd: e.currentTarget.selectionEnd,
            },
            normalizeDraftChange
          )
        : null;
      // Mens brugeren taster, divergerer draft fra den ikke-committbare rå draft → input-fejlen
      // skjules automatisk (afledt). Selve `invalidDrafts`-entryet ryddes først ved (gyldigt) commit.
      pendingCommitRef.current = null;
      draftRef.current = nextDraft;
      pendingDraftCommitRef.current = true;
      setDraft(nextDraft);
      latest.current.onChange?.({ target: { value: nextDraft } });
    },
    [isReadOnly]
  );

  const handleFocus = React.useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      if (latest.current.locked) {
        pendingDraftCommitRef.current = false;
        return;
      }
      const shouldCommit = !e.currentTarget.readOnly || pendingDraftCommitRef.current;
      if (!shouldCommit) return;
      const rawValue = e.currentTarget.readOnly && pendingDraftCommitRef.current
        ? draftRef.current
        : e.currentTarget.value ?? '';
      commitAndEmitBlur(rawValue);
    },
    [commitAndEmitBlur]
  );

  const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (latest.current.adapter.filterKeyDown?.(e, { isEditing, hasError: hasInputError })) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, [hasInputError, isEditing]);

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const applyPaste = latest.current.adapter.applyPaste;
      if (!applyPaste) return;

      e.preventDefault();
      e.stopPropagation();
      const raw = readClipboardText(e);
      const applied = applyPaste(raw, {
        currentDraft: draftRef.current,
        isEditing,
        selectionStart: typeof e.currentTarget.selectionStart === 'number' ? e.currentTarget.selectionStart : null,
        selectionEnd: typeof e.currentTarget.selectionEnd === 'number' ? e.currentTarget.selectionEnd : null,
      });
      if (applied === null) return;

      pendingCommitRef.current = null;
      draftRef.current = applied.draft;
      pendingDraftCommitRef.current = true;
      setDraft(applied.draft);
      latest.current.onChange?.({ target: { value: applied.draft } });
      if (!isEditing) {
        commitAndEmitBlur(applied.draft);
        setIsFocused(true);
        return;
      }
      if (typeof applied.caretPosition === 'number') {
        const caretPosition = applied.caretPosition;
        requestAnimationFrame(() => {
          const el = inputElRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(caretPosition, caretPosition);
          } catch {
            // Browseren kan afvise selection på visse inputtyper; draften er stadig sat.
          }
        });
      }
    },
    [commitAndEmitBlur, isEditing]
  );

  const handleCopy = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      const showsDraft = isEditing || (touched && (hasInputError || hasLocalVisualError));
      copyWholeValueFromReadOnlyField(e, {
        isReadOnly,
        value: showsDraft ? draft : adapter.toClipboardString?.(value) ?? adapter.format(value),
        selectionStart: e.currentTarget.selectionStart,
        selectionEnd: e.currentTarget.selectionEnd,
      });
    },
    [adapter, draft, hasInputError, hasLocalVisualError, isEditing, isReadOnly, touched, value]
  );

  const handleDoubleClick = React.useCallback(() => {
    if (latest.current.locked) return;
    gridApi.openEditing(gridCell, 'doubleClick');
    const el = inputElRef.current;
    if (!el) return;
    el.focus();
    try {
      el.select();
    } catch {
      // Browseren kan afvise selection på visse inputtyper; editoren er stadig åbnet.
    }
  }, [gridApi, gridCell]);

  const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
    return {
      getElement: () => inputElRef.current,
      getIsLocked: () => latest.current.locked ?? false,
      commitCurrent: () => {
        if (latest.current.locked) return true;
        const ok = commitAndEmitBlur(inputElRef.current?.value ?? draftRef.current);
        if (!ok) return false;
        setIsFocused(false);
        gridApi.closeEditing();
        return true;
      },
      clearAndCommit: () => {
        if (latest.current.locked) return;
        resetEditingState();
        pendingDraftCommitRef.current = false;
        setTouched(false);
        draftRef.current = '';
        setDraft('');
        const ok = commitAndEmitBlur('');
        if (!ok) return;
        gridApi.closeEditing();
      },
      cancelEdit: () => {
        if (latest.current.locked) return;
        resetEditingState();
        pendingDraftCommitRef.current = false;
        pendingCommitRef.current = null;
        setTouched(originalTouchedOnEditStartRef.current);
        setLocalVisualError(originalLocalVisualErrorOnEditStartRef.current);
        // Escape gendanner præcis den afsluttede starttilstand. Et allerede rejected input er derfor
        // fortsat aktuelt input; rydning her ville være en ny brugerhandling og kunne afdække stale canonical data.
        const startValue = originalValueOnEditStartRef.current;
        draftRef.current = startValue;
        setDraft(startValue);
        gridApi.closeEditing();
      },
      prepareEditFromKey: (key: string) => {
        if (latest.current.locked) return false;
        if (!latest.current.adapter.isValidStartKey(key)) return false;
        const startValue = effectiveInvalidDraftRef.current === undefined
          ? latest.current.adapter.toDraftString?.(latestCommittedPayloadRef.current.model)
            ?? latest.current.adapter.format(latestCommittedPayloadRef.current.model)
          : draftRef.current;
        originalValueOnEditStartRef.current = startValue;
        originalTouchedOnEditStartRef.current = touchedRef.current;
        originalLocalVisualErrorOnEditStartRef.current = localVisualErrorRef.current;
        keyInitiatedEditRef.current = true;
        setKeyInitiatedEdit(true);
        setTouched(false);
        pendingCommitRef.current = null;
        draftRef.current = key;
        pendingDraftCommitRef.current = true;
        setDraft(key);
        requestAnimationFrame(() => {
          const el = inputElRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(el.value.length, el.value.length);
          } catch {
            // Browseren kan afvise selection på visse inputtyper; edit-start er stadig gyldig.
          }
        });
        return true;
      },
      selectAll: () => {
        const el = inputElRef.current;
        if (el) {
          el.focus();
          try {
            el.select();
          } catch {
            // Browseren kan afvise selection på visse inputtyper; RAF-fallback forsøger igen.
          }
        }
        requestAnimationFrame(() => inputElRef.current?.select());
      },
    };
  }, [commitAndEmitBlur, gridApi, resetEditingState]);

  React.useEffect(() => {
    gridApi.registerEditor(gridCell, editorHandle);
    return () => {
      gridApi.unregisterEditor(gridCell);
    };
    // resolvedGridCellKey er en stabil streng-repræsentation af gridCell-koordinaterne.
    // gridCell er intentionelt udeladt fra dep-arrayet for at undgå re-registrering
    // ved inline object literals i caller (ny reference, samme værdier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorHandle, gridApi, resolvedGridCellKey]);

  const externalErrorText = (externalErrorMessage ?? '').trim();
  const hasExternalError = externalErrorText !== '';
  const displayErrorMessage = hasInputError
    ? inputErrorMessage
    : hasCommittedVisualError
      ? committedVisualError
      : hasLocalVisualError
        ? localVisualError
        : externalErrorText;
  const showError = (effectiveHasError || hasExternalError) && !isFocused && (touched || !isEditing);
  const renderedValue = isEditing
    ? draft
    : effectiveInvalidDraft !== undefined
      ? draft
      : touched && hasLocalVisualError
        ? draft
        : committedDisplayValue;

  const inputRefCallback = React.useCallback(
    (el: HTMLInputElement | null) => {
      inputElRef.current = el;
      assignRef(inputRef, el);
    },
    [inputRef]
  );

  return {
    draft,
    renderedValue,
    isFocused,
    touched,
    hasError: effectiveHasError,
    errorMessage: displayErrorMessage,
    showError,
    errorKind,
    isEditing,
    isReadOnly,
    cellFocused,
    inputElRef,
    inputRefCallback,
    undoFocusToken,
    gridCellKey: resolvedGridCellKey,
    undoFieldPathAliasesAttr,
    invalidDraftFieldPath: channelFieldPath,
    a11yInputId,
    htmlInputName: resolvedGridCellKey,
    a11yErrorId,
    keyInitiatedEdit,
    handleChange,
    handleFocus,
    handleBlur,
    handleKeyDown,
    handlePaste,
    handleCopy,
    handleDoubleClick,
  };
};
