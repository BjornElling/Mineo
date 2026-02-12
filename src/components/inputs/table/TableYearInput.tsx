import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCore } from '../../tables/gridCoreContext';
import { areSameGridCell } from '../../tables/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { shouldClearField } from '../../../utils/inputValidation';
import { interpretYear } from '../../../utils/dateValidation';
import { asTableCommittedString, committedToString, normalizeTableDraftOnCommit, type TableCommitResult, type TableInputErrorInfo } from './tableInputContracts';
import { assignRef } from './assignRef';
import { filterYearKeyDown } from '../inputKeyFilters';

const MAX_YEAR_DRAFT_LENGTH = 6;

export type TableYearInputChangeEvent = { target: { value: string } };

export type TableYearInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: string | undefined;
  minYear?: number;
  maxYear?: number;
  /**
   * Policy for interpreting 1-2 digit years on commit.
   *
   * Default: `infer` (legacy behavior via `interpretYear`).
   */
  twoDigitYearPolicy?: 'reject' | 'infer' | 'assume20xx';
  placeholder?: string;
  onChange?: (e: TableYearInputChangeEvent) => void;
  onBlur?: (e: TableYearInputChangeEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

type ParsedYear = { ok: true; value: string } | { ok: false; error: string };

const parseYearOnCommit = (
  draft: string,
  {
    minYear,
    maxYear,
    twoDigitYearPolicy,
  }: { minYear: number | undefined; maxYear: number | undefined; twoDigitYearPolicy: 'reject' | 'infer' | 'assume20xx' }
): ParsedYear => {
  const trimmed = draft.trim();
  if (trimmed === '' || shouldClearField(trimmed)) return { ok: true, value: '' };
  if (/[^0-9]/.test(trimmed)) return { ok: false, error: 'Ugyldigt format' };
  if (trimmed.length === 3) return { ok: false, error: 'Ugyldigt årstal' };

  let yearStr: string;
  if (trimmed.length === 1 || trimmed.length === 2) {
    if (twoDigitYearPolicy === 'reject') return { ok: false, error: 'Ugyldigt årstal' };
    if (twoDigitYearPolicy === 'assume20xx') {
      const parsed = Number.parseInt(trimmed, 10);
      if (!Number.isFinite(parsed)) return { ok: false, error: 'Ugyldigt årstal' };
      yearStr = String(2000 + parsed);
    } else {
      const interpreted = interpretYear(trimmed);
      if (interpreted === null) return { ok: false, error: 'Ugyldigt årstal' };
      yearStr = String(interpreted);
    }
  } else if (trimmed.length === 4) {
    yearStr = trimmed;
  } else {
    return { ok: false, error: 'Ugyldigt årstal' };
  }

  const yearNum = Number.parseInt(yearStr, 10);
  if (!Number.isFinite(yearNum)) return { ok: false, error: 'Ugyldigt årstal' };

  if (typeof minYear === 'number' && yearNum < minYear) {
    if (typeof maxYear === 'number') return { ok: false, error: `År skal være mellem ${minYear} og ${maxYear}` };
    return { ok: false, error: `År skal være ${minYear} eller senere` };
  }
  if (typeof maxYear === 'number' && yearNum > maxYear) {
    if (typeof minYear === 'number') return { ok: false, error: `År skal være mellem ${minYear} og ${maxYear}` };
    return { ok: false, error: `År skal være ${maxYear} eller tidligere` };
  }

  return { ok: true, value: yearStr };
};

const commitYearDraft = (
  draft: string,
  {
    hasConfigError,
    minYear,
    maxYear,
    twoDigitYearPolicy,
  }: { hasConfigError: boolean; minYear: number | undefined; maxYear: number | undefined; twoDigitYearPolicy: 'reject' | 'infer' | 'assume20xx' }
): TableCommitResult => {
  if (hasConfigError) return { kind: 'config-error', committed: draft };
  const result = parseYearOnCommit(draft, { minYear, maxYear, twoDigitYearPolicy });
  if (!result.ok) return { kind: 'input-error', committed: draft, errorMessage: result.error };
  return { kind: 'ok', committed: asTableCommittedString(result.value) };
};

const TableYearInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    minYear,
    maxYear,
    twoDigitYearPolicy = 'infer',
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableYearInputProps) => {
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
    const draftRef = React.useRef<string>(draft);
    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedValueRef = React.useRef<string>('');

    const configErrorMessage = React.useMemo(() => {
      if (minYear !== undefined && !Number.isFinite(minYear)) return 'Ugyldig konfiguration: minYear skal være et tal';
      if (maxYear !== undefined && !Number.isFinite(maxYear)) return 'Ugyldig konfiguration: maxYear skal være et tal';
      if (typeof minYear === 'number' && typeof maxYear === 'number' && minYear > maxYear) return 'Ugyldig konfiguration: minYear er større end maxYear';
      return '';
    }, [maxYear, minYear]);

    if (import.meta.env.DEV && configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const hasConfigError = configErrorMessage.trim() !== '';

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, minYear, maxYear, twoDigitYearPolicy, hasConfigError });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, minYear, maxYear, twoDigitYearPolicy, hasConfigError };
    }, [hasConfigError, locked, maxYear, minYear, onBlur, onChange, onErrorChange, twoDigitYearPolicy]);

    React.useEffect(() => {
      latestCommittedValueRef.current = value ?? '';
    }, [value]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

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
      (rawDraft: string): boolean => {
        if (!latest.current.hasConfigError) setTouched(true);
        const normalized = normalizeTableDraftOnCommit(rawDraft);
        const committed = commitYearDraft(normalized, {
          hasConfigError: latest.current.hasConfigError,
          minYear: latest.current.minYear,
          maxYear: latest.current.maxYear,
          twoDigitYearPolicy: latest.current.twoDigitYearPolicy,
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
        const nextDraft = String(e.target.value ?? '').slice(0, MAX_YEAR_DRAFT_LENGTH);
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
        const committedValue = latestCommittedValueRef.current;
        if (!isEditing && rawValue === committedValue) return;
        commitAndEmitBlur(rawValue);
      },
      [commitAndEmitBlur, isEditing]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Filtrér kun under edit-mode (arvet fra StyledYearFieldNext)
        if (!isEditing) return;
        filterYearKeyDown(e);
      },
      [isEditing]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || hasConfigError || (touched && hasError)) && !isFocused;
    const tooltipText = hasExternalError ? externalErrorText : hasConfigError ? configErrorMessage : errorMessage;

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
          keyInitiatedEditRef.current = false;
          setHasError(false);
          setErrorMessage('');
          setTouched(false);
          latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
          setDraft('');
          // Ingen emitValueChange. Commit sker via blur/commit-pipeline:
          const ok = commitAndEmitBlur('');
          if (!ok) return;
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
        selectAll: () => requestAnimationFrame(() => inputElRef.current?.select()),
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

TableYearInput.displayName = 'TableYearInput';

export default TableYearInput;
