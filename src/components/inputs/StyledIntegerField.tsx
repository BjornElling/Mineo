import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import { filterIntegerKeyDown } from './inputKeyFilters';
import { trimToNumericEdgesPreserveLeadingMinus } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import { getIntegerRangeErrorMessage } from '../../utils/integerRange';
import { readClipboardText } from '../../utils/clipboardUtils';
import { normalizeIntegerPaste } from '../../utils/inputPasteNormalization';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { useFieldInvalidDraftChannel } from '../../hooks/useFormFieldErrors';

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

    const { committedInvalidDraft, onCommitInvalid, clearInvalidDraft } = useFieldInvalidDraftChannel(onFieldError);

    const { draft, setDraft, touched, error, onFocus: onFocusBase, onBlur: onBlurBase, onKeyDown: onKeyDownBase, commit } =
      useDraftField<number | undefined>({
        value,
        format: formatInteger,
        parse: parseInteger,
        normalizeDraftOnCommit: trimToNumericEdgesPreserveLeadingMinus,
        onCommit: (nextValue) => {
          onCommit?.(createCommitEvent(nextValue));
          clearInvalidDraft?.();
        },
        onCommitInvalid,
        committedInvalidDraft,
        inputElementRef,
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

    const visibleLocalError = error;
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

    // Parse-fejl persisteres i invalidDrafts via useDraftField. Kun den blocksSave:false
    // range-fejl (committet, men uden for UI-range) rapporteres til fieldErrors-storen.
    React.useEffect(() => {
      if (typeof onFieldError !== 'function') return;
      if (shouldShowRangeError) {
        onFieldError({ message: rangeErrorMessage, blocksSave: false });
        return;
      }
      onFieldError(undefined);
    }, [onFieldError, rangeErrorMessage, shouldShowRangeError]);

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
      normalizePasteText: (text) =>
        normalizeIntegerPaste(text, {
          maxDigits: effectiveMaxDigits,
          maxValue,
          allowNegative,
        }),
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
            const normalized = trimToNumericEdgesPreserveLeadingMinus('');
            const result = parseInteger(normalized, { mode: 'commit' });
            if (result.ok) {
              onCommit?.(createCommitEvent(result.value));
            }
            // Delete tømmer feltet → ryd evt. ikke-committbar rå draft (jf. StyledDateField)
            // og den UI-only range-fejl, så en tidligere out-of-range-værdis røde markering
            // ikke hænger ved efter rydningen (denne sti går uden om handleDraftChange).
            clearInvalidDraft?.();
            setRangeErrorMessage('');
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
      [activation, allowNegative, clearInvalidDraft, effectiveMaxDigits, maxValue, onCommit, onKeyDown, onKeyDownBase, parseInteger, setDraft]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          activation.handlePaste(e);
          return;
        }

        const normalized = normalizeIntegerPaste(readClipboardText(e), {
          maxDigits: effectiveMaxDigits,
          maxValue,
          allowNegative,
        });
        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElementRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        handleDraftChange(draft.slice(0, start) + normalized + draft.slice(end));
      },
      [activation, allowNegative, draft, effectiveMaxDigits, handleDraftChange, maxValue]
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
          const unchanged = draft === formatInteger(value) && committedInvalidDraft === undefined;
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
