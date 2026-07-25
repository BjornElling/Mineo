import * as React from 'react';
import type { AppSettings } from '../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../settings/appSettingsStorage';
import { loadInitialSettings, mergeAppSettings } from '../settings/appSettingsParse';
import { AppSettingsContext, type AppSettingsContextValue } from './AppSettingsContext.shared';

const THEME_COLOR_BY_MODE = {
  light: '#e9ecef',
  dark: '#2b2b2b',
} as const;

/**
 * AppSettingsContext
 *
 * Programindstillinger (device-local) som ikke må indgå i `.eo` gem/indlæs.
 *
 * Persistence:
 * - Local: `localStorage` (best-effort; fail-safe fallback til in-memory).
 * - `.eo`: NEVER. `.eo`-payloaden bygges ud fra de registrerede sektioner i `persistenceRegistry`.
 *
 * Se `src/contracts/app-settings.md` for normativt rationale og constraints.
 */

export const AppSettingsProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [settings, setSettings] = React.useState(() => loadInitialSettings());

  const updateSettings = React.useCallback((patch: Readonly<Partial<AppSettings>>) => {
    setSettings((prev) => {
      const next = mergeAppSettings(prev, patch);
      return next;
    });
    return true;
  }, []);

  React.useEffect(() => {
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  React.useEffect(() => {
    // Tværgående UI-debug-kontrol (CSS-niveau). DEV-only: font-style-farverne er kun
    // tilgængelige i udviklingsmiljøet. Adfærden gates på import.meta.env.DEV, så en
    // værdi gemt i localStorage under en dev-session aldrig aktiverer farverne i en
    // produktions-build. Når slået fra, bruger appen normale typografi-farver.
    const enabled = import.meta.env.DEV && settings.fontStyleColorDebug;
    document.documentElement.dataset.mineoFontStyleColors = enabled ? 'on' : 'off';
  }, [settings.fontStyleColorDebug]);

  React.useEffect(() => {
    document.documentElement.dataset.mineoTheme = settings.themeMode;

    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = THEME_COLOR_BY_MODE[settings.themeMode];
  }, [settings.themeMode]);

  const value = React.useMemo<AppSettingsContextValue>(() => ({ settings, updateSettings }), [settings, updateSettings]);

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};
