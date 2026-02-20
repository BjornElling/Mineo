import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { containsUnaryMinusToken, filterAmountExpressionKeyDown } from './inputKeyFilters';
import { stripAmountGroupingSeparators } from '../../utils/draftNormalization';
import { sanitizePastedAmount } from '../../utils/amountInputUtils';
import { readClipboardText } from '../../utils/clipboardUtils';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import {
  amountValueToDisplayString,
  amountValueToDraftString,
  formatExpressionErrorMessage,
  isExpressionErrorMessage,
  parseAmountInput,
} from '../../utils/expressionAmount';
import {
  createCommitEvent,
  createDraftChangeEvent,
  type CommitEvent,
  type CommitHandler,
  type DraftChangeEvent,
  type DraftChangeHandler,
} from './fieldEvents';

export type StyledAmountFieldValueChangeEvent = CommitEvent<AmountValue | undefined>;
export type StyledAmountFieldDraftChangeEvent = DraftChangeEvent;

export type StyledAmountFieldProps = {
  value: AmountValue | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<AmountValue | undefined>;

  width?: number | string;
  placeholder?: string;
  allowNegative?: boolean;
  /**
   * Precision applied to all commits (afrunding af slutresultat).
   *
   * Default: `precision=2`.
   */
  precision?: number;
  disabled?: boolean;

  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  error?: boolean;
  helperText?: string;
  onErrorChange?: (hasError: boolean) => void;
  onLocalErrorChange?: (hasLocalError: boolean) => void;
  /**
   * Callback for current local error message (for producer-owned error reporting).
   *
   * Note: this intentionally does not report `error/helperText` from the parent (external errors).
   */
  onFieldError?: (errorMsg: string | undefined) => void;

  sx?: SxProps<Theme>;
};

const clampInt = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

const MAX_AMOUNT_RAW_LENGTH = 64;
const MAX_AMOUNT_INTEGER_DIGITS = 20;

const mapCaretFromGroupedAmount = (draft: string, caret: number): number => {
  if (caret <= 0) return 0;
  const before = draft.slice(0, caret);
  const groupingCount = (before.match(/\./g) ?? []).length;
  return Math.max(0, caret - groupingCount);
};

const StyledAmountField = React.forwardRef<HTMLDivElement, StyledAmountFieldProps>(
  (
    {
      value,
      onDraftChange,
      onCommit,
      width = 120,
      placeholder = '0,00',
      allowNegative = true,
      precision = 2,
      disabled,
      onFocus,
      onBlur,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      onErrorChange,
      onLocalErrorChange,
      onFieldError,
      sx,
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement>(null);

    const roundingConfigError = React.useMemo(() => {
      if (precision === undefined) return '';
      if (!Number.isFinite(precision)) return 'Ugyldig konfiguration: precision skal være et tal';
      if (!Number.isInteger(precision)) return 'Ugyldig konfiguration: precision skal være et heltal';
      if (precision < 0 || precision > 6) return 'Ugyldig konfiguration: precision skal være mellem 0 og 6';
      return '';
    }, [precision]);

    if (import.meta.env.DEV && roundingConfigError.trim() !== '') {
      throw new Error(roundingConfigError);
    }

    const resolvedPrecision = React.useMemo(() => {
      if (!Number.isFinite(precision ?? 2) || !Number.isInteger(precision ?? 2)) return 2;
      return clampInt(precision ?? 2, 0, 6);
    }, [precision]);

    const formatAmount = React.useCallback(
      (v: AmountValue | undefined): string => amountValueToDisplayString(v, resolvedPrecision),
      [resolvedPrecision]
    );

    const parseAmount: DraftParse<AmountValue | undefined> = React.useCallback(
      (draft, { mode }) => {
        const parsed = parseAmountInput(draft, {
          precision: resolvedPrecision,
          allowNegative,
          maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
          maxRawLength: MAX_AMOUNT_RAW_LENGTH,
        });

        if (parsed.ok) {
          return { ok: true, value: parsed.value };
        }

        if (mode === 'typing') return { ok: false, kind: 'partial' };
        if (parsed.error.kind === 'expression') {
          return { ok: false, kind: 'invalid', message: formatExpressionErrorMessage(parsed.error.message) };
        }
        return { ok: false, kind: 'invalid', message: parsed.error.message };
      },
      [allowNegative, resolvedPrecision]
    );

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<AmountValue | undefined>({
        value,
        format: formatAmount,
        parse: parseAmount,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
        },
        inputElementRef,
        clearErrorOnDraftChange: true,
        clearTouchedOnEmptyDraft: true,
        commitOnBlur: false,
      });

    const visibleLocalError = touched ? error : undefined;
    const localHasError = Boolean(visibleLocalError?.message);
    const resolvedHasError = externalHasError || localHasError;
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    // Notify parent of local error state (producer-owned reporting)
    React.useEffect(() => {
      if (typeof onFieldError !== 'function') return;
      onFieldError(visibleLocalError?.message);
    }, [onFieldError, visibleLocalError?.message]);

    React.useEffect(() => {
      if (!onErrorChange) return;
      onErrorChange(resolvedHasError);
    }, [onErrorChange, resolvedHasError]);

    React.useEffect(() => {
      if (!onLocalErrorChange) return;
      onLocalErrorChange(localHasError);
    }, [localHasError, onLocalErrorChange]);

    const skipNextBlurCommitRef = React.useRef(false);
    const hadErrorOnEditStartRef = React.useRef(false);
    const pendingClickCaretRef = React.useRef<number | null>(null);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        const cleanedDraft = sanitizePastedAmount(nextDraft);
        // UX policy: tomt draft betyder "ingen valideringstilstand".
        skipNextBlurCommitRef.current = false;
        setDraft(cleanedDraft);
        onDraftChange?.(createDraftChangeEvent(cleanedDraft));
      },
      [onDraftChange, setDraft]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      const mapped = key === '.' ? '.' : key;
      if (/^[0-9,]$/.test(mapped)) return mapped;
      if (mapped === '-' && !allowNegative) return null;
      if (mapped === '-' || mapped === '(' || mapped === ')') return mapped;
      return null;
    }, [allowNegative]);

    const activation = useTwoStageInputActivation<HTMLInputElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      normalizePasteText: sanitizePastedAmount,
      onReplaceDraft: (nextDraft) => {
        if (!allowNegative && containsUnaryMinusToken(nextDraft)) return;
        handleDraftChange(nextDraft);
      },
      onStartEditing: (source) => {
        hadErrorOnEditStartRef.current = Boolean(visibleLocalError?.message);
        if (source !== 'click') return;
        if (isExpressionErrorMessage(visibleLocalError?.message)) {
          pendingClickCaretRef.current = null;
          return;
        }
        if (value?.kind === 'expression') {
          const nextDraft = amountValueToDraftString(value, resolvedPrecision);
          if (nextDraft !== draft) handleDraftChange(nextDraft);
          pendingClickCaretRef.current = null;
          return;
        }
        const selectionStart = inputElementRef.current?.selectionStart;
        const cleanedDraft = stripAmountGroupingSeparators(draft);
        if (typeof selectionStart === 'number') {
          pendingClickCaretRef.current = mapCaretFromGroupedAmount(draft, selectionStart);
        }
        if (cleanedDraft !== draft) {
          handleDraftChange(cleanedDraft);
        }
      },
    });

    React.useEffect(() => {
      if (!activation.isEditorOpen) {
        pendingClickCaretRef.current = null;
        return;
      }
      const pendingCaret = pendingClickCaretRef.current;
      if (pendingCaret === null) return;
      pendingClickCaretRef.current = null;
      requestAnimationFrame(() => {
        const el = inputElementRef.current;
        if (!el) return;
        const clamped = Math.min(pendingCaret, el.value.length);
        try {
          el.setSelectionRange(clamped, clamped);
        } catch {
          // no-op
        }
      });
    }, [activation.isEditorOpen, draft]);

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
            onCommit?.(createCommitEvent(undefined));
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
          filterAmountExpressionKeyDown(e, { allowNegative });
        }
        onKeyDown?.(e);
      },
      [activation, allowNegative, onCommit, onKeyDown, onKeyDownBase, setDraft]
    );

    const displayDraft = activation.isEditorOpen ? draft : localHasError ? draft : formatAmount(value);

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          activation.handlePaste(e);
          return;
        }

        const raw = readClipboardText(e);
        const sanitized = sanitizePastedAmount(raw);

        e.preventDefault();
        e.stopPropagation();
        if (sanitized === '') return;

        const input = inputElementRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        const nextDraft = draft.slice(0, start) + sanitized + draft.slice(end);
        if (!allowNegative && containsUnaryMinusToken(nextDraft)) return;
        handleDraftChange(nextDraft);

        const nextCaret = start + sanitized.length;
        requestAnimationFrame(() => {
          const el = inputElementRef.current;
          if (!el) return;
          try {
            el.setSelectionRange(nextCaret, nextCaret);
          } catch {
            // no-op
          }
        });
      },
      [activation, allowNegative, draft, handleDraftChange]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
        draft={displayDraft}
        onDraftChange={handleDraftChange}
        inputRef={inputElementRef}
        onFocus={handleFocus}
        onBlur={(e) => {
          onBlurBase(e);
          const unchanged = value?.kind === 'expression' ? draft === amountValueToDraftString(value, resolvedPrecision) : draft === formatAmount(value);
          const shouldForceCommit = draft === '' && value === undefined && hadErrorOnEditStartRef.current;
          if (!skipNextBlurCommitRef.current && (!unchanged || shouldForceCommit)) {
            commit();
          }
          if (activation.isEditorOpen) activation.closeEditor();
          skipNextBlurCommitRef.current = false;
          hadErrorOnEditStartRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={handlePaste}
        htmlInputAttributes={{ inputMode: 'decimal', readOnly: !activation.isEditorOpen }}
        sx={{
          '& .MuiInputBase-input': {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            caretColor: activation.isEditorOpen ? 'auto' : 'transparent',
            cursor: activation.isEditorOpen ? 'text' : 'pointer',
          },
          ...sx,
        }}
        endAdornment={
          value?.kind === 'expression' ? (
            <span
              className="mineo-expression-indicator"
              style={{
                position: 'absolute',
                right: 2,
                bottom: 2,
                fontSize: 8,
                fontWeight: 700,
                color: 'rgba(0, 0, 0, 0.45)',
                pointerEvents: 'none',
              }}
            >
              fx
            </span>
          ) : undefined
        }
      />
    );
  }
);

StyledAmountField.displayName = 'StyledAmountField';

export default StyledAmountField;
