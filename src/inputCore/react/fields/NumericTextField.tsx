import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledTextFieldBase from '../../../components/inputs/StyledTextFieldBase';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import type { FieldIssue } from '../../inputIssue';
import { useFormFieldSurface } from '../useFormFieldSurface';
import { resolveFieldIssueText } from '../fieldIssueText';
import { assignRef } from '../../../utils/refUtils';
import { mergeSx } from '../../../utils/mergeSx';
import type { FieldWarning } from '../../fieldWarning';
import { keyFilterFromAdmission, type DraftAdmission } from '../../../components/inputs/draftAdmission';
import { useFieldLabel } from '../useFieldLabel';

// Numerisk tekst-felt (§2.4/§3.5): den delte TYNDE skal for alle single-`<input>` numeriske
// codec-familier (år, heltal, beløb, procent, brøk, uge). Præcis som `DateField`, men med et
// familiespecifikt tegnfilter givet ind som prop i stedet for hardcodet. Parse/format/paste-normalisering
// ejes af descriptorens codec; commit-intervaller og tværgående bounds er FELTVALIDATORER (inputkernen), ikke
// props. Komponenten modtager kun sin `field`/`location` + rendering-props (§2.4).

export type NumericTextFieldProps<T> = Readonly<{
  field: FieldRef<T>;
  location: EditorLocation;
  /**
   * Familiens tegn- og længdeprædikat (fx `yearAdmission()`). ÉN erklæring pr. kaldssted: surfacen
   * håndhæver det i `onDraftChange` (modalitets-uafhængigt, §1.2) og afleder samtidig keydown-filteret af
   * det, så de to værn ikke kan drifte fra hinanden. Se `draftAdmission.ts`.
   */
  admission: DraftAdmission;

  name?: string;
  width?: number | string;
  placeholder?: string;
  disabled?: boolean;
  singleStageClick?: boolean;
  /** Draft-maks under indtastning (eftergivende over den kanoniske form). */
  maxDraftLength?: number;
  /**
   * Tekstjustering i inputfeltet. `center` bruges til år/heltal, `right` til beløb/procent med
   * tabular-nums. Default `center`.
   */
  textAlign?: 'center' | 'right';
  /** Højrestil tabular-nums til beløbs-/procentfelter. Sættes automatisk ved `textAlign='right'`. */
  tabularNums?: boolean;
  /**
   * Enheds-adornment (kr./%) — den delte `InputUnitAdornment`. En funktion modtager draftens tomhed OG den
   * committede canonical værdi, så adornmentet kan mutes ved tomt felt og fx vise et beløbs-`fx`-udtryksmærke —
   * alt sammen fra `NumericTextField`s ÉNE editor-controller (aldrig en anden controller for feltet).
   */
  endAdornment?:
    | React.ReactNode
    | ((info: Readonly<{ isDraftEmpty: boolean; value: T | undefined }>) => React.ReactNode);
  /** `inputMode` til det virtuelle tastatur (default `numeric`; beløb/procent bruger `decimal`). */
  inputMode?: 'numeric' | 'decimal';
  /**
   * Et KRYDS-FELT-domæneregel-issue, som descriptorens egen validator ikke kan udlede, fordi den kun ser sin
   * egen celles værdi (fx feriegodtgørelsens relevans, der afhænger af den valgte reguleringsform).
   *
   * Bevidst et strukturelt `FieldIssue` og ikke en fri fejltekst: markering, tooltip, fokusnavigation og
   * consumerblokering skal læse ÉN repræsentation af samme fejl. Descriptorens eget issue har
   * forrang (§1.8), så dette vises kun, når feltet ikke selv har et format-/bounds-/rule-issue.
   */
  crossFieldIssue?: FieldIssue;
  /** Ikke-blokerende gul feltstatus; ignoreres automatisk, hvis feltet har en rød fejl. */
  warning?: FieldWarning;
  inputRef?: React.Ref<HTMLInputElement>;
  sx?: SxProps<Theme>;
}>;

const NumericTextFieldInner = <T,>(
  {
    field,
    location,
    admission,
    name,
    width = 130,
    placeholder,
    disabled,
    singleStageClick = false,
    maxDraftLength,
    textAlign = 'center',
    tabularNums,
    endAdornment,
    inputMode = 'numeric',
    crossFieldIssue,
    warning,
    inputRef,
    sx,
  }: NumericTextFieldProps<T>,
  ref: React.ForwardedRef<HTMLDivElement>
): React.ReactElement => {
  const accessibleName = useFieldLabel(field);
  const keyFilter = React.useMemo(() => keyFilterFromAdmission(admission), [admission]);
  const surface = useFormFieldSurface(field, location, {
    disabled,
    singleStageClick,
    keyFilter,
    draftAdmission: admission,
    // Samme loft som `<input maxLength>` nedenfor. Paste kan ikke bruge elementets eget loft (§1.2a).
    ...(maxDraftLength === undefined ? {} : { maxDraftLength }),
  });

  const surfaceInputRef = surface.inputElementRef;
  const assignInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      assignRef(surfaceInputRef, node);
      assignRef(inputRef, node);
    },
    [inputRef, surfaceInputRef]
  );

  // Descriptorens eget issue har forrang; en ekstern tværfelt-fejl vises kun ellers (§1.8).
  const issueText = resolveFieldIssueText(surface.issue, crossFieldIssue);
  const hasError = issueText.message !== undefined;
  const resolvedEndAdornment = typeof endAdornment === 'function'
    ? (endAdornment as (info: Readonly<{ isDraftEmpty: boolean; value: T | undefined }>) => React.ReactNode)(
        { isDraftEmpty: surface.displayText.trim() === '', value: surface.value }
      )
    : endAdornment;

  return (
    <StyledTextFieldBase
      ref={ref}
      accessibleName={accessibleName}
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
      helperText={issueText.message ?? ''}
      {...(issueText.tooltip === undefined ? {} : { tooltipText: issueText.tooltip })}
      {...(warning === undefined ? {} : { warning })}
      {...(resolvedEndAdornment === undefined ? {} : { endAdornment: resolvedEndAdornment })}
      htmlInputAttributes={{
        inputMode,
        ...(maxDraftLength === undefined ? {} : { maxLength: maxDraftLength }),
        readOnly: surface.readOnly,
        ...surface.restoreTargetAttributes,
      }}
      sx={mergeSx({
        '& .MuiInputBase-input': {
          textAlign,
          ...((tabularNums ?? textAlign === 'right') ? { fontVariantNumeric: 'tabular-nums' } : {}),
          caretColor: surface.isOpen ? 'auto' : 'transparent',
          cursor: surface.isOpen ? 'text' : 'pointer',
        },
      }, sx)}
    />
  );
};

// forwardRef bevarer den generiske `T` via en cast af den generiske inner-komponent.
const NumericTextField = React.forwardRef(NumericTextFieldInner) as <T>(
  props: NumericTextFieldProps<T> & { ref?: React.ForwardedRef<HTMLDivElement> }
) => React.ReactElement;

export default NumericTextField;
