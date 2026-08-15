import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { yearAdmission } from '../../../components/inputs/draftAdmission';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';
import { YEAR_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';
import { resolveYearCharPolicy } from './charLengthPolicy';

// år-felt (§2.4/§3.5): den tynde familie-skal over `NumericTextField` med årsfamiliens
// tegnfilter. Parse/format/paste ejes af descriptorens år-codec; komponenten modtager derfor KUN sin
// `field`/`location` + rendering-props — ingen `minYear`/`maxYear`/`onCommit`/`onFieldError` (§2.4). Satsårets
// min/maxYear er efter kravændringen 2026-07-18 en canonical bounds-feltvalidator; røde bounds-fejl kommer fra
// issue-snapshottet, og et velformet år uden for intervallet kan stadig gemmes i `.eo` (§1.6).

const YEAR_ADMISSION = yearAdmission();

export type YearFieldProps = Readonly<{
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

const YearField = React.forwardRef<HTMLDivElement, YearFieldProps>(
  ({ field, location, name, width = 80, placeholder = YEAR_FORMAT_PLACEHOLDER, disabled, singleStageClick = false, inputRef, sx }, ref) => (
    // Cifferloftet kommer fra descriptorens codec gennem den DELTE resolver — samme kilde som
    // grid-cellen. Tallet stod før hardkodet her (4) og i `GridYearCell` som DATO-konstanten (16).
    <NumericTextField
      ref={ref}
      field={field}
      location={location}
      admission={YEAR_ADMISSION}
      name={name}
      width={width}
      placeholder={placeholder}
      disabled={disabled}
      singleStageClick={singleStageClick}
      maxDraftLength={resolveYearCharPolicy(field).maxDraftLength}
      inputRef={inputRef}
      sx={sx}
    />
  )
);

YearField.displayName = 'YearField';

export default YearField;
