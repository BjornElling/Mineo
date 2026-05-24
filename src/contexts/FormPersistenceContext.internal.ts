import React from 'react';
import type { FormPersistenceContextValue } from './FormPersistenceContext.shared';

export const FormPersistenceContext = React.createContext<FormPersistenceContextValue | null>(null);
