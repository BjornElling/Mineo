import * as React from 'react';
import StyledRadioButton from '../../../components/inputs/StyledRadioButton';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';

// Greenfield radio-felt (§1.3/§3.6): radio-valg committer STRAKS via `commitImmediate` — ingen draft/settle-fase.
// Modtager kun sin `field`/`location` og sine options. Den viste værdi læses fra den afsluttede revision gennem
// editor-controlleren; valget dispatcher `setImmediateField` (som kører den styrende-valg-oprydning atomisk, §3.6).
// Værditypen er en streng-enum; en påkrævet radio (uden tomværdi) er default (`allowEmpty=false`).

export type RadioOption<TValue extends string> = Readonly<{ value: TValue; label: string }>;

export type RadioFieldProps<TValue extends string> = Readonly<{
  field: FieldRef<TValue> | FieldRef<TValue | undefined>;
  location: EditorLocation;
  options: readonly RadioOption<TValue>[];

  name?: string;
  label?: string;
  row?: boolean;
  disabled?: boolean;
  /** Tillad "intet valg" (committer `undefined`). Default falsk — påkrævet radio. */
  allowEmpty?: boolean;
  emptyLabel?: string;
}>;

const RadioField = <TValue extends string>({
  field,
  location,
  options,
  name,
  label,
  row = false,
  disabled,
  allowEmpty = false,
  emptyLabel,
}: RadioFieldProps<TValue>): React.ReactElement => {
  // Radio-værdien er altid en defineret enum for et påkrævet felt; controlleren er typet på feltets værditype.
  const controller = useFieldEditor(field as FieldRef<TValue | undefined>, location);
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);

  const handleCommit = React.useCallback(
    (e: CommitEvent<string | undefined>): boolean => {
      const next = e.target.value;
      if (next === undefined) {
        controller.clearImmediate();
        return true;
      }
      controller.commitImmediate(next as TValue);
      return true;
    },
    [controller]
  );

  const hasError = controller.issue !== undefined;

  return (
    <StyledRadioButton
      name={name}
      label={label}
      options={options as RadioOption<TValue>[]}
      value={controller.value}
      onCommit={handleCommit}
      row={row}
      disabled={disabled}
      allowEmpty={allowEmpty}
      {...(emptyLabel === undefined ? {} : { emptyLabel })}
      error={hasError}
      helperText={controller.issue?.message ?? ''}
      restoreTargetAttributes={restoreTargetAttributes}
    />
  );
};

RadioField.displayName = 'RadioField';

export default RadioField;
