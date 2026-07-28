import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterPercentKeyDown } from '../../../components/inputs/inputKeyFilters';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_PERCENT_PLACEHOLDER } from '../../../utils/percentInputUtils';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import type { FieldIssue } from '../../inputIssue';
import NumericTextField from './NumericTextField';

// Greenfield procent-felt (§2.4/§3.5): familie-skal over `NumericTextField` med procent-tegnfilteret,
// den delte "%"-enheds-adornment (muted når tom) og legacy højrestillet tabular-nums-visning. Parse/format og
// commit-intervallet ejes af descriptorens procent-codec (§samlet input-enhed). Komponenten modtager KUN sin
// `field`/`location` + rendering-props — ingen `minValue`/`maxValue`/`onCommit`/`onFieldError`/`enforceRange` (§2.4).

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
      inputRef,
      sx,
    },
    ref
  ) => {
    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterPercentKeyDown(e, {
          allowNegative: true,
          allowDecimals: true,
        }),
      []
    );

    // Adornmentet mutes, når draften er tom (legacy-adfærd). Muted-flaget kommer fra `NumericTextField`s
    // ÉNE editor-controller via render-prop — vi opretter aldrig en anden surface/controller for samme felt.
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
        textAlign="right"
        inputMode="decimal"
        endAdornment={({ isDraftEmpty }) => (
          <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.percent} muted={isDraftEmpty} />
        )}
        {...(crossFieldIssue === undefined ? {} : { crossFieldIssue })}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

PercentField.displayName = 'PercentField';

export default PercentField;
