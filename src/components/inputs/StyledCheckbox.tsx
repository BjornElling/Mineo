import React from 'react';
import { Checkbox, FormControlLabel } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';

type StyledCheckboxProps = Readonly<{
  checked: boolean;
  onCommit: CommitHandler<boolean>;
  label: React.ReactNode;
  disabled?: boolean;
  size?: 'small' | 'medium';
}>;

const StyledCheckbox = ({
  checked,
  onCommit,
  label,
  disabled = false,
  size = 'small',
}: StyledCheckboxProps) => {
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
          checked={checked}
          onChange={handleChange}
          disabled={disabled}
          size={size}
          slotProps={{
            input: {
              onKeyDown: handleKeyDown,
              'aria-checked': checked,
            },
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
