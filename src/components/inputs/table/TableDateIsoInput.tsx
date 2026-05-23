import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import type { ISODateString } from '../../../types/branded';
import { coerceToDanishDateString, coerceToISODateString } from '../../../types/branded';
import type { GridCellCoord } from '../../tables/gridCore/gridCoreTypes';
import type { DateRangeSpecialErrors } from '../../../utils/dateRangeErrorMessages';
import TableDateInput from './TableDateInput';
import type { TableInputErrorInfo } from '../../../utils/tableInputContracts';

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
    placeholder = 'dd-mm-åååå',
    onChange,
    onBlur,
    onErrorChange,
    externalErrorMessage,
    inputRef,
    sx,
  }: TableDateIsoInputProps) => {
    const displayValue = React.useMemo(() => {
      return coerceToDanishDateString(value) ?? '';
    }, [value]);

    return (
      <TableDateInput
        gridCell={gridCell}
        locked={locked}
        value={displayValue}
        minDate={minDate}
        maxDate={maxDate}
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
        externalErrorMessage={externalErrorMessage}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

TableDateIsoInput.displayName = 'TableDateIsoInput';

export default TableDateIsoInput;
