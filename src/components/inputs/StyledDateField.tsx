import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { type DraftParse } from '../../hooks/useDraftField';
import { useStyledFieldAdapter } from '../../hooks/useStyledFieldAdapter';
import type { ISODateString } from '../../types/branded';
import { isISODateString, isoToDanish } from '../../types/branded';
import { validateISODateRange } from '../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage, type DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import { filterDateLikeKeyDown } from './inputKeyFilters';
import { normalizeDateDraftOnCommit } from '../../utils/dateDraftNormalization';
import { INSERT_TODAY_DATE_EVENT } from '../../utils/insertTodayDate';
import { normalizeDatePaste } from '../../utils/inputPasteNormalization';
import { assignRef } from '../../utils/refUtils';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from '../../types/fieldEvents';
import type { FieldErrorReporter } from '../../types/fieldErrors';
import { parseDateDraftForCommit } from '../../utils/dateDraftCommit';
import { mergeSx } from '../../utils/mergeSx';

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
    const effectiveMinDate = minDate;
    const effectiveMaxDate = maxDate;
    const specialFraTilRole = specialRangeErrors?.fraTilRole;
    const specialMinBoundKind = specialRangeErrors?.minBoundKind;
    const specialMinBoundReferenceISO = specialRangeErrors?.minBoundReferenceISO;
    const specialMinBoundLabel = specialRangeErrors?.minBoundLabel;
    const specialMaxBoundKind = specialRangeErrors?.maxBoundKind;
    const specialMaxBoundFieldLabel = specialRangeErrors?.maxBoundFieldLabel;
    const specialMaxBoundReferenceISO = specialRangeErrors?.maxBoundReferenceISO;
    const resolvedSpecialRangeErrors = React.useMemo<DateRangeSpecialErrors | undefined>(() => {
      if (
        specialFraTilRole === undefined &&
        specialMinBoundKind === undefined &&
        specialMinBoundReferenceISO === undefined &&
        specialMinBoundLabel === undefined &&
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
        minBoundLabel: specialMinBoundLabel,
        maxBoundKind: specialMaxBoundKind,
        maxBoundFieldLabel: specialMaxBoundFieldLabel,
        maxBoundReferenceISO: specialMaxBoundReferenceISO,
      };
    }, [
      specialFraTilRole,
      specialMinBoundKind,
      specialMinBoundReferenceISO,
      specialMinBoundLabel,
      specialMaxBoundKind,
      specialMaxBoundFieldLabel,
      specialMaxBoundReferenceISO,
    ]);

    const validateRange = React.useCallback(
      (isoDate: ISODateString) => validateISODateRange(isoDate, effectiveMinDate, effectiveMaxDate),
      [effectiveMaxDate, effectiveMinDate]
    );

    const parseDate: DraftParse<ISODateString | undefined> = React.useCallback((draft) => {
      const commitInvalid = (message: string): { ok: false; kind: 'invalid'; message: string } => ({
        ok: false,
        kind: 'invalid',
        message,
      });

      const trimmed = draft.trim();
      if (trimmed === '') return { ok: true, value: undefined };
      if (trimmed.length > MAX_DRAFT_LENGTH) {
        return commitInvalid('Ugyldig dato');
      }

      const parsed = parseDateDraftForCommit(trimmed, { twoDigitYearPolicy: 'infer' });
      if (!parsed.ok) return commitInvalid(parsed.message);
      return { ok: true, value: parsed.iso };
    }, []);

    const getVisualError = React.useCallback(
      (committedValue: ISODateString | undefined): string => {
        if (committedValue === undefined) return '';
        const result = validateRange(committedValue);
        return result.isValid
          ? ''
          : resolveDateRangeErrorMessage({
              iso: committedValue,
              minDate: effectiveMinDate,
              maxDate: effectiveMaxDate,
              special: resolvedSpecialRangeErrors,
            });
      },
      [effectiveMaxDate, effectiveMinDate, resolvedSpecialRangeErrors, validateRange]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

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
    } = useStyledFieldAdapter<ISODateString | undefined>({
      value,
      format: formatISODateAsDanish,
      parse: parseDate,
      normalizeDraftOnCommit: normalizeDateDraftOnCommit,
      getDraftForKey,
      normalizePasteText: normalizeDatePaste,
      singleStageClick,
      onCommit: (nextValue) => onCommit?.(createCommitEvent(nextValue)),
      onDraftChange: (nextDraft) => onDraftChange?.(createDraftChangeEvent(nextDraft)),
      onFieldError,
      getVisualError,
      onFocus,
      onBlur,
      onKeyDown,
      disabled,
      keyFilter: filterDateLikeKeyDown,
      gateKeyFilterOnInvalidTouched: true,
      setPasteCaret: true,
    });

    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        assignRef(inputRef, node);
      },
      [inputElementRef, inputRef]
    );

    const handleInsertTodayDateEvent = React.useCallback((event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : undefined;
      if (!isISODateString(detail)) return;
      handleDraftChange(formatISODateAsDanish(detail));
    }, [handleDraftChange]);

    React.useEffect(() => {
      const input = inputElementRef.current;
      if (!input) return undefined;
      input.addEventListener(INSERT_TODAY_DATE_EVENT, handleInsertTodayDateEvent);
      return () => {
        input.removeEventListener(INSERT_TODAY_DATE_EVENT, handleInsertTodayDateEvent);
      };
    }, [handleInsertTodayDateEvent, inputElementRef]);

    const visibleLocalError = error;
    const resolvedHasError =
      externalHasError ||
      Boolean(visibleLocalError?.message) ||
      visualErrorMessage !== '';

    const resolvedErrorMessage = !resolvedHasError
      ? ''
      : externalHasError
        ? externalHelperText
        : visibleLocalError?.message ?? visualErrorMessage;

    return (
      <StyledTextFieldBase
        ref={ref}
        name={name}
        draft={draft}
        onDraftChange={handleDraftChange}
        inputRef={assignInputRef}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        onPaste={handlePaste}
        placeholder={placeholder}
        width={width}
        disabled={disabled}
        error={resolvedHasError}
        helperText={resolvedErrorMessage}
        htmlInputAttributes={{ inputMode: 'numeric', maxLength: MAX_DRAFT_LENGTH, readOnly: !isEditorOpen }}
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

StyledDateField.displayName = 'StyledDateField';

export default StyledDateField;
