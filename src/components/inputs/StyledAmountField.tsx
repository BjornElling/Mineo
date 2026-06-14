import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { containsUnaryMinusToken, filterAmountExpressionKeyDown } from './inputKeyFilters';
import { stripAmountGroupingSeparators } from '../../utils/draftNormalization';
import {
  DEFAULT_AMOUNT_PLACEHOLDER,
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
  sanitizePastedAmount,
} from '../../utils/amountInputUtils';
import { readClipboardText } from '../../utils/clipboardUtils';
import { formatAsAmount } from '../../utils/formatUtils';
import { normalizeAmountPaste } from '../../utils/inputPasteNormalization';
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
} from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { useFieldInvalidDraftChannel } from '../../hooks/useFormFieldErrors';

export type StyledAmountFieldValueChangeEvent = CommitEvent<AmountValue | undefined>;
export type StyledAmountFieldDraftChangeEvent = DraftChangeEvent;

export type StyledAmountFieldProps = {
  value: AmountValue | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<AmountValue | undefined>;

  name?: string;
  width?: number | string;
  placeholder?: string;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  minValue?: number;
  maxValue?: number;
  /**
   * Precision der anvendes på alle commits (afrunding af slutresultat).
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
  /**
   * Callback for den aktuelle lokale fejlbesked (til producer-owned fejlrapportering).
   *
   * Bemærk: dette rapporterer bevidst ikke `error/helperText` fra forælderen (eksterne fejl).
   */
  onFieldError?: FieldErrorReporter;

  sx?: SxProps<Theme>;
};

const clampInt = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

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
      name,
      width = 120,
      placeholder = DEFAULT_AMOUNT_PLACEHOLDER,
      allowNegative = true,
      allowDecimals = true,
      minValue,
      maxValue,
      precision = DEFAULT_AMOUNT_PRECISION,
      disabled,
      onFocus,
      onBlur,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
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
      if (maxValue !== undefined && !Number.isFinite(maxValue)) {
        return 'Ugyldig konfiguration: maxValue skal være et tal';
      }
      if (minValue !== undefined && !Number.isFinite(minValue)) {
        return 'Ugyldig konfiguration: minValue skal være et tal';
      }
      if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
        return 'Ugyldig konfiguration: minValue er større end maxValue';
      }
      if (!allowNegative && typeof minValue === 'number' && minValue < 0) {
        return 'Ugyldig konfiguration: minValue er negativ, men allowNegative=false';
      }
      if (!allowNegative && typeof maxValue === 'number' && maxValue < 0) {
        return 'Ugyldig konfiguration: maxValue er negativ, men allowNegative=false';
      }
      return '';
    }, [allowNegative, maxValue, minValue, precision]);

    if (import.meta.env.DEV && roundingConfigError.trim() !== '') {
      throw new Error(roundingConfigError);
    }

    const resolvedPrecision = React.useMemo(() => {
      if (!allowDecimals) return 0;
      const fallbackPrecision = precision ?? DEFAULT_AMOUNT_PRECISION;
      if (!Number.isFinite(fallbackPrecision) || !Number.isInteger(fallbackPrecision)) {
        return DEFAULT_AMOUNT_PRECISION;
      }
      return clampInt(fallbackPrecision, 0, 6);
    }, [allowDecimals, precision]);

    const resolvedPlaceholder = React.useMemo(() => {
      if (allowDecimals) return placeholder;
      if (placeholder === '0,00') return '0';
      return placeholder;
    }, [allowDecimals, placeholder]);

    const formatAmount = React.useCallback(
      (v: AmountValue | undefined): string => amountValueToDisplayString(v, resolvedPrecision),
      [resolvedPrecision]
    );

    const parseAmount: DraftParse<AmountValue | undefined> = React.useCallback(
      (draft, { mode }) => {
        const parsed = parseAmountInput(draft, {
          precision: resolvedPrecision,
          allowNegative,
          allowDecimals,
          maxIntegerDigits: MAX_AMOUNT_INTEGER_DIGITS,
          maxRawLength: MAX_AMOUNT_RAW_LENGTH,
        });

        if (parsed.ok) {
          const numericValue = parsed.value?.value;
          if (
            typeof minValue === 'number' &&
            typeof numericValue === 'number' &&
            Number.isFinite(numericValue) &&
            numericValue < minValue
          ) {
            const errorMessage = `Beløb skal være ${formatAsAmount(minValue, resolvedPrecision)} eller højere`;
            if (mode === 'typing') return { ok: false, kind: 'partial' };
            return { ok: false, kind: 'invalid', message: errorMessage };
          }
          if (
            typeof maxValue === 'number' &&
            typeof numericValue === 'number' &&
            Number.isFinite(numericValue) &&
            numericValue > maxValue
          ) {
            const errorMessage = `Beløb skal være ${formatAsAmount(maxValue, resolvedPrecision)} eller lavere`;
            if (mode === 'typing') return { ok: false, kind: 'partial' };
            return { ok: false, kind: 'invalid', message: errorMessage };
          }
          return { ok: true, value: parsed.value };
        }

        if (mode === 'typing') return { ok: false, kind: 'partial' };
        if (parsed.error.kind === 'expression') {
          return { ok: false, kind: 'invalid', message: formatExpressionErrorMessage(parsed.error.message) };
        }
        return { ok: false, kind: 'invalid', message: parsed.error.message };
      },
      [allowDecimals, allowNegative, maxValue, minValue, resolvedPrecision]
    );

    const { committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = useFieldInvalidDraftChannel(onFieldError);

    const { draft, setDraft, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit, commitDraft } =
      useDraftField<AmountValue | undefined>({
        value,
        format: formatAmount,
        parse: parseAmount,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
          clearInvalidDraft?.();
        },
        onCommitInvalid,
        committedInvalidDraft,
        inputElementRef,
        clearTouchedOnEmptyDraft: true,
        commitOnBlur: false,
      });

    const visibleLocalError = error;
    const localHasError = Boolean(visibleLocalError?.message);
    const resolvedHasError = externalHasError || localHasError;
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    // Parse-fejl (ikke-committbart beløb) persisteres i invalidDrafts via useDraftField.onCommitInvalid
    // og vises afledt herfra. Beløbsfeltet har ingen separat blocksSave:false range-fejl, så det
    // rapporterer ikke til fieldErrors-storen.

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
      if (allowDecimals) {
        if (/^[0-9,]$/.test(mapped)) return mapped;
      } else if (/^[0-9]$/.test(mapped)) {
        return mapped;
      }
      if (mapped === '-' && !allowNegative) return null;
      if (mapped === '-' || mapped === '(' || mapped === ')') return mapped;
      return null;
    }, [allowDecimals, allowNegative]);

    const activation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      normalizePasteText: (text) => normalizeAmountPaste(text, { allowNegative }),
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
      const draftAtSchedule = draft;
      pendingClickCaretRef.current = null;
      requestAnimationFrame(() => {
        const el = inputElementRef.current;
        if (!el) return;
        if (el.value !== draftAtSchedule) return;
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
            // Commit kun hvis der faktisk er noget at rydde (committed værdi eller en rå
            // ikke-committbar draft). Et ubetinget commit(undefined) på et allerede tomt felt
            // ville skrive en identisk værdi til storen og producere en overflødig undo-frame.
            if (value !== undefined || committedInvalidDraft !== undefined) {
              onCommit?.(createCommitEvent(undefined));
            }
            // Delete tømmer feltet → ryd evt. ikke-committbar rå draft (jf. StyledDateField).
            clearInvalidDraft?.();
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
          filterAmountExpressionKeyDown(e, { allowNegative, allowDecimals });
        }
        onKeyDown?.(e);
      },
      [activation, allowDecimals, allowNegative, clearInvalidDraft, committedInvalidDraft, onCommit, onKeyDown, onKeyDownBase, setDraft, value]
    );

    const displayDraft = activation.isEditorOpen ? draft : localHasError ? draft : formatAmount(value);

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const raw = readClipboardText(e);
        const normalized = normalizeAmountPaste(raw, { allowNegative });

        if (!activation.isEditorOpen) {
          e.preventDefault();
          e.stopPropagation();
          if (normalized === '') return;
          skipNextBlurCommitRef.current = true;
          commitDraft(normalized);
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElementRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        const nextDraft = draft.slice(0, start) + normalized + draft.slice(end);
        if (!allowNegative && containsUnaryMinusToken(nextDraft)) return;
        handleDraftChange(nextDraft);

        const nextCaret = start + normalized.length;
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
      [activation.isEditorOpen, allowNegative, commitDraft, draft, handleDraftChange]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={displayDraft}
        onDraftChange={handleDraftChange}
        inputRef={inputElementRef}
        onFocus={handleFocus}
        onBlur={(e) => {
          onBlurBase(e);
          // Aldrig "unchanged" mens en ikke-committbar rå draft lever — ellers ryddes invalidDrafts ikke
          // ved clear/edit af et ugyldigt felt, og feltet re-syncer til den gamle ugyldige værdi (jf. StyledDateField).
          const unchanged =
            committedInvalidDraft === undefined &&
            (value?.kind === 'expression' ? draft === amountValueToDraftString(value, resolvedPrecision) : draft === formatAmount(value));
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
        placeholder={resolvedPlaceholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={handlePaste}
        htmlInputAttributes={{
          inputMode: allowDecimals ? 'decimal' : 'numeric',
          readOnly: !activation.isEditorOpen,
        }}
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
                color: 'var(--mineo-color-placeholder)',
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
