import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterIntegerKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';

// Heltals-felt (§2.4/§3.5): den tynde familie-skal over `NumericTextField` med heltals-
// tegnfilteret. Parse/format ejes af descriptorens heltals-codec; komponenten modtager KUN sin `field`/`location`
// + rendering-props — ingen `minValue`/`maxValue`/`onCommit`/`onFieldError` (§2.4). Feltets min/max er efter
// kravændringen 2026-07-18 en canonical bounds-feltvalidator; røde bounds-fejl kommer fra issue-snapshottet (§1.6).

export type IntegerFieldProps = Readonly<{
  field: FieldRef<number | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const IntegerField = React.forwardRef<HTMLDivElement, IntegerFieldProps>(
  ({ field, location, name, width = 130, placeholder, disabled, singleStageClick = false, inputRef, sx }, ref) => {
    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterIntegerKeyDown(e, { allowNegative: true }),
      []
    );
    return (
      <NumericTextField
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

IntegerField.displayName = 'IntegerField';

export default IntegerField;
