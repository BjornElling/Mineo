import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { interpretYear } from '../../utils/dateInputValidation';
import { yearHas53Weeks } from '../../utils/dateUtils';
import { filterWeekKeyDown } from './inputKeyFilters';
import { readClipboardText } from '../../utils/clipboardUtils';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { normalizeWeekPaste } from '../../utils/inputPasteNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { useFieldInvalidDraftChannel } from '../../hooks/useFormFieldErrors';

export type StyledWeekFieldValueChangeEvent = CommitEvent<string | undefined>;
export type StyledWeekFieldDraftChangeEvent = DraftChangeEvent;

export type StyledWeekFieldProps = {
  value: string | undefined;

  name?: string;
  width?: number | string;
  minYear?: number;
  maxYear?: number;
  /**
   * Politik for fortolkning af 1-2-cifrede år ved commit.
   *
   * - `reject`: afvis 1-2-cifrede år (skal indtaste 4 cifre)
   * - `infer`: udled århundrede via `interpretYear`
   * - `assume20xx`: fortolk altid som 20xx
   *
   * Default: `infer`.
   */
  twoDigitYearPolicy?: 'reject' | 'infer' | 'assume20xx';
  placeholder?: string;
  disabled?: boolean;

  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<string | undefined>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Producer-owned fejlrapportør (valgfri). Når angivet rapporterer feltet sin egen
   * invalid-draft-tilstand op til form-error-registret og rehydrerer den ugyldige draft
   * efter undo/redo eller remount via `getCurrentError()`.
   */
  onFieldError?: FieldErrorReporter;

  error?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
};

const formatWeek = (value: string | undefined): string => value ?? '';
const MAX_CANONICAL_WEEK_LENGTH = 7; // uu/åååå
// Tillad lidt flere draft-tegn end den kanoniske committede form for at understøtte eftergivende typing
// (fx separatorer/whitespace) uden at UI'et blokerer midt i indtastningen. Dette er en eksplicit UX-tolerance.
const MAX_WEEK_DRAFT_LENGTH = MAX_CANONICAL_WEEK_LENGTH + 2;

/**
 * Parse-regler for uge-input:
 * - Kanonisk committet form: `uu/åååå`
 * - 1-2-cifrede år accepteres kun ved commit og normaliseres via `interpretYear`
 */
const StyledWeekField = React.forwardRef<HTMLDivElement, StyledWeekFieldProps>(
  (
    {
      value,
      name,
      width = 120,
      minYear,
      maxYear,
      twoDigitYearPolicy = 'infer',
      placeholder = 'uu/åååå',
      disabled,
      onDraftChange,
      onCommit,
      onFocus,
      onBlur,
      onKeyDown,
      onFieldError,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      sx,
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement>(null);

    const parseWeek: DraftParse<string | undefined> = React.useCallback(
      (draft, { mode }) => {
        const trimmed = draft.trim();
        if (trimmed === '') return { ok: true, value: undefined };

        if (trimmed.length > MAX_WEEK_DRAFT_LENGTH) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt format' };
        }

        const normalized = trimmed.replace(/[ .:-]/g, '/');
        if (normalized.startsWith('/')) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt format' };
        }

        const [weekRaw = '', yearRaw = '', ...rest] = normalized.split('/');
        if (rest.length > 0) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt format' };
        }

        if (weekRaw === '' || yearRaw === '') {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt format' };
        }

        if (/[^0-9]/.test(weekRaw) || /[^0-9]/.test(yearRaw)) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt format' };
        }

        if (weekRaw.length > 2) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt format' };
        }

        const weekNum = Number.parseInt(weekRaw, 10);
        if (!Number.isFinite(weekNum) || weekNum < 1) {
          return { ok: false, kind: 'invalid', message: 'Ugyldig uge' };
        }

        if (yearRaw.length === 3) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt årstal' };
        }

        let yearNum: number | null = null;
        if (yearRaw.length === 1 || yearRaw.length === 2) {
          if (mode === 'typing') return { ok: false, kind: 'partial' };

          if (twoDigitYearPolicy === 'reject') {
            return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
          }

          if (twoDigitYearPolicy === 'assume20xx') {
            const parsed = Number.parseInt(yearRaw, 10);
            yearNum = Number.isFinite(parsed) ? 2000 + parsed : null;
          } else {
            const interpreted = interpretYear(yearRaw);
            yearNum = interpreted === null ? null : interpreted;
          }
        } else if (yearRaw.length === 4) {
          const parsedYear = Number.parseInt(yearRaw, 10);
          yearNum = Number.isFinite(parsedYear) ? parsedYear : null;
        } else {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt årstal' };
        }

        if (yearNum === null) {
          return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
        }

        if (typeof minYear === 'number' && yearNum < minYear) {
          if (typeof maxYear === 'number') {
            return { ok: false, kind: 'invalid', message: `År skal være mellem ${minYear} og ${maxYear}` };
          }
          return { ok: false, kind: 'invalid', message: `År skal være ${minYear} eller senere` };
        }
        if (typeof maxYear === 'number' && yearNum > maxYear) {
          if (typeof minYear === 'number') {
            return { ok: false, kind: 'invalid', message: `År skal være mellem ${minYear} og ${maxYear}` };
          }
          return { ok: false, kind: 'invalid', message: `År skal være ${maxYear} eller tidligere` };
        }

        const maxWeek = yearHas53Weeks(yearNum) ? 53 : 52;
        if (weekNum > maxWeek) {
          return { ok: false, kind: 'invalid', message: `Uge skal være mellem 1 og ${maxWeek}` };
        }

        const week = String(weekNum).padStart(2, '0');
        const year = String(yearNum);
        return { ok: true, value: `${week}/${year}` };
      },
      [maxYear, minYear, twoDigitYearPolicy]
    );

    const { committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = useFieldInvalidDraftChannel(onFieldError);

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<string | undefined>({
        value,
        format: formatWeek,
        parse: parseWeek,
        normalizeDraftOnCommit: trimToAlphanumericEdges,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
          clearInvalidDraft?.();
        },
        onCommitInvalid,
        committedInvalidDraft,
        inputElementRef,
        // Feltet ejer blur-commit eksplicit, så vi kan undlade touched/commit ved uændret blur
        // og koordinere Enter/Escape-suppression med 2-trins editor-aktivering.
        commitOnBlur: false,
      });

    // Parse-fejl persisteres i invalidDrafts via useDraftField og vises afledt herfra.
    const visibleLocalError = error;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    const skipNextBlurCommitRef = React.useRef(false);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setDraft(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraft]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

    const activation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      normalizePasteText: normalizeWeekPaste,
      onReplaceDraft: (nextDraft) => handleDraftChange(nextDraft),
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
            // UNDTAGELSE TIL "INGEN LIVE PREVIEW": Commit øjeblikkeligt ved DELETE/Backspace
            // Parse og commit direkte (synkront) som table-felter gør
            const normalized = trimToAlphanumericEdges('');
            const result = parseWeek(normalized, { mode: 'commit' });
            // Commit kun hvis rydningen faktisk ændrer noget — undgå overflødig undo-frame
            // (jf. StyledDateField/StyledAmountField).
            if (result.ok && (value !== result.value || committedInvalidDraft !== undefined)) {
              onCommit?.(createCommitEvent(result.value));
            }
            // Delete tømmer feltet → ryd evt. ikke-committbar rå draft (jf. StyledDateField).
            clearInvalidDraft?.();
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
          activation.closeEditor();
          return;
        }
        if (!e.defaultPrevented && !(touched && error?.kind === 'invalid')) {
          filterWeekKeyDown(e);
        }
        onKeyDown?.(e);
      },
      [activation, clearInvalidDraft, committedInvalidDraft, error?.kind, onCommit, onKeyDown, onKeyDownBase, parseWeek, setDraft, touched, value]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          activation.handlePaste(e);
          return;
        }

        const normalized = normalizeWeekPaste(readClipboardText(e));
        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElementRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        handleDraftChange(draft.slice(0, start) + normalized + draft.slice(end));
      },
      [activation, draft, handleDraftChange]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={draft}
        onDraftChange={handleDraftChange}
        inputRef={inputElementRef}
        onFocus={handleFocus}
        onBlur={(e) => {
          onBlurBase(e);
          // Aldrig "unchanged" mens en ikke-committbar rå draft lever — ellers ryddes invalidDrafts ikke
          // ved clear/edit af et ugyldigt felt, og feltet re-syncer til den gamle ugyldige værdi (jf. StyledDateField).
          const unchanged = draft === formatWeek(value) && committedInvalidDraft === undefined;
          if (!skipNextBlurCommitRef.current && !unchanged) {
            commit();
          }
          if (activation.isEditorOpen) activation.closeEditor();
          skipNextBlurCommitRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={handlePaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{ inputMode: 'numeric', maxLength: MAX_WEEK_DRAFT_LENGTH, readOnly: !activation.isEditorOpen }}
        sx={{
          '& .MuiInputBase-input': {
            textAlign: 'center',
            caretColor: activation.isEditorOpen ? 'auto' : 'transparent',
            cursor: activation.isEditorOpen ? 'text' : 'pointer',
          },
          ...sx,
        }}
      />
    );
  }
);

StyledWeekField.displayName = 'StyledWeekField';

export default StyledWeekField;
