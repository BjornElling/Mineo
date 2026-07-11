import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftFieldError, type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import { containsUnaryMinusToken, filterAmountExpressionKeyDown } from './inputKeyFilters';
import { stripAmountGroupingSeparators } from '../../utils/draftNormalization';
import {
  DEFAULT_AMOUNT_PLACEHOLDER,
  DEFAULT_AMOUNT_PRECISION,
  MAX_AMOUNT_INTEGER_DIGITS,
  MAX_AMOUNT_RAW_LENGTH,
  sanitizePastedAmount,
} from '../../utils/amountInputUtils';
import { formatAsAmount } from '../../utils/formatUtils';
import { INPUT_UNIT_SUFFIX } from '../../utils/inputUnit';
import InputUnitAdornment from './InputUnitAdornment';
import { normalizeAmountPaste } from '../../utils/inputPasteNormalization';
import type { AmountValue } from '../../schemas/amountExpressionSchema';
import {
  amountValueToDisplayString,
  amountValueToDraftString,
  formatExpressionErrorMessage,
  isExpressionErrorMessage,
  parseAmountInput,
} from '../../utils/expressionAmount';
import type { TwoStageStartSource } from '../../hooks/useTwoStageInputActivation';
import {
  createCommitEvent,
  createDraftChangeEvent,
  type CommitEvent,
  type CommitHandler,
  type DraftChangeEvent,
  type DraftChangeHandler,
} from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { getNumericBoundsConfigErrors } from '../../utils/numericFieldConfig';
import { mergeSx } from '../../utils/mergeSx';

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
    const roundingConfigError = React.useMemo(() => {
      if (precision === undefined) return '';
      if (!Number.isFinite(precision)) return 'Ugyldig konfiguration: precision skal være et tal';
      if (!Number.isInteger(precision)) return 'Ugyldig konfiguration: precision skal være et heltal';
      if (precision < 0 || precision > 6) return 'Ugyldig konfiguration: precision skal være mellem 0 og 6';
      const boundsError = getNumericBoundsConfigErrors({ minValue, maxValue, allowNegative })[0];
      if (boundsError !== undefined) return boundsError;
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
      (draft) => {
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
            return { ok: false, kind: 'invalid', message: errorMessage };
          }
          if (
            typeof maxValue === 'number' &&
            typeof numericValue === 'number' &&
            Number.isFinite(numericValue) &&
            numericValue > maxValue
          ) {
            const errorMessage = `Beløb skal være ${formatAsAmount(maxValue, resolvedPrecision)} eller lavere`;
            return { ok: false, kind: 'invalid', message: errorMessage };
          }
          return { ok: true, value: parsed.value };
        }

        if (parsed.error.kind === 'expression') {
          return { ok: false, kind: 'invalid', message: formatExpressionErrorMessage(parsed.error.message) };
        }
        return { ok: false, kind: 'invalid', message: parsed.error.message };
      },
      [allowDecimals, allowNegative, maxValue, minValue, resolvedPrecision]
    );

    const hadErrorOnEditStartRef = React.useRef(false);
    const pendingClickCaretRef = React.useRef<number | null>(null);

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

    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => filterAmountExpressionKeyDown(e, { allowNegative, allowDecimals }),
      [allowDecimals, allowNegative]
    );

    const rejectDraft = React.useCallback(
      (nextDraft: string) => !allowNegative && containsUnaryMinusToken(nextDraft),
      [allowNegative]
    );

    const onStartEditing = React.useCallback(
      (
        source: TwoStageStartSource,
        helpers: Readonly<{ draft: string; error: DraftFieldError | undefined; inputElement: HTMLInputElement | null; setDraft: (draft: string) => void }>
      ) => {
        const { draft: currentDraft, error: currentError, inputElement, setDraft: applyDraft } = helpers;
        hadErrorOnEditStartRef.current = Boolean(currentError?.message);
        if (source !== 'click') return;
        if (isExpressionErrorMessage(currentError?.message)) {
          pendingClickCaretRef.current = null;
          return;
        }
        if (value?.kind === 'expression') {
          const nextDraft = amountValueToDraftString(value, resolvedPrecision);
          if (nextDraft !== currentDraft) applyDraft(nextDraft);
          pendingClickCaretRef.current = null;
          return;
        }
        const selectionStart = inputElement?.selectionStart;
        const cleanedDraft = stripAmountGroupingSeparators(currentDraft);
        if (typeof selectionStart === 'number') {
          pendingClickCaretRef.current = mapCaretFromGroupedAmount(currentDraft, selectionStart);
        }
        if (cleanedDraft !== currentDraft) {
          applyDraft(cleanedDraft);
        }
      },
      [resolvedPrecision, value]
    );

    const shouldCommitOnBlur = React.useCallback(
      (ctx: Readonly<{ draft: string; value: AmountValue | undefined; committedInvalidDraft: string | undefined }>) => {
        const unchanged =
          ctx.committedInvalidDraft === undefined &&
          (ctx.value?.kind === 'expression'
            ? ctx.draft === amountValueToDraftString(ctx.value, resolvedPrecision)
            : ctx.draft === formatAmount(ctx.value));
        const shouldForceCommit = ctx.draft === '' && ctx.value === undefined && hadErrorOnEditStartRef.current;
        return !unchanged || shouldForceCommit;
      },
      [formatAmount, resolvedPrecision]
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
    } = useStyledFieldAdapter<AmountValue | undefined>({
      value,
      format: formatAmount,
      parse: parseAmount,
      getDraftForKey,
      normalizePasteText: (text) => normalizeAmountPaste(text, { allowNegative }),
      onStartEditing,
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)),
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      onFocus,
      // Beløbsfeltet nulstiller "havde-fejl-ved-edit-start" efter hvert blur (drev for force-commit).
      onBlur: (e) => {
        hadErrorOnEditStartRef.current = false;
        onBlur?.(e);
      },
      onKeyDown,
      disabled,
      clearTouchedOnEmptyDraft: true,
      // Tastet/indsat draft canonicaliseres (fjern grupperings-separatorer mv.).
      transformDraftOnChange: sanitizePastedAmount,
      rejectDraft,
      keyFilter,
      shouldCommitOnBlur,
      setPasteCaret: true,
      commitOnClosedPaste: true,
    });

    const visibleLocalError = error;
    const localHasError = Boolean(visibleLocalError?.message);
    const resolvedHasError = externalHasError || localHasError;
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    // Parse-fejl (ikke-committbart beløb) persisteres i invalidDrafts via kanalen og vises afledt herfra.
    // Beløbsfeltet har ingen separat blocksSave:false range-fejl, så det rapporterer ikke til fieldErrors-storen.

    React.useEffect(() => {
      if (!isEditorOpen) {
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
    }, [draft, inputElementRef, isEditorOpen]);

    const displayDraft = isEditorOpen ? draft : localHasError ? draft : formatAmount(value);
    // Enheden ("kr.") rendres som adornment uden for input-værdien (jf. InputUnitAdornment): altid
    // synlig — også under indtastning — og dæmpet når der intet er vist (placeholder-tilstand).

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={displayDraft}
        onDraftChange={handleDraftChange}
        inputRef={inputElementRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={resolvedPlaceholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onPaste={handlePaste}
        htmlInputAttributes={{
          inputMode: allowDecimals ? 'decimal' : 'numeric',
          readOnly: !isEditorOpen,
        }}
        sx={mergeSx({
          '& .MuiInputBase-input': {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            caretColor: isEditorOpen ? 'auto' : 'transparent',
            cursor: isEditorOpen ? 'text' : 'pointer',
          },
        }, sx)}
        endAdornment={
          <>
            <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.currency} muted={displayDraft.trim() === ''} />
            {value?.kind === 'expression' ? (
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
            ) : null}
          </>
        }
      />
    );
  }
);

StyledAmountField.displayName = 'StyledAmountField';

export default StyledAmountField;
