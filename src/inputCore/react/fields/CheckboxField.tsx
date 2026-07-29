import * as React from 'react';
import StyledCheckbox from '../../../components/inputs/StyledCheckbox';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

// Checkbox-felt (§1.3/§3.6): en boolsk immediate-commit control (grid-pendanten er ikke relevant, da
// checkbokse kun bruges i formularer). Klik/Space committer STRAKS via `commitImmediate` — ingen draft/settle-fase.
// Modtager kun sin `field`/`location` + label; den viste checked-tilstand læses fra den afsluttede revision gennem
// editor-controlleren. Erstatter legacy `StyledCheckbox` bundet til `usePersistedForm`-setValues.

export type CheckboxFieldProps = Readonly<{
  field: FieldRef<boolean>;
  location: EditorLocation;
  label: React.ReactNode;
  disabled?: boolean;
  name?: string;
}>;

const CheckboxField = ({ field, location, label, disabled, name }: CheckboxFieldProps): React.ReactElement => {
  const controller = useFieldEditor(field, location);
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
  const checked = controller.value ?? false;

  const handleCommit = React.useCallback(
    (e: CommitEvent<boolean>): boolean => {
      controller.commitImmediate(e.target.value);
      return true;
    },
    [controller]
  );

  return (
    <StyledCheckbox
      checked={checked}
      onCommit={handleCommit}
      label={label}
      {...(disabled === undefined ? {} : { disabled })}
      {...(name === undefined ? {} : { name })}
      restoreTargetAttributes={restoreTargetAttributes}
    />
  );
};

CheckboxField.displayName = 'CheckboxField';

export default CheckboxField;
