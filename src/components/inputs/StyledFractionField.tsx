import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterFractionKeyDown } from './inputKeyFilters';
import { readClipboardText } from '../../utils/clipboardUtils';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { DEFAULT_FRACTION_MAX_DIGITS, getFractionMaxLength, INTEGER_FRACTION_FORMAT_MESSAGE, parseFractionString, sanitizePastedFraction } from '../../utils/fraction';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import { normalizeFractionPaste } from '../../utils/inputPasteNormalization';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { useFieldInvalidDraftChannel } from '../../hooks/useFormFieldErrors';

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
    const inputElementRef = React.useRef<HTMLInputElement>(null);

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
      (draft, { mode }) => {
        const trimmed = draft.trim();
        if (trimmed === '') return { ok: true, value: undefined };

        if (mode === 'typing') {
          // Invariant: typing må ikke hævde committable for ufuldstændig, ikke-tom input.
          // Hold typing-parse bevidst minimal: enhver ikke-tom draft behandles som partial indtil commit.
          return { ok: false, kind: 'partial' };
        }

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

    const { committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = useFieldInvalidDraftChannel(onFieldError);

    const { draft, setDraft, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<string | undefined>({
        value,
        format: formatFraction,
        parse: parseFraction,
        normalizeDraftOnCommit: trimToAlphanumericEdges,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
          clearInvalidDraft?.();
        },
        onCommitInvalid,
        committedInvalidDraft,
        inputElementRef,
        commitOnBlur: false,
      });

    // Parse-fejl persisteres i invalidDrafts via useDraftField og vises afledt herfra.
    const visibleLocalError = error;
    const resolvedHasError = externalHasError || Boolean(visibleLocalError?.message);
    const resolvedErrorMessage = externalHasError ? externalHelperText : visibleLocalError?.message ?? '';

    const skipNextBlurCommitRef = React.useRef(false);

    const applyDraft = React.useCallback((nextDraft: string) => {
      skipNextBlurCommitRef.current = false;
      setDraft(nextDraft);
      onDraftChange?.(createDraftChangeEvent(nextDraft));
    }, [onDraftChange, setDraft]);

    const handleDraftChange = React.useCallback(
      (nextDraft: string) => {
        applyDraft(sanitizePastedFraction(nextDraft, { allowNegative }));
      },
      [allowNegative, applyDraft]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9/,]$/.test(key)) return key;
      if (allowNegative && key === '-') return key;
      return null;
    }, [allowNegative]);

    const activation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      normalizePasteText: normalizeFractionPaste,
      onReplaceDraft: (nextDraft) => applyDraft(nextDraft),
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
          filterFractionKeyDown(e, { maxDigits, allowNegative });
        }
        onKeyDown?.(e);
      },
      [activation, allowNegative, maxDigits, onCommit, onKeyDown, onKeyDownBase, parseFraction, setDraft]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          activation.handlePaste(e);
          return;
        }

        const normalized = normalizeFractionPaste(readClipboardText(e));
        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElementRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        const nextDraft = draft.slice(0, start) + normalized + draft.slice(end);
        applyDraft(nextDraft);

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
      [activation, applyDraft, draft]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={draft}
        onDraftChange={handleDraftChange}
        inputRef={inputElementRef}
        onFocus={handleFocus}
        onBlur={(e) => {
          onBlurBase(e);
          // Aldrig "unchanged" mens en ikke-committbar rå draft lever — ellers ryddes invalidDrafts ikke
          // ved clear/edit af et ugyldigt felt, og feltet re-syncer til den gamle ugyldige værdi (jf. StyledDateField).
          const unchanged = draft === formatFraction(value) && committedInvalidDraft === undefined;
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
        onPaste={handlePaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{
          inputMode: 'decimal',
          maxLength: getFractionMaxLength(maxDigits, allowNegative),
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
