import * as React from 'react';
import { Box, Tooltip } from '@mui/material';
import StyledCheckbox from '../../../components/inputs/StyledCheckbox';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

// Checkbox-felt (§1.3/§3.6): en boolsk immediate-commit control (grid-pendanten er ikke relevant, da
// checkbokse kun bruges i formularer). Klik/Space committer STRAKS via `commitImmediate` – ingen draft/settle-fase.
// Modtager kun sin `field`/`location` + label; den viste checked-tilstand læses fra den afsluttede revision gennem
// editor-controlleren.

type CheckboxFieldBaseProps = Readonly<{
  field: FieldRef<boolean>;
  location: EditorLocation;
  label: React.ReactNode;
  name?: string;
}>;

type CheckboxFieldStateProps =
  | Readonly<{
      /** Feltet er et permanent tilvalg og vises derfor altid markeret. */
      lockedOn: true;
      unavailableReason: null;
    }>
  | Readonly<{
      /** Et aktuelt felt kan være markeret; et inaktuelt felt vises umarkeret. */
      lockedOn?: false;
      unavailableReason: string | null;
    }>;

export type CheckboxFieldProps = CheckboxFieldBaseProps & CheckboxFieldStateProps;

const CheckboxField = ({ field, location, label, lockedOn, unavailableReason, name }: CheckboxFieldProps): React.ReactElement => {
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

  const checkbox = (
    <StyledCheckbox
      checked={checked}
      onCommit={handleCommit}
      label={label}
      disabled={unavailableReason !== null}
      {...(lockedOn === undefined ? {} : { lockedOn })}
      {...(name === undefined ? {} : { name })}
      restoreTargetAttributes={restoreTargetAttributes}
    />
  );

  if (unavailableReason === null) return checkbox;

  // Tooltippet ankres på en wrapper og ikke på kontrollen selv: et disabled MUI-input udsender ingen
  // pointer-events, så et tooltip direkte på kontrollen ville aldrig vises. `mineo-disabled-hover-target`
  // er den etablerede klasse for netop denne hover-flade (nedtoning + hover-kontrast defineres i
  // `src/styles/layout.css` under `.disabled-hover-checkbox-group`).
  return (
    <Tooltip title={unavailableReason} arrow placement="top">
      <Box component="span" className="mineo-disabled-hover-target">
        {checkbox}
      </Box>
    </Tooltip>
  );
};

CheckboxField.displayName = 'CheckboxField';

export default CheckboxField;
