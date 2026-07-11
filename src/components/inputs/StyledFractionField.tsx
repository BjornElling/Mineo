import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { filterFractionKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { DEFAULT_FRACTION_MAX_DIGITS, getFractionMaxLength, INTEGER_FRACTION_FORMAT_MESSAGE, parseFractionString } from '../../utils/fraction';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import { normalizeFractionPaste } from '../../utils/inputPasteNormalization';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { mergeSx } from '../../utils/mergeSx';

export type StyledFractionFieldValueChangeEvent = CommitEvent<string | undefined>;
export type StyledFractionFieldDraftChangeEvent = DraftChangeEvent;

export type StyledFractionFieldProps = {
  value: string | undefined;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Maks antal cifre før og efter decimaltegn i hver del af brøken.
   */
  maxDigits?: number;
  allowNegative?: boolean;
  /**
   * Hvis `true`, accepteres `0/x` ved commit (afviser stadig `x=0`).
   *
   * Default: `false` (domænespecifik begrænsning).
   */
  allowZeroNumerator?: boolean;
  /**
   * Hvis `true`, normaliseres den committede brøk til en kanonisk forkortet form (fx `-2/4` -> `-1/2`).
   *
   * Bemærk: hvis `allowZeroNumerator=true`, kanoniseres `0/x` til `0/1` når `canonicalizeOnCommit=true`.
   */
  canonicalizeOnCommit?: boolean;
  requireIntegerFraction?: boolean;

  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<string | undefined>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Callback for den aktuelle lokale fejlbesked (til producer-owned fejlrapportering).
   *
   * Bemærk: dette rapporterer bevidst ikke `error/helperText` fra forælderen (eksterne fejl).
   */
  onFieldError?: FieldErrorReporter;

  error?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
};

const formatFraction = (value: string | undefined): string => value ?? '';

const StyledFractionField = React.forwardRef<HTMLDivElement, StyledFractionFieldProps>(
  (
    {
      value,
      name,
      width = 100,
      placeholder = 'fx 1/3',
      disabled,
      maxDigits = DEFAULT_FRACTION_MAX_DIGITS,
      allowNegative = false,
      allowZeroNumerator = false,
      canonicalizeOnCommit = false,
      requireIntegerFraction = false,
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
    const configErrorMessage = React.useMemo(() => {
      if (!Number.isFinite(maxDigits)) return 'Ugyldig konfiguration: maxDigits skal være et tal';
      if (!Number.isInteger(maxDigits)) return 'Ugyldig konfiguration: maxDigits skal være et heltal';
      if (maxDigits < 1 || maxDigits > 10) return 'Ugyldig konfiguration: maxDigits skal være mellem 1 og 10';
      return '';
    }, [maxDigits]);

    if (import.meta.env.DEV && configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }
    const parseFraction: DraftParse<string | undefined> = React.useCallback(
      (draft) => {
        const trimmed = draft.trim();
        if (trimmed === '') return { ok: true, value: undefined };

        if (configErrorMessage.trim() !== '') {
          return { ok: false, kind: 'invalid', message: configErrorMessage };
        }

        const result = parseFractionString(trimmed, {
          maxDigits,
          allowNegative,
          allowZeroNumerator,
          canonicalizeOnCommit,
          requireIntegerFraction,
        });
        if (!result.ok) {
          switch (result.reason) {
            case 'zero-denominator':
              return { ok: false, kind: 'invalid', message: 'Nævner kan ikke være 0' };
            case 'zero-numerator':
              return { ok: false, kind: 'invalid', message: 'Tæller kan ikke være 0' };
            case 'negative-not-allowed':
              return { ok: false, kind: 'invalid', message: 'Negative brøker er ikke tilladt' };
            case 'non-integer':
              return { ok: false, kind: 'invalid', message: INTEGER_FRACTION_FORMAT_MESSAGE };
            default:
              return {
                ok: false,
                kind: 'invalid',
                message: requireIntegerFraction
                  ? `Brøk skal angives som fx "1/3" (maks. ${maxDigits} cifre i tæller og nævner)`
                  : `Brøk skal angives som fx "1/3" eller "1,5/3,5" (maks. ${maxDigits} cifre før og efter decimaltegn)`,
              };
          }
        }

        return { ok: true, value: result.parsed.value };
      },
      [allowNegative, allowZeroNumerator, canonicalizeOnCommit, configErrorMessage, maxDigits, requireIntegerFraction]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9/,]$/.test(key)) return key;
      if (allowNegative && key === '-') return key;
      return null;
    }, [allowNegative]);

    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => filterFractionKeyDown(e, { maxDigits, allowNegative }),
      [allowNegative, maxDigits]
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
      format: formatFraction,
      parse: parseFraction,
      normalizeDraftOnCommit: trimToAlphanumericEdges,
      getDraftForKey,
      normalizePasteText: normalizeFractionPaste,
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)),
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      onFocus,
      onBlur,
      onKeyDown,
      disabled,
      // Tastet input må ikke canonicaliseres mens der skrives (jf. form-contract §3.1 / mineo-field-pattern
      // Lag C): ingen `transformDraftOnChange`. Tegnspærringen sker i `keyFilter` (keydown) og paste
      // normaliseres via `normalizePasteText`.
      keyFilter,
      setPasteCaret: true,
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
        htmlInputAttributes={{
          inputMode: 'decimal',
          maxLength: getFractionMaxLength(maxDigits, allowNegative),
          readOnly: !isEditorOpen,
        }}
        sx={mergeSx({
          '& .MuiInputBase-input': {
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
            caretColor: isEditorOpen ? 'auto' : 'transparent',
            cursor: isEditorOpen ? 'text' : 'pointer',
          },
        }, sx)}
      />
    );
  }
);

StyledFractionField.displayName = 'StyledFractionField';

export default StyledFractionField;
