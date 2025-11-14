import React from 'react';
import StyledTextField from './StyledTextField';

/**
 * StyledYearField - Central komponent til årstal-felter
 *
 * Denne komponent arver styling fra StyledTextField og tilføjer:
 * - Kun cifre tilladt (0-9)
 * - Maksimalt 4 cifre
 * - Automatisk fortolkning af 1-2 cifre ved blur
 * - Fejlmeddelelse ved 3 cifre eller ugyldigt årstal
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - value: Værdien i feltet (åååå format)
 * - onChange: Callback når værdien ændres
 * - minYear: Mindste tilladte årstal (number)
 * - maxYear: Største tilladte årstal (number)
 * - error: Boolean der indikerer fejl-tilstand
 * - helperText: Fejlbesked der vises under feltet
 */
const StyledYearField = React.forwardRef(({
  width = 80,
  value = '',
  onChange,
  onErrorChange,
  minYear,
  maxYear,
  error = false,
  helperText = '',
  ...otherProps
}, ref) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [errorState, setErrorState] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  // Synkroniser intern værdi med ekstern prop
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Intelligent år-fortolkning (genbrugt fra StyledDateField)
  const interpretYear = React.useCallback((yearStr) => {
    const currentYear = new Date().getFullYear();
    const yearNum = parseInt(yearStr, 10);

    if (yearStr.length === 1) {
      // 1 ciffer -> 200x
      return 2000 + yearNum;
    } else if (yearStr.length === 2) {
      // 2 cifre -> intelligent fortolkning
      const year20xx = 2000 + yearNum;
      const year19xx = 1900 + yearNum;

      if (year20xx > currentYear + 5) {
        return year19xx;
      }
      return year20xx;
    } else if (yearStr.length === 3) {
      // 3 cifre -> fejl
      return null;
    } else if (yearStr.length === 4) {
      // 4 cifre -> brug som de er
      return yearNum;
    }

    return null;
  }, []);

  // Valider årstal mod min/max
  const validateYearRange = React.useCallback((yearNum) => {
    if (minYear && maxYear && (yearNum < minYear || yearNum > maxYear)) {
      return `Årstallet skal være mellem ${minYear} og ${maxYear}`;
    }

    return true;
  }, [minYear, maxYear]);

  // Nulstil fejl
  const resetError = React.useCallback(() => {
    setErrorState(false);
    setErrorMessage('');
    if (onErrorChange) {
      onErrorChange(false);
    }
  }, [onErrorChange]);

  // Håndter input-ændringer
  const handleChange = React.useCallback((e) => {
    let input = e.target.value;

    // Fjern alle ikke-cifre
    input = input.replace(/\D/g, '');

    // Maksimalt 4 cifre
    input = input.slice(0, 4);

    setInternalValue(input);
    resetError();

    // Valider når der er indtastet 4 cifre
    if (input.length === 4) {
      const yearNum = parseInt(input, 10);
      const validationResult = validateYearRange(yearNum);
      if (validationResult !== true) {
        setErrorState(true);
        setErrorMessage(validationResult);
        if (onErrorChange) {
          onErrorChange(true);
        }
      }
    }

    // Kald onChange med den sanerede værdi
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
  }, [onChange, resetError, validateYearRange]);

  // Håndter blur for at finalisere årstal
  const handleBlur = React.useCallback((e) => {
    if (!internalValue) {
      // Tom værdi er OK
      return;
    }

    const yearStr = internalValue;

    // Tjek om år har ugyldig længde (3 cifre er ikke tilladt)
    if (yearStr.length === 3) {
      setErrorState(true);
      setErrorMessage('Ugyldig dato');
      if (onErrorChange) {
        onErrorChange(true);
      }
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
      setErrorState(true);
      setErrorMessage(validationResult);
      if (onErrorChange) {
        onErrorChange(true);
      }
    }
  }, [internalValue, interpretYear, validateYearRange, onChange, onErrorChange]);

  return (
    <StyledTextField
      ref={ref}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="åååå"
      width={width}
      error={error || errorState}
      helperText={helperText || errorMessage}
      sx={{
        '& input': { textAlign: 'center' },
      }}
      {...otherProps}
    />
  );
});

StyledYearField.displayName = 'StyledYearField';

export default StyledYearField;
