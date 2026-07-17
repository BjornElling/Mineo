import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { filterAmountExpressionKeyDown } from '../../../components/inputs/inputKeyFilters';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_AMOUNT_PLACEHOLDER, MAX_AMOUNT_RAW_LENGTH } from '../../../utils/amountInputUtils';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import GreenfieldNumericTextField from './GreenfieldNumericTextField';

// Greenfield beløbs-felt (§2.4/§3.5, samlet input-enhed): familie-skal over `GreenfieldNumericTextField` med
// beløbsudtryks-tegnfilteret, den delte "kr."-enheds-adornment (muted når tom) og et `fx`-udtryksmærke, når den
// committede værdi er et udtryk. Parse/format/paste og beløbsgrammatik ejes af descriptorens beløbs-codec.
// Komponenten modtager KUN sin `field`/`location` + rendering-props — ingen `value`/`onCommit`/`onFieldError` (§2.4).

export type GreenfieldAmountFieldProps = Readonly<{
  field: FieldRef<AmountValue | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  /** Tillad negative beløb under indtastning (default falsk). */
  allowNegative?: boolean;
  /** Tillad decimaler under indtastning (default sandt). */
  allowDecimals?: boolean;
  singleStageClick?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

/** Det lille `fx`-mærke, der vises i et beløbsfelt, hvis den committede værdi er et udtryk (legacy-visuel). */
const ExpressionIndicator = (): React.ReactElement => (
  <span
    className="mineo-expression-indicator"
    style={{
      position: 'absolute',
      right: 2,
      bottom: 2,
      fontSize: 8,
      fontWeight: 700,
      color: 'var(--mineo-color-placeholder)',
      pointerEvents: 'none',
    }}
  >
    fx
  </span>
);

const GreenfieldAmountField = React.forwardRef<HTMLDivElement, GreenfieldAmountFieldProps>(
  (
    {
      field,
      location,
      name,
      width = 120,
      placeholder = DEFAULT_AMOUNT_PLACEHOLDER,
      disabled,
      allowNegative = false,
      allowDecimals = true,
      singleStageClick = false,
      inputRef,
      sx,
    },
    ref
  ) => {
    const keyFilter = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => filterAmountExpressionKeyDown(e, { allowNegative, allowDecimals }),
      [allowNegative, allowDecimals]
    );

    return (
      <GreenfieldNumericTextField<AmountValue | undefined>
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
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        maxDraftLength={MAX_AMOUNT_RAW_LENGTH}
        endAdornment={({ isDraftEmpty, value }) => (
          <>
            <InputUnitAdornment unitSuffix={INPUT_UNIT_SUFFIX.currency} muted={isDraftEmpty} />
            {value?.kind === 'expression' ? <ExpressionIndicator /> : null}
          </>
        )}
        inputRef={inputRef}
        sx={sx}
      />
    );
  }
);

GreenfieldAmountField.displayName = 'GreenfieldAmountField';

export default GreenfieldAmountField;
