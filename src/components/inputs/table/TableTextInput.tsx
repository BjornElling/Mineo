import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import { textTableInputAdapter, useTableInputCore } from '../../../hooks/tableInput';

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
    const gridApi = useGridCoreApi();
    const core = useTableInputCore({
      adapter: textTableInputAdapter,
      gridCell,
      value: value ?? '',
      locked,
      onChange,
      onBlur,
      onErrorChange,
      externalErrorMessage,
      inputRef,
    });

    return (
      <Tooltip title={core.showError ? core.errorMessage : ''} arrow placement="top">
        <Box sx={{ width: '100%', height: '100%', ...sx }}>
          <InputBase
            inputRef={core.inputRefCallback}
            autoComplete="off"
            value={core.renderedValue}
            readOnly={core.isReadOnly}
            onChange={core.handleChange}
            onFocus={core.handleFocus}
            onBlur={core.handleBlur}
            onCopy={core.handleCopy}
            placeholder={core.cellFocused && !core.isReadOnly ? '' : placeholder}
            inputProps={{
              id: core.a11yInputId,
              name: core.htmlInputName,
              readOnly: core.isReadOnly,
              tabIndex: locked ? -1 : undefined,
              inputMode: 'text',
              'data-mineo-grid-locked': locked ? 'true' : undefined,
              'data-mineo-undo-focus-token': core.undoFocusToken,
              'data-mineo-undo-field-path': core.gridCellKey ?? undefined,
              'aria-describedby': core.showError ? core.a11yErrorId : undefined,
            }}
            sx={{
              ...getTableInputRootStyles({
                showError: core.showError,
                  tableKind: gridApi.tableKind,
                  locked,
              }),
              '& .MuiInputBase-input': {
                ...getTableInputElementStyles({
                  textAlign: 'left',
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
        </Box>
      </Tooltip>
    );
  }
);

TableTextInput.displayName = 'TableTextInput';

export default TableTextInput;
