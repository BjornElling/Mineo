import React from 'react';
import { TextField } from '@mui/material';

/**
 * StyledTextField - Central komponent til tekstfelter
 *
 * Denne komponent definerer det standardiserede udseende for alle tekstfelter
 * i applikationen. Ændringer her slår igennem på alle steder, hvor komponenten bruges.
 *
 * Features:
 * - Automatisk trimming af mellemrum ved blur
 * - Moderne, fladt design med afrundede hjørner
 * - Placeholder forsvinder når feltet er aktivt
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - placeholder: Placeholder-tekst (valgfrit)
 * - value: Værdien i feltet
 * - onChange: Callback når værdien ændres
 * - Andre standard TextField props (select, size, variant, osv.)
 */
const StyledTextField = React.forwardRef(({
  width = 300,
  placeholder,
  value,
  onChange,
  onBlur,
  sx = {},
  ...otherProps
}, ref) => {
  const [isFocused, setIsFocused] = React.useState(false);

  const handleFocus = React.useCallback((e) => {
    setIsFocused(true);
  }, []);

  const handleBlur = React.useCallback((e) => {
    setIsFocused(false);

    // Trim mellemrum før og efter
    if (value && typeof value === 'string') {
      const trimmedValue = value.trim();
      if (trimmedValue !== value && onChange) {
        // Opret et syntetisk event med den trimmede værdi
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: trimmedValue
          }
        };
        onChange(syntheticEvent);
      }
    }

    // Kald original onBlur hvis den findes
    if (onBlur) {
      onBlur(e);
    }
  }, [value, onChange, onBlur]);

  return (
    <TextField
      ref={ref}
      value={value}
      onChange={onChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={isFocused ? '' : placeholder}
      autoComplete="off"
      size="small"
      variant="outlined"
      sx={{
        width: typeof width === 'number' ? `${width}px` : width,
        position: 'relative',
        '& .MuiOutlinedInput-root': {
          backgroundColor: '#ffffff',
          borderRadius: '10px',
          '& fieldset': {
            borderColor: 'rgba(0, 0, 0, 0.12)',
            borderWidth: '1px',
          },
          '&:hover fieldset': {
            borderColor: 'rgba(0, 0, 0, 0.25)',
          },
          '&.Mui-focused fieldset': {
            borderColor: '#1976d2',
            borderWidth: '1px',
          },
          '&.Mui-error fieldset': {
            borderColor: '#d32f2f',
            borderWidth: '1px',
          },
          '&.Mui-error:hover fieldset': {
            borderColor: '#d32f2f',
          },
          '&.Mui-error.Mui-focused fieldset': {
            borderColor: '#d32f2f',
            borderWidth: '1px',
          },
        },
        '& .MuiInputBase-input::placeholder': {
          color: 'rgba(0, 0, 0, 0.4)',
          opacity: 1,
        },
        '& .MuiFormHelperText-root': {
          position: 'absolute',
          bottom: '-17px',
          left: '0',
          margin: '0',
          whiteSpace: 'nowrap',
          overflow: 'visible',
        },
        ...sx,
      }}
      {...otherProps}
    />
  );
});

StyledTextField.displayName = 'StyledTextField';

export default StyledTextField;
