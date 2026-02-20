import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import { shouldClearField } from '../../../utils/inputValidation';
import { interpretYear } from '../../../utils/dateInputValidation';
import { validateISODateRange } from '../../../utils/isoDateHelpers';
import { resolveDateRangeErrorMessage, type DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import { coerceToDanishDateString, coerceToISODateString, type ISODateString } from '../../../types/branded';
import { asTableCommittedString, normalizeTableDraftOnCommit, type TableInputErrorInfo } from './tableInputContracts';
import { assignRef } from './assignRef';
import { useGridCore } from '../../tables/gridCoreContext';
import { areSameGridCell } from '../../tables/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { filterDateLikeKeyDown } from '../inputKeyFilters';
import { makeDateFingerprintFromCanonical, type CommittedPayload, type DateFingerprint } from '../shared/parserSpec';

export type TableDateInputChangeEvent = { target: { value: string } };
export type TableDateSanitizeCallback = (value: string) => string;

export type TableDateInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: string;
  minDate?: string;
  maxDate?: string;
  specialRangeErrors?: DateRangeSpecialErrors;
  /**
   * Optional human-readable explanation of which other inputs determine the min/max bounds.
   *
   * Used when there are no valid dates because `minDate > maxDate`.
   * This must reference concrete user-visible inputs (e.g. "Dato til i samme række", etc.).
   */
  noValidRangeCause?: string;
  /**
   * Policy for interpreting 1-2 digit years on commit.
   *
   * Default: `infer` (legacy behavior via `interpretYear`).
   */
  twoDigitYearPolicy?: 'reject' | 'infer' | 'assume20xx';
  placeholder?: string;

  /**
   * Draft change (typing only).
   */
  onChange?: (e: TableDateInputChangeEvent) => void;

  /**
   * Commit attempt (blur only).
   * Emits the committed value only when commit succeeds.
   * Invalid input or config errors stay local (error state) and do not update parent value.
   * Range violations never block commit (they only show a validation error).
   */
  onBlur?: (e: TableDateInputChangeEvent) => void;

  onErrorChange?: (info: TableInputErrorInfo) => void;
  onRegisterSanitize?: (sanitize: TableDateSanitizeCallback) => void;
  externalErrorMessage?: string;

  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

type ParsedDanishDate = { ok: true; value: string; iso?: ISODateString } | { ok: false; error: string };

const parseDanishDateOnCommit = (
  draft: string,
  {
    twoDigitYearPolicy,
  }: {
    twoDigitYearPolicy: 'reject' | 'infer' | 'assume20xx';
  }
): ParsedDanishDate => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '', iso: undefined };
  if (trimmed.length > 64) return { ok: false, error: 'Ugyldig dato' };

  let dayRaw: string;
  let monthRaw: string;
  let yearRaw: string;

  // Convenience: allow DDMMYY / DDMMYYYY without separators.
  if (/^\d{6,8}$/.test(trimmed)) {
    dayRaw = trimmed.slice(0, 2);
    monthRaw = trimmed.slice(2, 4);
    yearRaw = trimmed.slice(4);
  } else {
    // Require exactly two separators between day/month/year (avoid permissive normalization of noisy input).
    const match = trimmed.match(/^(\d{1,2})\s*[ .:/-]\s*(\d{1,2})\s*[ .:/-]\s*(\d{1,4})$/);
    if (!match) return { ok: false, error: 'Ugyldig dato' };

    dayRaw = match[1];
    monthRaw = match[2];
    yearRaw = match[3];
  }

  if (/[^0-9]/.test(dayRaw) || /[^0-9]/.test(monthRaw) || /[^0-9]/.test(yearRaw)) {
    return { ok: false, error: 'Ugyldig dato' };
  }

  if (dayRaw.length > 2 || monthRaw.length > 2 || yearRaw.length > 4 || yearRaw.length === 3) {
    return { ok: false, error: 'Ugyldig dato' };
  }

  const day = dayRaw.padStart(2, '0');
  const month = monthRaw.padStart(2, '0');

  let year: string;
  if (yearRaw.length === 1 || yearRaw.length === 2) {
    if (twoDigitYearPolicy === 'reject') return { ok: false, error: 'Ugyldig dato' };
    if (twoDigitYearPolicy === 'assume20xx') {
      const parsed = Number.parseInt(yearRaw, 10);
      if (!Number.isFinite(parsed)) return { ok: false, error: 'Ugyldig dato' };
      year = String(2000 + parsed);
    } else {
      const interpreted = interpretYear(yearRaw);
      if (interpreted === null) return { ok: false, error: 'Ugyldig dato' };
      year = String(interpreted);
    }
  } else if (yearRaw.length === 4) {
    year = yearRaw;
  } else {
    return { ok: false, error: 'Ugyldig dato' };
  }

  const finalValue = `${day}-${month}-${year}`;
  if (finalValue.length !== 10) return { ok: false, error: 'Ugyldig dato' };
  const iso = coerceToISODateString(finalValue);
  if (!iso) return { ok: false, error: 'Ugyldig dato' };

  return { ok: true, value: finalValue, iso };
};

const getRangeErrorMessage = (
  iso: ISODateString,
  {
    minDate,
    maxDate,
    specialRangeErrors,
  }: {
    minDate: string | undefined;
    maxDate: string | undefined;
    specialRangeErrors: DateRangeSpecialErrors | undefined;
  }
): string | null => {
  const normalizedMin = minDate ? coerceToISODateString(minDate) : undefined;
  const normalizedMax = maxDate ? coerceToISODateString(maxDate) : undefined;
  const rangeResult = validateISODateRange(iso, normalizedMin, normalizedMax);
  if (rangeResult.isValid) return null;
  return resolveDateRangeErrorMessage({ iso, minDate: normalizedMin, maxDate: normalizedMax, special: specialRangeErrors });
};

type DateCommitResult =
  | { kind: 'ok'; committed: ReturnType<typeof asTableCommittedString>; iso?: ISODateString }
  | { kind: 'input-error'; committed: string; errorMessage: string };

const commitDateDraft = (
  draft: string,
  {
    twoDigitYearPolicy,
  }: {
    twoDigitYearPolicy: 'reject' | 'infer' | 'assume20xx';
  }
): DateCommitResult => {
  const result = parseDanishDateOnCommit(draft, { twoDigitYearPolicy });
  if (!result.ok) {
    return { kind: 'input-error', committed: draft, errorMessage: result.error };
  }
  return { kind: 'ok', committed: asTableCommittedString(result.value), iso: result.iso };
};

const dateFingerprintFromCommittedValue = (committedValue: string | undefined): DateFingerprint => {
  const trimmed = (committedValue ?? '').trim();
  if (trimmed === '') return makeDateFingerprintFromCanonical('');
  const iso = coerceToISODateString(trimmed);
  if (!iso) {
    // Fail-closed fallback: preserve deterministic fingerprint even if value is unexpectedly non-date.
    return makeDateFingerprintFromCanonical(trimmed);
  }
  return makeDateFingerprintFromCanonical(iso);
};

const toCommittedDatePayload = (value: string | undefined): CommittedPayload<string, string, DateFingerprint> => {
  const canonical = value ?? '';
  return {
    model: canonical,
    canonical,
    fingerprint: dateFingerprintFromCommittedValue(canonical),
  };
};

const TableDateInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    onChange,
    onBlur,
    onErrorChange,
    onRegisterSanitize,
    minDate,
    maxDate,
    specialRangeErrors,
    noValidRangeCause,
    twoDigitYearPolicy = 'infer',
    placeholder = '',
    externalErrorMessage,
    inputRef,
    sx,
  }: TableDateInputProps) => {
    const grid = useGridCore();
    const cellFocused = areSameGridCell(grid.focusedCell, gridCell);
    const isEditing = areSameGridCell(grid.editingCell, gridCell);
    const isReadOnly = locked || !isEditing;
    const isLooseTable = grid.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'rgba(0, 0, 0, 0.12)' : 'transparent';

    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const [draft, setDraft] = React.useState<string>(() => value ?? '');
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [preserveInvalidDraft, setPreserveInvalidDraft] = React.useState(false);
    const draftRef = React.useRef<string>(draft);
    const previousCommittedValueRef = React.useRef<string>(value ?? '');

    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedPayloadRef = React.useRef<CommittedPayload<string, string, DateFingerprint>>(toCommittedDatePayload(value));

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, minDate, maxDate, specialRangeErrors, twoDigitYearPolicy });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, minDate, maxDate, specialRangeErrors, twoDigitYearPolicy };
    }, [locked, maxDate, minDate, onBlur, onChange, onErrorChange, specialRangeErrors, twoDigitYearPolicy]);

    React.useEffect(() => {
      latestCommittedPayloadRef.current = toCommittedDatePayload(value);
    }, [value]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

    const boundsStatus = React.useMemo(() => {
      if (minDate !== undefined && coerceToISODateString(minDate) === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: minDate er ikke en dato (${String(minDate)})` };
      }
      if (maxDate !== undefined && coerceToISODateString(maxDate) === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: maxDate er ikke en dato (${String(maxDate)})` };
      }

      const normalizedMin = minDate ? coerceToISODateString(minDate) : undefined;
      const normalizedMax = maxDate ? coerceToISODateString(maxDate) : undefined;
      if (normalizedMin && normalizedMax && normalizedMin > normalizedMax) {
        const minText = coerceToDanishDateString(normalizedMin) ?? normalizedMin;
        const maxText = coerceToDanishDateString(normalizedMax) ?? normalizedMax;
        const causeSuffix =
          typeof noValidRangeCause === 'string' && noValidRangeCause.trim() !== ''
            ? ` Årsag: ${noValidRangeCause.trim()}`
            : ' Kontrollér de felter der bestemmer datointervallet.';
        return {
          kind: 'no-valid-range' as const,
          message: `Ingen gyldige datoer: min-dato (${minText}) er efter max-dato (${maxText}).${causeSuffix}`,
        };
      }

      return { kind: 'ok' as const };
    }, [maxDate, minDate, noValidRangeCause]);

    if (boundsStatus.kind !== 'ok') {
      throw new Error(boundsStatus.message);
    }

    React.useEffect(() => {
      if (!latest.current.onErrorChange) return;
      const kind: TableInputErrorInfo['kind'] = hasError ? 'input' : 'none';
      latest.current.onErrorChange({ hasError: kind !== 'none', kind });
    }, [hasError]);

    React.useEffect(() => {
      const nextCommitted = value ?? '';
      const didParentValueChange = previousCommittedValueRef.current !== nextCommitted;
      previousCommittedValueRef.current = nextCommitted;
      if (!didParentValueChange || isEditing || !preserveInvalidDraft) return;
      setPreserveInvalidDraft(false);
      setHasError(false);
      setErrorMessage('');
      setTouched(false);
    }, [isEditing, preserveInvalidDraft, value]);

    React.useEffect(() => {
      if (!isEditing) {
        const inputEl = inputElRef.current;
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const hasPhysicalFocus =
          inputEl !== null &&
          activeEl !== null &&
          (activeEl === inputEl || (activeEl instanceof Node && inputEl.contains(activeEl)));
        if (hasPhysicalFocus) return;
        if (preserveInvalidDraft) return;
        setDraft(value ?? '');
      }
    }, [isEditing, preserveInvalidDraft, value]);

    React.useEffect(() => {
      if (!isEditing) {
        keyInitiatedEditRef.current = false;
        return;
      }
      // Click-initiated edit: initialize the draft from the current committed value.
      if (!keyInitiatedEditRef.current) {
        if (preserveInvalidDraft) {
          originalValueOnEditStartRef.current = draftRef.current;
          return;
        }
        const committedValue = value ?? '';
        originalValueOnEditStartRef.current = committedValue;
        setDraft(committedValue);
        // Ingen emitValueChange her – vi må ikke opdatere parent under edit.
      }
    }, [isEditing, preserveInvalidDraft, value]);

    const sanitizeValue: TableDateSanitizeCallback = React.useCallback(
      (rawValue) => {
        const raw = normalizeTableDraftOnCommit(String(rawValue ?? ''));
        const { twoDigitYearPolicy: policy } = latest.current;
        const committed = commitDateDraft(raw, { twoDigitYearPolicy: policy });
        return committed.committed;
      },
      []
    );

    React.useEffect(() => {
      onRegisterSanitize?.(sanitizeValue);
    }, [onRegisterSanitize, sanitizeValue]);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string): boolean => {
        setTouched(true);
        const normalized = normalizeTableDraftOnCommit(rawDraft);
        const { minDate: min, maxDate: max, specialRangeErrors: special, twoDigitYearPolicy: policy } = latest.current;
        const committed = commitDateDraft(normalized, { twoDigitYearPolicy: policy });

        if (committed.kind === 'input-error') {
          setPreserveInvalidDraft(true);
          setHasError(true);
          setErrorMessage(committed.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          return false;
        }

        setPreserveInvalidDraft(false);
        if (committed.iso) {
          const rangeErrorMessage = getRangeErrorMessage(committed.iso, {
            minDate: min,
            maxDate: max,
            specialRangeErrors: special,
          });

          if (rangeErrorMessage) {
            setHasError(true);
            setErrorMessage(rangeErrorMessage);
            latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          } else {
            setHasError(false);
            setErrorMessage('');
            latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          }
        } else {
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        }

        const canonical = committed.committed;
        const nextFingerprint = committed.iso
          ? makeDateFingerprintFromCanonical(committed.iso)
          : makeDateFingerprintFromCanonical('');
        const nextPayload: CommittedPayload<string, string, DateFingerprint> = {
          model: canonical,
          canonical,
          fingerprint: nextFingerprint,
        };

        const isNoop = nextPayload.fingerprint === latestCommittedPayloadRef.current.fingerprint;
        if (!isNoop) {
          emitBlur(nextPayload.model);
        }
        return true;
      },
      [emitBlur]
    );

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isReadOnly) return;
        const nextDraft = e.target.value ?? '';
        setHasError(false);
        setErrorMessage('');
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        // Ingen emitValueChange under edit.
      },
      [isReadOnly]
    );

    const handleFocus = React.useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        // Vigtigt: grid kan lukke editor-state før input-blur ved klik udenfor.
        // I den situation skal vi stadig committe draften fra ref, hvis den afviger fra committed.
        const rawValue = isEditing ? (e.currentTarget.value ?? '') : draftRef.current;
        const committedValue = latestCommittedPayloadRef.current.canonical;
        if (!isEditing && rawValue === committedValue) return;
        commitAndEmitBlur(rawValue);
      },
      [commitAndEmitBlur, isEditing]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Filtrér kun under edit-mode (arvet fra StyledDateField)
        if (!isEditing) return;
        if (preserveInvalidDraft && hasError) return;
        filterDateLikeKeyDown(e);
      },
      [hasError, isEditing, preserveInvalidDraft]
    );

    const a11yInputId = React.useId();
    const a11yErrorId = `${a11yInputId}-error`;
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || (touched && hasError)) && !isFocused;
    const showDraftWhenError = !isEditing && touched && hasError && preserveInvalidDraft;

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => latest.current.locked ?? false,
        commitCurrent: () => {
          if (latest.current.locked) return true;
          const ok = commitAndEmitBlur(inputElRef.current?.value ?? draftRef.current);
          if (!ok) return false;
          setIsFocused(false);
          grid.closeEditing();
          return true;
        },
        clearAndCommit: () => {
          if (latest.current.locked) return;
          setTouched(false);
          setHasError(false);
          setPreserveInvalidDraft(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          setDraft('');
          // Ingen emitValueChange. Commit sker via blur/commit-pipeline:
          const ok = commitAndEmitBlur('');
          if (!ok) return;
          grid.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          setTouched(false);
          setHasError(false);
          setPreserveInvalidDraft(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          const original = originalValueOnEditStartRef.current;
          setDraft(original);
          // KRITISK INVARIANT: cancelEdit må ALDRIG udløse onChange eller onBlur
          // Original værdi er allerede committed - ingen onChange skal sendes til parent
          grid.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          if (!/^[0-9]$/.test(key)) return false;
          const committedValue = latestCommittedPayloadRef.current.canonical;
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          setDraft(key);
          // Ingen emitValueChange her – vi må ikke opdatere parent under edit.
          requestAnimationFrame(() => {
            const el = inputElRef.current;
            if (!el) return;
            try {
              el.setSelectionRange(el.value.length, el.value.length);
            } catch {
              // no-op
            }
          });
          return true;
        },
        selectAll: () => {
          requestAnimationFrame(() => inputElRef.current?.select());
        },
      };
    }, [commitAndEmitBlur, grid]);

    React.useEffect(() => {
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    }, [editorHandle, grid, gridCell]);

    const tooltipText = hasExternalError ? externalErrorText : errorMessage;

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            autoComplete="off"
            value={isEditing ? draft : showDraftWhenError ? draft : (value ?? '')}
            readOnly={isReadOnly}
            disabled={locked}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={cellFocused && !isReadOnly ? '' : placeholder}
            inputProps={{
              id: a11yInputId,
              readOnly: isReadOnly,
              inputMode: 'text',
              'data-mineo-grid-locked': locked ? 'true' : undefined,
              'aria-describedby': showError ? a11yErrorId : undefined,
            }}
            sx={{
              width: '100%',
              height: '100%',
              // TYPOGRAFI: Lad grid/table bestemme. Input skal arve.
              font: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
              color: 'inherit',
              padding: '4px 8px',
              border: '1px solid',
              borderColor: showError ? '#d32f2f' : inputBorderColor,
              borderRadius: inputBorderRadius,
              backgroundColor: 'transparent',
              ...(cellFocused ? { outline: 'none' } : {}),
              '&:focus-within': {
                borderColor: '#1976d2',
              },
              '& .MuiInputBase-input': {
                font: 'inherit',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                color: 'inherit',
                textAlign: 'center',
                padding: 0,
                // Pegefinger når ikke i edit-mode, I-beam når i edit-mode
                cursor: isEditing ? 'text' : 'pointer',
                // KRITISK: Caret skal afhænge af isEditing, IKKE isReadOnly
                caretColor: isEditing ? 'auto' : 'transparent',
              },
              ...sx,
            }}
          />
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {tooltipText}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

TableDateInput.displayName = 'TableDateInput';

export default TableDateInput;
