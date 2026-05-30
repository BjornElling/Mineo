import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import { createWeekTableInputAdapter, type TableYearPolicy, useTableInputCore } from '../../../hooks/tableInput';

export type TableWeekInputChangeEvent = { target: { value: string } };

export type TableWeekInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: string | undefined;
  minYear?: number;
  maxYear?: number;
  /**
   * Policy for interpreting 1-2 digit years on commit.
   *
   * Default: `infer` (via `interpretYear`).
   */
  twoDigitYearPolicy?: TableYearPolicy;
  placeholder?: string;
  onChange?: (e: TableWeekInputChangeEvent) => void;
  onBlur?: (e: TableWeekInputChangeEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TableWeekInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    minYear,
    maxYear,
    twoDigitYearPolicy = 'infer',
    placeholder = 'uu/åååå',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableWeekInputProps) => {
    const gridApi = useGridCoreApi();

    const configErrorMessage = React.useMemo(() => {
      if (minYear !== undefined && !Number.isFinite(minYear)) return 'Ugyldig konfiguration: minYear skal være et tal';
      if (maxYear !== undefined && !Number.isFinite(maxYear)) return 'Ugyldig konfiguration: maxYear skal være et tal';
      if (typeof minYear === 'number' && typeof maxYear === 'number' && minYear > maxYear) return 'Ugyldig konfiguration: minYear er større end maxYear';
      return '';
    }, [maxYear, minYear]);

    if (configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const adapter = React.useMemo(
      () => createWeekTableInputAdapter({ minYear, maxYear, twoDigitYearPolicy }),
      [maxYear, minYear, twoDigitYearPolicy]
    );

    const core = useTableInputCore({
      adapter,
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
            onCopy={core.handleCopy}
            placeholder={core.cellFocused && !core.isReadOnly ? '' : placeholder}
            inputProps={{
              id: core.a11yInputId,
              name: core.htmlInputName,
              readOnly: core.isReadOnly,
              tabIndex: locked ? -1 : undefined,
              inputMode: 'numeric',
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
              ...(core.cellFocused ? { outline: 'none' } : {}),
              '& .MuiInputBase-input': {
                ...getTableInputElementStyles({
                  textAlign: 'center',
                  cursor: core.isEditing ? 'text' : 'pointer',
                  caretColor: core.isEditing ? 'auto' : 'transparent',
                }),
              },
              ...sx,
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

TableWeekInput.displayName = 'TableWeekInput';

export default TableWeekInput;
