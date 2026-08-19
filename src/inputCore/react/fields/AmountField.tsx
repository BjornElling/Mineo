import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import { amountExpressionAdmission } from '../../../components/inputs/draftAdmission';
import { INPUT_UNIT_SUFFIX } from '../../../utils/inputUnit';
import InputUnitAdornment from '../../../components/inputs/InputUnitAdornment';
import { DEFAULT_AMOUNT_PLACEHOLDER, INTEGER_AMOUNT_PLACEHOLDER } from '../../../utils/amountInputUtils';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import NumericTextField from './NumericTextField';
import type { FieldWarning } from '../../fieldWarning';
import { resolveAmountCharPolicy } from './charLengthPolicy';

// Beløbs-felt (§2.4/§3.5, samlet input-enhed): familie-skal over `NumericTextField` med
// beløbsudtryks-tegnfilteret, den delte "kr."-enheds-adornment (muted når tom) og et `fx`-udtryksmærke, når den
// committede værdi er et udtryk. Parse/format/paste og beløbsgrammatik ejes af descriptorens beløbs-codec.
// Komponenten modtager KUN sin `field`/`location` + rendering-props – ingen `value`/`onCommit`/`onFieldError` (§2.4).

/**
 * Feltbredde for HELTALS-beløb i millionklassen – dimensioneret så syv cifre med tusindtalsseparatorer
 * står helt inde i feltet SAMMEN med den altid synlige " kr."-enhed. Bruges til felter med
 * `allowDecimals={false}`; der er ingen decimalhale at gøre plads til, fordi codec'en hverken tager imod
 * eller viser et komma i sådan et felt.
 *
 * Målt, ikke skønnet, på Montserrat 400 / 14px (temaets `MuiInputBase`-skrift) ud fra fontens egne
 * advance-bredder: det bredeste ciffer er `8`, så `8.888.888 kr.` er værste tilfælde med 89,1 px tekst.
 * MUI `size="small"` outlined lægger 14 px vandret padding i hver side oveni, altså ~117 px. `width` er
 * den YDRE bredde (jf. `StyledTextFieldBase`), så padding skal med i regnestykket. 130 giver de sidste
 * ~13 px som luft, så teksten ikke klistrer til rammen, og så en lidt bredere skrift ikke klipper.
 *
 * Brug denne frem for et lokalt tal, når to sider viser SAMME beløbsfelt: årslønsfelterne findes både på
 * Erhvervsevnetab og Forsørgertab, og de skal have samme bredde.
 */
export const MILLION_AMOUNT_FIELD_WIDTH = 130;

export type AmountFieldProps = Readonly<{
  field: FieldRef<AmountValue | undefined>;
  location: EditorLocation;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  warning?: FieldWarning;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

/** Det lille `fx`-mærke, der vises i et beløbsfelt, hvis den committede værdi er et udtryk. */
const ExpressionIndicator = (): React.ReactElement => (
  <span
    className="mineo-expression-indicator"
    style={{
      position: 'absolute',
      right: 2,
      bottom: 2,
      fontSize: 8,
      fontWeight: 700,
      color: 'var(--mineo-color-expression-indicator)',
      pointerEvents: 'none',
    }}
  >
    fx
  </span>
);

const AmountField = React.forwardRef<HTMLDivElement, AmountFieldProps>(
  (
    {
      field,
      location,
      name,
      width = 120,
      placeholder,
      disabled,
      singleStageClick = false,
      warning,
      inputRef,
      sx,
    },
    ref
  ) => {
    // Tegn- og længdepolitikken udledes af descriptorens codec gennem den DELTE `resolveAmountCharPolicy`,
    // så formularfeltet og grid-cellen ikke kan komme til at håndhæve forskellige grænser på samme felt.
    // For beløb rammer fortegnsfilteret KUN det unære minus (`containsUnaryMinusToken`), så subtraktion i
    // et udtryk – "5000-200" – forbliver lovlig også i et ikke-negativt felt.
    const policy = resolveAmountCharPolicy(field);
    const { allowNegative, allowDecimals, maxIntegerDigits, maxDecimalDigits, maxDraftLength } = policy;
    const admission = React.useMemo(
      () => amountExpressionAdmission({
        allowNegative,
        allowDecimals,
        maxIntegerDigits,
        maxDecimalDigits,
      }),
      [allowNegative, allowDecimals, maxIntegerDigits, maxDecimalDigits]
    );

    // Placeholderen følger `allowDecimals`, så et komma-frit felt ikke antyder en decimalhale. Et eksplicit
    // `placeholder` vinder stadig – kaldsstedet kan have en mere sigende prompt end blot et nul.
    const resolvedPlaceholder = placeholder
      ?? (allowDecimals ? DEFAULT_AMOUNT_PLACEHOLDER : INTEGER_AMOUNT_PLACEHOLDER);

    return (
      <NumericTextField<AmountValue | undefined>
        ref={ref}
        field={field}
        location={location}
        admission={admission}
        name={name}
        width={width}
        placeholder={resolvedPlaceholder}
        disabled={disabled}
        singleStageClick={singleStageClick}
        {...(warning === undefined ? {} : { warning })}
        textAlign="right"
        inputMode={allowDecimals ? 'decimal' : 'numeric'}
        maxDraftLength={maxDraftLength}
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

AmountField.displayName = 'AmountField';

export default AmountField;
