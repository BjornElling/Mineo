import React from 'react';
import { Radio, FormControlLabel, RadioGroup, FormLabel, FormControl } from '@mui/material';

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
 *
 * Props:
 * - label: Label-tekst for hele gruppen (valgfrit)
 * - options: Array af objekter med { value, label } for hver option
 * - value: Den aktuelt valgte værdi
 * - onChange: Callback når valg ændres (modtager event)
 * - disabled: Boolean der indikerer om alle radio buttons er deaktiveret
 * - row: Boolean der indikerer om buttons skal vises vandret (default: false)
 */
const StyledRadioButton = React.forwardRef(({
  label,
  options = [],
  value,
  onChange,
  disabled = false,
  row = false,
  ...otherProps
}, ref) => {
  return (
    <FormControl component="fieldset" disabled={disabled}>
      {label && (
        <FormLabel
          component="legend"
          sx={{
            fontFamily: 'Ubuntu, sans-serif',
            fontSize: '14px',
            fontWeight: 500,
            color: 'rgba(0, 0, 0, 0.87)',
            marginBottom: 1,
            '&.Mui-focused': {
              color: 'rgba(0, 0, 0, 0.87)',
            },
          }}
        >
          {label}
        </FormLabel>
      )}
      <RadioGroup
        ref={ref}
        value={value}
        onChange={onChange}
        row={row}
        {...otherProps}
      >
        {options.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            control={
              <Radio
                sx={{
                  color: 'rgba(0, 0, 0, 0.54)',
                  '&.Mui-checked': {
                    color: '#1976d2', // Blå farve når valgt
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.04)',
                  },
                }}
              />
            }
            label={option.label}
            sx={{
              '& .MuiFormControlLabel-label': {
                fontFamily: 'Ubuntu, sans-serif',
                fontSize: '14px',
                color: 'rgba(0, 0, 0, 0.87)',
              },
            }}
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
});

StyledRadioButton.displayName = 'StyledRadioButton';

export default StyledRadioButton;
