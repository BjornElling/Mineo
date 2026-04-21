import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCellEditing, useGridCellFocus, useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCore/gridCoreTypes';
import { shouldClearField } from '../../../utils/inputValidation';
import { asTableCommittedString, committedToString, normalizeTableDraftOnCommit, type TableCommitResult, type TableInputErrorInfo } from '../../../utils/tableInputContracts';
import { assignRef } from './assignRef';
import { filterIntegerKeyDown } from '../inputKeyFilters';
import { copyWholeValueFromReadOnlyField, readClipboardText } from '../../../utils/clipboardUtils';
import { makeIntegerFingerprintFromCanonical, type CommittedPayload, type IntegerFingerprint } from '../../../types/parserSpec';
import { getIntegerRangeErrorMessage } from '../../../utils/integerRange';
import { normalizeIntegerPaste } from '../../../utils/inputPasteNormalization';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';

export type TableIntegerInputChangeEvent = { target: { value: string } };

export type TableIntegerInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: string | undefined;
  /**
   * TableIntegerInput commits and sanitizes to a string value (table cells persist strings).
   *
   * Domain note: This input only accepts non-negative integers.
   */
  minValue?: number;
  maxValue?: number;
  /**
   * If true, out-of-range values are blocked on commit.
   * If false, out-of-range values commit but are shown as validation errors.
   */
  enforceRange?: boolean;
  /**
   * Optional hard cap for committed digit count (excluding sign).
   * If omitted, derives from bounds.
   */
  maxDigits?: number;
  placeholder?: string;
  onChange?: (e: TableIntegerInputChangeEvent) => void;
  onBlur?: (e: TableIntegerInputChangeEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

type ParsedInteger = { ok: true; value: string } | { ok: false; error: string };

const requiredDigits = (n: number): number => Math.abs(Math.trunc(n)).toString().length;

const parseIntegerOnCommit = (
  draft: string,
  {
    minValue,
    maxValue,
    maxDigits,
    enforceRange,
  }: { minValue: number | undefined; maxValue: number | undefined; maxDigits: number | undefined; enforceRange: boolean }
): ParsedInteger => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '' };
  if (/[^0-9]/.test(trimmed)) return { ok: false, error: 'Ugyldigt format' };
  if (typeof maxDigits === 'number' && trimmed.length > maxDigits) return { ok: false, error: `Maks ${maxDigits} cifre` };

  const numValue = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numValue)) return { ok: false, error: 'Ugyldigt format' };

  if (!enforceRange) {
    return { ok: true, value: String(numValue) };
  }

  const rangeError = getIntegerRangeErrorMessage(numValue, minValue, maxValue, { preferExactForEqualBounds: false });
  if (rangeError !== '') {
    return { ok: false, error: rangeError };
  }

  return { ok: true, value: String(numValue) };
};

const commitIntegerDraft = (
  draft: string,
  {
    minValue,
    maxValue,
    maxDigits,
    enforceRange,
  }: { minValue: number | undefined; maxValue: number | undefined; maxDigits: number | undefined; enforceRange: boolean }
): TableCommitResult => {
  const result = parseIntegerOnCommit(draft, { minValue, maxValue, maxDigits, enforceRange });
  if (!result.ok) return { kind: 'input-error', committed: draft, errorMessage: result.error };
  return { kind: 'ok', committed: asTableCommittedString(result.value) };
};

const toCommittedIntegerPayload = (value: string | undefined): CommittedPayload<string, string, IntegerFingerprint> => {
  const canonical = value ?? '';
  return {
    model: canonical,
    canonical,
    fingerprint: makeIntegerFingerprintFromCanonical(canonical),
  };
};

const getRangeErrorMessage = (value: string, minValue: number | undefined, maxValue: number | undefined): string => {
  if (value.trim() === '') return '';
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return '';
  return getIntegerRangeErrorMessage(parsed, minValue, maxValue, { preferExactForEqualBounds: false });
};

const TableIntegerInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    minValue,
    maxValue,
    enforceRange = true,
    maxDigits: maxDigitsProp,
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableIntegerInputProps) => {
    const gridApi = useGridCoreApi();
    const cellFocused = useGridCellFocus(gridCell);
    const isEditing = useGridCellEditing(gridCell);
    const isReadOnly = locked || !isEditing;
    const isLooseTable = gridApi.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';

    const [draft, setDraft] = React.useState<string>(() => value ?? '');
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const [preserveInvalidDraft, setPreserveInvalidDraft] = React.useState(false);

    const inputElRef = React.useRef<HTMLInputElement | null>(null);
    const draftRef = React.useRef<string>(draft);
    const previousCommittedValueRef = React.useRef<string>(value ?? '');
    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedPayloadRef = React.useRef<CommittedPayload<string, string, IntegerFingerprint>>(toCommittedIntegerPayload(value));

    const configErrorMessage = React.useMemo(() => {
      if (minValue !== undefined && !Number.isFinite(minValue)) return 'Ugyldig konfiguration: minValue skal være et tal';
      if (maxValue !== undefined && !Number.isFinite(maxValue)) return 'Ugyldig konfiguration: maxValue skal være et tal';
      if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) return 'Ugyldig konfiguration: minValue er større end maxValue';
      if (typeof minValue === 'number' && minValue < 0) return 'Ugyldig konfiguration: minValue kan ikke være negativ (TableIntegerInput)';
      if (typeof maxValue === 'number' && maxValue < 0) return 'Ugyldig konfiguration: maxValue kan ikke være negativ (TableIntegerInput)';
      if (maxDigitsProp !== undefined) {
        if (!Number.isFinite(maxDigitsProp) || !Number.isInteger(maxDigitsProp)) return 'Ugyldig konfiguration: maxDigits skal være et heltal';
        if (maxDigitsProp < 1 || maxDigitsProp > 18) return 'Ugyldig konfiguration: maxDigits skal være mellem 1 og 18';
        if (typeof minValue === 'number' && requiredDigits(minValue) > maxDigitsProp) return 'Ugyldig konfiguration: maxDigits er mindre end cifre(|minValue|)';
        if (typeof maxValue === 'number' && requiredDigits(maxValue) > maxDigitsProp) return 'Ugyldig konfiguration: maxDigits er mindre end cifre(|maxValue|)';
      }
      return '';
    }, [maxDigitsProp, maxValue, minValue]);

    if (configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const maxDigits = React.useMemo(() => {
      if (typeof maxDigitsProp === 'number') return maxDigitsProp;
      if (typeof maxValue === 'number') return requiredDigits(maxValue);
      return undefined;
    }, [maxDigitsProp, maxValue]);

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, minValue, maxValue, maxDigits, enforceRange });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, minValue, maxValue, maxDigits, enforceRange };
    }, [enforceRange, locked, maxDigits, maxValue, minValue, onBlur, onChange, onErrorChange]);

    React.useEffect(() => {
      latestCommittedPayloadRef.current = toCommittedIntegerPayload(value);
    }, [value]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

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
        if (hasError || preserveInvalidDraft) return;
        setDraft(value ?? '');
      }
    }, [hasError, isEditing, preserveInvalidDraft, value]);

    React.useEffect(() => {
      if (!isEditing) {
        keyInitiatedEditRef.current = false;
        return;
      }
      if (!keyInitiatedEditRef.current) {
        if (hasError || preserveInvalidDraft) {
          originalValueOnEditStartRef.current = draftRef.current;
          return;
        }
        const committedValue = value ?? '';
        originalValueOnEditStartRef.current = committedValue;
        setDraft(committedValue);
        // Ingen emitValueChange her – vi må ikke opdatere parent under edit.
      }
    }, [hasError, isEditing, preserveInvalidDraft, value]);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string): boolean => {
        setTouched(true);
        const committed = commitIntegerDraft(normalizeTableDraftOnCommit(rawDraft), {
          minValue: latest.current.minValue,
          maxValue: latest.current.maxValue,
          maxDigits: latest.current.maxDigits,
          enforceRange: latest.current.enforceRange,
        });

        if (committed.kind === 'input-error') {
          setPreserveInvalidDraft(true);
          setHasError(true);
          setErrorMessage(committed.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          return false;
        }

        setPreserveInvalidDraft(false);
        const canonical = committedToString(committed);
        const rangeError = latest.current.enforceRange ? '' : getRangeErrorMessage(canonical, latest.current.minValue, latest.current.maxValue);
        if (rangeError !== '') {
          setHasError(true);
          setErrorMessage(rangeError);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
        } else {
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        }
        const nextPayload: CommittedPayload<string, string, IntegerFingerprint> = {
          model: canonical,
          canonical,
          fingerprint: makeIntegerFingerprintFromCanonical(canonical),
        };

        const isNoop = nextPayload.fingerprint === latestCommittedPayloadRef.current.fingerprint;
        if (isNoop) return true;

        emitBlur(nextPayload.model);
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
      // Caret styling er nu declarativ via sx prop
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
        // Filtrér kun under edit-mode (arvet fra StyledIntegerField)
        if (!isEditing) return;
        filterIntegerKeyDown(e, { maxDigits });
      },
      [isEditing, maxDigits]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const normalized = normalizeIntegerPaste(readClipboardText(e), {
          maxDigits,
          maxValue,
          allowNegative: false,
        });

        if (!isEditing) {
          e.preventDefault();
          e.stopPropagation();
          if (normalized === '') return;
          setDraft(normalized);
          draftRef.current = normalized;
          const ok = commitAndEmitBlur(normalized);
          if (!ok) return;
          setIsFocused(true);
          return;
        }

        e.preventDefault();
        e.stopPropagation();
        if (normalized === '') return;

        const input = inputElRef.current;
        const start = typeof input?.selectionStart === 'number' ? input.selectionStart : draft.length;
        const end = typeof input?.selectionEnd === 'number' ? input.selectionEnd : start;
        const nextDraft = draft.slice(0, start) + normalized + draft.slice(end);
        setHasError(false);
        setErrorMessage('');
        draftRef.current = nextDraft;
        setDraft(nextDraft);
      },
      [commitAndEmitBlur, draft, isEditing, maxDigits, maxValue]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || (touched && hasError)) && !isFocused;
    const tooltipText = hasExternalError ? externalErrorText : errorMessage;
    const showDraftWhenError = !isEditing && (preserveInvalidDraft || (touched && hasError));
    const displayValue = isEditing ? draft : showDraftWhenError ? draft : (value ?? '');

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly,
          value: displayValue,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
      },
      [displayValue, isReadOnly]
    );

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => latest.current.locked ?? false,
        commitCurrent: () => {
          if (latest.current.locked) return true;
          const ok = commitAndEmitBlur(inputElRef.current?.value ?? draftRef.current);
          if (!ok) return false;
          setIsFocused(false);
          gridApi.closeEditing();
          return true;
        },
        clearAndCommit: () => {
          if (latest.current.locked) return;
          keyInitiatedEditRef.current = false;
          setHasError(false);
          setErrorMessage('');
          setPreserveInvalidDraft(false);
          setTouched(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          setDraft('');
          // Ingen emitValueChange. Commit sker via blur/commit-pipeline:
          const ok = commitAndEmitBlur('');
          if (!ok) return;
          gridApi.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          keyInitiatedEditRef.current = false;
          setHasError(false);
          setErrorMessage('');
          setPreserveInvalidDraft(false);
          setTouched(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          const original = originalValueOnEditStartRef.current;
          setDraft(original);
          // KRITISK INVARIANT: cancelEdit må ALDRIG udløse onChange eller onBlur
          // Original værdi er allerede committed - ingen onChange skal sendes til parent
          gridApi.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          if (!/^[0-9]$/.test(key)) return false;
          const committedValue = latestCommittedPayloadRef.current.canonical;
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setHasError(false);
          setErrorMessage('');
          setPreserveInvalidDraft(false);
          setTouched(false);
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
    }, [commitAndEmitBlur, gridApi]);

    const gridCellKey = `${gridCell.rowId}:${gridCell.colIndex}`;
    React.useEffect(() => {
      gridApi.registerEditor(gridCell, editorHandle);
      return () => gridApi.unregisterEditor(gridCell);
    // gridCellKey er en stabil streng-repræsentation af gridCell-koordinaterne.
    // gridCell er intentionelt udeladt fra dep-arrayet for at undgå re-registrering
    // ved inline object literals i caller (ny reference, samme værdier).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorHandle, gridApi, gridCellKey]);

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            autoComplete="off"
            value={displayValue}
            readOnly={isReadOnly}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onCopy={handleCopy}
            placeholder={cellFocused && !isReadOnly ? '' : placeholder}
            inputProps={{
              readOnly: isReadOnly,
              tabIndex: locked ? -1 : undefined,
              inputMode: 'numeric',
              'data-mineo-grid-locked': locked ? 'true' : undefined,
              'aria-describedby': showError ? a11yErrorId : undefined,
            }}
            sx={{
              ...getTableInputRootStyles({
                showError,
                isLooseTable,
                locked,
                borderRadius: inputBorderRadius,
                borderColor: inputBorderColor,
              }),
              '& .MuiInputBase-input': {
                ...getTableInputElementStyles({
                  textAlign: 'center',
                  cursor: isEditing ? 'text' : 'pointer',
                  caretColor: isEditing ? 'auto' : 'transparent',
                }),
              },
              ...sx,
            }}
          />
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {tooltipText}
            </span>
          ) : null}
        </Box>
      </Tooltip>
    );
  }
);

TableIntegerInput.displayName = 'TableIntegerInput';

export default TableIntegerInput;
