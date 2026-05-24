import * as React from 'react';
import { Box, InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { DEFAULT_PERCENT_PLACEHOLDER, withPercentPlaceholderSuffix } from '../../../utils/percentInputUtils';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import { useGridCoreApi } from '../../tables/useGridCore';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import {
  createPercentTableInputAdapter,
  useTableInputCore,
} from '../../../hooks/tableInput';
import { parsePercentDraftForCommit } from '../../../utils/percentDraftCore';

export type TablePercentInputValue = string | number | undefined;

export type TablePercentInputChangeEvent = { target: { value: string } };
export type TablePercentInputCommitEvent = { target: { value: number | undefined } };

export type TablePercentInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  /**
   * Existing table rows still persist percent cells as canonical display strings.
   * Internally the table-input adapter works with the numeric domain model.
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

    const committedValue = React.useMemo(() => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
      if (typeof value !== 'string' || value.trim() === '') return undefined;

      const trimmed = value.trim();
      const withoutPercentSuffix = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
      const parsed = parsePercentDraftForCommit(withoutPercentSuffix, {
        allowNegative: true,
        allowDecimals: true,
      });
      if (parsed.ok) return parsed.value;
      if (import.meta.env.DEV) {
        throw new Error(`Invariant brudt: committed procentværdi kan ikke parses (${value})`);
      }
      return undefined;
    }, [value]);
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
              onCopy={core.handleCopy}
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
