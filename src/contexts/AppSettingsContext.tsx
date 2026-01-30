import * as React from 'react';
import type { AppSettings } from '../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../settings/appSettingsStorage';
import { loadInitialSettings, parseStoredSettings } from '../settings/appSettingsParse';

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

type AppSettingsContextValue = Readonly<{
  settings: AppSettings;
  updateSettings: (patch: Readonly<Partial<AppSettings>>) => void;
}>;

const AppSettingsContext = React.createContext<AppSettingsContextValue | null>(null);

export const AppSettingsProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [settings, setSettings] = React.useState<AppSettings>(() => loadInitialSettings());

  const updateSettings = React.useCallback((patch: Readonly<Partial<AppSettings>>) => {
    setSettings((prev) => {
      const next = parseStoredSettings({ ...prev, ...patch });
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

  const value = React.useMemo<AppSettingsContextValue>(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};

export const useAppSettings = (): AppSettingsContextValue => {
  const context = React.useContext(AppSettingsContext);
  if (!context) {
    throw new Error('AppSettingsContext ikke tilgængelig. Sørg for at komponenten er wrapped i AppSettingsProvider.');
  }
  return context;
};
