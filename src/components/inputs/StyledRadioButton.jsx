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
                  '&.Mui-checked': {
                    color: 'primary.main',
                  },
                }}
              />
            }
            label={option.label}
            sx={{
              '& .MuiFormControlLabel-label': {
                color: 'text.primary',
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
