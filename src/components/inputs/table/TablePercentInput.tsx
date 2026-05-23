import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { copyWholeValueFromReadOnlyField } from '../../../utils/clipboardUtils';
import { DEFAULT_PERCENT_PLACEHOLDER, withPercentPlaceholderSuffix } from '../../../utils/percentInputUtils';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import { useGridCoreApi } from '../../tables/useGridCore';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import {
  createPercentTableInputAdapter,
  toPercentDisplayString,
  type TablePercentInputValue,
  useTableInputCore,
} from '../../../hooks/tableInput';

export type { TablePercentInputValue };

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
  allowDecimals?: boolean;
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
    const isLooseTable = gridApi.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';

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

    const committedValue = React.useMemo(
      () => toPercentDisplayString(value, allowDecimals),
      [allowDecimals, value]
    );
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

    const resolvedPlaceholder = React.useMemo(() => withPercentPlaceholderSuffix(placeholder), [placeholder]);
    const showDraftWhenError = !core.isEditing && core.touched && core.hasError;
    const readOnlyDisplayValue =
      showDraftWhenError || core.committedDisplayValue === ''
        ? showDraftWhenError
          ? core.draft
          : ''
        : `${core.committedDisplayValue} %`;
    const renderedValue = core.isEditing ? core.draft : readOnlyDisplayValue;

    const handleCopy = React.useCallback(
      (e: React.ClipboardEvent<HTMLInputElement>) => {
        copyWholeValueFromReadOnlyField(e, {
          isReadOnly: core.isReadOnly,
          value: renderedValue,
          selectionStart: e.currentTarget.selectionStart,
          selectionEnd: e.currentTarget.selectionEnd,
        });
      },
      [core.isReadOnly, renderedValue]
    );

    return (
      <Box sx={{ position: 'relative', width: '100%', height: '100%', ...sx }}>
        <Tooltip title={core.showError ? core.errorMessage : ''} arrow placement="top">
          <Box sx={{ width: '100%', height: '100%' }}>
            <InputBase
              inputRef={core.inputRefCallback}
              autoComplete="off"
              value={renderedValue}
              readOnly={core.isReadOnly}
              onChange={core.handleChange}
              onFocus={core.handleFocus}
              onBlur={core.handleBlur}
              onKeyDown={core.handleKeyDown}
              onPaste={core.handlePaste}
              onCopy={handleCopy}
              placeholder={core.cellFocused && !core.isReadOnly ? '' : resolvedPlaceholder}
              inputProps={{
                readOnly: core.isReadOnly,
                tabIndex: locked ? -1 : undefined,
                inputMode: allowDecimals ? 'decimal' : 'numeric',
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
