import React from 'react';
import StyledTextField from './StyledTextField';

/**
 * StyledDateField - Intelligent datoindtastningsfelt
 *
 * Denne komponent arver styling fra StyledTextField og tilføjer intelligent datohåndtering.
 *
 * Features:
 * - Formaterer automatisk til dd-mm-åååå
 * - Accepterer bindestreg, punktum, mellemrum eller kolon som separator (konverterer til bindestreg)
 * - Intelligent år-fortolkning (1-4 cifre)
 * - Validering af dato-gyldighed (inkl. skudår)
 * - Kræver min/max dato-grænser fra dateRanges
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - value: Værdien i feltet (dd-mm-åååå format)
 * - onChange: Callback når værdien ændres
 * - minDate: Mindste tilladte dato (ISO format: åååå-mm-dd)
 * - maxDate: Største tilladte dato (ISO format: åååå-mm-dd)
 * - error: Boolean der indikerer fejl-tilstand
 * - helperText: Fejlbesked der vises under feltet
 */
const StyledDateField = React.forwardRef(({
  width = 120,
  value = '',
  onChange,
  minDate,
  maxDate,
  error = false,
  helperText = '',
  ...otherProps
}, ref) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [errorState, setErrorState] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

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
  };

  // Valider mod min/max datoer
  const validateDateRange = (dateStr) => {
    if (!dateStr || dateStr.length < 10) return true; // Ikke komplet endnu

    const [day, month, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    if (minDate) {
      const min = new Date(minDate);
      if (date < min) {
        return `Dato må ikke være før ${formatISOToDanish(minDate)}`;
      }
    }

    if (maxDate) {
      const max = new Date(maxDate);
      if (date > max) {
        return `Dato må ikke være efter ${formatISOToDanish(maxDate)}`;
      }
    }

    return true;
  };

  // Hjælpefunktion til at formatere ISO dato til dansk
  const formatISOToDanish = (isoDate) => {
    const [year, month, day] = isoDate.split('-');
    return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
  };

  // Central valideringsfunktion
  const validateDate = (dateStr) => {
    const parts = dateStr.split('-');
    const day = parts[0] || '';
    const month = parts[1] || '';
    const year = parts[2] || '';

    // Tjek dd hvis 2 cifre er indtastet
    if (day.length === 2) {
      const dayNum = parseInt(day, 10);
      if (dayNum < 1 || dayNum > 31) {
        setErrorState(true);
        setErrorMessage('Dag skal være mellem 1 og 31');
        return;
      }
    }

    // Tjek mm hvis 2 cifre er indtastet
    if (month.length === 2) {
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);

      if (monthNum < 1 || monthNum > 12) {
        setErrorState(true);
        setErrorMessage('Måned skal være mellem 1 og 12');
        return;
      }

      // Tjek om dd er gyldig for denne måned (inkl. skudår-logik for februar)
      if (day.length === 2) {
        // Brug et vilkårligt skudår for at tjekke maksimale dage
        const testYear = 2024; // Et skudår
        if (!isValidDate(dayNum, monthNum, testYear)) {
          setErrorState(true);
          setErrorMessage('Ugyldig dato for denne måned');
          return;
        }
      }
    }

    // Tjek åååå hvis 4 cifre er indtastet
    if (year.length === 4 && day.length === 2 && month.length === 2) {
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);

      // Tjek om dd-mm er gyldig for dette specifikke år
      if (!isValidDate(dayNum, monthNum, yearNum)) {
        setErrorState(true);
        setErrorMessage('Ugyldig dato');
        return;
      }

      // Tjek om datoen er inden for de tilladte fra- og til-datoer
      const rangeError = validateDateRange(dateStr);
      if (rangeError !== true) {
        setErrorState(true);
        setErrorMessage(rangeError);
        return;
      }
    }

    // Hvis vi kom hertil uden fejl, ryd fejlstatus
    setErrorState(false);
    setErrorMessage('');
  };

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;

    // Erstat alle ikke-tal med bindestreg
    input = input.replace(/\D/g, '-');

    // Kollaps flere bindestreger i træk til én enkelt bindestreg
    input = input.replace(/-+/g, '-');

    // Fjern bindestreger fra starten
    input = input.replace(/^-+/, '');

    // Split i dele
    const parts = input.split('-');
    let formatted = '';

    // Håndter dag (dd)
    if (parts[0]) {
      let day = parts[0].slice(0, 2);
      // Hvis der er indtastet en separator efter enkelt ciffer, pad med 0
      if (parts.length > 1 && day.length === 1) {
        day = day.padStart(2, '0');
      }
      formatted = day;
    }

    // Håndter måned (mm)
    if (parts.length > 1) {
      let month = parts[1].slice(0, 2);
      // Hvis der er indtastet en separator efter enkelt ciffer, pad med 0
      if (parts.length > 2 && month.length === 1) {
        month = month.padStart(2, '0');
      }
      formatted += '-' + month;
    }

    // Håndter år (åååå)
    if (parts.length > 2) {
      formatted += '-' + parts[2].slice(0, 4);
    }

    setInternalValue(formatted);

    // Kør central validering
    validateDate(formatted);

    // Kald onChange med den formaterede værdi
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
    const parts = internalValue.split('-');

    // Kun fortolk år hvis alle dele er til stede
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      // Pad dag og måned med foranstående 0 hvis nødvendigt
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      let finalValue = `${day}-${month}-${year}`;

      // Tjek om år har ugyldig længde (3 cifre er ikke tilladt)
      if (year.length === 3) {
        setErrorState(true);
        setErrorMessage('Ugyldig dato');
        return;
      }

      // Intelligent år-fortolkning kun for 1-2 cifre
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
        // Selv hvis året allerede er 4 cifre, skal vi stadig opdatere med paddede dag/måned
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

      // Kør validering på den endelige værdi
      validateDate(finalValue);
    }
  };

  return (
    <StyledTextField
      ref={ref}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="dd-mm-åååå"
      width={width}
      error={error || errorState}
      helperText={helperText || errorMessage}
      {...otherProps}
    />
  );
});

StyledDateField.displayName = 'StyledDateField';

export default StyledDateField;
