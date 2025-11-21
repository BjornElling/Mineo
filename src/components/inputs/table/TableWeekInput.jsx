import React from 'react';
import { InputBase, Tooltip } from '@mui/material';

/**
 * TableWeekInput - Ugefelt til brug i tabeller
 *
 * Genbruger logik fra StyledWeekField, men uden ramme.
 * Fejl vises som rød kant på cellen i stedet for tekstbesked.
 *
 * Features:
 * - Formaterer automatisk til uu/åååå
 * - Accepterer bindestreg, punktum, mellemrum eller skråstreg som separator
 * - Intelligent år-fortolkning (1-4 cifre)
 * - Validering af uge-gyldighed (1-53 med ISO 8601 tjek)
 * - Rød kant ved fejl (hover viser fejlbesked)
 */
const TableWeekInput = React.memo(({
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

  // Tjek om et år har 53 uger (ISO 8601)
  const yearHas53Weeks = React.useCallback((year) => {
    const dec31 = new Date(year, 11, 31);
    const dayOfWeek = dec31.getDay();
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
    return dayOfWeek === 4 || (isLeapYear && dayOfWeek === 5);
  }, []);

  // Sync internal value med external value og valider
  React.useEffect(() => {
    setInternalValue(value);
    // Valider værdien når den ændres udefra (fx ved genindlæsning)
    if (value && value.trim() !== '') {
      // Tjek om formatet er ugyldigt (forventer uu/åååå)
      if (!value.includes('/')) {
        setHasError(true);
        setErrorMessage('Ugyldigt format');
        return;
      }
      const parts = value.split('/');
      if (parts.length === 2 && parts[1].length === 4) {
        const week = parseInt(parts[0], 10);
        const year = parseInt(parts[1], 10);
        if (!isNaN(week) && !isNaN(year)) {
          // Tjek årsinterval
          if ((minYear && year < minYear) || (maxYear && year > maxYear)) {
            setHasError(true);
            setErrorMessage(`År skal være mellem ${minYear} og ${maxYear}`);
            return;
          }
          // Tjek uge-gyldighed
          const maxWeek = yearHas53Weeks(year) ? 53 : 52;
          if (week < 1 || week > maxWeek) {
            setHasError(true);
            setErrorMessage('Ugyldigt ugenummer');
            return;
          }
        }
      } else {
        setHasError(true);
        setErrorMessage('Ugyldigt format');
        return;
      }
    }
    setHasError(false);
    setErrorMessage('');
  }, [value, minYear, maxYear, yearHas53Weeks]);

  // Valider uge-gyldighed
  const isValidWeek = (week, year) => {
    if (week < 1) return false;
    const maxWeek = yearHas53Weeks(year) ? 53 : 52;
    if (week > maxWeek) return false;
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

  // Valider mod min/max år
  const validateYearRange = (year) => {
    if (!year) return true;
    if ((minYear && year < minYear) || (maxYear && year > maxYear)) {
      return `År skal være mellem ${minYear} og ${maxYear}`;
    }
    return true;
  };

  // Central valideringsfunktion
  const validateWeek = React.useCallback((weekStr) => {
    const parts = weekStr.split('/');
    const week = parts[0] || '';
    const year = parts[1] || '';

    if (week.length > 0) {
      const weekNum = parseInt(week, 10);
      if (isNaN(weekNum) || weekNum < 1) {
        setHasError(true);
        setErrorMessage('Ugyldig uge');
        return;
      }

      if (year.length === 4) {
        const yearNum = parseInt(year, 10);
        if (!isValidWeek(weekNum, yearNum)) {
          const maxWeek = yearHas53Weeks(yearNum) ? 53 : 52;
          setHasError(true);
          setErrorMessage(`Uge skal være mellem 1 og ${maxWeek}`);
          return;
        }
      } else if (weekNum > 53) {
        setHasError(true);
        setErrorMessage('Uge skal være mellem 1 og 53');
        return;
      }
    }

    if (year.length === 4 && week.length > 0) {
      const yearNum = parseInt(year, 10);
      const rangeError = validateYearRange(yearNum);
      if (rangeError !== true) {
        setHasError(true);
        setErrorMessage(rangeError);
        return;
      }
    }

    setHasError(false);
    setErrorMessage('');
  }, [minYear, maxYear]);

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;
    const isDeleting = input.length < internalValue.length;

    // Ved sletning: kun fjern ugyldige tegn, ingen formatering
    if (isDeleting) {
      input = input.replace(/[^\d/]/g, '');
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
    input = input.replace(/[ .:-]/g, '/');
    input = input.replace(/\/+/g, '/');
    input = input.replace(/^\/+/, '');
    input = input.replace(/[^\d/]/g, '');

    const parts = input.split('/');
    let formatted = '';

    if (parts[0]) {
      formatted = parts[0].slice(0, 2);
    }

    if (parts.length > 1) {
      formatted += '/' + parts[1].slice(0, 4);
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

  // Håndter blur for at finalisere uge
  const handleBlur = (e) => {
    setIsFocused(false);
    const parts = internalValue.split('/');

    if (!internalValue || internalValue.trim() === '') {
      setHasError(false);
      setErrorMessage('');
      if (onBlur) onBlur(e);
      return;
    }

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setHasError(true);
      setErrorMessage('Ugyldigt format');
      if (onBlur) onBlur(e);
      return;
    }

    const week = parts[0].padStart(2, '0');
    const year = parts[1];
    let finalValue = `${week}/${year}`;

    if (year.length === 3) {
      setHasError(true);
      setErrorMessage('Ugyldigt årstal');
      if (onBlur) onBlur(e);
      return;
    }

    if (year.length === 1 || year.length === 2) {
      const interpretedYear = interpretYear(year);
      if (interpretedYear !== null) {
        finalValue = `${week}/${interpretedYear}`;
      } else {
        setHasError(true);
        setErrorMessage('Ugyldigt årstal');
        if (onBlur) onBlur(e);
        return;
      }
    }

    // Opdater værdien med formateret uge og år
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

    // Valider ugen efter årstallet er udfyldt
    const weekNum = parseInt(week, 10);
    const yearNum = parseInt(finalValue.split('/')[1], 10);
    if (!isValidWeek(weekNum, yearNum)) {
      const maxWeek = yearHas53Weeks(yearNum) ? 53 : 52;
      setHasError(true);
      setErrorMessage(`Uge skal være mellem 1 og ${maxWeek}`);
    } else {
      validateWeek(finalValue);
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
  };

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

TableWeekInput.displayName = 'TableWeekInput';

export default TableWeekInput;
