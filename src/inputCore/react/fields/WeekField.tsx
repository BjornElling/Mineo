import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { weekAdmission } from '../../../components/inputs/draftAdmission';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';
import { WEEK_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';
import { resolveFormLengthPolicy } from './charLengthPolicy';

// Uge-felt (§2.4/§3.5): familie-skal over `NumericTextField` med ugefamiliens tegnfilter
// (`WW-YYYY`). Parse/format/paste og uge-/år-commit-intervallet ejes af descriptorens uge-codec; komponenten
// modtager KUN sin `field`/`location` + rendering-props (§2.4). Værditypen er den string-backede uge-repræsentation.

// Draftloftet er erklæret på uge-codecet (`maxDraftLength`) og læses gennem den DELTE resolver, så
// formularfeltet og grid-cellen ikke kan håndhæve hver sin længde. Tallet stod før hardkodet her (8),
// mens grid-cellen slet ingen havde.
const WEEK_ADMISSION = weekAdmission();

export type WeekFieldProps = Readonly<{
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

const WeekField = React.forwardRef<HTMLDivElement, WeekFieldProps>(
  ({ field, location, name, width = 110, placeholder = WEEK_FORMAT_PLACEHOLDER, disabled, singleStageClick = false, inputRef, sx }, ref) => (
    <NumericTextField<string | undefined>
      ref={ref}
      field={field}
      location={location}
      admission={WEEK_ADMISSION}
      name={name}
      width={width}
      placeholder={placeholder}
      disabled={disabled}
      singleStageClick={singleStageClick}
      maxDraftLength={resolveFormLengthPolicy(field).maxDraftLength}
      inputRef={inputRef}
      sx={sx}
    />
  )
);

WeekField.displayName = 'WeekField';

export default WeekField;
