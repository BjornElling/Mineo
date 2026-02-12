import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { interpretYear } from '../../utils/dateValidation';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterYearKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitHandler, type DraftChangeHandler } from './fieldEvents';

export type StyledYearFieldNextProps = {
  value: number | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<number | undefined>;

  width?: number | string;
  minYear?: number;
  maxYear?: number;
  allowEmpty?: boolean;
  /**
   * Policy for interpreting 1-2 digit years on commit.
   *
   * - `reject`: reject 1-2 digit years (must enter 4 digits)
   * - `infer`: infer century (legacy behavior via `interpretYear`)
   * - `assume20xx`: always interpret as 20xx
   *
   * Default: `infer`.
   */
  twoDigitYearPolicy?: 'reject' | 'infer' | 'assume20xx';

  placeholder?: string;
  disabled?: boolean;

  /**
   * Called after internal focus bookkeeping (via `useDraftField`) has run.
   */
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /**
   * Level-triggered error signal for parent integrations.
   *
   * Invariant: called on mount and whenever the resolved error state changes.
   */
  onErrorChange?: (hasError: boolean) => void;
  /**
   * Callback for current local error message (for producer-owned error reporting).
   *
   * Note: this intentionally does not report `externalError`.
   */
  onFieldError?: (errorMsg: string | undefined) => void;

  /**
   * External error is authoritative over local parse errors.
   * Useful for parent-level validation gates.
   *
   * Note: local parse error state is preserved (suspended in the UI while `externalError` is present),
   * and will become visible again if `externalError` is cleared.
   */
  externalError?: { message: string } | undefined;

  sx?: SxProps<Theme>;
};

const formatYear = (value: number | undefined): string => {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};

const MAX_YEAR_DRAFT_LENGTH = 6; // 4 digits + whitespace tolerance

/**
 * Year input with strict parsing:
 * - Parsing/validation is performed exclusively in `parseYear`.
 * - 1-3 digits is treated as partial while typing, and as an error after commit.
 * - 2-digit years are accepted only on commit and normalized via `interpretYear`.
 */
const StyledYearFieldNext = React.forwardRef<HTMLDivElement, StyledYearFieldNextProps>(
  (
    {
      value,
      onDraftChange,
      onCommit,
      width = 80,
      minYear,
      maxYear,
      allowEmpty = true,
      twoDigitYearPolicy = 'infer',
      placeholder = 'åååå',
      disabled,
      onFocus,
      onBlur,
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
            // 2-digit years are accepted only on commit and normalized to a 4-digit year.
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

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown, commit } = useDraftField<
      number | undefined
    >({
      value,
      format: formatYear,
      parse: parseYear,
      normalizeDraftOnCommit: trimToAlphanumericEdges,
      onCommit: (nextValue) => {
        onCommit?.(createCommitEvent(nextValue));
      },
      inputElementRef,
      clearErrorOnDraftChange: true,
      commitOnBlur: false,
    });

    const visibleLocalError = touched ? error : undefined;
    const resolvedErrorMessage = externalError?.message ?? visibleLocalError?.message ?? '';
    const resolvedHasError = Boolean(externalError?.message) || Boolean(visibleLocalError?.message);

    React.useEffect(() => {
      if (!onErrorChange) return;
      onErrorChange(resolvedHasError);
    }, [onErrorChange, resolvedHasError]);

    // Notify parent of local error state (producer-owned reporting)
    React.useEffect(() => {
      if (typeof onFieldError !== 'function') return;
      onFieldError(visibleLocalError?.message);
    }, [onFieldError, visibleLocalError?.message]);

    const skipNextBlurCommitRef = React.useRef(false);
    const pendingCommitOnBlurRef = React.useRef(false);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        pendingCommitOnBlurRef.current = false;
        setDraft(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraft]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

    const activation = useTwoStageInputActivation<HTMLInputElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
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
      },
      [activation, onCommit, onKeyDown, parseYear, setDraft]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
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
          pendingCommitOnBlurRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={activation.handlePaste}
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

StyledYearFieldNext.displayName = 'StyledYearFieldNext';

export default StyledYearFieldNext;
