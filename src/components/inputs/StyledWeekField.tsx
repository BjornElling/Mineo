import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { filterWeekKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { parseWeekDraftForCommit } from '../../utils/weekDraftCore';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { mergeSx } from '../../utils/mergeSx';
import { createWeekFieldCodec } from '../../input/fieldCodecs';

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
    const codec = React.useMemo(
      () => createWeekFieldCodec({
        minYear,
        maxYear,
        twoDigitYearPolicy,
        maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
      }),
      [maxYear, minYear, twoDigitYearPolicy]
    );

    const parseWeek: DraftParse<string | undefined> = React.useCallback(
      (draft) => {
        const resolution = codec.parseForSettle(draft);
        if (resolution.status === 'invalid') {
          // Fejlteksten er endnu en migrations-seam. Resolutionen ejes alene af codecet; den gamle kerne
          // klassificerer kun den allerede afviste råtekst, indtil fase 5 indfører strukturelle issues.
          const failure = parseWeekDraftForCommit(trimToAlphanumericEdges(draft), {
            twoDigitYearPolicy,
            maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
          });
          return {
            ok: false,
            kind: 'invalid',
            message: failure.ok ? 'Ugyldigt format' : failure.errorMessage,
          };
        }
        if (resolution.value === undefined) return { ok: true, value: undefined };

        // Intervallet er fortsat en commit-blokerende UI-regel, indtil fase 5 flytter bounds til den rene issue-model.
        const bounded = parseWeekDraftForCommit(resolution.value, {
          minYear,
          maxYear,
          twoDigitYearPolicy: 'reject',
          maxDraftLength: MAX_WEEK_DRAFT_LENGTH,
        });
        return bounded.ok
          ? { ok: true, value: resolution.value }
          : { ok: false, kind: 'invalid', message: bounded.errorMessage };
      },
      [codec, maxYear, minYear, twoDigitYearPolicy]
    );

    const getDraftForKey = React.useCallback(
      (key: string): string | null => codec.acceptsInitialKey(key) ? key : null,
      [codec]
    );

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
      format: codec.format,
      parse: parseWeek,
      getDraftForKey,
      normalizePasteText: codec.normalizePaste,
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)) ?? true,
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
        sx={mergeSx({
          '& .MuiInputBase-input': {
            textAlign: 'center',
            caretColor: isEditorOpen ? 'auto' : 'transparent',
            cursor: isEditorOpen ? 'text' : 'pointer',
          },
        }, sx)}
      />
    );
  }
);

StyledWeekField.displayName = 'StyledWeekField';

export default StyledWeekField;
