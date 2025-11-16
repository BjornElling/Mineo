import React from 'react';
import { Switch, FormControlLabel } from '@mui/material';

/**
 * StyledToggleSwitch - Moderne toggle switch med blå farve
 *
 * Bruger MUI's indbyggede Switch komponent med custom styling.
 *
 * Features:
 * - Moderne slider-design med rund figur
 * - Blå farve når aktiveret
 * - Kan bruges med eller uden label
 *
 * Props:
 * - label: Label-tekst (valgfrit)
 * - checked: Boolean der indikerer om switchen er aktiveret
 * - onChange: Callback når switchen ændres
 * - disabled: Boolean der indikerer om switchen er deaktiveret
 * - labelPlacement: Position af label ('start', 'end', 'top', 'bottom')
 */
const StyledToggleSwitch = React.forwardRef(({
  label,
  checked = false,
  onChange,
  disabled = false,
  labelPlacement = 'end',
  ...otherProps
}, ref) => {
  const switchComponent = (
    <Switch
      ref={ref}
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: '#1976d2', // Blå farve når aktiveret
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          backgroundColor: '#1976d2', // Blå track når aktiveret
        },
      }}
      {...otherProps}
    />
  );

  // Hvis der er en label, wrap i FormControlLabel
  if (label) {
    return (
      <FormControlLabel
        control={switchComponent}
        label={label}
        labelPlacement={labelPlacement}
        sx={{
          '& .MuiFormControlLabel-label': {
            fontFamily: 'Ubuntu, sans-serif',
            fontSize: '14px',
            color: 'rgba(0, 0, 0, 0.87)',
          },
        }}
      />
    );
  }

  // Ellers returner kun switchen
  return switchComponent;
});

StyledToggleSwitch.displayName = 'StyledToggleSwitch';

export default StyledToggleSwitch;
