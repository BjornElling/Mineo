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
// editor-controlleren.

export type CheckboxFieldProps = Readonly<{
  field: FieldRef<boolean>;
  location: EditorLocation;
  label: React.ReactNode;
  disabled?: boolean;
  /**
   * Permanent tilvalg (§3.6): feltet vises altid markeret og kan ikke fravælges. Bruges til elementer,
   * der pr. definition indgår. Feltet bindes stadig gennem editor-controlleren — låsningen er ren
   * visning og committer aldrig, så den afsluttede værdi er uændret.
   */
  lockedOn?: boolean;
  name?: string;
}>;

const CheckboxField = ({ field, location, label, disabled, lockedOn, name }: CheckboxFieldProps): React.ReactElement => {
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
      {...(lockedOn === undefined ? {} : { lockedOn })}
      {...(name === undefined ? {} : { name })}
      restoreTargetAttributes={restoreTargetAttributes}
    />
  );
};

CheckboxField.displayName = 'CheckboxField';

export default CheckboxField;
