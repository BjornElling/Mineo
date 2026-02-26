import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterIntegerKeyDown, filterIntegerPaste, isIntegerDraftAllowed } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from './fieldEvents';
import { getIntegerRangeErrorMessage } from './shared/integerRange';
import { readClipboardText } from '../../utils/clipboardUtils';

export type StyledIntegerFieldValueChangeEvent = CommitEvent<number | undefined>;
export type StyledIntegerFieldDraftChangeEvent = DraftChangeEvent;

export type StyledIntegerFieldProps = {
  value: number | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<number | undefined>;
  onErrorChange?: (hasError: boolean) => void;
  /**
   * Callback for current local error message (for producer-owned error reporting).
   *
   * Note: this intentionally does not report external errors/config errors.
   */
  onFieldError?: (errorMsg: string | undefined) => void;

  width?: number | string;
  minValue?: number;
  maxValue?: number;
  /**
   * If `true`, min/max validation is part of commit (commit will be blocked when out of range).
   * If `false`, min/max validation is UI-only (value is still committed).
   */
  enforceRange?: boolean;
  /**
   * Maximum number of digits allowed in the input (excluding an optional leading `-`).
   *
   * Note: If `minValue`/`maxValue` is provided, `maxDigits` must be large enough to represent those bounds.
   * This is treated as a configuration error in DEV (and the field is disabled in PROD) to avoid silently
   * making valid values impossible to enter.
   */
  maxDigits?: number;
  /**
   * Safety cap used when `maxDigits` is not provided.
   *
   * This prevents pathological drafts from growing without bound.
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
    const inputElementRef = React.useRef<HTMLInputElement>(null);

    const signConfigErrorMessage = React.useMemo(() => {
      if (typeof minValue === 'number' && minValue < 0 && !allowNegative) {
        return 'Ugyldig konfiguration: minValue er negativ, men allowNegative=false';
      }
      if (typeof maxValue === 'number' && maxValue < 0 && !allowNegative) {
        return 'Ugyldig konfiguration: maxValue er negativ, men allowNegative=false';
      }
      return '';
    }, [allowNegative, maxValue, minValue]);

    const resolvedSafetyMaxDigits = React.useMemo(() => {
      if (!Number.isFinite(safetyMaxDigits ?? DEFAULT_MAX_DIGITS_SAFETY) || !Number.isInteger(safetyMaxDigits ?? DEFAULT_MAX_DIGITS_SAFETY)) {
        return DEFAULT_MAX_DIGITS_SAFETY;
      }
      return Math.max(1, Math.min(18, safetyMaxDigits ?? DEFAULT_MAX_DIGITS_SAFETY));
    }, [safetyMaxDigits]);

    const { effectiveMaxDigits, maxLength, devConfigErrorMessage } = React.useMemo(() => {
      const errors: string[] = [];

      if (minValue !== undefined && !Number.isFinite(minValue)) errors.push('Ugyldig konfiguration: minValue skal være et tal');
      if (maxValue !== undefined && !Number.isFinite(maxValue)) errors.push('Ugyldig konfiguration: maxValue skal være et tal');
      if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
        errors.push('Ugyldig konfiguration: minValue er større end maxValue');
      }

      if (signConfigErrorMessage.trim() !== '') {
        errors.push(signConfigErrorMessage);
      }

      if (safetyMaxDigits !== undefined) {
        if (!Number.isFinite(safetyMaxDigits)) errors.push('Ugyldig konfiguration: safetyMaxDigits skal være et tal');
        else if (!Number.isInteger(safetyMaxDigits)) errors.push('Ugyldig konfiguration: safetyMaxDigits skal være et heltal');
        else if (safetyMaxDigits < 1 || safetyMaxDigits > 18) errors.push('Ugyldig konfiguration: safetyMaxDigits skal være mellem 1 og 18');
      }

      // Bounds are commit-time constraints and do NOT affect input length directly.
      // However, if `maxDigits` is provided, it must be able to represent any configured bounds.
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
          // DEV-only signal. In runtime we ignore the inconsistent maxDigits to avoid surfacing config errors as parse errors.
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
    }, [allowNegative, maxDigits, maxValue, minValue, resolvedSafetyMaxDigits, safetyMaxDigits, signConfigErrorMessage]);

    const hasConfigError = devConfigErrorMessage.trim() !== '';

    if (import.meta.env.DEV && hasConfigError) {
      throw new Error(devConfigErrorMessage);
    }

    const getRangeErrorMessage = React.useCallback(
      (parsed: number): string => {
        return getIntegerRangeErrorMessage(parsed, minValue, maxValue, { preferExactForEqualBounds: true });
      },
      [maxValue, minValue]
    );

    const parseInteger: DraftParse<number | undefined> = React.useCallback(
      (draft, { mode }) => {
        const trimmed = draft.trim();
        if (trimmed === '') return { ok: true, value: undefined };

        if (!allowNegative && trimmed.startsWith('-')) {
          if (mode === 'typing') return { ok: false, kind: 'partial' };
          return { ok: false, kind: 'invalid', message: 'Negative tal er ikke tilladt' };
        }

        const digitsOnly = trimmed.startsWith('-') ? trimmed.slice(1) : trimmed;
        if (digitsOnly === '' || /[^0-9]/.test(digitsOnly)) {
          if (mode === 'typing') return { ok: false, kind: 'partial' };
          return { ok: false, kind: 'invalid', message: 'Ugyldigt heltal' };
        }

        if (digitsOnly.length > effectiveMaxDigits) {
          if (mode === 'typing') return { ok: false, kind: 'partial' };
          return { ok: false, kind: 'invalid', message: `Maks ${effectiveMaxDigits} cifre` };
        }

        const parsed = Number.parseInt(trimmed, 10);
        if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
          if (mode === 'typing') return { ok: false, kind: 'partial' };
          return { ok: false, kind: 'invalid', message: 'Ugyldigt heltal' };
        }

        if (enforceRange) {
          const rangeError = getIntegerRangeErrorMessage(parsed, minValue, maxValue, { preferExactForEqualBounds: true });
          if (rangeError !== '') {
            return { ok: false, kind: 'invalid', message: rangeError };
          }
        }

        return { ok: true, value: parsed };
      },
      [allowNegative, effectiveMaxDigits, enforceRange, maxValue, minValue]
    );

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<number | undefined>({
        value,
        format: formatInteger,
        parse: parseInteger,
        normalizeDraftOnCommit: trimToAlphanumericEdges,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
        },
        inputElementRef,
        clearErrorOnDraftChange: true,
        commitOnBlur: false,
      });

    const [rangeErrorMessage, setRangeErrorMessage] = React.useState<string>('');

    React.useEffect(() => {
      if (hasConfigError || enforceRange) {
        setRangeErrorMessage('');
        return;
      }
      if (value === undefined) {
        setRangeErrorMessage('');
        return;
      }

      setRangeErrorMessage(getRangeErrorMessage(value));
    }, [enforceRange, getRangeErrorMessage, hasConfigError, value]);

    const visibleLocalError = touched ? error : undefined;
    const shouldShowRangeError = !enforceRange && touched && rangeErrorMessage.trim() !== '';
    const resolvedHasError = hasConfigError || externalHasError || Boolean(visibleLocalError?.message) || shouldShowRangeError;
    const resolvedErrorMessage =
      hasConfigError
        ? import.meta.env.DEV
          ? devConfigErrorMessage
          : 'Ugyldig konfiguration'
        : externalHasError
            ? externalHelperText
            : visibleLocalError?.message ?? (shouldShowRangeError ? rangeErrorMessage : '');

    React.useEffect(() => {
      if (!onErrorChange) return;
      onErrorChange(resolvedHasError);
    }, [onErrorChange, resolvedHasError]);

    // Notify parent of local error state (producer-owned reporting)
    React.useEffect(() => {
      if (typeof onFieldError !== 'function') return;
      onFieldError(visibleLocalError?.message || (shouldShowRangeError ? rangeErrorMessage : undefined));
    }, [onFieldError, rangeErrorMessage, shouldShowRangeError, visibleLocalError?.message]);

    const skipNextBlurCommitRef = React.useRef(false);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setRangeErrorMessage('');
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
      disabled: Boolean(disabled || hasConfigError),
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
            const result = parseInteger(normalized, { mode: 'commit' });
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
          filterIntegerKeyDown(e, {
            maxDigits: effectiveMaxDigits,
            maxValue,
            allowNegative,
          });
        }
        onKeyDown?.(e);
      },
      [activation, allowNegative, effectiveMaxDigits, maxValue, onCommit, onKeyDown, onKeyDownBase, parseInteger, setDraft]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const constraints = {
          maxDigits: effectiveMaxDigits,
          maxValue,
          allowNegative,
        };

        if (!activation.isEditorOpen) {
          const pastedText = readClipboardText(e);
          if (pastedText !== '' && !isIntegerDraftAllowed(pastedText, constraints)) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          activation.handlePaste(e);
          return;
        }

        filterIntegerPaste(e, constraints);
      },
      [activation, allowNegative, effectiveMaxDigits, maxValue]
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
          const unchanged = draft === formatInteger(value);
          if (!skipNextBlurCommitRef.current && !unchanged) {
            commit();
          }
          if (activation.isEditorOpen) activation.closeEditor();
          skipNextBlurCommitRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        width={width}
        disabled={disabled || hasConfigError}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{
          inputMode: 'numeric',
          maxLength,
          readOnly: !activation.isEditorOpen,
        }}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={handlePaste}
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

StyledIntegerField.displayName = 'StyledIntegerField';

export default StyledIntegerField;
