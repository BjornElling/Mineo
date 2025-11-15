import React from 'react';
import StyledTextField from './StyledTextField';

/**
 * StyledIntegerField - Felt til heltal med min/max validering
 *
 * Arver styling fra StyledTextField
 *
 * Features:
 * - Accepterer kun tal-input (0-9)
 * - Validering mod min/max værdier
 * - Fejlmeddelelse hvis uden for interval
 *
 * Props:
 * - width: Bredde (number for pixels eller string for anden enhed)
 * - value: Værdien i feltet
 * - onChange: Callback når værdien ændres
 * - minValue: Mindste tilladte værdi (number)
 * - maxValue: Største tilladte værdi (number)
 * - placeholder: Placeholder tekst
 */
const StyledIntegerField = React.forwardRef(({
  width = 120,
  value = '',
  onChange,
  minValue,
  maxValue,
  placeholder = '',
  ...otherProps
}, ref) => {
  const [errorState, setErrorState] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState('');

  // Valider værdi mod min/max
  const validateValue = (val) => {
    if (!val || val.trim() === '') {
      setErrorState(false);
      setErrorMessage('');
      return;
    }

    const numValue = parseInt(val, 10);

    if (isNaN(numValue)) {
      setErrorState(false);
      setErrorMessage('');
      return;
    }

    // Hvis værdien er 0, vis ingen fejl (den tømmes bare ved blur)
    if (numValue === 0) {
      setErrorState(false);
      setErrorMessage('');
      return;
    }

    if (minValue !== undefined && maxValue !== undefined) {
      if (numValue < minValue || numValue > maxValue) {
        setErrorState(true);
        setErrorMessage(`Værdi skal være mellem ${minValue} og ${maxValue}`);
        return;
      }
    }

    setErrorState(false);
    setErrorMessage('');
  };

  // Håndter input-ændringer
  const handleChange = (e) => {
    let input = e.target.value;

    // Tillad kun cifre (0-9)
    input = input.replace(/[^0-9]/g, '');

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

    validateValue(input);
  };

  // Håndter blur for at validere
  const handleBlur = (e) => {
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
      setErrorState(false);
      setErrorMessage('');
      return;
    }

    validateValue(value);
  };

  return (
    <StyledTextField
      ref={ref}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      width={width}
      error={errorState}
      helperText={errorMessage}
      {...otherProps}
    />
  );
});

StyledIntegerField.displayName = 'StyledIntegerField';

export default StyledIntegerField;
