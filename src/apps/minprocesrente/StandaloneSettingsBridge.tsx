import React from 'react';
import { AppSettingsContext, type AppSettingsContextValue } from '../../contexts/AppSettingsContext.shared';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';

const STANDALONE_SETTINGS = {
  ...DEFAULT_APP_SETTINGS,
  themeMode: 'light',
  showContentBoxReportButton: false,
  fontStyleColorDebug: false,
} as const;

export const StandaloneSettingsBridge = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const updateSettings = React.useCallback(() => {
    // MinProcesrente har ingen brugerindstillinger i første standalone-version. DEFAULT_APP_SETTINGS
    // genbruges kun for at tilfredsstille eksisterende passive setting-consumere uden persistence.
  }, []);

  const value = React.useMemo<AppSettingsContextValue>(
    () => ({
      settings: STANDALONE_SETTINGS,
      updateSettings,
    }),
    [updateSettings]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};
