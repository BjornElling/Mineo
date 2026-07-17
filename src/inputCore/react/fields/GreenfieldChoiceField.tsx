import * as React from 'react';
import type { SxProps, Theme } from '@mui/material/styles';
import StyledDropdown, { type StyledDropdownValue } from '../../../components/inputs/StyledDropdown';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';

// Greenfield choice-felt (§1.3/§3.6): dropdown committer STRAKS via `commitImmediate` — ingen draft/settle-fase.
// Modtager kun sin `field`/`location` og sine options som children. Den viste værdi læses fra den afsluttede
// revision gennem editor-controlleren; valget dispatcher `setImmediateField` (som kører den styrende-valg-
// oprydning atomisk, §3.6). `StyledDropdown` ejer selv sin popover-interaktion og keyboard-navigation.

export type GreenfieldChoiceFieldProps<TValue extends StyledDropdownValue> = Readonly<{
  field: FieldRef<TValue | undefined>;
  location: EditorLocation;

  children?: React.ReactNode;
  placeholder?: string;
  width?: number | string;
  name?: string;
  disabled?: boolean;
  getOptionLabel?: (value: TValue) => string;
  /**
   * Om det tomme placeholder-valg tilbydes (default sandt). Sæt `false` for et påkrævet valg uden tomværdi
   * (fx en enhed-/type-dropdown med en gyldig default): så vises ingen tom-række, og feltet kan ikke ryddes
   * til placeholderen. Feltets faktiske tomhed ejes af descriptorens `isEmpty`; denne prop styrer kun UI'et.
   */
  allowEmpty?: boolean;
  sx?: SxProps<Theme>;
}>;

const GreenfieldChoiceField = <TValue extends StyledDropdownValue>({
  field,
  location,
  children,
  placeholder,
  width,
  name,
  disabled,
  getOptionLabel,
  allowEmpty = true,
  sx,
}: GreenfieldChoiceFieldProps<TValue>): React.ReactElement => {
  const controller = useFieldEditor(field, location);

  const handleChange = React.useCallback(
    (e: { target: { value: TValue | undefined } }) => {
      const next = e.target.value;
      // Tom-valg (placeholder) rydder feltet; ellers immediate-commit af den valgte værdi. Med `allowEmpty=false`
      // udsteder dropdownen aldrig `undefined`, så clear-grenen nås ikke for et påkrævet felt.
      if (next === undefined) {
        controller.clearImmediate();
        return;
      }
      controller.commitImmediate(next);
    },
    [controller]
  );

  const hasError = controller.issue !== undefined;

  // `allowEmpty=false` kræver en defineret værdi; descriptorens tomværdi (fx 'dage') er den gyldige default.
  if (!allowEmpty) {
    const value = controller.value;
    if (value === undefined) {
      throw new Error(`GreenfieldChoiceField(${field.descriptor.id}): allowEmpty=false kræver en defineret værdi`);
    }
    return (
      <StyledDropdown<TValue>
        name={name}
        allowEmpty={false}
        value={value}
        onChange={handleChange}
        width={width}
        disabled={disabled}
        getOptionLabel={getOptionLabel}
        error={hasError}
        helperText={controller.issue?.message ?? ''}
        sx={sx}
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
      sx={sx}
    >
      {children}
    </StyledDropdown>
  );
};

GreenfieldChoiceField.displayName = 'GreenfieldChoiceField';

export default GreenfieldChoiceField;
