import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../../../components/inputs/StyledTextFieldBase';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFormFieldSurface } from '../useFormFieldSurface';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';

// Greenfield numerisk tekst-felt (§2.4/§3.5): den delte TYNDE skal for alle single-`<input>` numeriske
// codec-familier (år, heltal, beløb, procent, brøk, uge). Præcis som `GreenfieldDateField`, men med et
// familiespecifikt tegnfilter givet ind som prop i stedet for hardcodet. Parse/format/paste-normalisering
// ejes af descriptorens codec; commit-intervaller og tværgående bounds er FELTVALIDATORER (Fase 3), ikke
// props. Komponenten modtager kun sin `field`/`location` + rendering-props (§2.4).

export type GreenfieldNumericTextFieldProps<T> = Readonly<{
  field: FieldRef<T>;
  location: EditorLocation;
  /** Familiespecifikt tegnfilter i åben editor (fx `filterYearKeyDown`). */
  keyFilter: (e: React.KeyboardEvent<HTMLInputElement>) => void;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  /** Draft-maks under indtastning (eftergivende over den kanoniske form). */
  maxDraftLength?: number;
  /** Centrér teksten (default sandt — matcher legacy numeriske felter). */
  centerText?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const GreenfieldNumericTextFieldInner = <T,>(
  {
    field,
    location,
    keyFilter,
    name,
    width = 130,
    placeholder,
    disabled,
    singleStageClick = false,
    maxDraftLength,
    centerText = true,
    inputRef,
    sx,
  }: GreenfieldNumericTextFieldProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
): React.ReactElement => {
  const surface = useFormFieldSurface(field, location, {
    disabled,
    singleStageClick,
    keyFilter,
    // Gate tegnfilteret, når feltet har en aktiv rød fejl, så brugeren kan rette den fejlende råtekst frit.
    gateKeyFilterOnIssue: true,
    setPasteCaret: true,
  });

  const surfaceInputRef = surface.inputElementRef;
  const assignInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      assignRef(surfaceInputRef, node);
      assignRef(inputRef, node);
    },
    [inputRef, surfaceInputRef]
  );

  const hasError = surface.issue !== undefined;

  return (
    <StyledTextFieldBase
      ref={ref}
      name={name}
      draft={surface.displayText}
      onDraftChange={surface.onDraftChange}
      inputRef={assignInputRef}
      onFocus={surface.onFocus}
      onBlur={surface.onBlur}
      onKeyDown={surface.onKeyDown}
      onMouseDown={surface.onMouseDown}
      onClick={surface.onClick}
      onPaste={surface.onPaste}
      placeholder={placeholder}
      width={width}
      disabled={disabled}
      error={hasError}
      helperText={surface.issue?.message ?? ''}
      htmlInputAttributes={{
        inputMode: 'numeric',
        ...(maxDraftLength === undefined ? {} : { maxLength: maxDraftLength }),
        readOnly: surface.readOnly,
      }}
      sx={mergeSx({
        '& .MuiInputBase-input': {
          ...(centerText ? { textAlign: 'center' } : {}),
          caretColor: surface.isOpen ? 'auto' : 'transparent',
          cursor: surface.isOpen ? 'text' : 'pointer',
        },
      }, sx)}
    />
  );
};

// forwardRef bevarer den generiske `T` via en cast af den generiske inner-komponent.
const GreenfieldNumericTextField = React.forwardRef(GreenfieldNumericTextFieldInner) as <T>(
  props: GreenfieldNumericTextFieldProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

export default GreenfieldNumericTextField;
