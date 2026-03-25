import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { formatAsAmount } from '../../../utils/formatUtils';
import { copyWholeValueFromReadOnlyField, readClipboardText } from '../../../utils/clipboardUtils';
import { normalizePercentPaste } from '../../../utils/inputPasteNormalization';
import { useGridCoreApi, useGridCoreState } from '../../tables/useGridCore';
import { areSameGridCell } from '../../tables/gridCore/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCore/gridCoreTypes';
import { assignRef } from './assignRef';
import {
  asTableCommittedString,
  committedToString,
  normalizeTableAmountDraftOnCommit,
  type TableCommitResult,
  type TableInputErrorInfo,
} from '../../../utils/tableInputContracts';
import { filterPercentKeyDown } from '../inputKeyFilters';
import {
  makePercentFingerprintFromCanonical,
  type CommittedPayload,
  type PercentFingerprint,
} from '../../../types/parserSpec';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';

export type TablePercentInputValue = string | number | undefined;

export type TablePercentInputChangeEvent = { target: { value: string } };

export type TablePercentInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  /**
   * Table cell values persist as strings.
   *
   * Invariant:
   * - If `value` is a `string`, it must already be a committed (canonical display) value, not a raw user draft.
   * - If `value` is a `number`, it will be formatted for display.
   */
  value?: TablePercentInputValue;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  minValue?: number;
  maxValue?: number;
  /**
   * Default percent range (0-100). Applied only when `minValue`/`maxValue` are not provided.
   */
  useDefaultPercentRange?: boolean;
  placeholder?: string;
  onChange?: (e: TablePercentInputChangeEvent) => void;
  onBlur?: (e: TablePercentInputChangeEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TABLE_PERCENT_DECIMAL_PRECISION = 2;
const MAX_PERCENT_RAW_LENGTH = 64;
const TABLE_PERCENT_PASTE_MAX = 100;

type ParsedPercent =
  | { ok: true; numeric: number }
  | { ok: true; empty: true }
  | { ok: false; error: string };
type PreparedPercentCommit =
  | { kind: 'input-error'; committed: string; errorMessage: string }
  | {
      kind: 'ok';
      canonical: string;
      payload: CommittedPayload<string, string, PercentFingerprint>;
    };

const getPercentPrecision = (allowDecimals: boolean): 0 | 2 =>
  allowDecimals ? TABLE_PERCENT_DECIMAL_PRECISION : 0;

const formatPercentBound = (value: number, precision: 0 | 2): string =>
  formatAsAmount(value, precision);

const parsePercentOnCommit = (
  rawValue: string,
  {
    allowNegative,
    allowDecimals,
    minValue,
    maxValue,
  }: {
    allowNegative: boolean;
    allowDecimals: boolean;
    minValue: number | undefined;
    maxValue: number | undefined;
  }
): ParsedPercent => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, empty: true };
  if (trimmed === '-') return { ok: false, error: 'Ugyldig procent' };
  if (trimmed.length > MAX_PERCENT_RAW_LENGTH) {
    return { ok: false, error: 'Ugyldig procent' };
  }

  const compact = trimmed.replace(/\s+/g, '');
  const isNegative = compact.startsWith('-');
  if (isNegative && !allowNegative) {
    return { ok: false, error: 'Procent kan ikke være negativ' };
  }

  const unsigned = isNegative ? compact.slice(1) : compact;
  if (unsigned.includes('-')) return { ok: false, error: 'Ugyldig procent' };
  if (/\s/.test(trimmed) && unsigned.includes('.')) {
    return { ok: false, error: 'Ugyldig procent' };
  }
  if (!allowDecimals && unsigned.includes(',')) {
    return { ok: false, error: 'Ugyldig procent' };
  }

  const commaCount = (unsigned.match(/,/g) ?? []).length;
  if (commaCount > 1) return { ok: false, error: 'Ugyldig procent' };

  const [integerRaw, decimalRaw] = unsigned.split(',') as [string, string | undefined];
  if (!integerRaw) return { ok: false, error: 'Ugyldig procent' };
  if (decimalRaw !== undefined && decimalRaw === '') {
    return { ok: false, error: 'Ugyldig procent' };
  }

  if (decimalRaw !== undefined) {
    if (/[^0-9]/.test(decimalRaw)) return { ok: false, error: 'Ugyldig procent' };
    if (!allowDecimals) return { ok: false, error: 'Ugyldig procent' };
    if (decimalRaw.length > TABLE_PERCENT_DECIMAL_PRECISION) {
      return { ok: false, error: 'Ugyldig procent' };
    }
  }

  if (integerRaw.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})*$/.test(integerRaw)) {
      return { ok: false, error: 'Ugyldig procent' };
    }
  } else {
    if (/[^0-9]/.test(integerRaw)) return { ok: false, error: 'Ugyldig procent' };
  }

  const integerDigits = integerRaw.replace(/\./g, '');
  const numericValue = Number.parseFloat(
    `${integerDigits}${decimalRaw ? `.${decimalRaw}` : ''}`
  );
  if (!Number.isFinite(numericValue)) return { ok: false, error: 'Ugyldig procent' };

  const signed = isNegative ? -numericValue : numericValue;
  const precision = getPercentPrecision(allowDecimals);

  if (typeof minValue === 'number' && signed < minValue) {
    if (typeof maxValue === 'number') {
      return {
        ok: false,
        error: `Procent skal være mellem ${formatPercentBound(minValue, precision)} og ${formatPercentBound(maxValue, precision)}`,
      };
    }
    return {
      ok: false,
      error: `Procent skal være ${formatPercentBound(minValue, precision)} eller højere`,
    };
  }

  if (typeof maxValue === 'number' && signed > maxValue) {
    if (typeof minValue === 'number') {
      return {
        ok: false,
        error: `Procent skal være mellem ${formatPercentBound(minValue, precision)} og ${formatPercentBound(maxValue, precision)}`,
      };
    }
    return {
      ok: false,
      error: `Procent skal være ${formatPercentBound(maxValue, precision)} eller lavere`,
    };
  }

  return { ok: true, numeric: signed };
};

const commitPercentDraft = (
  draft: string,
  {
    allowNegative,
    allowDecimals,
    minValue,
    maxValue,
  }: {
    allowNegative: boolean;
    allowDecimals: boolean;
    minValue: number | undefined;
    maxValue: number | undefined;
  }
): TableCommitResult => {
  const parsed = parsePercentOnCommit(draft, {
    allowNegative,
    allowDecimals,
    minValue,
    maxValue,
  });
  if (!parsed.ok) {
    return { kind: 'input-error', committed: draft, errorMessage: parsed.error };
  }
  if ('empty' in parsed) return { kind: 'ok', committed: asTableCommittedString('') };
  return {
    kind: 'ok',
    committed: asTableCommittedString(
      formatAsAmount(parsed.numeric, getPercentPrecision(allowDecimals))
    ),
  };
};

const toDisplayString = (
  value: TablePercentInputValue,
  allowDecimals: boolean
): string => {
  if (value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? formatAsAmount(value, getPercentPrecision(allowDecimals))
      : '';
  }
  return value;
};

const percentNumericCanonicalFromDisplay = (
  display: string,
  allowDecimals: boolean
): string => {
  const trimmed = display.trim();
  const withoutPercentSuffix = trimmed.endsWith('%')
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  const parsed = parsePercentOnCommit(withoutPercentSuffix, {
    allowNegative: true,
    allowDecimals,
    minValue: undefined,
    maxValue: undefined,
  });
  if (!parsed.ok) {
    if (import.meta.env.DEV && withoutPercentSuffix !== '') {
      throw new Error(
        `Invariant brudt: committed procentværdi kan ikke parses (${display})`
      );
    }
    return '';
  }
  if ('empty' in parsed) return '';
  return parsed.numeric.toFixed(getPercentPrecision(allowDecimals));
};

const percentFingerprintFromCommittedDisplay = (
  display: string,
  allowDecimals: boolean
): PercentFingerprint => {
  const numericCanonical = percentNumericCanonicalFromDisplay(display, allowDecimals);
  return makePercentFingerprintFromCanonical(numericCanonical);
};

const toCommittedPercentPayload = (
  value: TablePercentInputValue,
  allowDecimals: boolean
): CommittedPayload<string, string, PercentFingerprint> => {
  const canonical = toDisplayString(value, allowDecimals);
  return {
    model: canonical,
    canonical,
    fingerprint: percentFingerprintFromCommittedDisplay(canonical, allowDecimals),
  };
};

const preparePercentCommit = (
  rawDraft: string,
  {
    allowNegative,
    allowDecimals,
    minValue,
    maxValue,
  }: {
    allowNegative: boolean;
    allowDecimals: boolean;
    minValue: number | undefined;
    maxValue: number | undefined;
  }
): PreparedPercentCommit => {
  const normalized = normalizeTableAmountDraftOnCommit(rawDraft);
  const committed = commitPercentDraft(normalized, {
    allowNegative,
    allowDecimals,
    minValue,
    maxValue,
  });

  if (committed.kind === 'input-error') {
    return {
      kind: 'input-error',
      committed: committed.committed,
      errorMessage: committed.errorMessage,
    };
  }

  const canonical = committedToString(committed);
  return {
    kind: 'ok',
    canonical,
    payload: {
      model: canonical,
      canonical,
      fingerprint: percentFingerprintFromCommittedDisplay(canonical, allowDecimals),
    },
  };
};

const TablePercentInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    allowNegative = false,
    allowDecimals = true,
    minValue,
    maxValue,
    useDefaultPercentRange = true,
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TablePercentInputProps) => {
    const gridState = useGridCoreState();
    const gridApi = useGridCoreApi();
    const cellFocused = areSameGridCell(gridState.focusedCell, gridCell);
    const isEditing = areSameGridCell(gridState.editingCell, gridCell);
    const isReadOnly = locked || !isEditing;
    const isLooseTable = gridApi.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'rgba(0, 0, 0, 0.12)' : 'transparent';

    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const [draft, setDraft] = React.useState<string>(() =>
      toDisplayString(value, allowDecimals)
    );
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [preserveInvalidDraft, setPreserveInvalidDraft] = React.useState(false);
    const draftRef = React.useRef<string>(draft);
    const previousCommittedValueRef = React.useRef<string>(
      toDisplayString(value, allowDecimals)
    );

    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedPayloadRef = React.useRef<
      CommittedPayload<string, string, PercentFingerprint>
    >(toCommittedPercentPayload(value, allowDecimals));

    const effectiveMin = minValue ?? (useDefaultPercentRange ? 0 : undefined);
    const effectiveMax = maxValue ?? (useDefaultPercentRange ? 100 : undefined);

    const configErrorMessage = React.useMemo(() => {
      if (minValue !== undefined && !Number.isFinite(minValue)) {
        return 'Ugyldig konfiguration: minValue skal være et tal';
      }
      if (maxValue !== undefined && !Number.isFinite(maxValue)) {
        return 'Ugyldig konfiguration: maxValue skal være et tal';
      }
      if (
        typeof effectiveMin === 'number' &&
        typeof effectiveMax === 'number' &&
        effectiveMin > effectiveMax
      ) {
        return 'Ugyldig konfiguration: minValue er større end maxValue';
      }
      return '';
    }, [effectiveMax, effectiveMin, maxValue, minValue]);

    if (configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const latest = React.useRef({
      onChange,
      onBlur,
      onErrorChange,
      locked,
      allowNegative,
      minValue: effectiveMin,
      maxValue: effectiveMax,
    });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = {
        onChange,
        onBlur,
        onErrorChange,
        locked,
        allowNegative,
        minValue: effectiveMin,
        maxValue: effectiveMax,
      };
    }, [allowNegative, effectiveMax, effectiveMin, locked, onBlur, onChange, onErrorChange]);

    React.useEffect(() => {
      latestCommittedPayloadRef.current = toCommittedPercentPayload(
        value,
        allowDecimals
      );
    }, [allowDecimals, value]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

    React.useEffect(() => {
      const nextCommitted = toDisplayString(value, allowDecimals);
      const didParentValueChange = previousCommittedValueRef.current !== nextCommitted;
      previousCommittedValueRef.current = nextCommitted;
      if (!didParentValueChange || isEditing || !preserveInvalidDraft) return;
      setPreserveInvalidDraft(false);
      setHasError(false);
      setErrorMessage('');
      setTouched(false);
    }, [allowDecimals, isEditing, preserveInvalidDraft, value]);

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
        setDraft(toDisplayString(value, allowDecimals));
      }
    }, [allowDecimals, hasError, isEditing, preserveInvalidDraft, value]);

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
        const committedValue = toDisplayString(value, allowDecimals);
        originalValueOnEditStartRef.current = committedValue;
        setDraft(committedValue);
      }
    }, [allowDecimals, hasError, isEditing, preserveInvalidDraft, value]);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string, prepared?: PreparedPercentCommit): boolean => {
        setTouched(true);
        const resolvedPrepared =
          prepared ??
          preparePercentCommit(rawDraft, {
            allowNegative: latest.current.allowNegative,
            allowDecimals,
            minValue: latest.current.minValue,
            maxValue: latest.current.maxValue,
          });

        if (resolvedPrepared.kind === 'input-error') {
          setPreserveInvalidDraft(true);
          setHasError(true);
          setErrorMessage(resolvedPrepared.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          return false;
        }

        setPreserveInvalidDraft(false);
        setHasError(false);
        setErrorMessage('');
        latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        const isNoop =
          resolvedPrepared.payload.fingerprint ===
          latestCommittedPayloadRef.current.fingerprint;
        if (isNoop) return true;

        emitBlur(resolvedPrepared.payload.model);
        return true;
      },
      [allowDecimals, emitBlur]
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
        const prepared = preparePercentCommit(rawValue, {
          allowNegative: latest.current.allowNegative,
          allowDecimals,
          minValue: latest.current.minValue,
          maxValue: latest.current.maxValue,
        });
        if (prepared.kind === 'ok') {
          const nextFingerprint = prepared.payload.fingerprint;
          if (!isEditing && nextFingerprint === latestCommittedPayloadRef.current.fingerprint) {
            return;
          }
        }
        commitAndEmitBlur(rawValue, prepared);
      },
      [allowDecimals, commitAndEmitBlur, isEditing]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Filtrér kun under edit-mode
        if (!isEditing) return;
        filterPercentKeyDown(e, {
          allowNegative,
          allowDecimals,
        });
      },
      [allowDecimals, allowNegative, isEditing]
    );

    const handlePaste = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        const normalized = normalizePercentPaste(readClipboardText(e), { maxValue: TABLE_PERCENT_PASTE_MAX });

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
      [commitAndEmitBlur, draft, isEditing]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || (touched && hasError)) && !isFocused;
    const tooltipText = hasExternalError ? externalErrorText : errorMessage;
    const showDraftWhenError = !isEditing && (preserveInvalidDraft || (touched && hasError));
    const displayValue = toDisplayString(value, allowDecimals);
    const readOnlyDisplayValue = showDraftWhenError ? draft : displayValue === '' ? '' : `${displayValue} %`;
    const renderedValue = isEditing ? draft : readOnlyDisplayValue;

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly,
          value: renderedValue,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
      },
      [isReadOnly, renderedValue]
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
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          setPreserveInvalidDraft(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          setDraft('');
          const ok = commitAndEmitBlur('');
          if (!ok) return;
          gridApi.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          setPreserveInvalidDraft(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          const original = originalValueOnEditStartRef.current;
          setDraft(original);
          gridApi.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          if (allowDecimals) {
            if (!/^[0-9,-]$/.test(key)) return false;
          } else {
            if (!/^[0-9-]$/.test(key)) return false;
          }
          if (key === '-' && !latest.current.allowNegative) return false;
          const committedValue = latestCommittedPayloadRef.current.canonical;
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          setPreserveInvalidDraft(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          setDraft(key);
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
    }, [allowDecimals, commitAndEmitBlur, gridApi]);

    React.useEffect(() => {
      gridApi.registerEditor(gridCell, editorHandle);
      return () => {
        gridApi.unregisterEditor(gridCell);
      };
    }, [editorHandle, gridApi, gridCell]);

    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%', ...sx }}>
        <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
          <Box sx={{ width: '100%', height: '100%' }}>
            <InputBase
              inputRef={(el) => {
                inputElRef.current = el;
                assignRef(inputRef, el);
              }}
              autoComplete="off"
              value={renderedValue}
              readOnly={isReadOnly}
              disabled={locked}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onCopy={handleCopy}
              placeholder={cellFocused && !isReadOnly ? '' : placeholder}
              inputProps={{
                readOnly: isReadOnly,
                inputMode: allowDecimals ? 'decimal' : 'numeric',
                'data-mineo-grid-locked': locked ? 'true' : undefined,
                'aria-describedby': showError ? a11yErrorId : undefined,
              }}
              sx={{
                width: '100%',
                height: '100%',
                font: 'inherit',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                lineHeight: 'inherit',
                color: 'inherit',
                fontFeatureSettings: '"tnum"',
                paddingLeft: '8px',
                paddingRight: '8px',
                borderRadius: inputBorderRadius,
                border: '1px solid',
                borderColor: showError ? '#d32f2f' : inputBorderColor,
                '&:focus-within': {
                  borderColor: '#1976d2',
                },
                '& .MuiInputBase-input': {
                  font: 'inherit',
                  fontSize: 'inherit',
                  lineHeight: 'inherit',
                  color: 'inherit',
                  textAlign: 'right',
                  cursor: isEditing ? 'text' : 'pointer',
                  caretColor: isEditing ? 'auto' : 'transparent',
                },
              }}
            />
            {showError ? (
              <span id={a11yErrorId} style={visuallyHiddenStyle}>
                {tooltipText}
              </span>
            ) : null}
          </Box>
        </Tooltip>
      </Box>
    );
  }
);

TablePercentInput.displayName = 'TablePercentInput';

export default TablePercentInput;
