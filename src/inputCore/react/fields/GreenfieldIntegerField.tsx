import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterIntegerKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import GreenfieldNumericTextField from './GreenfieldNumericTextField';

// Greenfield heltals-felt (§2.4/§3.5): den tynde familie-skal over `GreenfieldNumericTextField` med heltals-
// tegnfilteret. Parse/format og commit-intervallet (min/max → rejected `range`) ejes af descriptorens
// heltals-codec; komponenten modtager KUN sin `field`/`location` + rendering-props — ingen `minValue`/`maxValue`/
// `onCommit`/`onFieldError` (§2.4). Røde range-fejl kommer fra codec-`range` via issue-snapshottet.

export type GreenfieldIntegerFieldProps = Readonly<{
  field: FieldRef<number | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  /** Tegnfilter-loft under indtastning (matcher legacy `StyledIntegerField.maxValue`-guard). */
  maxKeyFilterValue?: number;
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const GreenfieldIntegerField = React.forwardRef<HTMLDivElement, GreenfieldIntegerFieldProps>(
  ({ field, location, name, width = 130, placeholder, disabled, maxKeyFilterValue, singleStageClick = false, inputRef, sx }, ref) => {
    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterIntegerKeyDown(e, { allowNegative: false, ...(maxKeyFilterValue === undefined ? {} : { maxValue: maxKeyFilterValue }) }),
      [maxKeyFilterValue]
    );
    return (
      <GreenfieldNumericTextField
        ref={ref}
        field={field}
        location={location}
        keyFilter={keyFilter}
        name={name}
        width={width}
        placeholder={placeholder}
        disabled={disabled}
        singleStageClick={singleStageClick}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

GreenfieldIntegerField.displayName = 'GreenfieldIntegerField';

export default GreenfieldIntegerField;
