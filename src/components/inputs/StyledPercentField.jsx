import React from 'react';
import StyledTextField from './StyledTextField';

/**
 * StyledPercentField - Felt til procentværdier med 2 decimaler
 *
 * Arver styling fra StyledTextField
 *
 * Features:
 * - Accepterer kun tal og ét komma
 * - Maksimalt 2 decimaler efter komma
 * - Begrænset til intervallet 0-100
 * - Viser % suffix når feltet ikke har fokus
 * - Fjerner decimaler hvis de er 0 (fx "12,00" → "12")
 * - Hård afskæring efter 2 decimaler (ingen afrunding)
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - value: Værdien i feltet
 * - onChange: Callback når værdien ændres
 * - placeholder: Placeholder tekst (default: "0 %")
 */
const StyledPercentField = React.forwardRef(({
  width = 100,
  value = '',
  onChange,
  onBlur,
  onFocus,
  onKeyDown,
  placeholder = '0 %',
  sx,
  ...otherProps
}, ref) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [hasFocus, setHasFocus] = React.useState(false);
  const originalValueRef = React.useRef(value);
  const inputRef = React.useRef(null);

  // Sync internal value med external value
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;

    // Fjern % hvis brugeren tastede det
    input = input.replace(/%/g, '').trim();

    // Tillad kun tal og komma
    input = input.replace(/[^0-9,]/g, '');

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

    // Begræns til 0-100 interval
    if (input && input !== ',') {
      const numericValue = parseFloat(input.replace(',', '.'));
      if (!isNaN(numericValue)) {
        if (numericValue < 0) {
          input = '0';
        } else if (numericValue > 100) {
          input = '100';
        }
      }
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

  // Håndter focus
  const handleFocus = (e) => {
    setHasFocus(true);
    // Gem oprindelig værdi (med % suffix) FØR vi fjerner det
    originalValueRef.current = internalValue;

    // Fjern % suffix når feltet får fokus
    let rawValue = internalValue;
    if (typeof rawValue === 'string' && rawValue.includes('%')) {
      rawValue = rawValue.replace(/%/g, '').trim();
      setInternalValue(rawValue);
    }

    if (onFocus) {
      onFocus(e);
    }
  };

  // Håndter Escape-tast for at fortryde ændringer
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      // Gendan den oprindelige værdi (med % suffix)
      setInternalValue(originalValueRef.current);
      if (onChange) {
        const syntheticEvent = {
          target: { value: originalValueRef.current }
        };
        onChange(syntheticEvent);
      }
      // Fjern tekstmarkør visuelt men behold fokus
      const input = inputRef.current?.querySelector('input');
      if (input) {
        input.setSelectionRange(0, 0);
        input.style.caretColor = 'transparent';
      }
    }
    // Kald ekstern onKeyDown hvis den findes
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Håndter blur for at formatere
  const handleBlur = (e) => {
    setHasFocus(false);

    if (!internalValue || internalValue.trim() === '' || internalValue === ',') {
      // Tøm feltet hvis det er tomt eller kun indeholder komma
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

    // Konverter til tal
    const numericValue = parseFloat(internalValue.replace(',', '.'));

    // Hvis værdien ikke er et gyldigt tal, tøm feltet
    if (isNaN(numericValue)) {
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

    // Begræns til 0-100
    const clampedValue = Math.max(0, Math.min(100, numericValue));

    // Formatér værdien
    let formatted;

    // Tjek om der var decimaler i inputtet
    const hasDecimals = internalValue.includes(',');

    if (hasDecimals) {
      // Formatér med max 2 decimaler, fjern trailing zeros
      formatted = clampedValue.toFixed(2).replace('.', ',').replace(/,00$/, '').replace(/0$/, '').replace(/,$/, '');
    } else {
      // Heltal - ingen decimaler
      formatted = Math.round(clampedValue).toString();
    }

    // Tilføj % suffix
    formatted = formatted + ' %';

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

  return (
    <StyledTextField
      ref={(node) => {
        inputRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      onKeyDown={handleKeyDown}
      placeholder={hasFocus ? '' : placeholder}
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

StyledPercentField.displayName = 'StyledPercentField';

export default StyledPercentField;
