import React from 'react';
import { MenuItem } from '@mui/material';
import StyledTextField from './StyledTextField';

/**
 * StyledDropdown - Central komponent til dropdown-felter
 *
 * Denne komponent arver styling fra StyledTextField og tilføjer dropdown-funktionalitet.
 * Ændringer i StyledTextField slår automatisk igennem her.
 *
 * Features:
 * - Arver moderne, fladt design fra StyledTextField
 * - Placeholder vises indtil værdi vælges
 * - Placeholder er ikke en del af dropdown-listen
 * - Brugeren kan slette valgt værdi for at vise placeholder igen
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - placeholder: Placeholder-tekst (valgfrit)
 * - value: Værdien i feltet
 * - onChange: Callback når værdien ændres
 * - children: MenuItem-komponenter med valgmuligheder
 * - Andre standard TextField props
 */
const StyledDropdown = React.forwardRef(({
  width = 200,
  placeholder = '',
  value,
  onChange,
  onFocus,
  children,
  sx,
  ...otherProps
}, ref) => {
  // Håndter sletning af værdi via Backspace/Delete
  const handleKeyDown = React.useCallback((e) => {
    if ((e.key === 'Backspace' || e.key === 'Delete') && value) {
      e.preventDefault();
      // Opret et syntetisk event med tom værdi
      const syntheticEvent = {
        target: {
          value: ''
        }
      };
      if (onChange) {
        onChange(syntheticEvent);
      }
    }
  }, [value, onChange]);

  return (
    <StyledTextField
      ref={ref}
      select
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      displayEmpty
      width={width}
      SelectProps={{
        displayEmpty: true,
        renderValue: (selected) => {
          if (!selected || selected === '') {
            return <span style={{ color: 'rgba(0, 0, 0, 0.4)' }}>{placeholder}</span>;
          }
          // Find den valgte MenuItem for at vise dens label
          const selectedChild = React.Children.toArray(children).find(
            (child) => child.props.value === selected
          );
          return selectedChild ? selectedChild.props.children : selected;
        },
      }}
      sx={{
        // Fokus-indikator for dropdown-felter - matcher almindelige input-felter
        '& .MuiOutlinedInput-root.Mui-focused fieldset': {
          borderColor: '#1976d2 !important',
          borderWidth: '1px !important',
        },
        // Keyboard-fokus (Tab) via :has — moderne browsere
        '& .MuiOutlinedInput-root:has(input:focus) fieldset': {
          borderColor: '#1976d2 !important',
          borderWidth: '1px !important',
        },
        // Fokus-indikator når dropdown er åben (klik eller keyboard)
        '& .MuiOutlinedInput-root[aria-expanded="true"] fieldset': {
          borderColor: '#1976d2 !important',
          borderWidth: '1px !important',
        },
        ...sx,
      }}
      {...otherProps}
    >
      {children}
    </StyledTextField>
  );
});

StyledDropdown.displayName = 'StyledDropdown';

export default StyledDropdown;
