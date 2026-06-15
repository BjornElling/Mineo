import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { DEFAULT_PERCENT_PLACEHOLDER } from '../../../utils/percentInputUtils';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../InputUnitAdornment';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import { useGridCoreApi } from '../../tables/useGridCore';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import {
  createPercentTableInputAdapter,
  type TablePercentInputModel,
  useTableInputCore,
} from '../../../hooks/tableInput';

export type TablePercentInputChangeEvent = { target: { value: string } };
export type TablePercentInputCommitEvent = { target: { value: number | undefined } };

export type TablePercentInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: TablePercentInputModel;
  allowNegative?: boolean;
  allowDecimals?: boolean;
  minValue?: number;
  maxValue?: number;
  /**
   * Default procent-interval (0-100). Anvendes kun når `minValue`/`maxValue` ikke er angivet.
   */
  useDefaultPercentRange?: boolean;
  placeholder?: string;
  onChange?: (e: TablePercentInputChangeEvent) => void;
  onBlur?: (e: TablePercentInputCommitEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

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
    placeholder = DEFAULT_PERCENT_PLACEHOLDER,
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TablePercentInputProps) => {
    const gridApi = useGridCoreApi();

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

    if (configErrorMessage.trim() !== '') {
      throw new Error(configErrorMessage);
    }

    const committedValue = typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    const adapter = React.useMemo(
      () =>
        createPercentTableInputAdapter({
          allowNegative,
          allowDecimals,
          minValue: effectiveMin,
          maxValue: effectiveMax,
        }),
      [allowDecimals, allowNegative, effectiveMax, effectiveMin]
    );

    const core = useTableInputCore({
      adapter,
      gridCell,
      value: committedValue,
      locked,
      onChange,
      onBlur,
      onErrorChange,
      externalErrorMessage,
      inputRef,
    });

    // Klik uden for selve <input> (på enheds-adornment eller cellens padding) skal fokusere inputtet,
    // så grid-aktiveringen åbner editoren — ligesom et klik direkte på inputtet.
    const inputElRef = core.inputElRef;
    const handleFieldMouseDown = React.useCallback(
      (e: React.MouseEvent) => {
        if (locked) return;
        if (e.target === inputElRef.current) return;
        e.preventDefault();
        inputElRef.current?.focus();
      },
      [inputElRef, locked]
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
              onCopy={core.handleCopy}
              onMouseDown={handleFieldMouseDown}
              endAdornment={
                <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={core.renderedValue === ''} />
              }
              placeholder={core.cellFocused && !core.isReadOnly ? '' : placeholder}
              inputProps={{
                id: core.a11yInputId,
                name: core.htmlInputName,
                readOnly: core.isReadOnly,
                tabIndex: locked ? -1 : undefined,
                inputMode: allowDecimals ? 'decimal' : 'numeric',
                'data-mineo-grid-locked': locked ? 'true' : undefined,
                'data-mineo-undo-focus-token': core.undoFocusToken,
                'data-mineo-undo-field-path': core.gridCellKey ?? undefined,
                'data-mineo-field-path': core.invalidDraftFieldPath ?? undefined,
                'aria-describedby': core.showError ? core.a11yErrorId : undefined,
              }}
              sx={{
                ...getTableInputRootStyles({
                  showError: core.showError,
                  tableKind: gridApi.tableKind,
                  locked,
                }),
                // Pegefinger over hele feltet (inkl. enheds-adornment) når det ikke redigeres.
                cursor: core.isEditing ? 'text' : 'pointer',
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
          </Box>
        </Tooltip>
      </Box>
    );
  }
);

TablePercentInput.displayName = 'TablePercentInput';

export default TablePercentInput;
