import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterFractionKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from './fieldEvents';

export type StyledFractionFieldValueChangeEvent = CommitEvent<string | undefined>;
export type StyledFractionFieldDraftChangeEvent = DraftChangeEvent;

export type StyledFractionFieldProps = {
  value: string | undefined;

  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  /**
   * Legacy konfigurationsprop.
   * Kun værdien `2` er understøttet for at bevare eksisterende inputkontrakt.
   */
  maxDigits?: number;
  allowNegative?: boolean;
  /**
   * If `true`, `0/x` is accepted on commit (still rejects `x=0`).
   *
   * Default: `false` (domain-specific constraint).
   */
  allowZeroNumerator?: boolean;
  /**
   * If `true`, the committed fraction is normalized to a canonical reduced form (e.g. `-2/4` -> `-1/2`).
   *
   * Note: if `allowZeroNumerator=true`, `0/x` is canonicalized to `0/1` when `canonicalizeOnCommit=true`.
   */
  canonicalizeOnCommit?: boolean;

  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<string | undefined>;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Callback for current local error message (for producer-owned error reporting).
   *
   * Note: this intentionally does not report `error/helperText` from the parent (external errors).
   */
  onFieldError?: (errorMsg: string | undefined) => void;

  error?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
};

const formatFraction = (value: string | undefined): string => value ?? '';

const gcd = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x === 0 ? 1 : x;
};

const StyledFractionField = React.forwardRef<HTMLDivElement, StyledFractionFieldProps>(
  (
    {
      value,
      width = 100,
      placeholder = 'fx 1/3',
      disabled,
      maxDigits = 2,
      allowNegative = false,
      allowZeroNumerator = false,
      canonicalizeOnCommit = true,
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
    const inputElementRef = React.useRef<HTMLInputElement>(null);

    const configErrorMessage = React.useMemo(() => {
      if (!Number.isFinite(maxDigits)) return 'Ugyldig konfiguration: maxDigits skal være et tal';
      if (!Number.isInteger(maxDigits)) return 'Ugyldig konfiguration: maxDigits skal være et heltal';
      if (maxDigits !== 2) return 'Ugyldig konfiguration: maxDigits skal være 2';
      return '';
    }, [maxDigits]);

    if (import.meta.env.DEV && configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const resolvedMaxDigits = 2;

    const parseFraction: DraftParse<string | undefined> = React.useCallback(
      (draft, { mode }) => {
        const trimmed = draft.trim();
        if (trimmed === '') return { ok: true, value: undefined };

        const normalized = trimmed.replace(/[ .:-]/g, '/');

        if (mode === 'typing') {
          // Invariant: typing must not claim committable for incomplete non-empty input.
          // Keep typing parse intentionally minimal: any non-empty draft is treated as partial until commit.
          return { ok: false, kind: 'partial' };
        }

        if (configErrorMessage.trim() !== '') {
          return { ok: false, kind: 'invalid', message: configErrorMessage };
        }

        const hasLeadingMinus = normalized.startsWith('-');
        if (hasLeadingMinus && !allowNegative) {
          return {
            ok: false,
            kind: 'invalid',
            message: 'Negative brøker er ikke tilladt',
          };
        }

        const withoutSign = hasLeadingMinus ? normalized.slice(1) : normalized;
        if (/[^0-9/]/.test(withoutSign)) {
          return { ok: false, kind: 'invalid', message: 'Ugyldig værdi' };
        }

        const slashCount = (withoutSign.match(/\//g) ?? []).length;
        if (slashCount !== 1) {
          return { ok: false, kind: 'invalid', message: 'Ugyldig værdi' };
        }

        const [numeratorRaw, denominatorRaw] = withoutSign.split('/') as [string, string];
        if (numeratorRaw === '' || denominatorRaw === '') {
          return { ok: false, kind: 'invalid', message: 'Ugyldig værdi' };
        }

        if (numeratorRaw.length > resolvedMaxDigits || denominatorRaw.length > resolvedMaxDigits) {
          return { ok: false, kind: 'invalid', message: 'Maks 2 cifre før og efter /' };
        }

        const numerator = Number.parseInt(numeratorRaw, 10);
        const denominator = Number.parseInt(denominatorRaw, 10);
        if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
          return { ok: false, kind: 'invalid', message: 'Ugyldig værdi' };
        }

        if (denominator === 0) {
          return { ok: false, kind: 'invalid', message: 'Ugyldig værdi' };
        }

        if (numerator === 0) {
          if (!allowZeroNumerator) {
            return { ok: false, kind: 'invalid', message: 'Tæller kan ikke være 0' };
          }
          if (!canonicalizeOnCommit) {
            return { ok: true, value: `0/${denominator}` };
          }
          return { ok: true, value: '0/1' };
        }

        const signedNumerator = hasLeadingMinus ? -numerator : numerator;

        if (!canonicalizeOnCommit) {
          return { ok: true, value: `${signedNumerator}/${denominator}` };
        }

        const divisor = gcd(signedNumerator, denominator);
        const reducedNumerator = signedNumerator / divisor;
        const reducedDenominator = denominator / divisor;

        return { ok: true, value: `${reducedNumerator}/${reducedDenominator}` };
      },
      [allowNegative, allowZeroNumerator, canonicalizeOnCommit, configErrorMessage]
    );

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<string | undefined>({
        value,
        format: formatFraction,
        parse: parseFraction,
        normalizeDraftOnCommit: trimToAlphanumericEdges,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
        },
        inputElementRef,
        clearErrorOnDraftChange: true,
        commitOnBlur: false,
      });

    const visibleLocalError = touched ? error : undefined;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    // Notify parent of local error state (producer-owned reporting)
    React.useEffect(() => {
      if (typeof onFieldError !== 'function') return;
      onFieldError(visibleLocalError?.message);
    }, [onFieldError, visibleLocalError?.message]);

    const skipNextBlurCommitRef = React.useRef(false);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setDraft(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraft]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9/]$/.test(key)) return key;
      return null;
    }, []);

    const activation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
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
            const result = parseFraction(normalized, { mode: 'commit' });
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
          filterFractionKeyDown(e);
        }
        onKeyDown?.(e);
      },
      [activation, onCommit, onKeyDown, onKeyDownBase, parseFraction, setDraft]
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
          const unchanged = draft === formatFraction(value);
          if (!skipNextBlurCommitRef.current && !unchanged) {
            commit();
          }
          if (activation.isEditorOpen) activation.closeEditor();
          skipNextBlurCommitRef.current = false;
          onBlur?.(e);
        }}
        onKeyDown={handleKeyDown}
        onMouseDown={activation.handleMouseDown}
        onClick={activation.handleClick}
        onPaste={activation.handlePaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{
          inputMode: 'numeric',
          maxLength: (allowNegative ? 1 : 0) + resolvedMaxDigits + 1 + resolvedMaxDigits,
          readOnly: !activation.isEditorOpen,
        }}
        sx={{
          '& .MuiInputBase-input': {
            textAlign: 'center',
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

StyledFractionField.displayName = 'StyledFractionField';

export default StyledFractionField;
