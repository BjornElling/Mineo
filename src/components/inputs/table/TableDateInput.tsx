import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { coerceToDanishDateString, coerceToISODateString } from '../../../types/branded';
import type { DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import { useGridCoreApi } from '../../tables/useGridCore';
import { visuallyHiddenStyle } from '../../shared/visuallyHiddenStyle';
import { getTableInputElementStyles, getTableInputRootStyles } from './tableInputStyles';
import {
  createDateTableInputAdapter,
  sanitizeTableDateDraft,
  type TableYearPolicy,
  useTableInputCore,
} from '../../../hooks/tableInput';

export type TableDateInputChangeEvent = { target: { value: string } };
export type TableDateSanitizeCallback = (value: string) => string;

export type TableDateInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: string;
  minDate?: string;
  maxDate?: string;
  specialRangeErrors?: DateRangeSpecialErrors;
  /**
   * Optional human-readable explanation of which other inputs determine the min/max bounds.
   *
   * Used when there are no valid dates because `minDate > maxDate`.
   * This must reference concrete user-visible inputs (e.g. "Dato til i samme række", etc.).
   */
  noValidRangeCause?: string;
  /**
   * Policy for interpreting 1-2 digit years on commit.
   *
   * Default: `infer` (via `interpretYear`).
   */
  twoDigitYearPolicy?: TableYearPolicy;
  placeholder?: string;

  /**
   * Draft change (typing only).
   */
  onChange?: (e: TableDateInputChangeEvent) => void;

  /**
   * Commit attempt (blur only).
   * Emits the committed value only when commit succeeds.
   * Invalid input or config errors stay local (error state) and do not update parent value.
   * Range violations never block commit (they only show a validation error).
   */
  onBlur?: (e: TableDateInputChangeEvent) => void;

  onErrorChange?: (info: TableInputErrorInfo) => void;
  onRegisterSanitize?: (sanitize: TableDateSanitizeCallback) => void;
  externalErrorMessage?: string;

  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TableDateInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    onBlur,
    onErrorChange,
    onRegisterSanitize,
    minDate,
    maxDate,
    specialRangeErrors,
    noValidRangeCause,
    twoDigitYearPolicy = 'infer',
    placeholder = '',
    externalErrorMessage,
    inputRef,
    sx,
  }: TableDateInputProps) => {
    const gridApi = useGridCoreApi();
    const isLooseTable = gridApi.tableKind === 'loose';
    const inputBorderRadius = isLooseTable ? '10px' : '0px';
    const inputBorderColor = isLooseTable ? 'var(--color-input-border)' : 'transparent';

    const boundsStatus = React.useMemo(() => {
      if (minDate !== undefined && coerceToISODateString(minDate) === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: minDate er ikke en dato (${String(minDate)})` };
      }
      if (maxDate !== undefined && coerceToISODateString(maxDate) === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: maxDate er ikke en dato (${String(maxDate)})` };
      }

      const normalizedMin = minDate ? coerceToISODateString(minDate) : undefined;
      const normalizedMax = maxDate ? coerceToISODateString(maxDate) : undefined;
      if (normalizedMin && normalizedMax && normalizedMin > normalizedMax) {
        const minText = coerceToDanishDateString(normalizedMin) ?? normalizedMin;
        const maxText = coerceToDanishDateString(normalizedMax) ?? normalizedMax;
        const causeSuffix =
          typeof noValidRangeCause === 'string' && noValidRangeCause.trim() !== ''
            ? ` Årsag: ${noValidRangeCause.trim()}`
            : ' Kontrollér de felter der bestemmer datointervallet.';
        return {
          kind: 'no-valid-range' as const,
          message: `Ingen gyldige datoer: min-dato (${minText}) er efter max-dato (${maxText}).${causeSuffix}`,
        };
      }

      return { kind: 'ok' as const };
    }, [maxDate, minDate, noValidRangeCause]);

    if (boundsStatus.kind === 'hard-config') {
      throw new Error(boundsStatus.message);
    }

    const configErrorMessage = boundsStatus.kind === 'no-valid-range' ? boundsStatus.message : '';
    const effectiveMinDate = configErrorMessage === '' ? minDate : undefined;
    const effectiveMaxDate = configErrorMessage === '' ? maxDate : undefined;

    const adapter = React.useMemo(
      () =>
        createDateTableInputAdapter({
          minDate: effectiveMinDate,
          maxDate: effectiveMaxDate,
          specialRangeErrors,
          twoDigitYearPolicy,
        }),
      [effectiveMaxDate, effectiveMinDate, specialRangeErrors, twoDigitYearPolicy]
    );

    const core = useTableInputCore({
      adapter,
      gridCell,
      value: value ?? '',
      locked,
      onBlur,
      onErrorChange,
      inputRef,
    });

    const sanitizeValue: TableDateSanitizeCallback = React.useCallback(
      (rawValue) => sanitizeTableDateDraft(rawValue, { twoDigitYearPolicy }),
      [twoDigitYearPolicy]
    );

    React.useEffect(() => {
      onRegisterSanitize?.(sanitizeValue);
    }, [onRegisterSanitize, sanitizeValue]);

    const lastReportedErrorInfoRef = React.useRef<string | null>(null);
    React.useEffect(() => {
      if (!onErrorChange) return;
      const kind: TableInputErrorInfo['kind'] = configErrorMessage !== '' ? 'config' : core.hasError ? 'input' : 'none';
      const nextErrorInfoKey = `${kind}:${kind !== 'none' ? '1' : '0'}`;
      if (lastReportedErrorInfoRef.current === nextErrorInfoKey) return;
      lastReportedErrorInfoRef.current = nextErrorInfoKey;
      onErrorChange({ hasError: kind !== 'none', kind });
    }, [configErrorMessage, core.hasError, onErrorChange]);

    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    const showError = (hasExternalError || configErrorMessage !== '' || (core.touched && core.hasError)) && !core.isFocused;
    const tooltipText = hasExternalError ? externalErrorText : configErrorMessage !== '' ? configErrorMessage : core.errorMessage;

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        <span style={{ display: 'block', width: '100%', height: '100%' }}>
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
              readOnly: core.isReadOnly,
              tabIndex: locked ? -1 : undefined,
              inputMode: 'text',
              'data-mineo-grid-locked': locked ? 'true' : undefined,
              'data-mineo-undo-focus-token': core.undoFocusToken,
              'data-mineo-undo-field-path': core.gridCellKey ?? undefined,
              'aria-describedby': showError ? core.a11yErrorId : undefined,
            }}
            sx={{
              ...getTableInputRootStyles({
                showError,
                isLooseTable,
                locked,
                borderRadius: inputBorderRadius,
                borderColor: inputBorderColor,
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
          {showError ? (
            <span id={core.a11yErrorId} style={visuallyHiddenStyle}>
              {tooltipText}
            </span>
          ) : null}
        </span>
      </Tooltip>
    );
  }
);

TableDateInput.displayName = 'TableDateInput';

export default TableDateInput;
