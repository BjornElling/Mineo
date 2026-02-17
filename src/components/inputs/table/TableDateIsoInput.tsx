import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ISODateString } from '../../../types/branded';
import { coerceToDanishDateString, coerceToISODateString } from '../../../types/branded';
import type { GridCellCoord } from '../../tables/gridCoreTypes';
import type { DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import TableDateInput from './TableDateInput';
import type { TableInputErrorInfo } from './tableInputContracts';

/**
 * TableDateIsoInput is the canonical adapter for table rows that persist ISO dates
 * while reusing TableDateInput's Danish draft/commit UX.
 *
 * Keep this adapter until/unless TableDateInput gains a first-class ISO model mode.
 */
type IsoCommitEvent = Readonly<{ target: { value: ISODateString | undefined } }>;
type DraftEvent = Readonly<{ target: { value: string } }>;

export type TableDateIsoInputProps = Readonly<{
  gridCell: GridCellCoord;
  locked?: boolean;
  value?: ISODateString;
  minDate?: ISODateString;
  maxDate?: ISODateString;
  specialRangeErrors?: DateRangeSpecialErrors;
  noValidRangeCause?: string;
  twoDigitYearPolicy?: 'reject' | 'infer' | 'assume20xx';
  placeholder?: string;
  onChange?: (e: DraftEvent) => void;
  onBlur?: (e: IsoCommitEvent) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const TableDateIsoInput = React.memo(
  ({
    gridCell,
    locked = false,
    value,
    minDate,
    maxDate,
    specialRangeErrors,
    noValidRangeCause,
    twoDigitYearPolicy = 'infer',
    placeholder = '',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableDateIsoInputProps) => {
    const configErrorMessage = React.useMemo(() => {
      if (minDate && maxDate && minDate > maxDate) {
        const minText = coerceToDanishDateString(minDate) ?? minDate;
        const maxText = coerceToDanishDateString(maxDate) ?? maxDate;
        const causeSuffix =
          typeof noValidRangeCause === 'string' && noValidRangeCause.trim() !== ''
            ? ` Årsag: ${noValidRangeCause.trim()}`
            : ' Kontrollér de felter der bestemmer datointervallet.';
        return `Ingen gyldige datoer: min-dato (${minText}) er efter max-dato (${maxText}).${causeSuffix}`;
      }
      return '';
    }, [maxDate, minDate, noValidRangeCause]);

    const mergedExternalErrorMessage = React.useMemo(() => {
      const external = (externalErrorMessage ?? '').trim();
      if (configErrorMessage === '') return external;
      if (external === '') return configErrorMessage;
      return `${configErrorMessage}; ${external}`;
    }, [configErrorMessage, externalErrorMessage]);

    const displayValue = React.useMemo(() => {
      return coerceToDanishDateString(value) ?? '';
    }, [value]);

    return (
      <TableDateInput
        gridCell={gridCell}
        locked={locked}
        value={displayValue}
        minDate={configErrorMessage === '' ? minDate : undefined}
        maxDate={configErrorMessage === '' ? maxDate : undefined}
        specialRangeErrors={specialRangeErrors}
        noValidRangeCause={noValidRangeCause}
        twoDigitYearPolicy={twoDigitYearPolicy}
        placeholder={placeholder}
        onChange={onChange}
        onBlur={(e) => {
          const nextRaw = e.target.value ?? '';
          const nextIso = coerceToISODateString(nextRaw) ?? undefined;
          onBlur?.({ target: { value: nextIso } });
        }}
        onErrorChange={onErrorChange}
        externalErrorMessage={mergedExternalErrorMessage}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

TableDateIsoInput.displayName = 'TableDateIsoInput';

export default TableDateIsoInput;
