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
            // Feltidentitet i DOM: serialiseret feltadresse + editorlokation (§3.2/§3.7), sat af
            // feltfamilien og videreført her. Checkboxen er en immediate-commit widget, så restoren skal
            // kunne finde den uden forudgående fokus — men identiteten er adressen, ikke `name`.
            // Transiente checkboxes (fx app-settings på Indstillinger) har ingen feltadresse og deltager
            // ikke i restoren. Cast som StyledRadioButton: MUI's slotProps-type tillader ikke
            // data-attributter direkte.
            input: {
              id: resolvedId,
              name: resolvedName,
              onKeyDown: handleKeyDown,
              'aria-checked': checked,
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
