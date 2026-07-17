import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterYearKeyDown } from '../../../components/inputs/inputKeyFilters';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import GreenfieldNumericTextField from './GreenfieldNumericTextField';

// Greenfield år-felt (§2.4/§3.5): den tynde familie-skal over `GreenfieldNumericTextField` med årsfamiliens
// tegnfilter. Parse/format/paste og satsårets commit-interval (min/maxYear → rejected `range`) ejes af
// descriptorens år-codec; komponenten modtager derfor KUN sin `field`/`location` + rendering-props — ingen
// `minYear`/`maxYear`/`onCommit`/`onFieldError` (§2.4). Røde bounds-fejl kommer fra codec-`range` via issue-snapshottet.

// Et år har højst 4 cifre; tillad et par ekstra draft-tegn til eftergivende typing (fx førende/efterfølgende ws).
const MAX_YEAR_DRAFT_LENGTH = 6;

export type GreenfieldYearFieldProps = Readonly<{
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

const GreenfieldYearField = React.forwardRef<HTMLDivElement, GreenfieldYearFieldProps>(
  ({ field, location, name, width = 80, placeholder, disabled, singleStageClick = false, inputRef, sx }, ref) => (
    <GreenfieldNumericTextField
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

GreenfieldYearField.displayName = 'GreenfieldYearField';

export default GreenfieldYearField;
