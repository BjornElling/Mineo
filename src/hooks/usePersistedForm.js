import React from 'react';
import { useFormPersistence } from '../contexts/FormPersistenceContext.jsx';

/**
 * Custom hook til formular-persistence
 *
 * Automatisk persistence af formular state til sessionStorage.
 * Data gemmes når felter ændres og genindlæses når siden åbnes igen.
 *
 * @param {string} pageKey - Unik nøgle for siden (f.eks. 'stamdata', 'renteberegning')
 * @param {Object} initialValues - Initiale værdier for formularen
 * @returns {Object} - { values, setValues, handleChange, handleBlur, resetForm }
 *
 * Eksempel:
 * const { values, handleChange, handleBlur } = usePersistedForm('stamdata', {
 *   journalnr: '',
 *   advokat: '',
 * });
 */
export const usePersistedForm = (pageKey, initialValues) => {
  const { getPersistedData, persistData, clearPageData } = useFormPersistence();

  // Initialiser state med gemt data hvis det findes, ellers brug initialValues
  const [values, setValues] = React.useState(() => {
    try {
      const persisted = getPersistedData(pageKey);
      return persisted || initialValues;
    } catch (error) {
      console.error('Fejl ved indlæsning af gemte data:', error);
      return initialValues;
    }
  });

  // Gem data til sessionStorage hver gang values ændres
  const skipInitialPersist = React.useRef(!getPersistedData(pageKey));

  React.useEffect(() => {
    if (skipInitialPersist.current) {
      skipInitialPersist.current = false;
      return;
    }
    persistData(pageKey, values);
  }, [values, pageKey, persistData]);

  // Generisk handleChange funktion
  const handleChange = React.useCallback((fieldName) => (event) => {
    const value = event?.target?.value ?? '';
    setValues(prev => ({ ...prev, [fieldName]: value }));
  }, []);

  // Generisk handleBlur funktion (kan bruges til validation senere)
  const handleBlur = React.useCallback((fieldName) => (event) => {
    // For nu gemmer vi bare værdien igen ved blur
    const value = event?.target?.value ?? values[fieldName];
    setValues(prev => ({ ...prev, [fieldName]: value }));
  }, [values]);

  // Funktion til at nulstille formularen
  const resetForm = React.useCallback(() => {
    setValues(initialValues);
    clearPageData(pageKey);
  }, [initialValues, pageKey, clearPageData]);

  return {
    values,
    setValues,
    handleChange,
    handleBlur,
    resetForm,
  };
};

export default usePersistedForm;
