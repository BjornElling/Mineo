import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { useGridCoreApi } from '../../tables/useGridCore';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import { createIntegerTableInputAdapter, useTableInputCore } from '../../../hooks/tableInput';

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

const requiredDigits = (n: number): number => Math.abs(Math.trunc(n)).toString().length;

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

    const adapter = React.useMemo(
      () => createIntegerTableInputAdapter({ minValue, maxValue, maxDigits, enforceRange }),
      [enforceRange, maxDigits, maxValue, minValue]
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

TableIntegerInput.displayName = 'TableIntegerInput';

export default TableIntegerInput;
