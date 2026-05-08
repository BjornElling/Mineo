import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { copyWholeValueFromReadOnlyField } from '../../../utils/clipboardUtils';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import { useGridCoreApi } from '../../tables/useGridCore';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import {
  createAmountTableInputAdapter,
  type TableAmountInputValue,
  useTableInputCore,
} from '../../../hooks/tableInput';

export type { TableAmountInputValue };

export type TableAmountInputChangeEvent = { target: { value: string } };
export type TableAmountInputCommitEvent = { target: { value: TableAmountInputValue } };

export type TableAmountInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  /**
   * Table cell values persist as committed amount values.
   */
  value?: TableAmountInputValue;
  /**
   * Column policy: whether negative values are allowed.
   *
   * Default: true.
   */
  canBeNegative?: boolean;
  placeholder?: string;
  onChange?: (e: TableAmountInputChangeEvent) => void;
  onBlur?: (e: TableAmountInputCommitEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TableAmountInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    canBeNegative = true,
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableAmountInputProps) => {
    const gridApi = useGridCoreApi();
    const isLooseTable = gridApi.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';
    const skipClickSelectionRestoreRef = React.useRef(false);

    const adapter = React.useMemo(
      () => createAmountTableInputAdapter({ canBeNegative }),
      [canBeNegative]
    );

    const core = useTableInputCore({
      adapter,
      gridCell,
      value,
      locked,
      onChange,
      onBlur,
      onErrorChange,
      externalErrorMessage,
      inputRef,
    });

    React.useLayoutEffect(() => {
      if (!core.isEditing || core.keyInitiatedEdit || core.hasError) return;
      const shouldRestoreSelection = !skipClickSelectionRestoreRef.current;
      skipClickSelectionRestoreRef.current = false;
      if (value?.kind === 'expression' || !shouldRestoreSelection) return;
      const selectionStart = core.inputElRef.current?.selectionStart;
      const selectionEnd = core.inputElRef.current?.selectionEnd;
      if (typeof selectionStart !== 'number' || typeof selectionEnd !== 'number') return;
      const inputEl = core.inputElRef.current;
      if (!inputEl) return;
      try {
        inputEl.setSelectionRange(
          Math.min(selectionStart, inputEl.value.length),
          Math.min(selectionEnd, inputEl.value.length)
        );
      } catch {
        // Browseren kan afvise selection i sjældne timingtilfælde; edit-start er stadig gyldig.
      }
    }, [core.hasError, core.isEditing, core.inputElRef, core.keyInitiatedEdit, value]);

    const handleDoubleClick = React.useCallback(() => {
      skipClickSelectionRestoreRef.current = true;
    }, []);

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly: core.isReadOnly,
          value: core.renderedValue,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
      },
      [core.isReadOnly, core.renderedValue]
    );

    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%', ...sx }}>
        <Tooltip title={core.showError ? core.errorMessage : ''} arrow placement="top">
          <Box sx={{ width: '100%', height: '100%' }}>
            <InputBase
              inputRef={core.inputRefCallback}
              autoComplete="off"
              value={core.renderedValue}
              readOnly={core.isReadOnly}
              onChange={core.handleChange}
              onFocus={core.handleFocus}
              onBlur={core.handleBlur}
              onKeyDown={core.handleKeyDown}
              onPaste={core.handlePaste}
              onCopy={handleCopy}
              onDoubleClick={handleDoubleClick}
              placeholder={core.cellFocused && !core.isReadOnly ? '' : placeholder}
              inputProps={{
                readOnly: core.isReadOnly,
                tabIndex: locked ? -1 : undefined,
                inputMode: 'decimal',
                'data-mineo-grid-locked': locked ? 'true' : undefined,
                'data-mineo-undo-focus-token': core.undoFocusToken,
                'data-mineo-undo-field-path': core.gridCellKey ?? undefined,
                'aria-describedby': core.showError ? core.a11yErrorId : undefined,
              }}
              sx={{
                ...getTableInputRootStyles({
                  showError: core.showError,
                  isLooseTable,
                  locked,
                  borderRadius: inputBorderRadius,
                  borderColor: inputBorderColor,
                }),
                ...(core.cellFocused ? { outline: 'none' } : {}),
                '& .MuiInputBase-input': {
                  ...getTableInputElementStyles({
                    textAlign: 'right',
                    cursor: core.isEditing ? 'text' : 'pointer',
                    caretColor: core.isEditing ? 'auto' : 'transparent',
                  }),
                },
              }}
            />
            {core.showError ? (
              <span id={core.a11yErrorId} style={visuallyHiddenStyle}>
                {core.errorMessage}
              </span>
            ) : null}
            {value?.kind === 'expression' ? (
              <span
                className="mineo-expression-indicator"
                style={{
                  position: 'absolute',
                  right: 2,
                  bottom: 2,
                  fontSize: 8,
                  fontWeight: 700,
                  color: 'var(--color-grid-expression-indicator)',
                  pointerEvents: 'none',
                }}
              >
                fx
              </span>
            ) : null}
          </Box>
        </Tooltip>
      </Box>
    );
  }
);

TableAmountInput.displayName = 'TableAmountInput';

export default TableAmountInput;
