import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { integerAdmission } from '../../../components/inputs/draftAdmission';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';
import { resolveIntegerCharPolicy } from './charLengthPolicy';

// Heltals-felt (§2.4/§3.5): den tynde familie-skal over `NumericTextField` med heltals-
// tegnfilteret. Parse/format ejes af descriptorens heltals-codec; komponenten modtager KUN sin `field`/`location`
// + rendering-props – ingen `minValue`/`maxValue`/`onCommit`/`onFieldError` (§2.4). Feltets min/max er efter
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
    // Fortegn OG cifferloft kommer fra descriptorens codec gennem den DELTE resolver – samme kilde som
    // grid-cellen. Cifferloftet var før valgfrit, og 8 af 12 heltalsfelter havde derfor ingen grænse.
    const { allowNegative, maxDigits, maxDraftLength } = resolveIntegerCharPolicy(field);
    const admission = React.useMemo(
      () => integerAdmission({ allowNegative, maxDigits }),
      [allowNegative, maxDigits]
    );
    return (
      <NumericTextField
        ref={ref}
        field={field}
        location={location}
        admission={admission}
        name={name}
        width={width}
        placeholder={placeholder}
        disabled={disabled}
        singleStageClick={singleStageClick}
        maxDraftLength={maxDraftLength}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

IntegerField.displayName = 'IntegerField';

export default IntegerField;
