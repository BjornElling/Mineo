import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCore } from '../../tables/gridCoreContext';
import { areSameGridCell } from '../../tables/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { shouldClearField } from '../../../utils/inputValidation';
import { asTableCommittedString, committedToString, normalizeTableDraftOnCommit, type TableCommitResult, type TableInputErrorInfo } from './tableInputContracts';
import { assignRef } from './assignRef';
import { filterIntegerKeyDown } from '../inputKeyFilters';

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
  placeholder?: string;
  onChange?: (e: TableIntegerInputChangeEvent) => void;
  onBlur?: (e: TableIntegerInputChangeEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
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
  }: { minValue: number | undefined; maxValue: number | undefined; maxDigits: number | undefined }
): ParsedInteger => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '' };
  if (/[^0-9]/.test(trimmed)) return { ok: false, error: 'Ugyldigt format' };
  if (typeof maxDigits === 'number' && trimmed.length > maxDigits) return { ok: false, error: `Maks ${maxDigits} cifre` };

  const numValue = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numValue)) return { ok: false, error: 'Ugyldigt format' };

  if (typeof minValue === 'number' && numValue < minValue) {
    if (typeof maxValue === 'number') return { ok: false, error: `Værdi skal være mellem ${minValue} og ${maxValue}` };
    return { ok: false, error: `Værdi skal være ${minValue} eller højere` };
  }
  if (typeof maxValue === 'number' && numValue > maxValue) {
    if (typeof minValue === 'number') return { ok: false, error: `Værdi skal være mellem ${minValue} og ${maxValue}` };
    return { ok: false, error: `Værdi skal være ${maxValue} eller lavere` };
  }

  return { ok: true, value: String(numValue) };
};

const commitIntegerDraft = (
  draft: string,
  {
    hasConfigError,
    minValue,
    maxValue,
    maxDigits,
  }: { hasConfigError: boolean; minValue: number | undefined; maxValue: number | undefined; maxDigits: number | undefined }
): TableCommitResult => {
  if (hasConfigError) return { kind: 'config-error', committed: draft };
  const result = parseIntegerOnCommit(draft, { minValue, maxValue, maxDigits });
  if (!result.ok) return { kind: 'input-error', committed: draft, errorMessage: result.error };
  return { kind: 'ok', committed: asTableCommittedString(result.value) };
};

const TableIntegerInput = React.memo(
  ({ gridCell, locked = false, value, minValue, maxValue, placeholder = '', onChange, onBlur, onErrorChange, inputRef, sx }: TableIntegerInputProps) => {
    const grid = useGridCore();
    const cellFocused = areSameGridCell(grid.focusedCell, gridCell);
    const isEditing = areSameGridCell(grid.editingCell, gridCell);
    const isReadOnly = locked || !isEditing;

    const [draft, setDraft] = React.useState<string>(() => value ?? '');
    const [hasError, setHasError] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);

    const inputElRef = React.useRef<HTMLInputElement | null>(null);
    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedValueRef = React.useRef<string>('');

    const configErrorMessage = React.useMemo(() => {
      if (minValue !== undefined && !Number.isFinite(minValue)) return 'Ugyldig konfiguration: minValue skal være et tal';
      if (maxValue !== undefined && !Number.isFinite(maxValue)) return 'Ugyldig konfiguration: maxValue skal være et tal';
      if (typeof minValue === 'number' && typeof maxValue === 'number' && minValue > maxValue) return 'Ugyldig konfiguration: minValue er større end maxValue';
      if (typeof minValue === 'number' && minValue < 0) return 'Ugyldig konfiguration: minValue kan ikke være negativ (TableIntegerInput)';
      if (typeof maxValue === 'number' && maxValue < 0) return 'Ugyldig konfiguration: maxValue kan ikke være negativ (TableIntegerInput)';
      return '';
    }, [maxValue, minValue]);

    if (import.meta.env.DEV && configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const hasConfigError = configErrorMessage.trim() !== '';
    const maxDigits = React.useMemo(() => {
      if (typeof maxValue === 'number') return requiredDigits(maxValue);
      if (typeof minValue === 'number') return requiredDigits(minValue);
      return undefined;
    }, [maxValue, minValue]);

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, minValue, maxValue, maxDigits, hasConfigError });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, minValue, maxValue, maxDigits, hasConfigError };
    }, [hasConfigError, locked, maxDigits, maxValue, minValue, onBlur, onChange, onErrorChange]);

    React.useEffect(() => {
      latestCommittedValueRef.current = value ?? '';
    }, [value]);

    React.useEffect(() => {
      if (!isEditing) {
        setDraft(value ?? '');
      }
    }, [isEditing, value]);

    React.useEffect(() => {
      if (!isEditing) {
        keyInitiatedEditRef.current = false;
        return;
      }
      if (!keyInitiatedEditRef.current) {
        const committedValue = value ?? '';
        originalValueOnEditStartRef.current = committedValue;
        setDraft(committedValue);
        // Ingen emitValueChange her – vi må ikke opdatere parent under edit.
      }
    }, [isEditing, value]);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string) => {
        if (!latest.current.hasConfigError) setTouched(true);
        const committed = commitIntegerDraft(normalizeTableDraftOnCommit(rawDraft), {
          hasConfigError: latest.current.hasConfigError,
          minValue: latest.current.minValue,
          maxValue: latest.current.maxValue,
          maxDigits: latest.current.maxDigits,
        });

        if (committed.kind === 'config-error') {
          latest.current.onErrorChange?.({ hasError: true, kind: 'config' });
          emitBlur(committedToString(committed));
          return;
        }

        if (committed.kind === 'input-error') {
          setHasError(true);
          setErrorMessage(committed.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          emitBlur(committedToString(committed));
          return;
        }

        setHasError(false);
        setErrorMessage('');
        latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        emitBlur(committedToString(committed));
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
        if (!isEditing) return;
        commitAndEmitBlur(e.currentTarget.value ?? '');
      },
      [commitAndEmitBlur, isEditing]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Filtrér kun under edit-mode (arvet fra StyledIntegerField)
        if (!isEditing) return;
        filterIntegerKeyDown(e);
      },
      [isEditing]
    );

    const a11yErrorId = React.useId();
    const showError = (hasConfigError || (touched && hasError)) && !isFocused;
    const tooltipText = hasConfigError ? configErrorMessage : errorMessage;

    const editorHandle = React.useMemo<GridCellEditorHandle>(() => {
      return {
        getElement: () => inputElRef.current,
        getIsLocked: () => latest.current.locked,
        clearAndCommit: () => {
          if (latest.current.locked) return;
          keyInitiatedEditRef.current = false;
          setHasError(false);
          setErrorMessage('');
          setTouched(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          setDraft('');
          // Ingen emitValueChange. Commit sker via blur/commit-pipeline:
          commitAndEmitBlur('');
          grid.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          keyInitiatedEditRef.current = false;
          setHasError(false);
          setErrorMessage('');
          setTouched(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          const original = originalValueOnEditStartRef.current;
          setDraft(original);
          // KRITISK INVARIANT: cancelEdit må ALDRIG udløse onChange eller onBlur
          // Original værdi er allerede committed - ingen onChange skal sendes til parent
          grid.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          if (!/^[0-9]$/.test(key)) return false;
          const committedValue = latestCommittedValueRef.current;
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setHasError(false);
          setErrorMessage('');
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
    }, [commitAndEmitBlur, grid]);

    React.useEffect(() => {
      grid.registerEditor(gridCell, editorHandle);
      return () => grid.unregisterEditor(gridCell);
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

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%' }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            value={isEditing ? draft : value ?? ''}
            readOnly={isReadOnly}
            disabled={locked}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={cellFocused && !isReadOnly ? '' : placeholder}
            inputProps={{
              readOnly: isReadOnly,
              inputMode: 'numeric',
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
                textAlign: 'center',
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
        </Box>
      </Tooltip>
    );
  }
);

TableIntegerInput.displayName = 'TableIntegerInput';

export default TableIntegerInput;
