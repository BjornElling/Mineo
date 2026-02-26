import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCore } from '../../tables/gridCoreContext';
import { areSameGridCell } from '../../tables/gridCoreUtils';
import type { GridCellCoord, GridCellEditorHandle } from '../../tables/gridCoreTypes';
import { assignRef } from './assignRef';
import type { TableInputErrorInfo } from './tableInputContracts';
import { trimWhitespaceEdges } from '../../../utils/draftNormalization';
import { makeStringFingerprintFromCanonical, type CommittedPayload, type StringFingerprint } from '../shared/parserSpec';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';

export type TableTextInputChangeEvent = { target: { value: string } };

export type TableTextInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: string;
  placeholder?: string;
  onChange?: (e: TableTextInputChangeEvent) => void;
  onBlur?: (e: TableTextInputChangeEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const toCommittedTextPayload = (value: string | undefined): CommittedPayload<string, string, StringFingerprint> => {
  const canonical = value ?? '';
  return {
    model: canonical,
    canonical,
    fingerprint: makeStringFingerprintFromCanonical(canonical),
  };
};

const TableTextInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableTextInputProps) => {
    const grid = useGridCore();
    const cellFocused = areSameGridCell(grid.focusedCell, gridCell);
    const isEditing = areSameGridCell(grid.editingCell, gridCell);
    const isReadOnly = locked || !isEditing;
    const isLooseTable = grid.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'rgba(0, 0, 0, 0.12)' : 'transparent';

    const [draft, setDraft] = React.useState<string>(() => value ?? '');
    const [isFocused, setIsFocused] = React.useState(false);
    const [touched, setTouched] = React.useState(false);
    const inputElRef = React.useRef<HTMLInputElement | null>(null);
    const draftRef = React.useRef<string>(draft);
    const originalValueOnEditStartRef = React.useRef<string>('');
    const keyInitiatedEditRef = React.useRef(false);
    const latestCommittedPayloadRef = React.useRef<CommittedPayload<string, string, StringFingerprint>>(toCommittedTextPayload(value));

    const latest = React.useRef({ onChange, onBlur, onErrorChange, locked });

    const emitBlur = React.useCallback((nextValue: string) => {
      latest.current.onBlur?.({ target: { value: nextValue } });
    }, []);

    React.useEffect(() => {
      latest.current = { onChange, onBlur, onErrorChange, locked };
    }, [locked, onBlur, onChange, onErrorChange]);

    React.useEffect(() => {
      latestCommittedPayloadRef.current = toCommittedTextPayload(value);
    }, [value]);

    React.useEffect(() => {
      draftRef.current = draft;
    }, [draft]);

    React.useEffect(() => {
      latest.current.onErrorChange?.({ hasError: false, kind: 'none' });
    }, []);

    React.useEffect(() => {
      if (!isEditing) {
        const inputEl = inputElRef.current;
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const hasPhysicalFocus =
          inputEl !== null &&
          activeEl !== null &&
          (activeEl === inputEl || (activeEl instanceof Node && inputEl.contains(activeEl)));
        if (hasPhysicalFocus) return;
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
      }
    }, [isEditing, value]);

    const commitAndEmitBlur = React.useCallback(
      (rawDraft: string): boolean => {
        setTouched(true);
        const canonical = trimWhitespaceEdges(rawDraft);
        const nextPayload: CommittedPayload<string, string, StringFingerprint> = {
          model: canonical,
          canonical,
          fingerprint: makeStringFingerprintFromCanonical(canonical),
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
        draftRef.current = nextDraft;
        setDraft(nextDraft);
        latest.current.onChange?.({ target: { value: nextDraft } });
      },
      [isReadOnly]
    );

    const handleFocus = React.useCallback(() => {
      setIsFocused(true);
    }, []);

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(false);
        const rawValue = isEditing ? (e.currentTarget.value ?? '') : draftRef.current;
        const committedValue = latestCommittedPayloadRef.current.canonical;
        if (!isEditing && trimWhitespaceEdges(rawValue) === committedValue) return;
        commitAndEmitBlur(rawValue);
      },
      [commitAndEmitBlur, isEditing]
    );

    const a11yInputId = React.useId();
    const a11yErrorId = `${a11yInputId}-error`;
    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = hasExternalError && !isFocused && (touched || !isEditing);

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
          setTouched(false);
          setDraft('');
          const ok = commitAndEmitBlur('');
          if (!ok) return;
          grid.closeEditing();
        },
        cancelEdit: () => {
          if (latest.current.locked) return;
          keyInitiatedEditRef.current = false;
          setTouched(false);
          setDraft(originalValueOnEditStartRef.current);
          grid.closeEditing();
        },
        prepareEditFromKey: (key: string) => {
          if (latest.current.locked) return false;
          if (key.length !== 1) return false;
          const committedValue = latestCommittedPayloadRef.current.canonical;
          originalValueOnEditStartRef.current = committedValue;
          keyInitiatedEditRef.current = true;
          setTouched(false);
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

    return (
      <Tooltip title={showError ? externalErrorText : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%', ...sx }}>
          <InputBase
            inputRef={(el) => {
              inputElRef.current = el;
              assignRef(inputRef, el);
            }}
            autoComplete="off"
            value={isEditing ? draft : (value ?? '')}
            readOnly={isReadOnly}
            disabled={locked}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
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
              font: 'inherit',
              fontSize: 'inherit',
              fontFamily: 'inherit',
              lineHeight: 'inherit',
              color: 'inherit',
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
                textAlign: 'left',
                cursor: isEditing ? 'text' : 'pointer',
                caretColor: isEditing ? 'auto' : 'transparent',
              },
            }}
          />
          {showError ? (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {externalErrorText}
            </span>
          ) : null}
        </Box>
      </Tooltip>
    );
  }
);

TableTextInput.displayName = 'TableTextInput';

export default TableTextInput;

