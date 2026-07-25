import * as React from 'react';
import StyledToggleSwitch from '../../../components/inputs/StyledToggleSwitch';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { StyledToggleSwitchHandle } from '../../../types/handles';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

/**
 * Greenfield-toggle for persisted enumfelter, hvor den synlige switch mapper mellem to canonical værdier
 * (i praksis EO-felternes `Ja`/`Nej`). Mappingen er rendering-adfærd; codec og commitvej ejes fortsat af feltet.
 */
export type MappedToggleFieldProps<TValue> = Readonly<{
  field: FieldRef<TValue>;
  location: EditorLocation;
  checkedValue: NoInfer<TValue>;
  uncheckedValue: NoInfer<TValue>;
  label?: string;
  labelPlacement?: 'start' | 'end' | 'top' | 'bottom';
  disabled?: boolean;
  name?: string;
  id?: string;
  ariaLabel?: string;
}>;

const MappedToggleFieldInner = <TValue,>(
  {
    field,
    location,
    checkedValue,
    uncheckedValue,
    label,
    labelPlacement,
    disabled,
    name,
    id,
    ariaLabel,
  }: MappedToggleFieldProps<TValue>,
  ref: React.ForwardedRef<StyledToggleSwitchHandle>
): React.ReactElement => {
  const controller = useFieldEditor(field, location);
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
  const checked = Object.is(controller.value, checkedValue);

  const handleCommit = React.useCallback(
    (event: CommitEvent<boolean>): boolean => {
      controller.commitImmediate(event.target.value ? checkedValue : uncheckedValue);
      return true;
    },
    [checkedValue, controller, uncheckedValue]
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
};

const MappedToggleField = React.forwardRef(MappedToggleFieldInner) as <TValue>(
  props: MappedToggleFieldProps<TValue> & React.RefAttributes<StyledToggleSwitchHandle>
) => React.ReactElement;

export default MappedToggleField;
