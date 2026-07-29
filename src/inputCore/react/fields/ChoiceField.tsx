import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledDropdown, {
  StyledDropdownDivider,
  type StyledDropdownValue,
} from '../../../components/inputs/StyledDropdown';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

// Choice-felt (§1.3/§3.6): dropdown committer STRAKS via `commitImmediate` — ingen draft/settle-fase.
// Modtager kun sin `field`/`location` og sine options som children. Den viste værdi læses fra den afsluttede
// revision gennem editor-controlleren; valget dispatcher `setImmediateField` (som kører den styrende-valg-
// oprydning atomisk, §3.6). `StyledDropdown` ejer selv sin popover-interaktion og keyboard-navigation.

export type ChoiceFieldProps<
  TValue extends StyledDropdownValue,
  TCanonical extends TValue | undefined = TValue | undefined,
> = Readonly<{
  field: FieldRef<TCanonical>;
  location: EditorLocation;

  children?: React.ReactNode;
  placeholder?: string;
  width?: number | string;
  name?: string;
  disabled?: boolean;
  getOptionLabel?: (value: TValue) => string;
  /** UI-sentinel som vises for canonical tomhed; valg af værdien rydder feltet (fx EO-filterets "ALLE"). */
  emptyUiValue?: NoInfer<TValue>;
  /**
   * Om det tomme placeholder-valg tilbydes (default sandt). Sæt `false` for et påkrævet valg uden tomværdi
   * (fx en enhed-/type-dropdown med en gyldig default): så vises ingen tom-række, og feltet kan ikke ryddes
   * til placeholderen. Feltets faktiske tomhed ejes af descriptorens `isEmpty`; denne prop styrer kun UI'et.
   */
  allowEmpty?: boolean;
  sx?: SxProps<Theme>;
  listboxSx?: SxProps<Theme>;
  optionSx?: SxProps<Theme>;
  iconSx?: SxProps<Theme>;
  containerSx?: SxProps<Theme>;
}>;

const ChoiceField = <
  TValue extends StyledDropdownValue,
  TCanonical extends TValue | undefined = TValue | undefined,
>({
  field,
  location,
  children,
  placeholder,
  width,
  name,
  disabled,
  getOptionLabel,
  emptyUiValue,
  allowEmpty = true,
  sx,
  listboxSx,
  optionSx,
  iconSx,
  containerSx,
}: ChoiceFieldProps<TValue, TCanonical>): React.ReactElement => {
  const controller = useFieldEditor(field, location);
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);

  const handleChange = React.useCallback(
    (e: { target: { value: TValue | undefined } }) => {
      const next = e.target.value;
      // Tom-valg (placeholder) rydder feltet; ellers immediate-commit af den valgte værdi. Med `allowEmpty=false`
      // udsteder dropdownen aldrig `undefined`, så clear-grenen nås ikke for et påkrævet felt.
      if (next === undefined || (emptyUiValue !== undefined && Object.is(next, emptyUiValue))) {
        controller.clearImmediate();
        return;
      }
      controller.commitImmediate(next as TCanonical);
    },
    [controller, emptyUiValue]
  );

  const hasError = controller.issue !== undefined;

  // `allowEmpty=false` kræver en defineret værdi; descriptorens tomværdi (fx 'dage') er den gyldige default.
  if (!allowEmpty || emptyUiValue !== undefined) {
    const value = controller.value;
    if (value === undefined && emptyUiValue === undefined) {
      throw new Error(`ChoiceField(${field.descriptor.id}): allowEmpty=false kræver en defineret værdi`);
    }
    return (
      <StyledDropdown<TValue>
        name={name}
        allowEmpty={false}
        value={value ?? emptyUiValue as TValue}
        onChange={handleChange}
        width={width}
        disabled={disabled}
        getOptionLabel={getOptionLabel}
        error={hasError}
        helperText={controller.issue?.message ?? ''}
        restoreTargetAttributes={restoreTargetAttributes}
        sx={sx}
        listboxSx={listboxSx}
        optionSx={optionSx}
        iconSx={iconSx}
        containerSx={containerSx}
      >
        {children}
      </StyledDropdown>
    );
  }

  return (
    <StyledDropdown<TValue>
      name={name}
      value={controller.value}
      onChange={handleChange}
      placeholder={placeholder}
      width={width}
      disabled={disabled}
      getOptionLabel={getOptionLabel}
      error={hasError}
      helperText={controller.issue?.message ?? ''}
      restoreTargetAttributes={restoreTargetAttributes}
      sx={sx}
      listboxSx={listboxSx}
      optionSx={optionSx}
      iconSx={iconSx}
      containerSx={containerSx}
    >
      {children}
    </StyledDropdown>
  );
};

ChoiceField.displayName = 'ChoiceField';

/** Visuel gruppeseparator til options; den bærer ingen persisted state. */
export const ChoiceDivider = StyledDropdownDivider;

export default ChoiceField;
