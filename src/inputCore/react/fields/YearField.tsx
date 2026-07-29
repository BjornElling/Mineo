import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterYearKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';
import { YEAR_FORMAT_PLACEHOLDER } from '../../../utils/fieldFormatPlaceholders';

// år-felt (§2.4/§3.5): den tynde familie-skal over `NumericTextField` med årsfamiliens
// tegnfilter. Parse/format/paste ejes af descriptorens år-codec; komponenten modtager derfor KUN sin
// `field`/`location` + rendering-props — ingen `minYear`/`maxYear`/`onCommit`/`onFieldError` (§2.4). Satsårets
// min/maxYear er efter kravændringen 2026-07-18 en canonical bounds-feltvalidator; røde bounds-fejl kommer fra
// issue-snapshottet, og et velformet år uden for intervallet kan stadig gemmes i `.eo` (§1.6).

// Et år har højst 4 cifre; tillad et par ekstra draft-tegn til eftergivende typing (fx førende/efterfølgende ws).
const MAX_YEAR_DRAFT_LENGTH = 6;

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
    <NumericTextField
      ref={ref}
      field={field}
      location={location}
      keyFilter={filterYearKeyDown}
      name={name}
      width={width}
      placeholder={placeholder}
      disabled={disabled}
      singleStageClick={singleStageClick}
      maxDraftLength={MAX_YEAR_DRAFT_LENGTH}
      inputRef={inputRef}
      sx={sx}
    />
  )
);

YearField.displayName = 'YearField';

export default YearField;
