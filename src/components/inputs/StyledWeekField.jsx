import React from 'react';
import StyledTextField from './StyledTextField';

/**
 * StyledWeekField - Intelligent ugenummerindtastningsfelt
 *
 * Denne komponent arver styling fra StyledTextField og tilføjer intelligent ugehåndtering.
 *
 * Features:
 * - Formaterer automatisk til uu/åååå
 * - Accepterer bindestreg, punktum, mellemrum eller skråstreg som separator (konverterer til skråstreg)
 * - Intelligent år-fortolkning (1-4 cifre) - samme logik som StyledDateField
 * - Validering af uge-gyldighed (1-53 med ISO 8601 tjek)
 * - Kræver min/max år-grænser som props
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - value: Værdien i feltet (uu/åååå format)
 * - onChange: Callback når værdien ændres
 * - minYear: Mindste tilladte år (fx 2005)
 * - maxYear: Største tilladte år (fx 2025)
 * - error: Boolean der indikerer fejl-tilstand
 * - helperText: Fejlbesked der vises under feltet
 */
const StyledWeekField = React.forwardRef(({
  width = 120,
  value = '',
  onChange,
  onBlur,
  minYear,
  maxYear,
  error = false,
  helperText = '',
  sx,
  ...otherProps
}, ref) => {
  const [internalValue, setInternalValue] = React.useState(value);
  const [errorState, setErrorState] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  // Sync internal value med external value
  React.useEffect(() => {
    setInternalValue(value);
  }, [value]);

  // Central valideringsfunktion (defineres senere i koden)
  const validateWeekRef = React.useRef();

  // Valider eksisterende værdi når komponenten mounter eller når value ændres
  React.useEffect(() => {
    if (value && value.trim() !== '' && validateWeekRef.current) {
      validateWeekRef.current(value);
    } else {
      // Hvis værdien er tom, ryd fejl
      setErrorState(false);
      setErrorMessage('');
    }
  }, [value, minYear, maxYear]); // Genvalider hvis min/max grænser ændres

  // Tjek om et år har 53 uger (ISO 8601)
  const yearHas53Weeks = (year) => {
    // ISO 8601: Et år har 53 uger hvis 31. december falder på en torsdag,
    // eller hvis det er et skudår og 31. december falder på en fredag
    const dec31 = new Date(year, 11, 31);
    const dayOfWeek = dec31.getDay();
    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);

    // Torsdag = 4, Fredag = 5
    return dayOfWeek === 4 || (isLeapYear && dayOfWeek === 5);
  };

  // Valider uge-gyldighed
  const isValidWeek = (week, year) => {
    if (week < 1) return false;

    // Tjek om året har 53 uger
    const maxWeek = yearHas53Weeks(year) ? 53 : 52;

    if (week > maxWeek) return false;

    return true;
  };

  // Intelligent år-fortolkning (SAMME som StyledDateField)
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

  // Valider mod min/max år
  const validateYearRange = (year) => {
    if (!year) return true; // Ikke komplet endnu

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

    // Tjek uge hvis indtastet
    if (week.length > 0) {
      const weekNum = parseInt(week, 10);
      if (isNaN(weekNum) || weekNum < 1) {
        setErrorState(true);
        setErrorMessage('Ugyldig uge');
        return;
      }

      // Hvis vi også har et år, valider uge mod årets max uger
      if (year.length === 4) {
        const yearNum = parseInt(year, 10);
        if (!isValidWeek(weekNum, yearNum)) {
          const maxWeek = yearHas53Weeks(yearNum) ? 53 : 52;
          setErrorState(true);
          setErrorMessage(`Uge skal være mellem 1 og ${maxWeek}`);
          return;
        }
      } else if (weekNum > 53) {
        // Hvis vi ikke har et år endnu, tillad max 53
        setErrorState(true);
        setErrorMessage('Uge skal være mellem 1 og 53');
        return;
      }
    }

    // Tjek år-interval hvis komplet (uu/åååå)
    if (year.length === 4 && week.length > 0) {
      const yearNum = parseInt(year, 10);
      const rangeError = validateYearRange(yearNum);
      if (rangeError !== true) {
        setErrorState(true);
        setErrorMessage(rangeError);
        return;
      }
    }

    // Hvis vi kom hertil uden fejl, ryd fejlstatus
    setErrorState(false);
    setErrorMessage('');
  }, [minYear, maxYear]);

  // Gem validateWeek i ref så useEffect kan bruge den
  React.useEffect(() => {
    validateWeekRef.current = validateWeek;
  }, [validateWeek]);

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;
    const inputType = e.nativeEvent?.inputType || '';
    const isDeleting =
      inputType === 'deleteContentBackward' ||
      inputType === 'deleteContentForward' ||
      inputType === 'deleteContent';

    // Erstat separator-karakterer (mellemrum, punktum, bindestreg) med skråstreg
    // Men behold eksisterende skråstreger for nu
    input = input.replace(/[ .:-]/g, '/');

    // Kollaps flere skråstreger i træk til én enkelt skråstreg
    input = input.replace(/\/+/g, '/');

    // Fjern skråstreger fra starten
    input = input.replace(/^\/+/, '');

    // Fjern alle ikke-tal og ikke-skråstreger
    input = input.replace(/[^\d/]/g, '');

    // Split i dele
    const parts = input.split('/');
    let formatted = '';

    // Håndter uge (uu) - max 2 cifre
    if (parts[0]) {
      let week = parts[0].slice(0, 2);
      formatted = week;
    }

    // Håndter år (åååå) - max 4 cifre
    if (parts.length > 1) {
      let year = parts[1].slice(0, 4);
      formatted += '/' + year;
    }

    setInternalValue(formatted);

    // Kør central validering
    validateWeek(formatted);

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

  // Håndter blur for at finalisere uge
  const handleBlur = (e) => {
    const parts = internalValue.split('/');

    // Hvis feltet er tomt, ryd fejl og afslut
    if (!internalValue || internalValue.trim() === '') {
      setErrorState(false);
      setErrorMessage('');
      // Kald ekstern onBlur hvis den findes
      if (onBlur) {
        onBlur(e);
      }
      return;
    }

    // Hvis feltet indeholder noget, skal det være en komplet uge
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setErrorState(true);
      setErrorMessage('Ugyldigt format');
      // Kald ekstern onBlur hvis den findes
      if (onBlur) {
        onBlur(e);
      }
      return;
    }

    // Alle dele er til stede - fortsæt med formatering og validering
    // Pad uge med foranstående 0 hvis nødvendigt
    const week = parts[0].padStart(2, '0');
    const year = parts[1];
    let finalValue = `${week}/${year}`;

    // Tjek om år har ugyldig længde (3 cifre er ikke tilladt)
    if (year.length === 3) {
      setErrorState(true);
      setErrorMessage('Ugyldigt årstal');
      // Kald ekstern onBlur hvis den findes
      if (onBlur) {
        onBlur(e);
      }
      return;
    }

    // Intelligent år-fortolkning kun for 1-2 cifre
    if (year.length === 1 || year.length === 2) {
      const interpretedYear = interpretYear(year);
      if (interpretedYear !== null) {
        finalValue = `${week}/${interpretedYear}`;

        // Valider uge mod det fortolkede år
        const weekNum = parseInt(week, 10);
        if (!isValidWeek(weekNum, interpretedYear)) {
          const maxWeek = yearHas53Weeks(interpretedYear) ? 53 : 52;
          setErrorState(true);
          setErrorMessage(`Uge skal være mellem 1 og ${maxWeek}`);
          // Kald ekstern onBlur hvis den findes
          if (onBlur) {
            onBlur(e);
          }
          return;
        }

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
      } else {
        // År-fortolkning fejlede
        setErrorState(true);
        setErrorMessage('Ugyldigt årstal');
        // Kald ekstern onBlur hvis den findes
        if (onBlur) {
          onBlur(e);
        }
        return;
      }
    } else {
      // Selv hvis året allerede er 4 cifre, skal vi stadig opdatere med padded uge
      if (finalValue !== internalValue) {
        // Valider uge mod det komplette år
        const weekNum = parseInt(week, 10);
        const yearNum = parseInt(year, 10);
        if (!isValidWeek(weekNum, yearNum)) {
          const maxWeek = yearHas53Weeks(yearNum) ? 53 : 52;
          setErrorState(true);
          setErrorMessage(`Uge skal være mellem 1 og ${maxWeek}`);
          // Kald ekstern onBlur hvis den findes
          if (onBlur) {
            onBlur(e);
          }
          return;
        }

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
    validateWeek(finalValue);

    // Kald ekstern onBlur efter auto-formatering er færdig
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
    <StyledTextField
      ref={ref}
      value={internalValue}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder="uu/åååå"
      width={width}
      error={error || errorState}
      helperText={helperText || errorMessage}
      sx={{
        '& .MuiInputBase-input': {
          textAlign: 'center',
        },
        ...sx,
      }}
      {...otherProps}
    />
  );
});

StyledWeekField.displayName = 'StyledWeekField';

export default StyledWeekField;
