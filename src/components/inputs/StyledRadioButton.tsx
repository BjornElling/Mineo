import React from 'react';
import { Box, Radio, FormControlLabel, RadioGroup, FormLabel, FormControl, Tooltip, Typography } from '@mui/material';
import { createCommitEvent, type CommitHandler } from '../../types/fieldEvents';
import { visuallyHiddenStyle } from '../shared/visuallyHiddenStyle';

/**
 * StyledRadioButton - Moderne radio button med blå farve
 *
 * Bruger MUI's indbyggede Radio og RadioGroup komponenter med custom styling.
 *
 * Features:
 * - Moderne design med rund figur
 * - Blå farve når valgt
 * - Kan bruges individuelt eller i gruppe
 * - Horisontalt eller vertikalt layout
 */
interface RadioOption {
  value: string;
  label: string;
}

interface StyledRadioButtonProps {
  label?: string;
  options?: RadioOption[];
  value?: string | undefined;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, value: string) => void;
  /**
   * Selection is an immediate commit for radio buttons.
   * This provides Mineo-style commit semantics in addition to the native MUI callback.
   */
  onCommit?: CommitHandler<string | undefined>;
  /**
   * If `true`, the component supports "no selection" by committing `undefined`.
   *
   * Note: Internally this is implemented via a per-instance sentinel string value
   * to satisfy MUI's `RadioGroup` controlled `value` contract. Consumers MUST treat
   * `undefined` as the only "no value" state.
   */
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  row?: boolean;
  name?: string;
  error?: boolean;
  helperText?: string;
}

const StyledRadioButton = React.forwardRef<HTMLDivElement, StyledRadioButtonProps>(({
  label,
  options = [],
  value,
  onChange,
  onCommit,
  allowEmpty = false,
  emptyLabel = '-',
  disabled = false,
  row = false,
  name,
  error = false,
  helperText = '',
}, ref) => {
  const autoId = React.useId();
  const emptyValue = `__mineo_radio_empty__${autoId}`;

  const resolvedValue = value ?? emptyValue;
  const showError = error && helperText.trim() !== '';
  const a11yErrorId = `${emptyValue}-error`;

  if (import.meta.env.DEV) {
    if (options.some((o) => o.value === emptyValue)) {
      throw new Error('StyledRadioButton: empty-value sentinel collided with an option value');
    }
    if (error && helperText.trim() === '') {
      throw new Error('StyledRadioButton: helperText is required when error=true (avoid silent error states)');
    }
  }

  return (
    <FormControl component="fieldset" disabled={disabled} error={error} sx={{ margin: 0 }}>
      {label && (
        <FormLabel
          component="legend"
          sx={{
            fontWeight: 500,
            color: 'text.primary',
            marginBottom: 1,
            '&.Mui-focused': {
              color: 'text.primary',
            },
          }}
        >
          {label}
        </FormLabel>
      )}
      <Tooltip
        title={showError ? helperText : ''}
        arrow
        placement="top"
        disableHoverListener={!showError}
        disableFocusListener={!showError}
        disableTouchListener={!showError}
      >
        <Box
          sx={{
            position: 'relative',
            borderRadius: '10px',
            // No visible "frame" around radio groups in normal state.
            // Keep a transparent border to avoid layout shift when error border appears.
            border: '1px solid',
            borderColor: showError ? '#d32f2f' : 'transparent',
            padding: 0,
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            '& .MuiFormControlLabel-root': {
              margin: 0,
            },
          }}
        >
          <RadioGroup
            ref={ref}
            value={resolvedValue}
            aria-describedby={showError ? a11yErrorId : undefined}
            onChange={(e, nextValue) => {
              const committedValue = nextValue === emptyValue ? undefined : nextValue;
              if (onCommit) {
                onCommit(createCommitEvent(committedValue));
                return;
              }
              onChange?.(e, nextValue);
            }}
            row={row}
            name={name}
            sx={{
              margin: 0,
              minHeight: '40px',
              alignItems: 'center',
              ...(row
                ? {
                    columnGap: '14px',
                  }
                : {
                    rowGap: '6px',
                  }),
            }}
          >
            {allowEmpty && (
              <FormControlLabel
                key={emptyValue}
                value={emptyValue}
                control={
                  <Radio
                    size="small"
                    sx={{
                      padding: '4px',
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label={<Typography className="row--text">{emptyLabel}</Typography>}
              />
            )}
            {options.map((option) => (
              <FormControlLabel
                key={option.value}
                value={option.value}
                control={
                  <Radio
                    size="small"
                    sx={{
                      padding: '4px',
                      '&.Mui-checked': {
                        color: 'primary.main',
                      },
                    }}
                  />
                }
                label={<Typography className="row--text">{option.label}</Typography>}
              />
            ))}
          </RadioGroup>
          {showError && (
            <span id={a11yErrorId} style={visuallyHiddenStyle}>
              {helperText}
            </span>
          )}
        </Box>
      </Tooltip>
    </FormControl>
  );
});

StyledRadioButton.displayName = 'StyledRadioButton';

export default StyledRadioButton;
