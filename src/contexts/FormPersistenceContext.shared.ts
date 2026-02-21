import React from 'react';
import type { FormPersistenceContextValue } from './FormPersistenceContext.types';

export const FormPersistenceContext = React.createContext<FormPersistenceContextValue | null>(null);
