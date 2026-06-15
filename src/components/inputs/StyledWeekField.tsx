import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { interpretYear } from '../../utils/dateInputValidation';
import { yearHas53Weeks } from '../../utils/dateUtils';
import { filterWeekKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { normalizeWeekPaste } from '../../utils/inputPasteNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';

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

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

    const {
      draft,
      isEditorOpen,
      error,
      inputElementRef,
      handleDraftChange,
      handleFocus,
      handleKeyDown,
      handlePaste,
      handleBlur,
      handleMouseDown,
      handleClick,
    } = useStyledFieldAdapter<string | undefined>({
      value,
      format: formatWeek,
      parse: parseWeek,
      normalizeDraftOnCommit: trimToAlphanumericEdges,
      getDraftForKey,
      normalizePasteText: normalizeWeekPaste,
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)),
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      onFocus,
      onBlur,
      onKeyDown,
      disabled,
      keyFilter: filterWeekKeyDown,
      gateKeyFilterOnInvalidTouched: true,
    });

    // Parse-fejl persisteres i invalidDrafts via useStyledFieldAdapter og vises afledt herfra.
    const visibleLocalError = error;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={draft}
        onDraftChange={handleDraftChange}
        inputRef={inputElementRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onPaste={handlePaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{ inputMode: 'numeric', maxLength: MAX_WEEK_DRAFT_LENGTH, readOnly: !isEditorOpen }}
        sx={{
          '& .MuiInputBase-input': {
            textAlign: 'center',
            caretColor: isEditorOpen ? 'auto' : 'transparent',
            cursor: isEditorOpen ? 'text' : 'pointer',
          },
          ...sx,
        }}
      />
    );
  }
);

StyledWeekField.displayName = 'StyledWeekField';

export default StyledWeekField;
