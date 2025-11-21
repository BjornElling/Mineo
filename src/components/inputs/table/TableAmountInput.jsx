import React from 'react';
import { InputBase, Tooltip } from '@mui/material';

/**
 * TableAmountInput - Beløbsfelt til brug i tabeller
 *
 * Genbruger formateringslogik fra StyledAmountField, men uden ramme og "kr." suffix.
 * Fejl vises som rød kant på cellen i stedet for tekstbesked.
 *
 * Features:
 * - Accepterer kun tal og ét komma
 * - Maksimalt 2 decimaler efter komma
 * - Auto-formatering ved blur (tilføjer ,00 hvis mangler)
 * - Tusindtalsseparator (punktum)
 * - Hård afskæring efter 2 decimaler (ingen afrunding)
 * - Rød kant ved fejl (hover viser fejlbesked)
 */
const TableAmountInput = React.memo(({
  value = '',
  onChange,
  onBlur,
  onKeyDown,
  placeholder = '0,00',
  inputRef,
  sx,
  ...otherProps
}) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [hasError, setHasError] = React.useState(false);
  const [isFocused, setIsFocused] = React.useState(false);
  const originalValueRef = React.useRef(value);
  const internalInputRef = React.useRef(null);

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
    setIsFocused(false);
    if (!internalValue || internalValue.trim() === '') {
      setHasError(false);
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
      setHasError(false);
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
    let integerPart = parts[0] || '0';
    let decimalPart = parts[1] || '';

    // Hvis heltalsdelen er tom, sæt til 0
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

  // Håndter focus - gem oprindelig værdi
  const handleFocus = (e) => {
    setIsFocused(true);
    originalValueRef.current = internalValue;
    // Gendan caret-farve (kan være skjult efter Escape)
    e.target.style.caretColor = '';
  };

  // Håndter Escape-tast for at fortryde ændringer
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Gendan den oprindelige værdi
      setInternalValue(originalValueRef.current);
      if (onChange) {
        const syntheticEvent = {
          target: { value: originalValueRef.current }
        };
        onChange(syntheticEvent);
      }
      // Fjern tekstmarkør visuelt men behold fokus
      if (internalInputRef.current) {
        internalInputRef.current.setSelectionRange(0, 0);
        internalInputRef.current.style.caretColor = 'transparent';
      }
    }
    // Kald ekstern onKeyDown hvis den findes
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  return (
    <Tooltip title={hasError && !isFocused ? 'Ugyldig værdi' : ''} arrow placement="top">
      <InputBase
        inputRef={(node) => {
          internalInputRef.current = node;
          if (typeof inputRef === 'function') {
            inputRef(node);
          } else if (inputRef) {
            inputRef.current = node;
          }
        }}
        value={internalValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        sx={{
          width: '100%',
          height: '100%',
          padding: '4px 8px',
          border: '1px solid',
          borderColor: hasError ? 'error.main' : 'transparent',
          borderRadius: '4px',
          backgroundColor: 'transparent',
          '&:focus-within': {
            borderColor: 'primary.main',
          },
          '& .MuiInputBase-input': {
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            padding: 0,
          },
          ...sx,
        }}
        {...otherProps}
      />
    </Tooltip>
  );
});

TableAmountInput.displayName = 'TableAmountInput';

export default TableAmountInput;
