import * as React from 'react';
import { InputAdornment } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterPercentKeyDown } from './inputKeyFilters';
import { prefixZeroBeforeLeadingComma, trimToNumericEdgesPreserveLeadingMinus } from '../../utils/draftNormalization';
import { formatAsAmount, formatAsAmountTrimmed } from '../../utils/formatUtils';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';

export type StyledPercentFieldValueChangeEvent = CommitEvent<number | undefined>;
export type StyledPercentFieldDraftChangeEvent = DraftChangeEvent;

export type StyledPercentFieldProps = {
  value: number | undefined;

  width?: number | string;
  placeholder?: string;
  disabled?: boolean;

  allowNegative?: boolean;
  allowDecimals?: boolean;
  minValue?: number;
  maxValue?: number;
  /**
   * Range constraint (inclusive).
   *
   * Default range is forbidden unless explicitly opted in via `useDefaultPercentRange`.
   */
  useDefaultPercentRange?: boolean;

  /**
   * Optional: freezes the input grammar independent of `minValue`/`maxValue`.
   *
   * Controls how many integer digits are accepted (excluding thousands separators).
   * Must be an integer between 1 and 18.
   */
  maxIntegerDigits?: number;

  /**
   * Draft callback (typing only).
   */
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<number | undefined>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Callback for current error message (for parent validation gating)
   */
  onFieldError?: (errorMsg: string | undefined) => void;

  error?: boolean;
  helperText?: string;

  sx?: SxProps<Theme>;
};

const formatPercentMinimal = (
  value: number | undefined,
  decimals: 0 | 2
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '';
  return formatAsAmountTrimmed(value, decimals);
};

const stripTrailingPercent = (placeholder: string | undefined): string | undefined => {
  if (!placeholder) return placeholder;
  const trimmed = placeholder.trim();
  if (trimmed.endsWith('%')) {
    return trimmed.slice(0, -1).trimEnd();
  }
  return placeholder;
};

const formatPercentBound = (value: number, decimals: 0 | 2): string =>
  formatAsAmount(value, decimals);

const MAX_TYPING_PERCENT = 100;
const MAX_TYPING_PERCENT_INTEGER_DIGITS = 3;

const StyledPercentField = React.forwardRef<HTMLDivElement, StyledPercentFieldProps>(
  (
    {
      value,
      width = 100,
      placeholder = '0',
      disabled,
      allowNegative = false,
      allowDecimals = true,
      minValue,
      maxValue,
      useDefaultPercentRange = false,
      maxIntegerDigits: maxIntegerDigitsProp,
      onDraftChange,
      onCommit,
      onFocus,
      onBlur,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      sx,
      onFieldError,
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement>(null);

    const configErrorMessage = React.useMemo(() => {
      if (!useDefaultPercentRange && minValue === undefined && maxValue === undefined) {
        return 'Ugyldig konfiguration: angiv minValue/maxValue eller useDefaultPercentRange';
      }

      if (minValue !== undefined && !Number.isFinite(minValue)) return 'Ugyldig konfiguration: minValue skal være et tal';
      if (maxValue !== undefined && !Number.isFinite(maxValue)) return 'Ugyldig konfiguration: maxValue skal være et tal';
      if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) {
        return 'Ugyldig konfiguration: minValue er større end maxValue';
      }
      if (!allowNegative) {
        if (typeof minValue === 'number' && minValue < 0) return 'Ugyldig konfiguration: minValue er negativ, men allowNegative=false';
        if (typeof maxValue === 'number' && maxValue < 0) return 'Ugyldig konfiguration: maxValue er negativ, men allowNegative=false';
      }

      if (maxIntegerDigitsProp !== undefined) {
        if (!Number.isFinite(maxIntegerDigitsProp)) return 'Ugyldig konfiguration: maxIntegerDigits skal være et tal';
        if (!Number.isInteger(maxIntegerDigitsProp)) return 'Ugyldig konfiguration: maxIntegerDigits skal være et heltal';
        if (maxIntegerDigitsProp < 1 || maxIntegerDigitsProp > 18) {
          return 'Ugyldig konfiguration: maxIntegerDigits skal være mellem 1 og 18';
        }
      }
      return '';
    }, [allowNegative, maxIntegerDigitsProp, maxValue, minValue, useDefaultPercentRange]);

    const resolvedRange = React.useMemo(() => {
      const effectiveMin = typeof minValue === 'number' ? minValue : useDefaultPercentRange ? 0 : undefined;
      const effectiveMax = typeof maxValue === 'number' ? maxValue : useDefaultPercentRange ? 100 : undefined;
      return { effectiveMin, effectiveMax };
    }, [maxValue, minValue, useDefaultPercentRange]);

    const maxIntegerDigitsRangeErrorMessage = React.useMemo(() => {
      const maxAbs = Math.max(
        Math.abs(resolvedRange.effectiveMin ?? 0),
        Math.abs(resolvedRange.effectiveMax ?? 0)
      );
      if (!Number.isFinite(maxAbs)) return '';
      const requiredDigitsByRange = Math.max(1, Math.floor(maxAbs).toString().length);
      if (requiredDigitsByRange > 18) {
        return `Ugyldig konfiguration: min/maxValue kræver mere end 18 cifre (kræver ${requiredDigitsByRange})`;
      }
      if (
        typeof maxIntegerDigitsProp === 'number' &&
        Number.isFinite(maxIntegerDigitsProp) &&
        Number.isInteger(maxIntegerDigitsProp) &&
        maxIntegerDigitsProp < requiredDigitsByRange
      ) {
        return `Ugyldig konfiguration: maxIntegerDigits er for lille til min/maxValue (kræver mindst ${requiredDigitsByRange})`;
      }
      return '';
    }, [maxIntegerDigitsProp, resolvedRange.effectiveMax, resolvedRange.effectiveMin]);

    const resolvedConfigErrorMessage =
      configErrorMessage.trim() !== '' ? configErrorMessage : maxIntegerDigitsRangeErrorMessage;

    const hasConfigError = resolvedConfigErrorMessage.trim() !== '';

    if (import.meta.env.DEV && hasConfigError) {
      throw new Error(resolvedConfigErrorMessage);
    }

    const effectiveMaxIntegerDigits = React.useMemo(() => {
      if (typeof maxIntegerDigitsProp === 'number') return maxIntegerDigitsProp;
      const maxAbs = Math.max(
        Math.abs(resolvedRange.effectiveMin ?? 0),
        Math.abs(resolvedRange.effectiveMax ?? 0)
      );
      if (!Number.isFinite(maxAbs)) return 3;
      return Math.max(1, Math.floor(maxAbs).toString().length);
    }, [maxIntegerDigitsProp, resolvedRange.effectiveMax, resolvedRange.effectiveMin]);

    const maxAllowedIntegerPart = React.useMemo(() => {
      const maxAbs = Math.max(
        Math.abs(resolvedRange.effectiveMin ?? 0),
        Math.abs(resolvedRange.effectiveMax ?? 0)
      );
      if (!Number.isFinite(maxAbs)) return undefined;
      return Math.floor(maxAbs);
    }, [resolvedRange.effectiveMax, resolvedRange.effectiveMin]);

    const maxLength =
      effectiveMaxIntegerDigits +
      (allowDecimals ? 3 : 0) +
      (allowNegative ? 1 : 0); // [-]iiii[,dd]

    type PercentDisplayFormat = Readonly<{ value: number | undefined; decimals: 0 | 1 | 2 }>;
    const lastCommittedDisplayRef = React.useRef<PercentDisplayFormat | null>(null);
    const pendingCommitDecimalsRef = React.useRef<0 | 1 | 2>(allowDecimals ? 2 : 0);

    const normalizePercentValueForIdentity = React.useCallback((v: number | undefined): number | undefined => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
      return v === 0 ? 0 : v;
    }, []);

    React.useEffect(() => {
      const last = lastCommittedDisplayRef.current;
      if (!last) return;
      const lastValue = normalizePercentValueForIdentity(last.value);
      const currentValue = normalizePercentValueForIdentity(value);
      if (!Object.is(lastValue, currentValue)) {
        lastCommittedDisplayRef.current = null;
      }
    }, [normalizePercentValueForIdentity, value]);

    const formatPercent = React.useCallback((v: number | undefined): string => {
      if (typeof v !== 'number' || !Number.isFinite(v)) return '';

      const last = lastCommittedDisplayRef.current;
      const normalized = normalizePercentValueForIdentity(v);
      if (last && Object.is(normalizePercentValueForIdentity(last.value), normalized)) {
        const decimals = last.decimals;
        if (decimals === 0) return String(Math.trunc(v));
        return formatAsAmountTrimmed(v, decimals);
      }

      return formatPercentMinimal(v, allowDecimals ? 2 : 0);
    }, [allowDecimals, normalizePercentValueForIdentity]);

    const parsePercent: DraftParse<number | undefined> = React.useCallback(
      (draft, { mode }) => {
        const trimmed = draft.trim();
        if (trimmed === '') return { ok: true, value: undefined };

        const invalidOrPartial = (message: string) => {
          if (mode === 'typing') return { ok: false, kind: 'partial' } as const;
          return { ok: false, kind: 'invalid', message } as const;
        };

        const normalized = trimmed.replace(/\s+/g, '');
        if (normalized.length > maxLength) return invalidOrPartial('Ugyldig procent');

        const percentPattern = allowDecimals
          ? allowNegative
            ? /^-?\d*(,\d{0,2})?$/
            : /^\d*(,\d{0,2})?$/
          : allowNegative
            ? /^-?\d*$/
            : /^\d*$/;
        if (!percentPattern.test(normalized)) return invalidOrPartial('Ugyldig procent');

        const hasLeadingMinus = normalized.startsWith('-');
        if (hasLeadingMinus && !allowNegative) return invalidOrPartial('Procent kan ikke være negativ');

        const withoutSign = hasLeadingMinus ? normalized.slice(1) : normalized;
        const [integerPart, decimalPart] = withoutSign.split(',') as [string, string | undefined];
        if (integerPart.trim() === '') return invalidOrPartial('Ugyldig procent');
        if (!/^\d+$/.test(integerPart)) return invalidOrPartial('Ugyldig procent');

        if (decimalPart === '') {
          return invalidOrPartial('Ugyldig procent');
        }
        if (!allowDecimals && decimalPart !== undefined) {
          return invalidOrPartial('Ugyldig procent');
        }
        if (decimalPart !== undefined && !/^\d+$/.test(decimalPart))
          return invalidOrPartial('Ugyldig procent');

        const decimals = allowDecimals
          ? decimalPart?.length === 2
            ? 2
            : decimalPart?.length === 1
              ? 1
              : 0
          : 0;

        const integerNum = Number.parseInt(integerPart, 10);
        if (!Number.isFinite(integerNum)) return invalidOrPartial('Ugyldig procent');
        if (typeof maxAllowedIntegerPart === 'number' && integerNum > maxAllowedIntegerPart) {
          return invalidOrPartial(`Maks ${maxAllowedIntegerPart} før komma`);
        }

        const decimalScaled =
          !allowDecimals || decimalPart === undefined
            ? 0
            : decimalPart.length === 1
              ? Number.parseInt(decimalPart, 10) * 10
              : Number.parseInt(decimalPart, 10);
        if (!Number.isFinite(decimalScaled)) return invalidOrPartial('Ugyldig procent');

        const scaled = integerNum * 100 + decimalScaled;
        const numeric = scaled / 100;
        const signedRaw = hasLeadingMinus ? -numeric : numeric;
        const signed = signedRaw === 0 ? 0 : signedRaw;

        const effectiveMin = resolvedRange.effectiveMin;
        const effectiveMax = resolvedRange.effectiveMax;
        if (typeof effectiveMin === 'number' && signed < effectiveMin) {
          if (typeof effectiveMax === 'number') {
            return invalidOrPartial(
              `Procent skal være mellem ${formatPercentBound(effectiveMin, allowDecimals ? 2 : 0)} og ${formatPercentBound(effectiveMax, allowDecimals ? 2 : 0)}`
            );
          }
          return invalidOrPartial(
            `Procent skal være ${formatPercentBound(effectiveMin, allowDecimals ? 2 : 0)} eller højere`
          );
        }
        if (typeof effectiveMax === 'number' && signed > effectiveMax) {
          if (typeof effectiveMin === 'number') {
            return invalidOrPartial(
              `Procent skal være mellem ${formatPercentBound(effectiveMin, allowDecimals ? 2 : 0)} og ${formatPercentBound(effectiveMax, allowDecimals ? 2 : 0)}`
            );
          }
          return invalidOrPartial(
            `Procent skal være ${formatPercentBound(effectiveMax, allowDecimals ? 2 : 0)} eller lavere`
          );
        }

        if (mode === 'commit') {
          pendingCommitDecimalsRef.current = decimals;
        }
        return { ok: true, value: signed };
      },
      [
        allowDecimals,
        allowNegative,
        maxAllowedIntegerPart,
        maxLength,
        resolvedRange.effectiveMax,
        resolvedRange.effectiveMin,
      ]
    );

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<number | undefined>({
        value,
        format: formatPercent,
        parse: parsePercent,
        normalizeDraftOnCommit: (draft) => prefixZeroBeforeLeadingComma(trimToNumericEdgesPreserveLeadingMinus(draft)),
        onCommit: (nextValue) => {
          lastCommittedDisplayRef.current = { value: nextValue, decimals: pendingCommitDecimalsRef.current };
          onCommit?.(createCommitEvent(nextValue));
        },
        inputElementRef,
        clearErrorOnDraftChange: true,
        commitOnBlur: false,
      });


    const visibleLocalError = touched ? error : undefined;
    const resolvedHasError = hasConfigError || externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = hasConfigError
      ? resolvedConfigErrorMessage
      : externalHasError
        ? externalHelperText
        : visibleLocalError?.message ?? '';

    // Notify parent of error state
    React.useEffect(() => {
      if (typeof onFieldError === 'function') {
        onFieldError(visibleLocalError?.message);
      }
    }, [visibleLocalError?.message, onFieldError]);

    const skipNextBlurCommitRef = React.useRef(false);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setDraft(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraft]
    );

    const getDraftForKey = React.useCallback(
      (key: string): string | null => {
        const mapped = key === '.' ? ',' : key;
        if (allowDecimals) {
          if (/^[0-9,]$/.test(mapped)) return mapped;
          return null;
        }
        if (/^[0-9]$/.test(mapped)) return mapped;
        return null;
      },
      [allowDecimals]
    );

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

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          if (e.key === 'Backspace' || e.key === 'Delete') {
            e.preventDefault();
            e.stopPropagation();
            // UNDTAGELSE TIL "INGEN LIVE PREVIEW": Commit øjeblikkeligt ved DELETE/Backspace
            // Parse og commit direkte (synkront) som table-felter gør
            const normalized = prefixZeroBeforeLeadingComma(trimToNumericEdgesPreserveLeadingMinus(''));
            const result = parsePercent(normalized, { mode: 'commit' });
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
          // Revert draft til committed value og luk editor uden commit.
          handleDraftChange(formatPercent(value));
          skipNextBlurCommitRef.current = true; // ekstra sikkerhed: blur efter close må ikke committe
          activation.closeEditor();
          return;
        }

        if (!e.defaultPrevented) {
          filterPercentKeyDown(e, {
            allowNegative,
            maxIntegerDigits: MAX_TYPING_PERCENT_INTEGER_DIGITS,
            maxIntegerPart: MAX_TYPING_PERCENT,
            allowDecimals,
            maxValue: MAX_TYPING_PERCENT,
          });
        }
        onKeyDown?.(e);
    }, [activation, allowDecimals, allowNegative, formatPercent, handleDraftChange, onCommit, onKeyDown, onKeyDownBase, parsePercent, setDraft, value]);

    const percentAdornmentColor = draft.trim() === '' ? 'rgba(0, 0, 0, 0.4)' : 'inherit';
    const endAdornment = (
      <InputAdornment
        position="end"
        sx={{
          marginLeft: 0,
          pointerEvents: 'none',
          color: percentAdornmentColor,
          font: 'inherit',
          '& span': { font: 'inherit' },
        }}
      >
        <span style={{ whiteSpace: 'pre' }}> %</span>
      </InputAdornment>
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

          const unchanged = draft === formatPercent(value);

          // Commit når draft faktisk afviger fra committed value.
          // Dette må ikke afhænge af activation.isEditorOpen, ellers får vi "satser committer aldrig" bugs.
          if (!skipNextBlurCommitRef.current && !unchanged) {
            commit();
          }

          // Luk editor hvis den var åben.
          if (activation.isEditorOpen) activation.closeEditor();

          // Reset flags altid på blur.
          skipNextBlurCommitRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={activation.handlePaste}
        placeholder={stripTrailingPercent(placeholder)}
        width={width}
        disabled={disabled || hasConfigError}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        endAdornment={endAdornment}
        htmlInputAttributes={{
          inputMode: allowDecimals ? 'decimal' : 'numeric',
          maxLength,
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
      />
    );
  }
);

StyledPercentField.displayName = 'StyledPercentField';

export default StyledPercentField;
