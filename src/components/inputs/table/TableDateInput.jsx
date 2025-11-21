import React from 'react';
import { InputBase, Tooltip } from '@mui/material';

/**
 * TableDateInput - Datofelt til brug i tabeller
 *
 * Genbruger logik fra StyledDateField, men uden ramme.
 * Fejl vises som rød kant på cellen i stedet for tekstbesked.
 *
 * Features:
 * - Formaterer automatisk til dd-mm-åååå
 * - Accepterer bindestreg, punktum, mellemrum eller kolon som separator
 * - Intelligent år-fortolkning (1-4 cifre)
 * - Validering af dato-gyldighed (inkl. skudår)
 * - Rød kant ved fejl (hover viser fejlbesked)
 */
const TableDateInput = React.memo(({
  value = '',
  onChange,
  onBlur,
  onKeyDown,
  minDate,
  maxDate,
  placeholder = '',
  inputRef,
  sx,
  ...otherProps
}) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [hasError, setHasError] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const originalValueRef = React.useRef(value);
  const internalInputRef = React.useRef(null);

  // Sync internal value med external value
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Tjek om år er skudår
  const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  };

  // Valider dato-gyldighed
  const isValidDate = (day, month, year) => {
    if (day < 1 || day > 31) return false;
    if (month < 1 || month > 12) return false;
    const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month - 1]) return false;
    return true;
  };

  // Intelligent år-fortolkning
  const interpretYear = (yearStr) => {
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
  };

  const createDate = (year, monthIndex, day) => {
    const date = new Date(year, monthIndex, day);
    date.setFullYear(year);
    return date;
  };

  const parseISODate = (isoDate) => {
    if (!isoDate) return null;
    const [year, month, day] = isoDate.split('-').map(Number);
    return createDate(year, month - 1, day);
  };

  const formatISOToDanish = (isoDate) => {
    const [year, month, day] = isoDate.split('-');
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  };

  // Valider mod min/max datoer
  const validateDateRange = (dateStr) => {
    if (!dateStr || dateStr.length < 10) return true;

    const [day, month, year] = dateStr.split('-').map(Number);
    const date = createDate(year, month - 1, day);

    const min = parseISODate(minDate);
    const max = parseISODate(maxDate);

    if ((min && date < min) || (max && date > max)) {
      return `Dato skal være mellem ${formatISOToDanish(minDate)} og ${formatISOToDanish(maxDate)}`;
    }
    return true;
  };

  // Hjælpefunktion til at tjekke om en dato er formatmæssigt gyldig
  const isDateFormatValid = (day, month, year) => {
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);

    if (dayNum < 1 || dayNum > 31) return false;
    if (monthNum < 1 || monthNum > 12) return false;

    if (year && year.length === 4) {
      const yearNum = parseInt(year, 10);
      return isValidDate(dayNum, monthNum, yearNum);
    }
    return isValidDate(dayNum, monthNum, 2024);
  };

  // Central valideringsfunktion
  const validateDate = React.useCallback((dateStr) => {
    const parts = dateStr.split('-');
    const day = parts[0] || '';
    const month = parts[1] || '';
    const year = parts[2] || '';

    if (day.length === 2 && month.length === 2) {
      if (!isDateFormatValid(day, month, year)) {
        setHasError(true);
        setErrorMessage('Ugyldig dato');
        return;
      }
    } else if (day.length === 2) {
      const dayNum = parseInt(day, 10);
      if (dayNum < 1 || dayNum > 31) {
        setHasError(true);
        setErrorMessage('Ugyldig dato');
        return;
      }
    } else if (month.length === 2) {
      const monthNum = parseInt(month, 10);
      if (monthNum < 1 || monthNum > 12) {
        setHasError(true);
        setErrorMessage('Ugyldig dato');
        return;
      }
    }

    if (year.length === 4 && day.length === 2 && month.length === 2) {
      const rangeError = validateDateRange(dateStr);
      if (rangeError !== true) {
        setHasError(true);
        setErrorMessage(rangeError);
        return;
      }
    }

    setHasError(false);
    setErrorMessage('');
  }, [minDate, maxDate]);

  // Valider værdien når den ændres udefra (fx ved genindlæsning)
  React.useEffect(() => {
    if (value && value.trim() !== '') {
      validateDate(value);
    } else {
      setHasError(false);
      setErrorMessage('');
    }
  }, [value, validateDate]);

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;
    const isDeleting = input.length < internalValue.length;

    // Ved sletning: kun fjern ugyldige tegn, ingen formatering
    if (isDeleting) {
      input = input.replace(/[^\d-]/g, '');
      setInternalValue(input);
      setHasError(false);
      setErrorMessage('');
      if (onChange) {
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: input }
        };
        onChange(syntheticEvent);
      }
      return;
    }

    // Ved tilføjelse: konverter separatorer og formater
    input = input.replace(/[ .:]/g, '-');
    input = input.replace(/-+/g, '-');
    input = input.replace(/^-+/, '');
    input = input.replace(/[^\d-]/g, '');

    const parts = input.split('-');
    let formatted = '';

    if (parts[0]) {
      formatted = parts[0].slice(0, 2);
    }

    if (parts.length > 1) {
      formatted += '-' + parts[1].slice(0, 2);
    }

    if (parts.length > 2) {
      formatted += '-' + parts[2].slice(0, 4);
    }

    setInternalValue(formatted);
    // Ryd fejl under indtastning - validering sker ved blur
    setHasError(false);
    setErrorMessage('');

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
  };

  // Håndter blur for at finalisere dato
  const handleBlur = (e) => {
    setIsFocused(false);
    const parts = internalValue.split('-');

    if (!internalValue || internalValue.trim() === '') {
      setHasError(false);
      setErrorMessage('');
      if (onBlur) onBlur(e);
      return;
    }

    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
      setHasError(true);
      setErrorMessage('Ugyldig dato');
      if (onBlur) onBlur(e);
      return;
    }

    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    let finalValue = `${day}-${month}-${year}`;

    if (year.length === 3) {
      setHasError(true);
      setErrorMessage('Ugyldig dato');
      if (onBlur) onBlur(e);
      return;
    }

    if (year.length === 1 || year.length === 2) {
      const interpretedYear = interpretYear(year);
      if (interpretedYear !== null) {
        finalValue = `${day}-${month}-${interpretedYear}`;
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
      }
    } else {
      if (finalValue !== internalValue) {
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
      }
    }

    validateDate(finalValue);

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
      // Ryd eventuelle fejl og genvalider oprindelig værdi
      if (originalValueRef.current && originalValueRef.current.trim() !== '') {
        validateDate(originalValueRef.current);
      } else {
        setHasError(false);
        setErrorMessage('');
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
    <Tooltip title={hasError && !isFocused ? errorMessage : ''} arrow placement="top">
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

TableDateInput.displayName = 'TableDateInput';

export default TableDateInput;
