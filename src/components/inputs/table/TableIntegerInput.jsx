import React from 'react';
import { InputBase, Tooltip } from '@mui/material';

/**
 * TableIntegerInput - Heltals-felt til brug i tabeller
 *
 * Genbruger valideringslogik fra StyledIntegerField, men uden ramme.
 * Fejl vises som rød kant på cellen i stedet for tekstbesked.
 *
 * Features:
 * - Accepterer kun tal-input (0-9)
 * - Validering mod min/max værdier
 * - Rød kant ved fejl (hover viser fejlbesked)
 * - Tømmer feltet hvis værdien er 0 ved blur
 */
const TableIntegerInput = React.memo(({
  value = '',
  onChange,
  onBlur,
  minValue,
  maxValue,
  placeholder = '',
  inputRef,
  sx,
  ...otherProps
}) => {
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);

  const maxDigits = React.useMemo(() => {
    if (typeof maxValue === 'number') {
      return Math.abs(maxValue).toString().length;
    }
    return null;
  }, [maxValue]);

  // Valider værdi ved mount og når value ændres udefra
  React.useEffect(() => {
    if (value && value.toString().trim() !== '') {
      // Tjek om værdien indeholder ugyldige tegn (ikke-tal)
      if (/[^0-9]/.test(value.toString())) {
        setHasError(true);
        setErrorMessage('Ugyldigt format');
        return;
      }
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue) && numValue !== 0) {
        if (minValue !== undefined && maxValue !== undefined) {
          if (numValue < minValue || numValue > maxValue) {
            setHasError(true);
            setErrorMessage(`Værdi skal være mellem ${minValue} og ${maxValue}`);
            return;
          }
        }
      }
    }
    setHasError(false);
    setErrorMessage('');
  }, [value, minValue, maxValue]);

  // Valider værdi mod min/max
  const validateValue = React.useCallback((val) => {
    if (!val || val.trim() === '') {
      setHasError(false);
      setErrorMessage('');
      return;
    }

    const numValue = parseInt(val, 10);

    if (isNaN(numValue)) {
      setHasError(false);
      setErrorMessage('');
      return;
    }

    // Hvis værdien er 0, vis ingen fejl (den tømmes bare ved blur)
    if (numValue === 0) {
      setHasError(false);
      setErrorMessage('');
      return;
    }

    if (minValue !== undefined && maxValue !== undefined) {
      if (numValue < minValue || numValue > maxValue) {
        setHasError(true);
        setErrorMessage(`Værdi skal være mellem ${minValue} og ${maxValue}`);
        return;
      }
    }

    setHasError(false);
    setErrorMessage('');
  }, [minValue, maxValue]);

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;

    // Tillad kun cifre (0-9)
    input = input.replace(/[^0-9]/g, '');

    // Begræns antal cifre baseret på maxValue
    if (maxDigits !== null && input.length > maxDigits) {
      input = input.slice(0, maxDigits);
    }

    // Ryd fejl under indtastning - validering sker ved blur
    setHasError(false);
    setErrorMessage('');

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

  // Håndter blur for at validere
  const handleBlur = (e) => {
    setIsFocused(false);
    // Hvis værdien er 0, tøm feltet
    if (value === '0') {
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: {
            ...e.target,
            value: ''
          }
        };
        onChange(syntheticEvent);
      }
      setHasError(false);
      setErrorMessage('');
      if (onBlur) {
        onBlur(e);
      }
      return;
    }

    validateValue(value);

    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <Tooltip title={hasError && !isFocused ? errorMessage : ''} arrow placement="top">
      <InputBase
        inputRef={inputRef}
        value={value}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
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
            textAlign: 'center',
            padding: 0,
          },
          ...sx,
        }}
        {...otherProps}
      />
    </Tooltip>
  );
});

TableIntegerInput.displayName = 'TableIntegerInput';

export default TableIntegerInput;
