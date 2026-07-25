import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterFractionKeyDown } from '../../../components/inputs/inputKeyFilters';
import { DEFAULT_FRACTION_MAX_DIGITS } from '../../../utils/fraction';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';

// Greenfield brøk-felt (§2.4/§3.5): familie-skal over `NumericTextField` med brøk-tegnfilteret
// ("tæller/nævner"). Parse/format/normalisering ejes af descriptorens brøk-codec. Komponenten modtager kun sin
// `field`/`location` + rendering-props + en valgfri ekstern tværfelt-fejl (forlig "begge udfyldt"). Erstatter
// legacy `StyledFractionField` bundet til `usePersistedForm`.

export type FractionFieldProps = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  externalError?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const FractionField = React.forwardRef<HTMLDivElement, FractionFieldProps>(
  ({ field, location, name, width = 120, placeholder, disabled, externalError, inputRef, sx }, ref) => {
    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterFractionKeyDown(e, { maxDigits: DEFAULT_FRACTION_MAX_DIGITS, allowNegative: false }),
      []
    );

    return (
      <NumericTextField<string | undefined>
        ref={ref}
        field={field}
        location={location}
        keyFilter={keyFilter}
        {...(name === undefined ? {} : { name })}
        width={width}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(externalError === undefined ? {} : { externalError })}
        textAlign="center"
        inputMode="numeric"
        {...(inputRef === undefined ? {} : { inputRef })}
        {...(sx === undefined ? {} : { sx })}
      />
    );
  }
);

FractionField.displayName = 'FractionField';

export default FractionField;
