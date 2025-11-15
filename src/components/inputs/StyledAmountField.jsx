import React from 'react';
import StyledTextField from './StyledTextField';

/**
 * StyledAmountField - Felt til beløb med 2 decimaler
 *
 * Arver styling fra StyledTextField
 *
 * Features:
 * - Accepterer kun tal og ét komma
 * - Maksimalt 2 decimaler efter komma
 * - Auto-formatering ved blur (tilføjer ,00 hvis mangler)
 * - Hård afskæring efter 2 decimaler (ingen afrunding)
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - value: Værdien i feltet
 * - onChange: Callback når værdien ændres
 * - placeholder: Placeholder tekst (default: "0,00")
 */
const StyledAmountField = React.forwardRef(({
  width = 120,
  value = '',
  onChange,
  onBlur,
  placeholder = '0,00',
  sx,
  ...otherProps
}, ref) => {
  const [internalValue, setInternalValue] = React.useState(value);

  // Sync internal value med external value
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;

    // Tillad kun tal, komma og punktum
    input = input.replace(/[^0-9,.]/g, '');

    // Fjern alle punktummer (tusindtalsseparatorer) - de tilføjes automatisk ved blur
    input = input.replace(/\./g, '');

    // Split i heltal og decimaler
    const parts = input.split(',');
    let integerPart = parts[0] || '';
    let decimalPart = parts[1] || '';

    // Begræns decimaler til 2 cifre (hård afskæring)
    if (decimalPart.length > 2) {
      decimalPart = decimalPart.slice(0, 2);
    }

    // Gensammensæt
    if (parts.length > 1) {
      input = integerPart + ',' + decimalPart;
    } else {
      input = integerPart;
    }

    // Håndter tilfælde med flere kommaer
    const commaCount = (input.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Behold kun første komma
      const firstCommaIndex = input.indexOf(',');
      input = input.slice(0, firstCommaIndex + 1) + input.slice(firstCommaIndex + 1).replace(/,/g, '');
    }

    setInternalValue(input);

    if (onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: input
        }
      };
      onChange(syntheticEvent);
    }
  };

  // Håndter blur for at formatere
  const handleBlur = (e) => {
    if (!internalValue || internalValue.trim() === '') {
      // Kald ekstern onBlur hvis den findes
      if (onBlur) {
        onBlur(e);
      }
      return;
    }

    // Konverter til tal for at tjekke om værdien er større end 0
    const numericValue = parseFloat(internalValue.replace(',', '.'));

    // Hvis værdien ikke er et gyldigt tal eller er 0 eller mindre, tøm feltet
    if (isNaN(numericValue) || numericValue <= 0) {
      const finalValue = '';
      setInternalValue(finalValue);
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: finalValue
          }
        };
        onChange(syntheticEvent);
      }
      // Kald ekstern onBlur efter formatering er færdig
      if (onBlur) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: finalValue
          }
        };
        onBlur(syntheticEvent);
      }
      return;
    }

    let formatted = internalValue;

    // Split i heltal og decimaler
    const parts = formatted.split(',');
    let integerPart = parts[0] || '0'; // Hvis tom, brug 0
    let decimalPart = parts[1] || '';

    // Hvis heltalsdelen er tom eller kun indeholder tomme strenge, sæt til 0
    if (!integerPart || integerPart.trim() === '') {
      integerPart = '0';
    }

    // Pad decimaler til 2 cifre
    if (decimalPart.length === 0) {
      decimalPart = '00';
    } else if (decimalPart.length === 1) {
      decimalPart = decimalPart + '0';
    }

    // Tilføj tusindtalsseparatorer til heltalsdelen
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    // Kombiner til endelig formatering
    formatted = integerPart + ',' + decimalPart;

    setInternalValue(formatted);

    if (onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted
        }
      };
      onChange(syntheticEvent);
    }

    // Kald ekstern onBlur efter formatering er færdig
    if (onBlur) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: formatted
        }
      };
      onBlur(syntheticEvent);
    }
  };

  return (
    <StyledTextField
      ref={ref}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      width={width}
      sx={{
        '& .MuiInputBase-input': {
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        },
        ...sx,
      }}
      {...otherProps}
    />
  );
});

StyledAmountField.displayName = 'StyledAmountField';

export default StyledAmountField;
