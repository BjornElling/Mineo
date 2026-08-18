import * as React from 'react';
import { resolveThemeMode, type AppSettings } from '../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../settings/appSettingsStorage';
import { loadInitialSettings, mergeAppSettings } from '../settings/appSettingsParse';
import { AppSettingsContext, type AppSettingsContextValue } from './AppSettingsContext.shared';
import { SYSTEM_DARK_MEDIA_QUERY, THEME_COLOR_BY_MODE } from '../settings/themeBootstrap';

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

/**
 * Computerens aktuelle lys/mørke-præference, holdt levende.
 *
 * Findes som en abonnerende hook og ikke som et enkelt opslag, fordi hele pointen med
 * `themeMode: 'system'` er, at et skift på maskinen — typisk automatisk morgen/aften — skal slå
 * igennem MENS Mineo er åben. Et opslag ved mount ville kun give «følg computeren, som den så ud,
 * da du åbnede programmet».
 *
 * `matchMedia` kan mangle i jsdom og i ældre miljøer; er den væk, svarer hooken «lyst» og
 * abonnerer ikke. Det er samme fallback som bootstrap-scriptet og `readSystemThemeMode`.
 */
const useSystemPrefersDark = (): boolean => {
  const subscribe = React.useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
    const query = window.matchMedia(SYSTEM_DARK_MEDIA_QUERY);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const getSnapshot = React.useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(SYSTEM_DARK_MEDIA_QUERY).matches;
  }, []);

  return React.useSyncExternalStore(subscribe, getSnapshot, () => false);
};

export const AppSettingsProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [settings, setSettings] = React.useState(() => loadInitialSettings());
  const systemPrefersDark = useSystemPrefersDark();
  const resolvedThemeMode = resolveThemeMode(settings.themeMode, systemPrefersDark);

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
    // Det RESOLVEREDE tema, ikke valget: `data-mineo-theme="system"` ville ikke matche nogen
    // CSS-regel, og `THEME_COLOR_BY_MODE` har ingen farve for «systemet».
    document.documentElement.dataset.mineoTheme = resolvedThemeMode;

    let themeColorMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!themeColorMeta) {
      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      document.head.appendChild(themeColorMeta);
    }
    themeColorMeta.content = THEME_COLOR_BY_MODE[resolvedThemeMode];
  }, [resolvedThemeMode]);

  const value = React.useMemo<AppSettingsContextValue>(
    () => ({ settings, updateSettings, resolvedThemeMode }),
    [settings, updateSettings, resolvedThemeMode]
  );

  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>;
};
