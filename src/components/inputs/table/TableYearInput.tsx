import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCore } from '../../tables/gridCoreContext';
import { areSameGridCell } from '../../tables/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { shouldClearField } from '../../../utils/inputValidation';
import { interpretYear } from '../../../utils/dateInputValidation';
import { asTableCommittedString, committedToString, normalizeTableDraftOnCommit, type TableCommitResult, type TableInputErrorInfo } from './tableInputContracts';
import { assignRef } from './assignRef';
import { filterYearKeyDown } from '../inputKeyFilters';
import { makeYearFingerprintFromCanonical, type CommittedPayload, type YearFingerprint } from '../shared/parserSpec';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';

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
    minYear,
    maxYear,
    twoDigitYearPolicy,
  }: { minYear: number | undefined; maxYear: number | undefined; twoDigitYearPolicy: 'reject' | 'infer' | 'assume20xx' }
): TableCommitResult => {
  const result = parseYearOnCommit(draft, { minYear, maxYear, twoDigitYearPolicy });
  if (!result.ok) return { kind: 'input-error', committed: draft, errorMessage: result.error };
  return { kind: 'ok', committed: asTableCommittedString(result.value) };
};

const yearFingerprintFromCanonical = (canonical: string): YearFingerprint => {
  return makeYearFingerprintFromCanonical(canonical);
};

const toCommittedYearPayload = (value: string | undefined): CommittedPayload<string, string, YearFingerprint> => {
  const canonical = value ?? '';
  return {
    model: canonical,
    canonical,
    fingerprint: yearFingerprintFromCanonical(canonical),
  };
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
    const isLooseTable = grid.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'rgba(0, 0, 0, 0.12)' : 'transparent';

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
    const latestCommittedPayloadRef = React.useRef<CommittedPayload<string, string, YearFingerprint>>(toCommittedYearPayload(value));

    const configErrorMessage = React.useMemo(() => {
      if (minYear !== undefined && !Number.isFinite(minYear)) return 'Ugyldig konfiguration: minYear skal være et tal';
      if (maxYear !== undefined && !Number.isFinite(maxYear)) return 'Ugyldig konfiguration: maxYear skal være et tal';
      if (typeof minYear === 'number' && typeof maxYear === 'number' && minYear > maxYear) return 'Ugyldig konfiguration: minYear er større end maxYear';
      return '';
    }, [maxYear, minYear]);

    if (configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked, minYear, maxYear, twoDigitYearPolicy });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked, minYear, maxYear, twoDigitYearPolicy };
    }, [locked, maxYear, minYear, onBlur, onChange, onErrorChange, twoDigitYearPolicy]);

    React.useEffect(() => {
      latestCommittedPayloadRef.current = toCommittedYearPayload(value);
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
        const normalized = normalizeTableDraftOnCommit(rawDraft);
        const committed = commitYearDraft(normalized, {
          minYear: latest.current.minYear,
          maxYear: latest.current.maxYear,
          twoDigitYearPolicy: latest.current.twoDigitYearPolicy,
        });

        if (committed.kind === 'input-error') {
          setPreserveInvalidDraft(true);
          setHasError(true);
          setErrorMessage(committed.errorMessage);
          latest.current.onErrorChange?.({ hasError: true, kind: 'input' });
          return false;
        }

        setPreserveInvalidDraft(false);
        setHasError(false);
        setErrorMessage('');
        latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
        const canonical = committedToString(committed);
        const nextPayload: CommittedPayload<string, string, YearFingerprint> = {
          model: canonical,
          canonical,
          fingerprint: yearFingerprintFromCanonical(canonical),
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
        const nextDraft = String(e.target.value ?? '').slice(0, MAX_YEAR_DRAFT_LENGTH);
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
        // Filtrér kun under edit-mode (arvet fra StyledYearFieldNext)
        if (!isEditing) return;
        filterYearKeyDown(e);
      },
      [isEditing]
    );

    const a11yErrorId = React.useId();
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || (touched && hasError)) && !isFocused;
    const tooltipText = hasExternalError ? externalErrorText : errorMessage;
    const showDraftWhenError = !isEditing && (preserveInvalidDraft || (touched && hasError));

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
          grid.closeEditing();
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
          grid.closeEditing();
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
        selectAll: () => requestAnimationFrame(() => inputElRef.current?.select()),
      };
    }, [commitAndEmitBlur, grid]);

    React.useEffect(() => {
      grid.registerEditor(gridCell, editorHandle);
      return () => grid.unregisterEditor(gridCell);
    }, [editorHandle, grid, gridCell]);

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%' }}>
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



