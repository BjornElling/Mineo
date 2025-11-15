import React from 'react';

/**
 * FormPersistenceContext
 *
 * Håndterer automatisk persistence af formular-data ved hjælp af sessionStorage.
 * Data bevares når man navigerer mellem sider, men slettes når browseren lukkes.
 */

const FormPersistenceContext = React.createContext(null);

/**
 * Provider komponent der wrapper hele applikationen
 */
export const FormPersistenceProvider = ({ children }) => {
  // Hent gemt data fra sessionStorage ved første render
  const getPersistedData = React.useCallback((pageKey) => {
    try {
      const stored = sessionStorage.getItem(`mineo_${pageKey}`);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Fejl ved indlæsning af gemt data:', error);
      return null;
    }
  }, []);

  // Gem data i sessionStorage
  const persistData = React.useCallback((pageKey, data) => {
    try {
      sessionStorage.setItem(`mineo_${pageKey}`, JSON.stringify(data));
    } catch (error) {
      console.error('Fejl ved gemning af data:', error);
    }
  }, []);

  // Slet data for en specifik side
  const clearPageData = React.useCallback((pageKey) => {
    try {
      sessionStorage.removeItem(`mineo_${pageKey}`);
    } catch (error) {
      console.error('Fejl ved sletning af data:', error);
    }
  }, []);

  // Slet alle gemte data (til fremtidig 'Slet alt' funktion)
  const clearAllData = React.useCallback(() => {
    try {
      const keys = Object.keys(sessionStorage);
      keys.forEach(key => {
        if (key.startsWith('mineo_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Fejl ved sletning af alle data:', error);
    }
  }, []);

  const value = React.useMemo(
    () => ({
      getPersistedData,
      persistData,
      clearPageData,
      clearAllData,
    }),
    [getPersistedData, persistData, clearPageData, clearAllData]
  );

  return (
    <FormPersistenceContext.Provider value={value}>
      {children}
    </FormPersistenceContext.Provider>
  );
};

/**
 * Custom hook til at bruge FormPersistenceContext
 */
export const useFormPersistence = () => {
  const context = React.useContext(FormPersistenceContext);
  if (!context) {
    // Hvis context ikke er tilgængelig (f.eks. ved bfcache), genindlæs siden
    console.warn('FormPersistenceContext ikke tilgængelig - genindlæser siden');

    // Brug setTimeout for at sikre at fejlen ikke blokerer rendering
    setTimeout(() => {
      window.location.reload();
    }, 0);

    // Returner et dummy objekt for at undgå fejl mens siden genindlæses
    return {
      getPersistedData: () => null,
      persistData: () => {},
      clearPageData: () => {},
      clearAllData: () => {},
    };
  }
  return context;
};

export default FormPersistenceContext;
