import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { fractionAdmission } from '../../../components/inputs/draftAdmission';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';
import { resolveFractionCharPolicy } from './charLengthPolicy';

// Brøk-felt (§2.4/§3.5): familie-skal over `NumericTextField` med brøk-tegnfilteret
// ("tæller/nævner"). Parse/format/normalisering ejes af descriptorens brøk-codec. Komponenten modtager kun sin
// `field`/`location`, rendering-props og en valgfri ekstern tværfeltfejl (forlig "begge udfyldt").

export type FractionFieldProps = Readonly<{
  field: FieldRef<string | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  /** Åbn editoren ved første klik uden forudgående fokus (touch/mobil) – som de øvrige feltfamilier. */
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const FractionField = React.forwardRef<HTMLDivElement, FractionFieldProps>(
  ({ field, location, name, width = 120, placeholder, disabled, singleStageClick = false, inputRef, sx }, ref) => {
    // Ciffergrænse og fortegn kommer fra descriptorens codec gennem den DELTE resolver. Komponenten
    // hardkodede før begge dele og satte slet intet råt længdeloft.
    const { allowNegative, maxDigits, maxDraftLength } = resolveFractionCharPolicy(field);
    const admission = React.useMemo(
      () => fractionAdmission({ maxDigits, allowNegative }),
      [maxDigits, allowNegative]
    );

    return (
      <NumericTextField<string | undefined>
        ref={ref}
        field={field}
        location={location}
        admission={admission}
        {...(name === undefined ? {} : { name })}
        width={width}
        {...(placeholder === undefined ? {} : { placeholder })}
        {...(disabled === undefined ? {} : { disabled })}
        singleStageClick={singleStageClick}
        maxDraftLength={maxDraftLength}
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
