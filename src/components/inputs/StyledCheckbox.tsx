import React from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';

type StyledCheckboxProps = Readonly<{
  checked: boolean;
  onCommit: CommitHandler<boolean>;
  label: React.ReactNode;
  id?: string;
  name?: string;
  disabled?: boolean;
  size?: 'small' | 'medium';
  /**
   * Undo/redo-fokusrestore-attributter (§3.7): sættes på checkbox-input-slottet, så fokus efter undo/redo
   * lander PRÆCIST på denne editorlokation (feltadresse + editorlokation), ikke via `name`.
   * `inputCore/react/fields/CheckboxField` leverer dem.
   */
  restoreTargetAttributes?: Readonly<Record<string, string>>;
}>;

const StyledCheckbox = ({
  checked,
  onCommit,
  label,
  id,
  name,
  disabled = false,
  size = 'small',
  restoreTargetAttributes,
}: StyledCheckboxProps) => {
  const autoId = React.useId();
  const resolvedId = id ?? autoId;
  const resolvedName = name ?? resolvedId;

  const commitChecked = React.useCallback(
    (nextChecked: boolean) => {
      if (nextChecked === checked) return;
      onCommit(createCommitEvent(nextChecked));
    },
    [checked, onCommit]
  );

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, nextChecked: boolean) => {
      if (event.nativeEvent instanceof KeyboardEvent) {
        return;
      }
      commitChecked(nextChecked);
    },
    [commitChecked]
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      if (!disabled) {
        commitChecked(!checked);
      }
    },
    [checked, commitChecked, disabled]
  );

  return (
    <FormControlLabel
      control={(
        <Checkbox
          id={resolvedId}
          name={resolvedName}
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          size={size}
          slotProps={{
            // Felt-identitet for undo/redo-fokus-restore (jf. mineo-field-pattern.md): checkboxen er en
            // immediate-commit widget (commit uden forudgående fokus), så `name` er eneste durable
            // identitetskilde. historyTargetRestore lander fokus via `data-mineo-undo-field-path`.
            // Symmetrisk med StyledToggleSwitch/StyledRadioButton. Transiente checkboxes uden eksplicit
            // `name` (fx app-settings på Indstillinger, ikke undo-sporet) projicerer kun deres auto-id.
            // Cast som StyledRadioButton: MUI's slotProps-type tillader ikke data-attributter direkte.
            input: {
              id: resolvedId,
              name: resolvedName,
              onKeyDown: handleKeyDown,
              'aria-checked': checked,
              'data-mineo-undo-field-path': resolvedName,
              // Undo/redo-restore lokaliserer via feltadresse + editorlokation, ikke `name` (§3.7).
              ...(restoreTargetAttributes ?? {}),
            } as React.InputHTMLAttributes<HTMLInputElement>,
          }}
        />
      )}
      label={label}
      sx={{
        marginRight: 1,
        '& .MuiFormControlLabel-label': {
          fontFamily: 'var(--font-family-base)',
          fontSize: '15px',
          fontWeight: 'var(--font-weight-regular)',
          lineHeight: 'var(--line-height-base)',
          color: 'var(--mineo-color-row-text)',
        },
      }}
    />
  );
};

StyledCheckbox.displayName = 'StyledCheckbox';

export default StyledCheckbox;
