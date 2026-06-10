import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { interpretYear } from '../../utils/dateInputValidation';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterYearKeyDown } from './inputKeyFilters';
import { readClipboardText } from '../../utils/clipboardUtils';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { normalizeYearPaste } from '../../utils/inputPasteNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitHandler, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { useFieldInvalidDraftChannel } from '../../hooks/useFormFieldErrors';

export type StyledYearFieldProps = {
  value: number | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<number | undefined>;

  name?: string;
  width?: number | string;
  minYear?: number;
  maxYear?: number;
  allowEmpty?: boolean;
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

  /**
   * Kaldes efter at intern focus-bookkeeping (via `useDraftField`) er kørt.
   */
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /**
   * Level-triggered fejlsignal til forælder-integrationer.
   *
   * Invariant: kaldes ved mount og hver gang den resolved fejltilstand ændrer sig.
   */
  onErrorChange?: (hasError: boolean) => void;
  /**
   * Callback for den aktuelle lokale fejlbesked (til producer-owned fejlrapportering).
   *
   * Bemærk: dette rapporterer bevidst ikke `externalError`.
   */
  onFieldError?: FieldErrorReporter;

  /**
   * Ekstern fejl er autoritativ over lokale parse-fejl.
   * Nyttig til validation gates på forælder-niveau.
   *
   * Bemærk: lokal parse-fejltilstand bevares (suspenderet i UI'et mens `externalError` er til stede)
   * og bliver synlig igen, hvis `externalError` ryddes.
   */
  externalError?: { message: string } | undefined;

  sx?: SxProps<Theme>;
};

const formatYear = (value: number | undefined): string => {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};

const MAX_YEAR_DRAFT_LENGTH = 6; // 4 cifre + whitespace-tolerance

/**
 * År-input med striks parsing:
 * - Parsing/validering udføres udelukkende i `parseYear`.
 * - 1-3 cifre behandles som partial under typing, og som en fejl efter commit.
 * - 2-cifrede år accepteres kun ved commit og normaliseres via `interpretYear`.
 */
const StyledYearField = React.forwardRef<HTMLDivElement, StyledYearFieldProps>(
  (
    {
      value,
      onDraftChange,
      onCommit,
      name,
      width = 80,
      minYear,
      maxYear,
      allowEmpty = true,
      twoDigitYearPolicy = 'infer',
      placeholder = 'åååå',
      disabled,
      onFocus,
      onBlur,
      onKeyDown: onKeyDownProp,
      onErrorChange,
      onFieldError,
      externalError,
      sx,
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement>(null);

    const parseYear: DraftParse<number | undefined> = React.useCallback(
      (draft, { mode }) => {
        const trimmed = draft.trim();

        if (draft.length > MAX_YEAR_DRAFT_LENGTH) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt årstal' };
        }

        if (trimmed === '') {
          if (allowEmpty) {
            return { ok: true, value: undefined };
          }
          return { ok: false, kind: 'empty', message: 'Årstal er påkrævet' };
        }

        if (/[^0-9]/.test(trimmed)) {
          return { ok: false, kind: mode === 'typing' ? 'partial' : 'invalid', message: 'Ugyldigt årstal' };
        }

        let year: number | undefined;

        if (trimmed.length === 4) {
          const parsed = Number.parseInt(trimmed, 10);
          year = Number.isFinite(parsed) ? parsed : undefined;
        } else if (trimmed.length === 1 || trimmed.length === 2) {
          if (mode === 'typing') {
            return { ok: false, kind: 'partial' };
          }

          if (twoDigitYearPolicy === 'reject') {
            return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
          }

          if (twoDigitYearPolicy === 'assume20xx') {
            const parsed = Number.parseInt(trimmed, 10);
            year = Number.isFinite(parsed) ? 2000 + parsed : undefined;
          } else {
            // 2-cifrede år accepteres kun ved commit og normaliseres til et 4-cifret år.
            const interpreted = interpretYear(trimmed);
            year = interpreted === null ? undefined : interpreted;
          }
        } else if (trimmed.length === 3) {
          if (mode === 'typing') {
            return { ok: false, kind: 'partial' };
          }
          return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
        } else {
          return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
        }

        if (year === undefined) {
          return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
        }

        if (typeof minYear === 'number' && year < minYear) {
          if (typeof maxYear === 'number') {
            if (minYear === maxYear) {
              return { ok: false, kind: 'invalid', message: `Årstallet skal være ${minYear}` };
            }
            return { ok: false, kind: 'invalid', message: `Årstallet skal være mellem ${minYear} og ${maxYear}` };
          }
          return { ok: false, kind: 'invalid', message: `Årstallet skal være ${minYear} eller senere` };
        }
        if (typeof maxYear === 'number' && year > maxYear) {
          if (typeof minYear === 'number') {
            if (minYear === maxYear) {
              return { ok: false, kind: 'invalid', message: `Årstallet skal være ${maxYear}` };
            }
            return { ok: false, kind: 'invalid', message: `Årstallet skal være mellem ${minYear} og ${maxYear}` };
          }
          return { ok: false, kind: 'invalid', message: `Årstallet skal være ${maxYear} eller tidligere` };
        }

        return { ok: true, value: year };
      },
      [allowEmpty, maxYear, minYear, twoDigitYearPolicy]
    );

    const { committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = useFieldInvalidDraftChannel(onFieldError);

    const { draft, setDraft, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown, commit } = useDraftField<
      number | undefined
    >({
      value,
      format: formatYear,
      parse: parseYear,
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
    const resolvedErrorMessage = externalError?.message ?? visibleLocalError?.message ?? '';
    const resolvedHasError = Boolean(externalError?.message) || Boolean(visibleLocalError?.message);

    React.useEffect(() => {
      if (!onErrorChange) return;
      onErrorChange(resolvedHasError);
    }, [onErrorChange, resolvedHasError]);

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
      normalizePasteText: normalizeYearPaste,
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
            const result = parseYear(normalized, { mode: 'commit' });
            if (result.ok) {
              onCommit?.(createCommitEvent(result.value));
            }
            setDraft('');
            return;
          }
          activation.handleKeyDown(e);
          if (e.defaultPrevented) return;
          onKeyDownProp?.(e);
          return;
        }

        onKeyDown(e);
        if (e.defaultPrevented && e.key === 'Enter') {
          skipNextBlurCommitRef.current = true;
        }
        if (e.defaultPrevented && e.key === 'Escape') {
          activation.closeEditor();
          return;
        }
        if (!e.defaultPrevented) {
          filterYearKeyDown(e);
        }
        onKeyDownProp?.(e);
      },
      [activation, onCommit, onKeyDown, onKeyDownProp, parseYear, setDraft]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          activation.handlePaste(e);
          return;
        }

        const normalized = normalizeYearPaste(readClipboardText(e));
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
          const unchanged = draft === formatYear(value);
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
        htmlInputAttributes={{ maxLength: MAX_YEAR_DRAFT_LENGTH, inputMode: 'numeric', readOnly: !activation.isEditorOpen }}
        sx={{
          '& input': {
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

StyledYearField.displayName = 'StyledYearField';

export default StyledYearField;
