import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import type { ISODateString } from '../../types/branded';
import { isISODateString, isoToDanish } from '../../types/branded';
import { validateISODateRange } from '../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage, type DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import { filterDateLikeKeyDown } from './inputKeyFilters';
import { readClipboardText } from '../../utils/clipboardUtils';
import { normalizeDateDraftOnCommit } from '../../utils/dateDraftNormalization';
import { INSERT_TODAY_DATE_EVENT } from '../../utils/insertTodayDate';
import { normalizeDatePaste } from '../../utils/inputPasteNormalization';
import { assignRef } from '../../utils/refUtils';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { isInteractiveDevLoggingEnabled } from '../../utils/debugRuntime';
import { parseDateDraftForCommit } from '../../utils/dateDraftCommit';

const debugStyledDateField = (event: string, details: Record<string, unknown>): void => {
  if (!isInteractiveDevLoggingEnabled) return;
  console.debug('[StyledDateField]', event, details);
};

export type StyledDateFieldValueChangeEvent = CommitEvent<ISODateString | undefined>;
export type StyledDateFieldDraftChangeEvent = DraftChangeEvent;

export type StyledDateFieldProps = {
  value: ISODateString | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<ISODateString | undefined>;
  inputRef?: React.Ref<HTMLInputElement>;

  name?: string;
  width?: number | string;
  minDate?: ISODateString;
  maxDate?: ISODateString;
  specialRangeErrors?: DateRangeSpecialErrors;

  placeholder?: string;
  disabled?: boolean;

  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  /**
   * Callback for den aktuelle fejlbesked (til forælderens validation gating)
   */
  onFieldError?: FieldErrorReporter;

  error?: boolean;
  helperText?: string;
  sx?: SxProps<Theme>;
  /** Åbn editoren ved første klik uden forudgående fokus (til touch/mobil). */
  singleStageClick?: boolean;
};

const formatISODateAsDanish = (value: ISODateString | undefined): string => {
  if (!value) return '';
  return isoToDanish(value) ?? '';
};

const MAX_CANONICAL_DANISH_DATE_LENGTH = 10; // dd-mm-åååå
// Tillad lidt flere draft-tegn end den kanoniske committede form for at understøtte eftergivende typing
// (fx separatorer/whitespace) uden at UI'et blokerer midt i indtastningen. Dette er en eksplicit UX-tolerance.
const MAX_DRAFT_LENGTH = MAX_CANONICAL_DANISH_DATE_LENGTH + 6;

const StyledDateField = React.forwardRef<HTMLDivElement, StyledDateFieldProps>(
  (
    {
      value,
      onDraftChange,
      onCommit,
      inputRef,
      name,
      width = 130,
      minDate,
      maxDate,
      specialRangeErrors,
      placeholder = 'dd-mm-åååå',
      disabled,
      onFocus,
      onBlur,
      onKeyDown,
      error: externalHasError = false,
      helperText: externalHelperText = '',
      sx,
      onFieldError,
      singleStageClick = false,
    },
    ref
  ) => {
    const inputElementRef = React.useRef<HTMLInputElement>(null);
    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputRef]
    );

    const normalizedMinDate = minDate;
    const normalizedMaxDate = maxDate;

    const effectiveMinDate = normalizedMinDate;
    const effectiveMaxDate = normalizedMaxDate;
    const specialFraTilRole = specialRangeErrors?.fraTilRole;
    const specialMinBoundKind = specialRangeErrors?.minBoundKind;
    const specialMinBoundReferenceISO = specialRangeErrors?.minBoundReferenceISO;
    const specialMaxBoundKind = specialRangeErrors?.maxBoundKind;
    const specialMaxBoundFieldLabel = specialRangeErrors?.maxBoundFieldLabel;
    const specialMaxBoundReferenceISO = specialRangeErrors?.maxBoundReferenceISO;
    const resolvedSpecialRangeErrors = React.useMemo<DateRangeSpecialErrors | undefined>(() => {
      if (
        specialFraTilRole === undefined &&
        specialMinBoundKind === undefined &&
        specialMinBoundReferenceISO === undefined &&
        specialMaxBoundKind === undefined &&
        specialMaxBoundFieldLabel === undefined &&
        specialMaxBoundReferenceISO === undefined
      ) {
        return undefined;
      }

      return {
        fraTilRole: specialFraTilRole,
        minBoundKind: specialMinBoundKind,
        minBoundReferenceISO: specialMinBoundReferenceISO,
        maxBoundKind: specialMaxBoundKind,
        maxBoundFieldLabel: specialMaxBoundFieldLabel,
        maxBoundReferenceISO: specialMaxBoundReferenceISO,
      };
    }, [
      specialFraTilRole,
      specialMinBoundKind,
      specialMinBoundReferenceISO,
      specialMaxBoundKind,
      specialMaxBoundFieldLabel,
      specialMaxBoundReferenceISO,
    ]);

    const validateRange = React.useCallback(
      (isoDate: ISODateString) => validateISODateRange(isoDate, effectiveMinDate, effectiveMaxDate),
      [effectiveMaxDate, effectiveMinDate]
    );

    const [rangeErrorMessage, setRangeErrorMessage] = React.useState<string>('');

    const parseDate: DraftParse<ISODateString | undefined> = React.useCallback((draft, { mode }) => {
      const typingPartial = (): { ok: false; kind: 'partial'; message?: string } => ({ ok: false, kind: 'partial' });
      const commitInvalid = (message: string): { ok: false; kind: 'invalid'; message: string } => ({
        ok: false,
        kind: 'invalid',
        message,
      });

      const trimmed = draft.trim();
      if (trimmed === '') return { ok: true, value: undefined };
      if (trimmed.length > MAX_DRAFT_LENGTH) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      const parsed = parseDateDraftForCommit(trimmed, { mode, twoDigitYearPolicy: 'infer' });
      if (!parsed.ok) return parsed.kind === 'partial' ? typingPartial() : commitInvalid(parsed.message);
      return { ok: true, value: parsed.iso };
    }, []);

    const initialInvalidDraft = React.useMemo(() => {
      const currentError = onFieldError?.getCurrentError?.();
      if (
        currentError?.severity === 'error' &&
        currentError.blocksSave !== false &&
        typeof currentError.invalidDraft === 'string'
      ) {
        return { draft: currentError.invalidDraft, message: currentError.message };
      }
      return undefined;
    }, [onFieldError]);

    const {
      draft,
      setDraft: setDraftBase,
      touched,
      error,
      onFocus: onFocusBase,
      onBlur: onBlurBase,
      onKeyDown: onKeyDownBase,
      commit,
    } = useDraftField<ISODateString | undefined>({
      value,
      format: formatISODateAsDanish,
      parse: parseDate,
      normalizeDraftOnCommit: normalizeDateDraftOnCommit,
      onCommit: (nextValue) => {
        onCommit?.(createCommitEvent(nextValue));
      },
      inputElementRef,
      clearErrorOnDraftChange: true,
      commitOnBlur: false,
      initialInvalidDraft,
    });

    const skipNextBlurCommitRef = React.useRef(false);

    const setDraft = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        setRangeErrorMessage('');
        setDraftBase(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraftBase]
    );

    const handleInsertTodayDateEvent = React.useCallback((event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (!isISODateString(detail)) return;
      setDraft(formatISODateAsDanish(detail));
    }, [setDraft]);

    React.useEffect(() => {
      const input = inputElementRef.current;
      if (!input) return undefined;
      input.addEventListener(INSERT_TODAY_DATE_EVENT, handleInsertTodayDateEvent);
      return () => {
        input.removeEventListener(INSERT_TODAY_DATE_EVENT, handleInsertTodayDateEvent);
      };
    }, [handleInsertTodayDateEvent]);

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

    const activation = useTwoStageInputActivation<HTMLElement>({
      disabled: Boolean(disabled),
      singleStageClick,
      getDraftForKey,
      normalizePasteText: normalizeDatePaste,
      onReplaceDraft: (nextDraft) => setDraft(nextDraft),
    });

    // Range-validering er et separat anliggende fra parsing:
    // - Parsing afgør om vi kan committe en ISO-dato.
    // - Range-validering rapporterer en fejlbesked, men blokerer aldrig commit.
    const rangeEffectDepsRef = React.useRef<{ effectiveMaxDate: typeof effectiveMaxDate; effectiveMinDate: typeof effectiveMinDate; specialRangeErrors: typeof specialRangeErrors; validateRange: typeof validateRange; value: typeof value } | null>(null);
    React.useEffect(() => {
      if (isInteractiveDevLoggingEnabled) {
        const prev = rangeEffectDepsRef.current;
        if (prev !== null) {
          const changed: string[] = [];
          if (prev.effectiveMaxDate !== effectiveMaxDate) changed.push(`effectiveMaxDate (${prev.effectiveMaxDate} → ${effectiveMaxDate})`);
          if (prev.effectiveMinDate !== effectiveMinDate) changed.push(`effectiveMinDate (${prev.effectiveMinDate} → ${effectiveMinDate})`);
          if (prev.specialRangeErrors !== resolvedSpecialRangeErrors) changed.push('specialRangeErrors (reference changed)');
          if (prev.validateRange !== validateRange) changed.push('validateRange (fn reference changed)');
          if (prev.value !== value) changed.push(`value (${prev.value} → ${value})`);
          if (changed.length > 0) {
            console.debug('[StyledDateField] range-effect triggered. Changed deps:', changed.join(', '));
          }
        }
        rangeEffectDepsRef.current = { effectiveMaxDate, effectiveMinDate, specialRangeErrors: resolvedSpecialRangeErrors, validateRange, value };
      }

      if (value === undefined) {
        setRangeErrorMessage('');
        return;
      }

      const result = validateRange(value);
      setRangeErrorMessage(
        result.isValid
          ? ''
          : resolveDateRangeErrorMessage({ iso: value, minDate: effectiveMinDate, maxDate: effectiveMaxDate, special: resolvedSpecialRangeErrors })
      );
    }, [effectiveMaxDate, effectiveMinDate, resolvedSpecialRangeErrors, validateRange, value]);

    const visibleLocalError = touched ? error : undefined;
    const shouldShowRangeError =
      (effectiveMinDate !== undefined || effectiveMaxDate !== undefined) &&
      value !== undefined &&
      rangeErrorMessage.trim() !== '';
    const visibleRangeErrorMessage = shouldShowRangeError ? rangeErrorMessage : '';


    const resolvedHasError =
      externalHasError ||
      Boolean(visibleLocalError?.message) ||
      visibleRangeErrorMessage.trim() !== '';

    const resolvedErrorMessage = !resolvedHasError
      ? ''
      : externalHasError
        ? externalHelperText
        : visibleLocalError?.message ?? visibleRangeErrorMessage;

    React.useEffect(() => {
      debugStyledDateField('render-state', {
        value,
        draft,
        touched,
        localError: visibleLocalError?.message ?? '',
        rangeErrorMessage,
        visibleRangeErrorMessage,
        externalHasError,
        externalHelperText,
        resolvedHasError,
        resolvedErrorMessage,
        minDate: effectiveMinDate,
        maxDate: effectiveMaxDate,
        editorOpen: activation.isEditorOpen,
      });
    }, [
      value,
      draft,
      touched,
      visibleLocalError?.message,
      rangeErrorMessage,
      visibleRangeErrorMessage,
      externalHasError,
      externalHelperText,
      resolvedHasError,
      resolvedErrorMessage,
      effectiveMinDate,
      effectiveMaxDate,
      activation.isEditorOpen,
    ]);

    // Underret forælderen om fejltilstand
    const onFieldErrorDepsRef = React.useRef<{ visibleLocalErrorMsg: string | undefined; visibleRangeErrorMessage: string; onFieldError: typeof onFieldError } | null>(null);
    React.useEffect(() => {
      if (isInteractiveDevLoggingEnabled) {
        const prev = onFieldErrorDepsRef.current;
        if (prev !== null) {
          const changed: string[] = [];
          if (prev.visibleLocalErrorMsg !== visibleLocalError?.message) changed.push(`visibleLocalError.message (${prev.visibleLocalErrorMsg} → ${visibleLocalError?.message})`);
          if (prev.visibleRangeErrorMessage !== visibleRangeErrorMessage) changed.push(`visibleRangeErrorMessage (${prev.visibleRangeErrorMessage} → ${visibleRangeErrorMessage})`);
          if (prev.onFieldError !== onFieldError) changed.push('onFieldError (fn reference changed — POSSIBLE LOOP SOURCE)');
          if (changed.length > 0) {
            console.debug('[StyledDateField] onFieldError-effect triggered. Changed deps:', changed.join(', '));
          }
        }
        onFieldErrorDepsRef.current = { visibleLocalErrorMsg: visibleLocalError?.message, visibleRangeErrorMessage, onFieldError };
      }

      if (typeof onFieldError === 'function') {
        if (visibleLocalError?.message) {
          debugStyledDateField('report-field-error', {
            type: 'local',
            message: visibleLocalError.message,
            blocksSave: true,
          });
          onFieldError({ message: visibleLocalError.message, blocksSave: true, invalidDraft: draft });
          return;
        }
        if (visibleRangeErrorMessage) {
          debugStyledDateField('report-field-error', {
            type: 'range',
            message: visibleRangeErrorMessage,
            blocksSave: false,
          });
          onFieldError({ message: visibleRangeErrorMessage, blocksSave: false });
          return;
        }
        debugStyledDateField('report-field-error', { type: 'clear' });
        onFieldError(undefined);
      }
    }, [draft, visibleLocalError?.message, visibleRangeErrorMessage, onFieldError]);

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
            const normalized = normalizeDateDraftOnCommit('');
            const result = parseDate(normalized, { mode: 'commit' });
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

        if (!e.defaultPrevented && !(touched && error?.kind === 'invalid')) {
          filterDateLikeKeyDown(e);
        }
        onKeyDown?.(e);
      },
      [activation, error?.kind, onCommit, onKeyDown, onKeyDownBase, parseDate, setDraft, touched]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        if (!activation.isEditorOpen) {
          activation.handlePaste(e);
          return;
        }

        const normalized = normalizeDatePaste(readClipboardText(e));
        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElementRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        setDraft(draft.slice(0, start) + normalized + draft.slice(end));

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
      [activation, draft, setDraft]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={draft}
        onDraftChange={setDraft}
        inputRef={assignInputRef}
        onFocus={handleFocus}
        onBlur={(e) => {
          onBlurBase(e);
          const unchanged = draft === formatISODateAsDanish(value);
          debugStyledDateField('blur', {
            unchanged,
            skipNextBlurCommit: skipNextBlurCommitRef.current,
            draft,
            value,
          });
          if (!skipNextBlurCommitRef.current && !unchanged) {
            debugStyledDateField('commit-from-blur', {
              draft,
              value,
            });
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
        htmlInputAttributes={{ inputMode: 'numeric', maxLength: MAX_DRAFT_LENGTH, readOnly: !activation.isEditorOpen }}
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

StyledDateField.displayName = 'StyledDateField';

export default StyledDateField;
