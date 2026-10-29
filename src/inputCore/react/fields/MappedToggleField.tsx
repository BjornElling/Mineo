import * as React from 'react';
import { Box, Tooltip } from '@mui/material';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import type { FieldWarning } from '../../fieldWarning';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';
import type { ToggleCommitOverride } from './ToggleField';
import {
  selectAccessibleNameProps,
  type AccessibleNameProps,
} from '../../../components/inputs/accessibleName';

/**
 * Toggle for persisted enumfelter, hvor den synlige switch mapper mellem to canonical værdier
 * (i praksis EO-felternes `Ja`/`Nej`). Mappingen er rendering-adfærd; codec og commitvej ejes fortsat af feltet.
 */
export type MappedToggleFieldProps<TValue> = Readonly<{
  field: FieldRef<TValue>;
  location: EditorLocation;
  checkedValue: NoInfer<TValue>;
  uncheckedValue: NoInfer<TValue>;
  labelPlacement?: 'start' | 'end' | 'top' | 'bottom';
  disabled?: boolean;
  name?: string;
  id?: string;
  /**
   * Callsite-ejet afslutning (§1.11) – se {@link ToggleCommitOverride}. Kaldes med den MAPPEDE canonical værdi,
   * ikke med boolean, så callsitet arbejder i feltets eget domæne. Udelades for en almindelig ét-felts-toggle.
   */
  commit?: ToggleCommitOverride<NoInfer<TValue>>;
  /**
   * Ikke-blokerende advarsel: gul ring om switchen og teksten som tooltip – samme signal som tekstfelternes gule
   * kant. Bruges, når valget er gyldigt, men ikke giver det, brugeren bad om (BB-358).
   */
  warning?: FieldWarning;
}> &
  // Obligatorisk tilgængeligt navn – samme krav som ToggleField, jf. components/inputs/accessibleName.ts.
  AccessibleNameProps;

/**
 * Ingen ref-videreførsel: switchen ryster selv ved en afvisning, så intet udefra skal kunne nå den.
 * Komponenten er derfor en almindelig generisk funktion og behøver hverken `forwardRef` eller den
 * type-assertion, der før skulle genskabe generiskheden bagefter.
 */
const MappedToggleField = <TValue,>(
  props: MappedToggleFieldProps<TValue>
): React.ReactElement => {
  const {
    field,
    location,
    checkedValue,
    uncheckedValue,
    labelPlacement,
    disabled,
    name,
    id,
    commit,
    warning,
  } = props;
  const controller = useFieldEditor(field, location);
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
  const checked = Object.is(controller.value, checkedValue);

  const handleCommit = React.useCallback(
    (event: CommitEvent<boolean>): boolean => {
      const next = event.target.value ? checkedValue : uncheckedValue;
      const decision = commit === undefined ? 'commit' : commit(next);
      if (decision === 'reject') return false;
      if (decision === 'commit') controller.commitImmediate(next);
      return true;
    },
    [checkedValue, commit, controller, uncheckedValue]
  );

  const toggle = (
    <StyledToggleSwitch
      checked={checked}
      onCommit={handleCommit}
      {...selectAccessibleNameProps(props)}
      {...(labelPlacement === undefined ? {} : { labelPlacement })}
      {...(disabled === undefined ? {} : { disabled })}
      {...(name === undefined ? {} : { name })}
      {...(id === undefined ? {} : { id })}
      restoreTargetAttributes={restoreTargetAttributes}
    />
  );
  // Bevar samme træ, når advarslen skifter: ellers bliver det fokuserede input udskiftet ved klik,
  // så brugeren ikke kan slå valget fra igen med Enter eller mellemrum.
  return (
    <Tooltip title={warning?.message ?? ''} arrow placement="top">
      <Box
        component="span"
        {...(warning === undefined ? {} : { 'data-mineo-field-warning': '' })}
        sx={{
          display: 'inline-flex',
          borderRadius: '14px',
          outline: warning === undefined ? 'none' : '1px solid var(--color-status-warning)',
          outlineOffset: '2px',
        }}
      >
        {toggle}
      </Box>
    </Tooltip>
  );
};

export default MappedToggleField;
