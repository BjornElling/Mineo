import * as React from 'react';
import { InputBase, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import { coerceToDanishDateString, coerceToISODateString } from '../../../types/branded';
import type { ISODateString } from '../../../types/branded';
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
export type TableDateInputCommitEvent = { target: { value: ISODateString | undefined } };
export type TableDateSanitizeCallback = (value: string) => ISODateString | undefined;

export type TableDateInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: ISODateString;
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
  onBlur?: (e: TableDateInputCommitEvent) => void;

  onErrorChange?: (info: TableInputErrorInfo) => void;
  onRegisterSanitize?: (sanitize: TableDateSanitizeCallback) => void;
  externalErrorMessage?: string;

  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const normalizeDateBoundConfig = (value: string | undefined): ISODateString | undefined => {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  return coerceToISODateString(trimmed);
};

const TableDateInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    onChange,
    onBlur,
    onErrorChange,
    onRegisterSanitize,
    minDate,
    maxDate,
    specialRangeErrors,
    noValidRangeCause,
    twoDigitYearPolicy = 'infer',
    placeholder = 'dd-mm-åååå',
    externalErrorMessage,
    inputRef,
    sx,
  }: TableDateInputProps) => {
    const gridApi = useGridCoreApi();

    const boundsStatus = React.useMemo(() => {
      const normalizedMin = normalizeDateBoundConfig(minDate);
      const normalizedMax = normalizeDateBoundConfig(maxDate);

      if (minDate !== undefined && minDate.trim() !== '' && normalizedMin === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: minDate er ikke en dato (${String(minDate)})` };
      }
      if (maxDate !== undefined && maxDate.trim() !== '' && normalizedMax === undefined) {
        return { kind: 'hard-config' as const, message: `Ugyldig konfiguration: maxDate er ikke en dato (${String(maxDate)})` };
      }

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
    const effectiveMinDate = configErrorMessage === '' ? normalizeDateBoundConfig(minDate) : undefined;
    const effectiveMaxDate = configErrorMessage === '' ? normalizeDateBoundConfig(maxDate) : undefined;

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
      value,
      locked,
      onChange,
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

    const lastReportedConfigErrorRef = React.useRef(false);
    React.useEffect(() => {
      if (!onErrorChange) return;
      const hasConfigError = configErrorMessage !== '';
      if (lastReportedConfigErrorRef.current === hasConfigError) return;
      lastReportedConfigErrorRef.current = hasConfigError;
      if (hasConfigError) {
        onErrorChange({ hasError: true, kind: 'config' });
        return;
      }
      onErrorChange(core.hasError ? { hasError: true, kind: core.errorKind } : { hasError: false, kind: 'none' });
    }, [configErrorMessage, core.errorKind, core.hasError, onErrorChange]);

    const externalErrorText = (externalErrorMessage ?? '').trim();
    const hasExternalError = externalErrorText !== '';
    // Date-specific config errors are produced outside core so invalid bounds can be shown even without a commit attempt.
    const showError = (hasExternalError || configErrorMessage !== '' || (core.touched && core.hasError)) && !core.isFocused;
    const tooltipText = hasExternalError ? externalErrorText : configErrorMessage !== '' ? configErrorMessage : core.errorMessage;

    return (
      <Tooltip title={showError ? tooltipText : ''} arrow placement="top">
        {/* Tooltip child stays a native span so table layout semantics are unaffected by a MUI Box wrapper. */}
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
            onDoubleClick={core.handleDoubleClick}
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
