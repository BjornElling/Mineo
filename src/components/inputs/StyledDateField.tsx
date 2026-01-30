import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from './StyledTextFieldBase';
import { useDraftField, type DraftParse } from '../../hooks/useDraftField';
import { useTwoStageInputActivation } from '../../hooks/useTwoStageInputActivation';
import type { ISODateString } from '../../types/branded';
import { danishToISO, isoToDanish } from '../../types/branded';
import { interpretYear, validateISODateRange } from '../../utils/dateValidation';
import { resolveDateRangeErrorMessage, type DateRangeSpecialErrors } from '../../utils/dateRangeErrorMessages';
import { filterDateLikeKeyDown } from './inputKeyFilters';
import { trimToAlphanumericEdges } from '../../utils/draftNormalization';
import { createCommitEvent, createDraftChangeEvent, type CommitEvent, type CommitHandler, type DraftChangeEvent, type DraftChangeHandler } from './fieldEvents';

export type StyledDateFieldValueChangeEvent = CommitEvent<ISODateString | undefined>;
export type StyledDateFieldDraftChangeEvent = DraftChangeEvent;

export type StyledDateFieldProps = {
  value: ISODateString | undefined;
  onDraftChange?: DraftChangeHandler;
  onCommit?: CommitHandler<ISODateString | undefined>;
  inputRef?: React.Ref<HTMLInputElement>;

  width?: number | string;
  minDate?: ISODateString;
  maxDate?: ISODateString;
  specialRangeErrors?: DateRangeSpecialErrors;
  /**
   * Optional human-readable explanation of which other inputs determine the min/max bounds.
   *
   * Used when there are no valid dates because `minDate > maxDate`.
   * This must reference concrete user-visible inputs (e.g. "Skadesdato", "Vedrører periode til", etc.).
   */
  noValidRangeCause?: string;

  /**
   * Range validation is always UI-only for date fields.
   * Out-of-range values still commit when the date format is valid.
   *
   * Deprecated: kept for API compatibility, but no longer affects behavior.
   */
  enforceRange?: boolean;
  placeholder?: string;
  disabled?: boolean;

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

const formatISODateAsDanish = (value: ISODateString | undefined): string => {
  if (!value) return '';
  return isoToDanish(value) ?? '';
};

const formatISODateForTooltip = (value: ISODateString): string => {
  return isoToDanish(value) ?? value;
};

type SplitDateParts = { day: string; month: string; year: string } | null;

const MAX_CANONICAL_DANISH_DATE_LENGTH = 10; // dd-mm-åååå
// Allow slightly more draft characters than the canonical committed form to support permissive typing
// (e.g. separators/whitespace) without the UI blocking mid-entry. This is an explicit UX tolerance.
const MAX_DRAFT_LENGTH = MAX_CANONICAL_DANISH_DATE_LENGTH + 6;

const splitDateParts = (draft: string): SplitDateParts => {
  const normalized = draft
    .trim()
    .replace(/[ .:/]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '');

  const [dayRaw = '', monthRaw = '', yearRaw = '', ...rest] = normalized.split('-');
  if (rest.length > 0) return null;
  if (dayRaw === '' && monthRaw === '' && yearRaw === '') return null;
  return { day: dayRaw, month: monthRaw, year: yearRaw };
};

const StyledDateField = React.forwardRef<HTMLDivElement, StyledDateFieldProps>(
  (
    {
      value,
      onDraftChange,
      onCommit,
      inputRef,
      width = 130,
      minDate,
      maxDate,
      specialRangeErrors,
      noValidRangeCause,
      enforceRange: _enforceRange = false,
      placeholder = 'dd-mm-åååå',
      disabled,
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
    const assignInputRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputElementRef.current = node;
        if (!inputRef) return;
        if (typeof inputRef === 'function') {
          inputRef(node);
        } else if ('current' in inputRef) {
          (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = node;
        }
      },
      [inputRef]
    );

    const normalizedMinDate = minDate;
    const normalizedMaxDate = maxDate;

    const configErrorMessage = React.useMemo(() => {
      if (normalizedMinDate && normalizedMaxDate && normalizedMinDate > normalizedMaxDate) {
        const minText = formatISODateForTooltip(normalizedMinDate);
        const maxText = formatISODateForTooltip(normalizedMaxDate);
        const causeSuffix =
          typeof noValidRangeCause === 'string' && noValidRangeCause.trim() !== ''
            ? ` Værdien afgrænses af: ${noValidRangeCause.trim()}`
            : ' Kontrollér de felter der bestemmer datointervallet.';
        return `Ingen gyldige datoer: min-dato (${minText}) er efter max-dato (${maxText}).${causeSuffix}`;
      }
      return '';
    }, [noValidRangeCause, normalizedMaxDate, normalizedMinDate]);

    const hasConfigError = configErrorMessage.trim() !== '';

    if (import.meta.env.DEV && hasConfigError) {
      // Never crash the page for a prop-level min/max inconsistency; surface via tooltip only.
      // (No console warnings: this is a user-facing validation state, not a technical error.)
    }

    const effectiveMinDate = hasConfigError ? undefined : normalizedMinDate;
    const effectiveMaxDate = hasConfigError ? undefined : normalizedMaxDate;

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

      const parts = splitDateParts(trimmed);
      if (!parts) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      const dayDigits = parts.day.replace(/[^\d]/g, '');
      const monthDigits = parts.month.replace(/[^\d]/g, '');
      const yearDigits = parts.year.replace(/[^\d]/g, '');

      // Reject any non-digit content on commit (typing is lenient).
      if (mode === 'commit' && (dayDigits !== parts.day || monthDigits !== parts.month || yearDigits !== parts.year)) {
        return commitInvalid('Ugyldig dato');
      }

      if (dayDigits === '' || monthDigits === '' || yearDigits === '') {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      if (dayDigits.length > 2 || monthDigits.length > 2 || yearDigits.length > 4) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      if (yearDigits.length === 3) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      const dayNum = Number.parseInt(dayDigits, 10);
      const monthNum = Number.parseInt(monthDigits, 10);
      if (!Number.isFinite(dayNum) || !Number.isFinite(monthNum)) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      if (monthNum < 1 || monthNum > 12) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }
      if (dayNum < 1 || dayNum > 31) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      let yearNum: number;
      if (yearDigits.length === 1 || yearDigits.length === 2) {
        if (mode === 'typing') return typingPartial();
        const interpreted = interpretYear(yearDigits);
        if (interpreted === null) {
          return commitInvalid('Ugyldig dato');
        }
        yearNum = interpreted;
      } else if (yearDigits.length === 4) {
        const parsed = Number.parseInt(yearDigits, 10);
        if (!Number.isFinite(parsed)) {
          return commitInvalid('Ugyldig dato');
        }
        yearNum = parsed;
      } else {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      const maxDay = new Date(yearNum, monthNum, 0).getDate();
      if (dayNum > maxDay) {
        return mode === 'typing' ? typingPartial() : commitInvalid('Ugyldig dato');
      }

      const day = String(dayNum).padStart(2, '0');
      const month = String(monthNum).padStart(2, '0');
      const year = String(yearNum);

      const danish = `${day}-${month}-${year}`;
      const isoDate = danishToISO(danish);
      if (!isoDate) {
        return commitInvalid('Ugyldig dato');
      }

      return { ok: true, value: isoDate };
    }, []);

    const {
      draft,
      setDraft: setDraftBase,
      touched,
      error,
      isFocused: _isFocused,
      onFocus: onFocusBase,
      onBlur: onBlurBase,
      onKeyDown: onKeyDownBase,
      commit,
    } = useDraftField<ISODateString | undefined>({
      value,
      format: formatISODateAsDanish,
      parse: parseDate,
      normalizeDraftOnCommit: trimToAlphanumericEdges,
      onCommit: (nextValue) => {
        onCommit?.(createCommitEvent(nextValue));
      },
      inputElementRef,
      clearErrorOnDraftChange: true,
      commitOnBlur: false,
    });

    const skipNextBlurCommitRef = React.useRef(false);
    const pendingCommitOnBlurRef = React.useRef(false);

    const setDraft = React.useCallback(
      (nextDraft: string) => {
        skipNextBlurCommitRef.current = false;
        pendingCommitOnBlurRef.current = false;
        setRangeErrorMessage('');
        setDraftBase(nextDraft);
        onDraftChange?.(createDraftChangeEvent(nextDraft));
      },
      [onDraftChange, setDraftBase]
    );

    const getDraftForKey = React.useCallback((key: string): string | null => {
      if (/^[0-9]$/.test(key)) return key;
      return null;
    }, []);

    const activation = useTwoStageInputActivation<HTMLInputElement>({
      disabled: Boolean(disabled),
      getDraftForKey,
      onReplaceDraft: (nextDraft) => setDraft(nextDraft),
    });

    // Range validation is a separate concern from parsing:
    // - Parsing determines whether we can commit an ISO date.
    // - Range validation reports an error message but never blocks commit.
    React.useEffect(() => {
      if (configErrorMessage.trim() !== '') {
        setRangeErrorMessage('');
        return;
      }
      if (value === undefined) {
        setRangeErrorMessage('');
        return;
      }

      const result = validateRange(value);
      setRangeErrorMessage(
        result.isValid
          ? ''
          : resolveDateRangeErrorMessage({ iso: value, minDate: effectiveMinDate, maxDate: effectiveMaxDate, special: specialRangeErrors })
      );
    }, [configErrorMessage, effectiveMaxDate, effectiveMinDate, specialRangeErrors, validateRange, value]);

    const visibleLocalError = touched ? error : undefined;
    const shouldShowRangeError =
      (effectiveMinDate !== undefined || effectiveMaxDate !== undefined) &&
      value !== undefined &&
      rangeErrorMessage.trim() !== '';
    const visibleRangeErrorMessage = shouldShowRangeError ? rangeErrorMessage : '';


    const resolvedHasError =
      configErrorMessage.trim() !== '' ||
      externalHasError ||
      Boolean(visibleLocalError?.message) ||
      visibleRangeErrorMessage.trim() !== '';

    const resolvedErrorMessage = !resolvedHasError
      ? ''
      : configErrorMessage.trim() !== ''
        ? configErrorMessage
        : externalHasError
          ? externalHelperText
          : visibleLocalError?.message ?? visibleRangeErrorMessage;

    // Notify parent of error state
    React.useEffect(() => {
      if (typeof onFieldError === 'function') {
        // Prioritér config, local, range errors (samme rækkefølge som vises)
        const errorMsg = configErrorMessage.trim() !== ''
          ? configErrorMessage
          : visibleLocalError?.message || visibleRangeErrorMessage || undefined;
        onFieldError(errorMsg);
      }
    }, [configErrorMessage, visibleLocalError?.message, visibleRangeErrorMessage, onFieldError]);

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

        if (!e.defaultPrevented) {
          filterDateLikeKeyDown(e);
        }
        onKeyDown?.(e);
      },
      [activation, onCommit, onKeyDown, onKeyDownBase, parseDate, setDraft]
    );

    return (
      <StyledTextFieldBase
        ref={ref}
        draft={draft}
        onDraftChange={setDraft}
        inputRef={assignInputRef}
        onFocus={handleFocus}
        onBlur={(e) => {
          onBlurBase(e);
          if (activation.isEditorOpen || pendingCommitOnBlurRef.current) {
            const unchanged = draft === formatISODateAsDanish(value);
            if (!skipNextBlurCommitRef.current && !unchanged) {
              commit();
            }
            if (activation.isEditorOpen) activation.closeEditor();
            skipNextBlurCommitRef.current = false;
            pendingCommitOnBlurRef.current = false;
          }
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
