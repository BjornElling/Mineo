import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { filterIntegerKeyDown } from './inputKeyFilters';
import { trimToNumericEdgesPreserveLeadingMinus } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import { getIntegerRangeErrorMessage } from '../../utils/integerRange';
import { parseIntegerDraftForCommit } from '../../utils/integerDraftCore';
import { normalizeIntegerPaste } from '../../utils/inputPasteNormalization';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { getNumericBoundsConfigErrors } from '../../utils/numericFieldConfig';
import { mergeSx } from '../../utils/mergeSx';

export type StyledIntegerFieldValueChangeEvent = CommitEvent<number | undefined>;
export type StyledIntegerFieldDraftChangeEvent = DraftChangeEvent;

export type StyledIntegerFieldProps = {
  value: number | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<number | undefined>;
  onErrorChange?: (hasError: boolean) => void;
  /**
   * Callback for den aktuelle lokale fejlbesked (til producer-owned fejlrapportering).
   *
   * Bemærk: dette rapporterer bevidst ikke eksterne fejl/config-fejl.
   */
  onFieldError?: FieldErrorReporter;

  name?: string;
  width?: number | string;
  minValue?: number;
  maxValue?: number;
  /**
   * Hvis `true`, er min/max-validering en del af commit (commit blokeres når værdien er uden for intervallet).
   * Hvis `false`, er min/max-validering kun UI (værdien committes stadig).
   */
  enforceRange?: boolean;
  /**
   * Største antal cifre tilladt i inputtet (ekskl. et valgfrit foranstillet `-`).
   *
   * Bemærk: Hvis `minValue`/`maxValue` er angivet, skal `maxDigits` være stor nok til at repræsentere de bounds.
   * Dette behandles som en konfigurationsfejl i DEV (og feltet deaktiveres i PROD) for at undgå i det skjulte
   * at gøre gyldige værdier umulige at indtaste.
   */
  maxDigits?: number;
  /**
   * Sikkerhedsloft der bruges når `maxDigits` ikke er angivet.
   *
   * Dette forhindrer patologiske drafts i at vokse ubegrænset.
   * Default: `18`.
   */
  safetyMaxDigits?: number;
  allowNegative?: boolean;
  placeholder?: string;
  disabled?: boolean;

  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  error?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
};

const formatInteger = (value: number | undefined): string => {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
};

const DEFAULT_MAX_DIGITS_SAFETY = 18;
const digitsRequired = (n: number): number => Math.abs(Math.trunc(n)).toString().length;
const isValidDigitLimit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);

const StyledIntegerField = React.forwardRef<HTMLDivElement, StyledIntegerFieldProps>(
  (
    {
      value,
      onDraftChange,
      onCommit,
      onErrorChange,
      onFieldError,
      name,
      width = 120,
      minValue,
      maxValue,
      enforceRange = true,
      maxDigits,
      safetyMaxDigits = DEFAULT_MAX_DIGITS_SAFETY,
      allowNegative = false,
      placeholder = '',
      disabled,
      onFocus,
      onBlur,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      sx,
    },
    ref
  ) => {
    const resolvedSafetyMaxDigits = React.useMemo(() => {
      if (!Number.isFinite(safetyMaxDigits ?? DEFAULT_MAX_DIGITS_SAFETY) || !Number.isInteger(safetyMaxDigits ?? DEFAULT_MAX_DIGITS_SAFETY)) {
        return DEFAULT_MAX_DIGITS_SAFETY;
      }
      return Math.max(1, Math.min(18, safetyMaxDigits ?? DEFAULT_MAX_DIGITS_SAFETY));
    }, [safetyMaxDigits]);

    const { effectiveMaxDigits, maxLength, devConfigErrorMessage } = React.useMemo(() => {
      const errors: string[] = [];

      errors.push(...getNumericBoundsConfigErrors({ minValue, maxValue, allowNegative }));

      if (safetyMaxDigits !== undefined) {
        if (!Number.isFinite(safetyMaxDigits)) errors.push('Ugyldig konfiguration: safetyMaxDigits skal være et tal');
        else if (!Number.isInteger(safetyMaxDigits)) errors.push('Ugyldig konfiguration: safetyMaxDigits skal være et heltal');
        else if (safetyMaxDigits < 1 || safetyMaxDigits > 18) errors.push('Ugyldig konfiguration: safetyMaxDigits skal være mellem 1 og 18');
      }

      // Bounds er commit-time-begrænsninger og påvirker IKKE input-længden direkte.
      // Men hvis `maxDigits` er angivet, skal den kunne repræsentere alle konfigurerede bounds.
      const digitsRequiredByBounds = Math.max(
        typeof minValue === 'number' && Number.isFinite(minValue) ? digitsRequired(minValue) : 1,
        typeof maxValue === 'number' && Number.isFinite(maxValue) ? digitsRequired(maxValue) : 1
      );

      let resolvedMaxDigits: number | undefined = undefined;
      if (maxDigits !== undefined) {
        if (!isValidDigitLimit(maxDigits)) {
          errors.push('Ugyldig konfiguration: maxDigits skal være et heltal');
        } else if (maxDigits < 1 || maxDigits > 18) {
          errors.push('Ugyldig konfiguration: maxDigits skal være mellem 1 og 18');
        } else if (maxDigits < digitsRequiredByBounds) {
          // Kun DEV-signal. I runtime ignorerer vi den inkonsistente maxDigits for ikke at vise config-fejl som parse-fejl.
          errors.push('Ugyldig konfiguration: maxDigits er mindre end cifre(|min/maxValue|)');
        } else {
          resolvedMaxDigits = maxDigits;
        }
      }

      const digitsCap = resolvedMaxDigits ?? resolvedSafetyMaxDigits;
      const resolvedMaxLength = digitsCap + (allowNegative ? 1 : 0);

      return {
        effectiveMaxDigits: digitsCap,
        maxLength: resolvedMaxLength,
        devConfigErrorMessage: errors.join('\n'),
      };
    }, [allowNegative, maxDigits, maxValue, minValue, resolvedSafetyMaxDigits, safetyMaxDigits]);

    const hasConfigError = devConfigErrorMessage.trim() !== '';

    if (import.meta.env.DEV && hasConfigError) {
      throw new Error(devConfigErrorMessage);
    }

    const getRangeErrorMessage = React.useCallback(
      (parsed: number): string => {
        return getIntegerRangeErrorMessage(parsed, minValue, maxValue);
      },
      [maxValue, minValue]
    );

    const parseInteger: DraftParse<number | undefined> = React.useCallback(
      (draft) => {
        // Format-validering deles med tabel-cellen via den fælles kerne (ensartet ordlyd, A2).
        const result = parseIntegerDraftForCommit(draft, { allowNegative, maxDigits: effectiveMaxDigits });
        if (!result.ok) {
          return { ok: false, kind: 'invalid', message: result.errorMessage };
        }

        const parsed = result.value;
        if (parsed === undefined) return { ok: true, value: undefined };

        // Interval-validering er feltspecifik (kan være ikke-blokerende når enforceRange=false) og bliver her.
        if (enforceRange) {
          const rangeError = getIntegerRangeErrorMessage(parsed, minValue, maxValue);
          if (rangeError !== '') {
            return { ok: false, kind: 'invalid', message: rangeError };
          }
        }

        return { ok: true, value: parsed };
      },
      [allowNegative, effectiveMaxDigits, enforceRange, maxValue, minValue]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterIntegerKeyDown(e, {
          maxDigits: effectiveMaxDigits,
          maxValue: enforceRange ? maxValue : undefined,
          allowNegative,
        }),
      [allowNegative, effectiveMaxDigits, enforceRange, maxValue]
    );

    const {
      draft,
      isEditorOpen,
      error,
      visualErrorMessage,
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
      format: formatInteger,
      parse: parseInteger,
      normalizeDraftOnCommit: trimToNumericEdgesPreserveLeadingMinus,
      getDraftForKey,
      normalizePasteText: (text) => normalizeIntegerPaste(text, {
        maxDigits: effectiveMaxDigits,
        maxValue: enforceRange ? maxValue : undefined,
        allowNegative,
      }),
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)) ?? true,
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      getVisualError: enforceRange || hasConfigError
        ? undefined
        : (committedValue) =>
            committedValue === undefined ? '' : getRangeErrorMessage(committedValue),
      onFocus,
      onBlur,
      onKeyDown,
      disabled,
      blocked: hasConfigError,
      keyFilter,
    });

    const visibleLocalError = error;
    const resolvedHasError = hasConfigError || externalHasError || Boolean(visibleLocalError?.message) || visualErrorMessage !== '';
    const resolvedErrorMessage =
      hasConfigError
        ? import.meta.env.DEV
          ? devConfigErrorMessage
          : 'Ugyldig konfiguration'
        : externalHasError
            ? externalHelperText
            : visibleLocalError?.message ?? visualErrorMessage;

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
        placeholder={placeholder}
        width={width}
        disabled={disabled || hasConfigError}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{
          inputMode: 'numeric',
          maxLength,
          readOnly: !isEditorOpen,
        }}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onPaste={handlePaste}
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

StyledIntegerField.displayName = 'StyledIntegerField';

export default StyledIntegerField;
