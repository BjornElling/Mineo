import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { formatAsAmount } from '../../../utils/formatUtils';
import { useGridCore } from '../../tables/gridCoreContext';
import { areSameGridCell } from '../../tables/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { assignRef } from './assignRef';
import {
  asTableCommittedString,
  committedToString,
  normalizeTableAmountDraftOnCommit,
  type TableCommitResult,
  type TableInputErrorInfo,
} from './tableInputContracts';
import { filterPercentKeyDown } from '../inputKeyFilters';

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
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TABLE_PERCENT_PRECISION = 2;
const MAX_PERCENT_RAW_LENGTH = 64;

type ParsedPercent = { ok: true; numeric: number } | { ok: true; empty: true } | { ok: false; error: string };

const formatPercentBound = (value: number): string => formatAsAmount(value, TABLE_PERCENT_PRECISION);

const parsePercentOnCommit = (
  rawValue: string,
  {
    allowNegative,
    minValue,
    maxValue,
  }: { allowNegative: boolean; minValue: number | undefined; maxValue: number | undefined }
): ParsedPercent => {
  const trimmed = rawValue.trim();
  if (trimmed === '') return { ok: true, empty: true };
  if (trimmed === '-') return { ok: false, error: 'Ugyldig procent' };
  if (trimmed.length > MAX_PERCENT_RAW_LENGTH) return { ok: false, error: 'Ugyldig procent' };

  const compact = trimmed.replace(/\s+/g, '');
  const isNegative = compact.startsWith('-');
  if (isNegative && !allowNegative) return { ok: false, error: 'Procent kan ikke være negativ' };

  const unsigned = isNegative ? compact.slice(1) : compact;
  if (unsigned.includes('-')) return { ok: false, error: 'Ugyldig procent' };
  if (/\s/.test(trimmed) && unsigned.includes('.')) return { ok: false, error: 'Ugyldig procent' };

  const commaCount = (unsigned.match(/,/g) ?? []).length;
  if (commaCount > 1) return { ok: false, error: 'Ugyldig procent' };

  const [integerRaw, decimalRaw] = unsigned.split(',') as [string, string | undefined];
  if (!integerRaw) return { ok: false, error: 'Ugyldig procent' };
  if (decimalRaw !== undefined && decimalRaw === '') return { ok: false, error: 'Ugyldig procent' };

  if (decimalRaw !== undefined) {
    if (/[^0-9]/.test(decimalRaw)) return { ok: false, error: 'Ugyldig procent' };
    if (decimalRaw.length > TABLE_PERCENT_PRECISION) return { ok: false, error: 'Ugyldig procent' };
  }

  if (integerRaw.includes('.')) {
    if (!/^\d{1,3}(\.\d{3})*$/.test(integerRaw)) return { ok: false, error: 'Ugyldig procent' };
  } else {
    if (/[^0-9]/.test(integerRaw)) return { ok: false, error: 'Ugyldig procent' };
  }

  const integerDigits = integerRaw.replace(/\./g, '');
  const numericValue = Number.parseFloat(`${integerDigits}${decimalRaw ? `.${decimalRaw}` : ''}`);
  if (!Number.isFinite(numericValue)) return { ok: false, error: 'Ugyldig procent' };

  const signed = isNegative ? -numericValue : numericValue;

  if (typeof minValue === 'number' && signed < minValue) {
    if (typeof maxValue === 'number') {
      return { ok: false, error: `Procent skal være mellem ${formatPercentBound(minValue)} og ${formatPercentBound(maxValue)}` };
    }
    return { ok: false, error: `Procent skal være ${formatPercentBound(minValue)} eller højere` };
  }

  if (typeof maxValue === 'number' && signed > maxValue) {
    if (typeof minValue === 'number') {
      return { ok: false, error: `Procent skal være mellem ${formatPercentBound(minValue)} og ${formatPercentBound(maxValue)}` };
    }
    return { ok: false, error: `Procent skal være ${formatPercentBound(maxValue)} eller lavere` };
  }

  return { ok: true, numeric: signed };
};

const commitPercentDraft = (
  draft: string,
  {
    allowNegative,
    minValue,
    maxValue,
    hasConfigError,
  }: { allowNegative: boolean; minValue: number | undefined; maxValue: number | undefined; hasConfigError: boolean }
): TableCommitResult => {
  if (hasConfigError) return { kind: 'config-error', committed: draft };
  const parsed = parsePercentOnCommit(draft, { allowNegative, minValue, maxValue });
  if (!parsed.ok) return { kind: 'input-error', committed: draft, errorMessage: parsed.error };
  if ('empty' in parsed) return { kind: 'ok', committed: asTableCommittedString('') };
  return { kind: 'ok', committed: asTableCommittedString(formatAsAmount(parsed.numeric, TABLE_PERCENT_PRECISION)) };
};

const toDisplayString = (value: TablePercentInputValue): string => {
  if (value === undefined) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? formatAsAmount(value, TABLE_PERCENT_PRECISION) : '';
  return value;
};

const TablePercentInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    allowNegative = false,
    minValue,
    maxValue,
    useDefaultPercentRange = true,
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    inputRef,
    sx,
  }: TablePercentInputProps) => {
    const grid = useGridCore();
    const cellFocused = areSameGridCell(grid.focusedCell, gridCell);
    const isEditing = areSameGridCell(grid.editingCell, gridCell);
    const isReadOnly = locked || !isEditing;

    const inputElRef = React.useRef<HTMLInputElement | null>(null);

    const [draft, setDraft] = React.useState<string>(() => toDisplayString(value));
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const draftRef = React.useRef<string>(draft);

    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedValueRef = React.useRef<TablePercentInputValue>(undefined);

    const effectiveMin = minValue ?? (useDefaultPercentRange ? 0 : undefined);
    const effectiveMax = maxValue ?? (useDefaultPercentRange ? 100 : undefined);

    const configErrorMessage = React.useMemo(() => {
      if (minValue !== undefined && !Number.isFinite(minValue)) return 'Ugyldig konfiguration: minValue skal være et tal';
      if (maxValue !== undefined && !Number.isFinite(maxValue)) return 'Ugyldig konfiguration: maxValue skal være et tal';
      if (typeof effectiveMin === 'number' && typeof effectiveMax === 'number' && effectiveMin > effectiveMax) {
        return 'Ugyldig konfiguration: minValue er større end maxValue';
      }
      return '';
    }, [effectiveMax, effectiveMin, maxValue, minValue]);

    if (import.meta.env.DEV && configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const hasConfigError = configErrorMessage.trim() !== '';

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, allowNegative, minValue: effectiveMin, maxValue: effectiveMax, hasConfigError });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, allowNegative, minValue: effectiveMin, maxValue: effectiveMax, hasConfigError };
    }, [allowNegative, effectiveMax, effectiveMin, hasConfigError, locked, onBlur, onChange, onErrorChange]);

    React.useEffect(() => {
      latestCommittedValueRef.current = value;
    }, [value]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

    React.useEffect(() => {
      if (!isEditing) {
        setDraft(toDisplayString(value));
      }
    }, [isEditing, value]);

    React.useEffect(() => {
      if (!isEditing) {
        keyInitiatedEditRef.current = false;
        return;
      }
      if (!keyInitiatedEditRef.current) {
        const committedValue = toDisplayString(value);
        originalValueOnEditStartRef.current = committedValue;
        setDraft(committedValue);
      }
    }, [isEditing, value]);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string): boolean => {
        if (!latest.current.hasConfigError) setTouched(true);
        const normalized = normalizeTableAmountDraftOnCommit(rawDraft);
        const committed = commitPercentDraft(normalized, {
          allowNegative: latest.current.allowNegative,
          minValue: latest.current.minValue,
          maxValue: latest.current.maxValue,
          hasConfigError: latest.current.hasConfigError,
        });

        if (committed.kind === 'config-error') {
          latest.current.onErrorChange?.({ hasError: true, kind: 'config' });
          emitBlur(committedToString(committed));
          return false;
        }

        if (committed.kind === 'input-error') {
          setHasError(true);
          setErrorMessage(committed.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          emitBlur(committedToString(committed));
          return false;
        }

        setHasError(false);
        setErrorMessage('');
        latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        emitBlur(committedToString(committed));
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
        const rawValue = e.currentTarget.value ?? '';
        const committedPlain = toDisplayString(latestCommittedValueRef.current);
        const committedDisplay = committedPlain === '' ? '' : `${committedPlain} %`;
        if (!isEditing && (rawValue === committedPlain || rawValue === committedDisplay)) return;
        commitAndEmitBlur(rawValue);
      },
      [commitAndEmitBlur, isEditing]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Filtrér kun under edit-mode
        if (!isEditing) return;
        filterPercentKeyDown(e, { allowNegative });
      },
      [allowNegative, isEditing]
    );

    const a11yErrorId = React.useId();
    const showError = (hasConfigError || (touched && hasError)) && !isFocused;
    const tooltipText = hasConfigError ? configErrorMessage : errorMessage;

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => latest.current.locked,
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
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          setDraft('');
          const ok = commitAndEmitBlur('');
          if (!ok) return;
          grid.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          keyInitiatedEditRef.current = false;
          const original = originalValueOnEditStartRef.current;
          setDraft(original);
          grid.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          if (!/^[0-9,-]$/.test(key)) return false;
          if (key === '-' && !latest.current.allowNegative) return false;
          const committedValue = toDisplayString(latestCommittedValueRef.current);
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setTouched(false);
          setHasError(false);
          setErrorMessage('');
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
    }, [commitAndEmitBlur, grid]);

    React.useEffect(() => {
      grid.registerEditor(gridCell, editorHandle);
      return () => {
        grid.unregisterEditor(gridCell);
      };
    }, [editorHandle, grid, gridCell]);

    const visuallyHiddenStyle: React.CSSProperties = {
      position: 'absolute',
      width: 1,
      height: 1,
      padding: 0,
      margin: -1,
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0,
    };

    const displayValue = toDisplayString(value);

    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%', ...sx }}>
        <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
          <Box sx={{ width: '100%', height: '100%' }}>
            <InputBase
              inputRef={(el) => {
                inputElRef.current = el;
                assignRef(inputRef, el);
              }}
              value={isEditing ? draft : (displayValue === '' ? '' : `${displayValue} %`)}
              readOnly={isReadOnly}
              disabled={locked}
              onChange={handleChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              placeholder={cellFocused && !isReadOnly ? '' : placeholder}
              inputProps={{
                readOnly: isReadOnly,
                inputMode: 'decimal',
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
                borderRadius: '4px',
                border: '1px solid',
                borderColor: showError ? '#d32f2f' : 'transparent',
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
