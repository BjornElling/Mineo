import * as React from 'react';
import { AppSettingsContext, type AppSettingsContextValue } from './AppSettingsContext.shared';

export const useAppSettings = (): AppSettingsContextValue => {
  const context = React.useContext(AppSettingsContext);
  if (!context) {
    throw new Error('AppSettingsContext ikke tilgængelig. Sørg for at komponenten er wrapped i AppSettingsProvider.');
  }
  return context;
};
