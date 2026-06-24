import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { filterYearKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { parseYearDraftForCommit } from '../../utils/yearDraftCore';
import { normalizeYearPaste } from '../../utils/inputPasteNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitHandler, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';

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
    const parseYear: DraftParse<number | undefined> = React.useCallback(
      (draft) => {
        if (draft.length > MAX_YEAR_DRAFT_LENGTH) {
          return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
        }

        const trimmed = draft.trim();

        if (trimmed === '') {
          if (allowEmpty) {
            return { ok: true, value: undefined };
          }
          return { ok: false, kind: 'empty', message: 'Årstal er påkrævet' };
        }

        if (/[^0-9]/.test(trimmed)) {
          return { ok: false, kind: 'invalid', message: 'Ugyldigt årstal' };
        }

        // Selve fortolkningen (2-/4-cifret-politik + interval) deles med tabel-cellen via kernen.
        const result = parseYearDraftForCommit(trimmed, { minYear, maxYear, twoDigitYearPolicy });
        if (!result.ok) return { ok: false, kind: 'invalid', message: result.errorMessage };
        return { ok: true, value: result.value };
      },
      [allowEmpty, maxYear, minYear, twoDigitYearPolicy]
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
    } = useStyledFieldAdapter<number | undefined>({
      value,
      format: formatYear,
      parse: parseYear,
      normalizeDraftOnCommit: trimToAlphanumericEdges,
      getDraftForKey,
      normalizePasteText: normalizeYearPaste,
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)),
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      onFocus,
      onBlur,
      onKeyDown: onKeyDownProp,
      disabled,
      keyFilter: filterYearKeyDown,
    });

    // Parse-fejl persisteres i invalidDrafts via useStyledFieldAdapter og vises afledt herfra.
    const visibleLocalError = error;
    const resolvedErrorMessage = externalError?.message ?? visibleLocalError?.message ?? '';
    const resolvedHasError = Boolean(externalError?.message) || Boolean(visibleLocalError?.message);

    React.useEffect(() => {
      if (!onErrorChange) return;
      onErrorChange(resolvedHasError);
    }, [onErrorChange, resolvedHasError]);

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
        htmlInputAttributes={{ maxLength: MAX_YEAR_DRAFT_LENGTH, inputMode: 'numeric', readOnly: !isEditorOpen }}
        sx={{
          '& input': {
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

StyledYearField.displayName = 'StyledYearField';

export default StyledYearField;
