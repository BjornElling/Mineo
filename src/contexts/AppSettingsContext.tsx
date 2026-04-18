import * as React from 'react';
import type { AppSettings } from '../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../settings/appSettingsStorage';
import { loadInitialSettings, mergeAppSettings } from '../settings/appSettingsParse';
import { AppSettingsContext, type AppSettingsContextValue } from './AppSettingsContext.shared';

/**
 * AppSettingsContext
 *
 * Programindstillinger (device-local) som ikke må indgå i `.eo` gem/indlæs.
 *
 * Persistence:
 * - Local: `localStorage` (best-effort; fail-safe fallback til in-memory).
 * - `.eo`: NEVER. `.eo` payload bygges ud fra sessionStorage keys i storage-manifestet.
 *
 * See `src/contracts/app-settings.md` for normative rationale and constraints.
 */

export const AppSettingsProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [settings, setSettings] = React.useState(() => loadInitialSettings());

  const updateSettings = React.useCallback((patch: Readonly<Partial<AppSettings>>) => {
    setSettings((prev) => {
      const next = mergeAppSettings(prev, patch);
      return next;
    });
  }, []);

  React.useEffect(() => {
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  React.useEffect(() => {
    // Cross-cutting UI debug control (CSS-level).
    // Når `fontStyleColorDebug=false`, bruger appen normale typografi-farver.
    document.documentElement.dataset.mineoFontStyleColors = settings.fontStyleColorDebug ? 'on' : 'off';
  }, [settings.fontStyleColorDebug]);

  React.useEffect(() => {
    document.documentElement.dataset.mineoTheme = settings.themeMode;
  }, [settings.themeMode]);

  const value = React.useMemo<AppSettingsContextValue>(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};
