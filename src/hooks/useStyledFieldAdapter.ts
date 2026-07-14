import * as React from 'react';
import { useDraftField, type DraftFieldError, type DraftParse } from './useDraftField';
import {
  useTwoStageInputActivation,
  type TwoStageStartSource,
} from './useTwoStageInputActivation';
import { useFieldInvalidDraftChannel } from './useFormFieldErrors';
import type { FieldErrorReporter } from '../types/fieldErrors';
import { readClipboardText } from '../utils/clipboardUtils';
import {
  mapSelectionThroughDraftNormalization,
  restoreInputSelectionAfterControlledChange,
  type InputSelectionSnapshot,
  type NormalizedSelection,
} from '../utils/inputSelectionUtils';
import { useCriticalActionParticipant } from '../criticalActions/CriticalActionContext';
import { createElementFocusTarget } from '../criticalActions/focusTarget';

/**
 * Delt commit-/redigerings-skelet for de syv single-`<input>` "blur-commit"-felter
 * (Amount, Date, Integer, Percent, Fraction, Week, Year).
 *
 * Hook'en ejer den identiske, mekaniske lim, der tidligere var duplikeret i hver adapter:
 * - `useFieldInvalidDraftChannel` + `useDraftField`-opkobling (med onCommit der rydder invalidDrafts)
 * - to-trins-editor-aktivering (`useTwoStageInputActivation`)
 * - `handleDraftChange` (skip-blur-reset → transform → side-effekt → setDraft → onDraftChange)
 * - keydown-skelettet: editor-lukket (Backspace/Delete-clear ELLER aktiverings-tast) vs.
 *   editor-åben (useDraftField-keydown → Enter/Escape → tegnfilter)
 * - blur-skelettet (ignore-blur-guard → unchanged-guard → commit → luk → flag-reset)
 * - paste-skelettet (lukket: aktivering/commit; åben: normaliser + splice [+ caret])
 *
 * Per-felt-variation udtrykkes via veldefinerede, defaultede *seams* — parse/format og felt-unik
 * tilstand (range-fejl, display-hukommelse, adornments) bliver i komponenten.
 *
 * `StyledTextField` (fri tekst + textarea) bruger BEVIDST IKKE denne hook: den har to render-mål,
 * fri-tekst-semantik (intet tegnfilter/paste-normalisering) og caret-limbo-fixet med to aktiveringer.
 *
 * Form-kontrakt: alle disse felter committer på blur/Enter (ikke onChange). Backspace/Delete på en
 * lukket editor er den dokumenterede immediate-commit-undtagelse.
 */
export type UseStyledFieldAdapterConfig<TModel> = Readonly<{
  value: TModel;

  /** Feltets kanoniske committed-repræsentation (stabil for ækvivalente værdier). */
  format: (value: TModel) => string;
  parse: DraftParse<TModel>;
  /** Normalisering anvendt før commit-parse (fx trim). Default: identitet. */
  normalizeDraftOnCommit?: (draft: string) => string;

  /** To-trins-aktivering: hvilken draft en tast skal starte redigering med (null = ignorér). */
  getDraftForKey: (key: string) => string | null;
  /** Normalisering af indsat tekst (bruges til både aktiverings-paste og åben-editor-splice). */
  normalizePasteText?: (text: string) => string;
  /** Åbn editoren ved første klik uden forudgående fokus (touch/mobil). */
  singleStageClick?: boolean;
  /**
   * Kaldes når editoren åbnes. Modtager runtime-helpers (nuværende draft/fejl/DOM-element + setDraft),
   * så fx Amount kan canonicalisere draften ved klik uden cirkulær reference til hook-resultatet.
   */
  onStartEditing?: (
    source: TwoStageStartSource,
    helpers: Readonly<{
      draft: string;
      error: DraftFieldError | undefined;
      inputElement: HTMLInputElement | null;
      setDraft: (draft: string) => void;
    }>
  ) => void;

  /** Rå model-commit. Hook'en wrapper og rydder invalidDrafts efter. */
  onCommit?: (nextValue: TModel) => boolean;
  /** Draft-callback (kun typing). Modtager den transformerede draft. */
  onDraftChange?: (draft: string) => void;
  /** Producer-owned fejlrapportør (driver invalidDraft-kanalen). */
  onFieldError?: FieldErrorReporter;

  /**
   * Visuel fejl for en committet modelværdi. Fejlen rekonstrueres også efter
   * load/navigation og rapporteres altid som ikke-blokerende for Gem.
   */
  getVisualError?: (value: TModel) => string;

  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  disabled?: boolean;
  /** Når sand deaktiveres aktivering helt (fx ved config-fejl). */
  blocked?: boolean;
  clearTouchedOnEmptyDraft?: boolean;

  // --- Seams (alle defaultede) ---

  /** Transformer typet/indsat draft før den sættes (fx Amount: fjern grupperings-separatorer). */
  transformDraftOnChange?: (draft: string) => string;
  /** Side-effekt ved enhver draft-ændring (fx Integer/Date: nulstil UI-range-fejl). */
  onDraftChangeSideEffect?: () => void;
  /** Afvis en (typet/indsat) draft helt (fx Amount: unær minus når allowNegative=false). */
  rejectDraft?: (nextDraft: string) => boolean;

  /** Tegnfilter anvendt i åben editor når eventet ikke allerede er håndteret. */
  keyFilter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Spring tegnfilteret over når feltet har en synlig (touched) invalid-fejl (Date/Week). */
  gateKeyFilterOnInvalidTouched?: boolean;

  /** Side-effekt i Backspace/Delete-clear-stien (fx Integer: nulstil UI-range-fejl). */
  onClearSideEffect?: () => void;

  /**
   * Afgør om blur skal committe. Default: draften afviger fra committed værdi, ELLER der lever en
   * ikke-committbar rå draft (så invalidDrafts kan ryddes ved clear/edit af et ugyldigt felt).
   */
  shouldCommitOnBlur?: (ctx: Readonly<{ draft: string; value: TModel; committedInvalidDraft: string | undefined }>) => boolean;

  /** Ved Escape: revert draften til `format(value)` før editoren lukkes (fx Percent's display-memory). */
  escapeRevertsToFormatted?: boolean;

  /** Sæt caret efter en åben-editor-splice-paste (Amount/Date/Fraction). */
  setPasteCaret?: boolean;
  /** Commit direkte ved paste mens editoren er lukket (fx Amount), i stedet for at åbne editoren. */
  commitOnClosedPaste?: boolean;
}>;

export type UseStyledFieldAdapterResult = Readonly<{
  draft: string;
  isEditorOpen: boolean;
  error: DraftFieldError | undefined;
  visualErrorMessage: string;
  touched: boolean;
  inputElementRef: React.RefObject<HTMLInputElement | null>;

  handleDraftChange: (nextDraft: string) => void;
  handleFocus: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleMouseDown: (e: React.MouseEvent<HTMLElement>) => void;
  handleClick: (e: React.MouseEvent<HTMLElement>) => void;

  /** Imperativt commit af nuværende draft (sjældent nødvendigt; blur/Enter dækker normalt). */
  commit: () => void;
  /** Sæt + commit en draft (fx Amount lukket-paste). */
  commitDraft: (nextDraft: string) => void;
  /** Unified rydning af den effektive ikke-committbare rå draft (bundet store ELLER lokal fallback). */
  clearInvalidDraft: () => boolean;
  /** Feltets effektive ikke-committbare rå draft (bundet kanalværdi eller lokal fallback). */
  committedInvalidDraft: string | undefined;
}>;

const identity = (draft: string): string => draft;

export const useStyledFieldAdapter = <TModel>(
  config: UseStyledFieldAdapterConfig<TModel>
): UseStyledFieldAdapterResult => {
  const {
    value,
    format,
    parse,
    normalizeDraftOnCommit,
    getDraftForKey,
    normalizePasteText,
    singleStageClick,
    onStartEditing,
    onCommit,
    onDraftChange,
    onFieldError,
    getVisualError,
    onFocus,
    onBlur,
    onKeyDown,
    disabled,
    blocked = false,
    clearTouchedOnEmptyDraft,
    transformDraftOnChange = identity,
    onDraftChangeSideEffect,
    rejectDraft,
    keyFilter,
    gateKeyFilterOnInvalidTouched = false,
    onClearSideEffect,
    shouldCommitOnBlur,
    escapeRevertsToFormatted = false,
    setPasteCaret = false,
    commitOnClosedPaste = false,
  } = config;

  const inputElementRef = React.useRef<HTMLInputElement>(null);
  const criticalActionParticipantId = React.useId();
  const skipNextBlurCommitRef = React.useRef(false);
  const pendingSelectionRef = React.useRef<NormalizedSelection | null>(null);

  const {
    committedInvalidDraft: channelCommittedInvalidDraft,
    onCommitInvalid,
    clearInvalidDraft: channelClearInvalidDraft,
  } = useFieldInvalidDraftChannel(onFieldError);

  // Eneste commit-værdi-sti: kald komponentens onCommit OG ryd (bundne) invalidDrafts.
  //
  // Atomisk finalize (greenfield draft/commit §4.4): committer et felt gennem `setFieldValue` (den
  // kanoniske skalar-felt-committer, hvor feltnavnet ER invalidDrafts-storage-nøglen), rydder sektion-
  // committen selv draften ATOMISK i samme transaktion. Den efterfølgende `channelClearInvalidDraft`
  // her er da en no-op og fanger ingen ekstra undo-frame. Nested-updatere skal sende den præcise
  // `clearInvalidDraft` sammen med sektionscommittet; resterende adapters migreres i fase 4. Den bundne
  // rydning ejes bevidst her (commit-rækkefølge: værdi først, så defensiv clear); den ubundne
  // (lokale) ejer useDraftField selv. Bruges af både useDraftField og Backspace/Delete-clear-stien.
  const commitValue = React.useCallback(
    (nextValue: TModel) => {
      const committed = onCommit?.(nextValue);
      if (committed === false) return false;
      if (channelClearInvalidDraft?.() === false) return false;
      return true;
    },
    [channelClearInvalidDraft, onCommit]
  );

  const {
    draft,
    setDraft,
    touched,
    error,
    // Autoritativ EFFEKTIV ugyldig draft + unified rydning (bundet ELLER lokal). Alle invalid-draft-
    // beslutninger nedenfor bruger DISSE — ikke kanalens rå værdier, der er tomme for ubundne felter.
    effectiveInvalidDraft,
    clearInvalidDraft,
    onFocus: onFocusBase,
    onBlur: onBlurBase,
    onKeyDown: onKeyDownBase,
    commit,
    commitDraft,
  } = useDraftField<TModel>({
    value,
    format,
    parse,
    normalizeDraftOnCommit,
    onCommit: commitValue,
    onCommitInvalid,
    committedInvalidDraft: channelCommittedInvalidDraft,
    clearInvalidDraft: channelClearInvalidDraft,
    inputElementRef,
    commitOnBlur: false,
    clearTouchedOnEmptyDraft,
  });

  const handleDraftChange = React.useCallback(
    (nextDraft: string, selection?: InputSelectionSnapshot) => {
      const transformed = transformDraftOnChange(nextDraft);
      skipNextBlurCommitRef.current = false;
      onDraftChangeSideEffect?.();
      pendingSelectionRef.current = selection
        ? mapSelectionThroughDraftNormalization(nextDraft, transformed, selection, transformDraftOnChange)
        : null;
      setDraft(transformed);
      onDraftChange?.(transformed);
    },
    [onDraftChange, onDraftChangeSideEffect, setDraft, transformDraftOnChange]
  );

  React.useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    if (pendingSelection === null) return;
    pendingSelectionRef.current = null;

    const el = inputElementRef.current;
    restoreInputSelectionAfterControlledChange(el, pendingSelection);
  }, [draft]);

  const activation = useTwoStageInputActivation<HTMLElement>({
    disabled: Boolean(disabled || blocked),
    singleStageClick,
    getDraftForKey,
    normalizePasteText,
    onStartEditing: onStartEditing
      ? (source) =>
          onStartEditing(source, {
            draft,
            error,
            inputElement: inputElementRef.current,
            setDraft: handleDraftChange,
          })
      : undefined,
    onReplaceDraft: (nextDraft) => {
      if (rejectDraft?.(nextDraft)) return;
      handleDraftChange(nextDraft);
    },
  });

  const handleFocus = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      onFocusBase();
      onFocus?.(e);
    },
    [onFocus, onFocusBase]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!activation.isEditorOpen) {
        if (e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          e.stopPropagation();
          // UNDTAGELSE TIL "INGEN LIVE PREVIEW": commit øjeblikkeligt ved Backspace/Delete på lukket editor.
          // Commit kun hvis rydningen faktisk ændrer noget (committed værdi eller en rå ikke-committbar
          // draft) — et ubetinget commit på et allerede tomt felt ville give en overflødig undo-frame.
          const normalized = (normalizeDraftOnCommit ?? identity)('');
          const result = parse(normalized);
          if (result.ok && (value !== result.value || effectiveInvalidDraft !== undefined)) {
            commitValue(result.value);
          }
          // Ryd evt. stale ikke-committbar rå draft (ellers re-syncer feltet til den gamle ugyldige værdi).
          // Unified clear: rydder den EFFEKTIVE tilstand — bundet store ELLER lokal fallback. (Tidligere
          // kun kanalens bundne clear → ubundne felter (fx Satser-årstal) fik aldrig ryddet den lokale
          // draft, og feltet re-syncede den ugyldige værdi tilbage ved blur.)
          clearInvalidDraft();
          onClearSideEffect?.();
          setDraft('');
          return;
        }
        activation.handleKeyDown(e);
        if (e.defaultPrevented) return;
        onKeyDown?.(e);
        return;
      }

      onKeyDownBase(e);
      if (e.defaultPrevented && e.key === 'Enter') {
        skipNextBlurCommitRef.current = true;
      }
      if (e.defaultPrevented && e.key === 'Escape') {
        if (escapeRevertsToFormatted) handleDraftChange(format(value));
        // Et blur følger umiddelbart efter editor-luk; det må aldrig committe den forkastede draft.
        skipNextBlurCommitRef.current = true;
        activation.closeEditor();
        return;
      }
      if (
        !e.defaultPrevented &&
        keyFilter &&
        !(gateKeyFilterOnInvalidTouched && touched && error?.kind === 'invalid')
      ) {
        keyFilter(e);
      }
      onKeyDown?.(e);
    },
    [
      activation,
      clearInvalidDraft,
      commitValue,
      effectiveInvalidDraft,
      error?.kind,
      escapeRevertsToFormatted,
      format,
      gateKeyFilterOnInvalidTouched,
      handleDraftChange,
      keyFilter,
      normalizeDraftOnCommit,
      onClearSideEffect,
      onKeyDown,
      onKeyDownBase,
      parse,
      setDraft,
      touched,
      value,
    ]
  );

  const handlePaste = React.useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      if (!activation.isEditorOpen) {
        if (commitOnClosedPaste) {
          const normalized = (normalizePasteText ?? identity)(readClipboardText(e));
          e.preventDefault();
          e.stopPropagation();
          if (normalized === '') return;
          // Et blur følger commit'et; det må ikke committe igen.
          skipNextBlurCommitRef.current = true;
          commitDraft(normalized);
          return;
        }
        activation.handlePaste(e);
        return;
      }

      const normalized = (normalizePasteText ?? identity)(readClipboardText(e));
      e.preventDefault();
      e.stopPropagation();
      if (normalized === '') return;

      const input = inputElementRef.current;
      const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
      const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
      const nextDraft = draft.slice(0, start) + normalized + draft.slice(end);
      if (rejectDraft?.(nextDraft)) return;
      handleDraftChange(nextDraft);

      if (setPasteCaret) {
        const nextCaret = start + normalized.length;
        requestAnimationFrame(() => {
          const el = inputElementRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(nextCaret, nextCaret);
          } catch {
            // no-op
          }
        });
      }
    },
    [activation, commitDraft, commitOnClosedPaste, draft, handleDraftChange, normalizePasteText, rejectDraft, setPasteCaret]
  );

  const defaultShouldCommit = draft !== format(value) || effectiveInvalidDraft !== undefined;

  // Visuelle fejl udledes kun af committed state. En ikke-committbar rå draft
  // har forrang, så range-feedback aldrig beregnes fra det brugeren er ved at taste.
  const visualErrorMessage = React.useMemo(() => {
    if (effectiveInvalidDraft !== undefined || error?.message) return '';
    return getVisualError?.(value).trim() ?? '';
  }, [effectiveInvalidDraft, error?.message, getVisualError, value]);

  React.useEffect(() => {
    if (!onFieldError) return;
    onFieldError(
      visualErrorMessage === ''
        ? undefined
        : { message: visualErrorMessage, blocksSave: false }
    );
  }, [onFieldError, visualErrorMessage]);

  const handleBlur = React.useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // Ignorér det blur der stammer fra aktiverings-hookens programmatiske re-fokus (caret-etablering).
      // Neutralt for felter uden `editableElementRef` (returnerer altid false).
      if (activation.shouldIgnoreBlur()) return;
      onBlurBase(e);
      const willCommit = shouldCommitOnBlur
        ? shouldCommitOnBlur({ draft, value, committedInvalidDraft: effectiveInvalidDraft })
        : defaultShouldCommit;
      if (!skipNextBlurCommitRef.current && willCommit) {
        commit();
      }
      if (activation.isEditorOpen) activation.closeEditor();
      skipNextBlurCommitRef.current = false;
      onBlur?.(e);
    },
    [activation, commit, effectiveInvalidDraft, defaultShouldCommit, draft, onBlur, onBlurBase, shouldCommitOnBlur, value]
  );

  useCriticalActionParticipant({
    id: `form-field:${criticalActionParticipantId}`,
    kind: 'form-field',
    isEditing: () => activation.isEditorOpen,
    getFocusTarget: () => createElementFocusTarget(() => inputElementRef.current),
    commit: () => {
      // Gem bruger præcis feltets normale commit-sti, men lukker lifecycle eksplicit, så
      // coordinatoren ikke behøver at vente på et blur-event eller en render-tick.
      skipNextBlurCommitRef.current = true;
      const committed = commit();
      if (!committed) return false;
      activation.closeEditor();
      inputElementRef.current?.blur();
      return true;
    },
  });

  return {
    draft,
    isEditorOpen: activation.isEditorOpen,
    error,
    visualErrorMessage,
    touched,
    inputElementRef,
    handleDraftChange,
    handleFocus,
    handleKeyDown,
    handlePaste,
    handleBlur,
    handleMouseDown: activation.handleMouseDown,
    handleClick: activation.handleClick,
    commit,
    commitDraft,
    clearInvalidDraft,
    committedInvalidDraft: effectiveInvalidDraft,
  };
};
