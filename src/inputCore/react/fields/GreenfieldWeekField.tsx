import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterWeekKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import GreenfieldNumericTextField from './GreenfieldNumericTextField';

// Greenfield uge-felt (§2.4/§3.5): familie-skal over `GreenfieldNumericTextField` med ugefamiliens tegnfilter
// (`WW-YYYY`). Parse/format/paste og uge-/år-commit-intervallet ejes af descriptorens uge-codec; komponenten
// modtager KUN sin `field`/`location` + rendering-props (§2.4). Værditypen er den string-backede uge-repræsentation.

// `WW-YYYY` + lidt slæk til eftergivende typing.
const MAX_WEEK_DRAFT_LENGTH = 8;

export type GreenfieldWeekFieldProps = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const GreenfieldWeekField = React.forwardRef<HTMLDivElement, GreenfieldWeekFieldProps>(
  ({ field, location, name, width = 110, placeholder, disabled, singleStageClick = false, inputRef, sx }, ref) => (
    <GreenfieldNumericTextField<string | undefined>
      ref={ref}
      field={field}
      location={location}
      keyFilter={filterWeekKeyDown}
      name={name}
      width={width}
      placeholder={placeholder}
      disabled={disabled}
      singleStageClick={singleStageClick}
      maxDraftLength={MAX_WEEK_DRAFT_LENGTH}
      inputRef={inputRef}
      sx={sx}
    />
  )
);

GreenfieldWeekField.displayName = 'GreenfieldWeekField';

export default GreenfieldWeekField;
