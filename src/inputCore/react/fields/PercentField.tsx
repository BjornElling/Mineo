import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { percentAdmission } from '../../../components/inputs/draftAdmission';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_PERCENT_PLACEHOLDER } from '../../../utils/percentInputUtils';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import type { FieldIssue } from '../../inputIssue';
import NumericTextField from './NumericTextField';
import StyledTextFieldBase from '../../../components/inputs/StyledTextFieldBase';
import { formatPercentDisplay } from '../../../utils/percentDraftCore';
import type { FieldWarning } from '../../fieldWarning';
import { resolvePercentCharPolicy } from './charLengthPolicy';
import { mergeSx } from '../../../utils/mergeSx';

// Procent-felt (§2.4/§3.5): familie-skal over `NumericTextField` med procent-tegnfilteret,
// den delte "%"-enheds-adornment (muted når tom) og højrestillet tabular-nums-visning. Parse/format og
// commit-intervallet ejes af descriptorens procent-codec (§samlet input-enhed). Komponenten modtager KUN sin
// `field`/`location` + rendering-props – ingen `minValue`/`maxValue`/`onCommit`/`onFieldError`/`enforceRange` (§2.4).

export type PercentFieldProps = Readonly<{
  field: FieldRef<number | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  /** Kryds-felt-domæneregel-issue; descriptorens eget issue har forrang (§1.8). */
  crossFieldIssue?: FieldIssue;
  warning?: FieldWarning;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const PercentField = React.forwardRef<HTMLDivElement, PercentFieldProps>(
  (
    {
      field,
      location,
      name,
      width = 100,
      placeholder = DEFAULT_PERCENT_PLACEHOLDER,
      disabled,
      singleStageClick = false,
      crossFieldIssue,
      warning,
      inputRef,
      sx,
    },
    ref
  ) => {
    // Tegn- og længdepolitikken kommer fra descriptorens codec gennem den DELTE `resolvePercentCharPolicy`
    // – samme kilde som grid-cellen. Alle procent-descriptorer er ikke-negative, og komponenten svarede
    // tidligere `true` i strid med dem, så et minus kunne tastes som første tegn.
    const { allowNegative, allowDecimals, maxIntegerDigits, maxDraftLength } =
      resolvePercentCharPolicy(field);
    const admission = React.useMemo(
      () => percentAdmission({ allowNegative, allowDecimals, maxIntegerDigits }),
      [allowDecimals, allowNegative, maxIntegerDigits]
    );

    // Adornmentet mutes, når draften er tom. Muted-flaget kommer fra `NumericTextField`s
    // ÉNE editor-controller via render-prop – vi opretter aldrig en anden surface/controller for samme felt.
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
        textAlign="right"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        maxDraftLength={maxDraftLength}
        endAdornment={({ isDraftEmpty }) => (
          <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={isDraftEmpty} />
        )}
        {...(crossFieldIssue === undefined ? {} : { crossFieldIssue })}
        {...(warning === undefined ? {} : { warning })}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

PercentField.displayName = 'PercentField';

/** Låst procentvisning for rent afledte værdier uden et persisteret `FieldRef`. */
export const DerivedPercentField = React.forwardRef<HTMLDivElement, Readonly<{
  value: number | undefined;
  name?: string;
  placeholder?: string;
  sx?: SxProps<Theme>;
}>>(({ value, name, placeholder = DEFAULT_PERCENT_PLACEHOLDER, sx }, ref) => (
  <StyledTextFieldBase
    ref={ref}
    accessibleName="Beregnet procent"
    name={name}
    draft={formatPercentDisplay(value, true)}
    onDraftChange={() => undefined}
    placeholder={placeholder}
    disabled
    disabledAppearance="locked"
    endAdornment={<InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={value === undefined} />}
    htmlInputAttributes={{ readOnly: true }}
    width={100}
    sx={mergeSx({
      '& .MuiInputBase-input': {
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
      },
    }, sx)}
  />
));
DerivedPercentField.displayName = 'DerivedPercentField';

export default PercentField;
