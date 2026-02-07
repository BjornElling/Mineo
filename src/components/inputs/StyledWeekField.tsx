import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { interpretYear } from '../../utils/dateValidation';
import { filterDateLikeKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from './fieldEvents';

export type StyledWeekFieldValueChangeEvent = CommitEvent<string | undefined>;
export type StyledWeekFieldDraftChangeEvent = DraftChangeEvent;

export type StyledWeekFieldProps = {
  value: string | undefined;

  width?: number | string;
  minYear?: number;
  maxYear?: number;
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

  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<string | undefined>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  error?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
};

const formatWeek = (value: string | undefined): string => value ?? '';
const MAX_CANONICAL_WEEK_LENGTH = 7; // uu/åååå
// Allow slightly more draft characters than the canonical committed form to support permissive typing
// (e.g. separators/whitespace) without the UI blocking mid-entry. This is an explicit UX tolerance.
const MAX_WEEK_DRAFT_LENGTH = MAX_CANONICAL_WEEK_LENGTH + 2;

const yearHas53Weeks = (year: number): boolean => {
  const dec31 = new Date(Date.UTC(year, 11, 31));
  const dayOfWeek = dec31.getUTCDay();
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  return dayOfWeek === 4 || (isLeapYear && dayOfWeek === 5);
};

/**
 * Week input parsing rules:
 * - Canonical committed form: `uu/åååå`
 * - 1-2 digit years are accepted only on commit and normalized via `interpretYear`
 */
const StyledWeekField = React.forwardRef<HTMLDivElement, StyledWeekFieldProps>(
  (
    {
      value,
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

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<string | undefined>({
        value,
        format: formatWeek,
        parse: parseWeek,
        normalizeDraftOnCommit: trimToAlphanumericEdges,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
        },
        inputElementRef,
        clearErrorOnDraftChange: true,
        commitOnBlur: false,
      });

    const visibleLocalError = touched ? error : undefined;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

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
            const result = parseWeek(normalized, { mode: 'commit' });
            if (result.ok) {
              onCommit?.(createCommitEvent(result.value));
            }
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
        if (!e.defaultPrevented) {
          filterDateLikeKeyDown(e);
        }
        onKeyDown?.(e);
      },
      [activation, onCommit, onKeyDown, onKeyDownBase, parseWeek, setDraft]
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
          if (activation.isEditorOpen || pendingCommitOnBlurRef.current) {
            const unchanged = draft === formatWeek(value);
            if (!skipNextBlurCommitRef.current && !unchanged) {
              commit();
            }
            if (activation.isEditorOpen) activation.closeEditor();
            skipNextBlurCommitRef.current = false;
            pendingCommitOnBlurRef.current = false;
          }
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
