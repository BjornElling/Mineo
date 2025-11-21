import React from 'react';
import { InputBase, Tooltip } from '@mui/material';

/**
 * TableYearInput - Årstalsfelt til brug i tabeller
 *
 * Genbruger logik fra StyledYearField, men uden ramme.
 * Fejl vises som rød kant på cellen i stedet for tekstbesked.
 *
 * Features:
 * - Kun cifre tilladt (0-9)
 * - Maksimalt 4 cifre
 * - Automatisk fortolkning af 1-2 cifre ved blur
 * - Fejlmeddelelse ved 3 cifre eller ugyldigt årstal
 * - Rød kant ved fejl (hover viser fejlbesked)
 */
const TableYearInput = React.memo(({
  value = '',
  onChange,
  onBlur,
  minYear,
  maxYear,
  placeholder = '',
  inputRef,
  sx,
  ...otherProps
}) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);

  // Synkroniser intern værdi med ekstern prop og valider
  React.useEffect(() => {
    setInternalValue(value);
    // Valider værdien når den ændres udefra (fx ved genindlæsning)
    if (value && value.toString().trim() !== '') {
      // Tjek om værdien indeholder ugyldige tegn (ikke-tal)
      if (/[^0-9]/.test(value.toString())) {
        setHasError(true);
        setErrorMessage('Ugyldigt format');
        return;
      }
      if (value.length === 4) {
        const yearNum = parseInt(value, 10);
        if (!isNaN(yearNum)) {
          if (minYear && maxYear && (yearNum < minYear || yearNum > maxYear)) {
            setHasError(true);
            setErrorMessage(`År skal være mellem ${minYear} og ${maxYear}`);
            return;
          }
        }
      } else if (value.length === 3) {
        setHasError(true);
        setErrorMessage('Ugyldigt årstal');
        return;
      }
    }
    setHasError(false);
    setErrorMessage('');
  }, [value, minYear, maxYear]);

  // Intelligent år-fortolkning
  const interpretYear = React.useCallback((yearStr) => {
    const currentYear = new Date().getFullYear();
    const yearNum = parseInt(yearStr, 10);

    if (yearStr.length === 1) {
      return 2000 + yearNum;
    } else if (yearStr.length === 2) {
      const year20xx = 2000 + yearNum;
      const year19xx = 1900 + yearNum;
      if (year20xx > currentYear + 5) {
        return year19xx;
      }
      return year20xx;
    } else if (yearStr.length === 3) {
      return null;
    } else if (yearStr.length === 4) {
      return yearNum;
    }
    return null;
  }, []);

  // Valider årstal mod min/max
  const validateYearRange = React.useCallback((yearNum) => {
    if (minYear && maxYear && (yearNum < minYear || yearNum > maxYear)) {
      return `År skal være mellem ${minYear} og ${maxYear}`;
    }
    return true;
  }, [minYear, maxYear]);

  // Håndter input-ændringer
  const handleChange = React.useCallback((e) => {
    let input = e.target.value;

    // Fjern alle ikke-cifre
    input = input.replace(/\D/g, '');

    // Maksimalt 4 cifre
    input = input.slice(0, 4);

    setInternalValue(input);
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
  }, [onChange, validateYearRange]);

  // Håndter blur for at finalisere årstal
  const handleBlur = React.useCallback((e) => {
    setIsFocused(false);
    if (!internalValue) {
      if (onBlur) onBlur(e);
      return;
    }

    const yearStr = internalValue;

    // 3 cifre er ikke tilladt
    if (yearStr.length === 3) {
      setHasError(true);
      setErrorMessage('Ugyldigt årstal');
      if (onBlur) onBlur(e);
      return;
    }

    // Intelligent år-fortolkning for 1-2 cifre
    let finalYear = yearStr;
    if (yearStr.length === 1 || yearStr.length === 2) {
      const interpretedYear = interpretYear(yearStr);
      if (interpretedYear !== null) {
        finalYear = interpretedYear.toString();
        setInternalValue(finalYear);

        if (onChange) {
          const syntheticEvent = {
            ...e,
            target: {
              ...e.target,
              value: finalYear
            }
          };
          onChange(syntheticEvent);
        }
      }
    }

    // Valider årstal mod min/max
    const yearNum = parseInt(finalYear, 10);
    const validationResult = validateYearRange(yearNum);
    if (validationResult !== true) {
      setHasError(true);
      setErrorMessage(validationResult);
    }

    if (onBlur) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: finalYear
        }
      };
      onBlur(syntheticEvent);
    }
  }, [internalValue, interpretYear, validateYearRange, onChange, onBlur]);

  return (
    <Tooltip title={hasError && !isFocused ? errorMessage : ''} arrow placement="top">
      <InputBase
        inputRef={inputRef}
        value={internalValue}
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

TableYearInput.displayName = 'TableYearInput';

export default TableYearInput;
