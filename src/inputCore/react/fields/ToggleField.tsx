import * as React from 'react';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { StyledToggleSwitchHandle } from '../../../types/handles';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

// Greenfield toggle-felt (§1.3/§3.6): en boolsk immediate-commit control. Klik/Enter/Space committer STRAKS via
// `commitImmediate` — ingen draft/settle-fase. Modtager kun sin `field`/`location`; den viste checked-tilstand
// læses fra den afsluttede revision gennem editor-controlleren. Handle-ref (`shake()`) forwardes uændret, så en
// gate-afvisning (fx omregning) fortsat kan animere kontrollen.

export type ToggleFieldProps = Readonly<{
  field: FieldRef<boolean>;
  location: EditorLocation;

  label?: string;
  labelPlacement?: 'start' | 'end' | 'top' | 'bottom';
  disabled?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
}>;

const ToggleField = React.forwardRef<StyledToggleSwitchHandle, ToggleFieldProps>(
  ({ field, location, label, labelPlacement, disabled, name, id, ariaLabel }, ref) => {
    const controller = useFieldEditor(field, location);
    const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
    // En boolsk descriptor har altid en defineret canonical værdi (emptyValue false/true); controller.value er
    // derfor defineret for et toggle-felt. Fald tilbage til false for at opfylde den controlled kontrakt.
    const checked = controller.value ?? false;

    const handleCommit = React.useCallback(
      (e: CommitEvent<boolean>): boolean => {
        controller.commitImmediate(e.target.value);
        return true;
      },
      [controller]
    );

    return (
      <StyledToggleSwitch
        ref={ref}
        checked={checked}
        onCommit={handleCommit}
        {...(label === undefined ? {} : { label })}
        {...(labelPlacement === undefined ? {} : { labelPlacement })}
        {...(disabled === undefined ? {} : { disabled })}
        {...(name === undefined ? {} : { name })}
        {...(id === undefined ? {} : { id })}
        {...(ariaLabel === undefined ? {} : { ariaLabel })}
        restoreTargetAttributes={restoreTargetAttributes}
      />
    );
  }
);

ToggleField.displayName = 'ToggleField';

export default ToggleField;
