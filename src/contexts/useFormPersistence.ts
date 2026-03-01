import React from 'react';
import { FormPersistenceContext, type FormPersistenceContextValue } from './FormPersistenceContext.shared';

/**
 * Custom hook til at bruge FormPersistenceContext
 *
 * @throws {Error} Hvis context ikke er tilgængelig (komponenten skal wrappes i FormPersistenceProvider)
 */
export const useFormPersistence = (): FormPersistenceContextValue => {
  const context = React.useContext(FormPersistenceContext);
  if (!context) {
    const errorMessage = 'FormPersistenceContext ikke tilgængelig. Sørg for at komponenten er wrapped i FormPersistenceProvider.';
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
  return context;
};
