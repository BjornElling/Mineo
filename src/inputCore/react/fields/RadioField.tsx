import * as React from 'react';
import StyledRadioButton from '../../../components/inputs/StyledRadioButton';
import type { CommitEvent } from '../../../types/fieldEvents';
import type { FieldRef } from '../../fieldDescriptor';
import type { EditorLocation } from '../../editor/fieldEditorState';
import { useFieldEditor } from '../useFieldEditor';
import { useRestoreTargetAttributes } from '../historyRestoreTarget';
import { resolveFieldIssueText } from '../fieldIssueText';
import { useFieldLabel } from '../useFieldLabel';
import { resolveChoiceAllowEmpty } from './choiceEmptinessPolicy';

// Radio-felt (§1.3/§3.6): radio-valg committer STRAKS via `commitImmediate` – ingen draft/settle-fase.
// Modtager kun sin `field`/`location` og sine options. Den viste værdi læses fra den afsluttede revision gennem
// editor-controlleren; valget dispatcher `setImmediateField` (som kører den styrende-valg-oprydning atomisk, §3.6).
// Værditypen er en streng-enum; en påkrævet radio (uden tomværdi) er default (`allowEmpty=false`).

export type RadioOption<TValue extends string> = Readonly<{ value: TValue; label: string }>;

export type RadioFieldProps<TValue extends string> = Readonly<{
  field: FieldRef<TValue> | FieldRef<TValue | undefined>;
  location: EditorLocation;
  options: readonly RadioOption<TValue>[];

  name?: string;
  row?: boolean;
  disabled?: boolean;
  /** Tillad "intet valg" (committer `undefined`). Default falsk – påkrævet radio. */
  allowEmpty?: boolean;
  emptyLabel?: string;
}>;

const RadioField = <TValue extends string>({
  field,
  location,
  options,
  name,
  row = false,
  disabled,
  allowEmpty = false,
  emptyLabel,
}: RadioFieldProps<TValue>): React.ReactElement => {
  // Gruppens navn ER feltets navn. Hentes fra den ENE autoritet, så beskeder og skærmlæser aldrig kan
  // navngive samme felt forskelligt (§3.2a) – og så et callsite ikke skal skrive teksten to gange.
  // Radio-værdien er altid en defineret enum for et påkrævet felt; controlleren er typet på feltets værditype.
  const controller = useFieldEditor(field as FieldRef<TValue | undefined>, location);
  // Gruppens navn ER feltets navn. Hentes fra den ENE autoritet, så beskeder og skærmlæser aldrig kan
  // navngive samme felt forskelligt (§3.2a) – og så et callsite ikke skal skrive teksten to gange.
  const accessibleName = useFieldLabel(field as FieldRef<TValue | undefined>);
  const restoreTargetAttributes = useRestoreTargetAttributes(field.address, location);
  const resolvedAllowEmpty = resolveChoiceAllowEmpty(
    field as FieldRef<TValue | undefined>,
    allowEmpty,
    'RadioField'
  );

  // `StyledRadioButton` er generisk i optionernes værditype og mapper DOM-strengen tilbage til den
  // option, den kom fra. `next` ER derfor `TValue` – det tidligere `as TValue`-cast er unødvendigt.
  const handleCommit = React.useCallback(
    (e: CommitEvent<TValue | undefined>): boolean => {
      const next = e.target.value;
      if (next === undefined) {
        controller.clearImmediate();
        return true;
      }
      controller.commitImmediate(next);
      return true;
    },
    [controller]
  );

  const issueText = resolveFieldIssueText(controller.issue);
  const hasError = issueText.message !== undefined;

  return (
    <StyledRadioButton
      name={name}
      ariaLabel={accessibleName}
      options={options}
      value={controller.value}
      onCommit={handleCommit}
      row={row}
      disabled={disabled}
      allowEmpty={resolvedAllowEmpty}
      {...(emptyLabel === undefined ? {} : { emptyLabel })}
      error={hasError}
      helperText={issueText.message ?? ''}
      {...(issueText.tooltip === undefined ? {} : { tooltipText: issueText.tooltip })}
      restoreTargetAttributes={restoreTargetAttributes}
    />
  );
};

RadioField.displayName = 'RadioField';

export default RadioField;
