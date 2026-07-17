import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterPercentKeyDown } from '../../../components/inputs/inputKeyFilters';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_PERCENT_PLACEHOLDER } from '../../../utils/percentInputUtils';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import GreenfieldNumericTextField from './GreenfieldNumericTextField';

// Greenfield procent-felt (§2.4/§3.5): familie-skal over `GreenfieldNumericTextField` med procent-tegnfilteret,
// den delte "%"-enheds-adornment (muted når tom) og legacy højrestillet tabular-nums-visning. Parse/format og
// commit-intervallet ejes af descriptorens procent-codec (§samlet input-enhed). Komponenten modtager KUN sin
// `field`/`location` + rendering-props — ingen `minValue`/`maxValue`/`onCommit`/`onFieldError`/`enforceRange` (§2.4).

export type GreenfieldPercentFieldProps = Readonly<{
  field: FieldRef<number | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  /** Tillad negative under indtastning (default falsk — satsfelter er ikke-negative). */
  allowNegative?: boolean;
  /** Loft på heltalsdelen under indtastning (matcher legacy `maxIntegerPart`). */
  maxIntegerPart?: number;
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const GreenfieldPercentField = React.forwardRef<HTMLDivElement, GreenfieldPercentFieldProps>(
  (
    {
      field,
      location,
      name,
      width = 100,
      placeholder = DEFAULT_PERCENT_PLACEHOLDER,
      disabled,
      allowNegative = false,
      maxIntegerPart,
      singleStageClick = false,
      inputRef,
      sx,
    },
    ref
  ) => {
    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) =>
        filterPercentKeyDown(e, {
          allowNegative,
          allowDecimals: true,
          ...(maxIntegerPart === undefined ? {} : { maxIntegerPart }),
        }),
      [allowNegative, maxIntegerPart]
    );

    // Adornmentet mutes, når draften er tom (legacy-adfærd). Muted-flaget kommer fra `GreenfieldNumericTextField`s
    // ÉNE editor-controller via render-prop — vi opretter aldrig en anden surface/controller for samme felt.
    return (
      <GreenfieldNumericTextField
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
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

GreenfieldPercentField.displayName = 'GreenfieldPercentField';

export default GreenfieldPercentField;
