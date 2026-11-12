import * as React from 'react';
import { resolveThemeMode, type AppSettingsPatch } from '../settings/appSettingsSchema';
import { LOCAL_STORAGE_KEY, readLocalStorage, readLocalStorageResult, writeLocalStorage } from '../settings/appSettingsStorage';
import { parseStoredSettingsJson, mergeAppSettings } from '../settings/appSettingsParse';
import { AppSettingsContext, type AppSettingsContextValue } from './AppSettingsContext.shared';
import { SYSTEM_DARK_MEDIA_QUERY, THEME_COLOR_BY_MODE } from '../settings/themeBootstrap';
import { logError } from '../utils/logger';
import { asError } from '../utils/typeGuards';
import { getPersistentLocalStorage } from '../utils/safeLocalStorage';
import type { AppSettings } from '../settings/appSettingsSchema';
import {
  commitAppSettingsRaw,
  discardCommittedAppSettings,
  isAppSettingsCommitStoreAvailable,
} from '../settings/appSettingsCommitStore';

/**
 * AppSettingsContext
 *
 * Programindstillinger (device-lokale) som ikke må indgå i `.eo` gem/indlæs.
 *
 * Lagring:
 * - Lokalt: `localStorage` (best-effort; fail-safe fallback til in-memory).
 * - `.eo`: aldrig. `.eo`-payloaden bygges ud fra de registrerede sektioner i `persistenceRegistry`.
 *
 * Se `src/contracts/app-settings.md` for normativt rationale og constraints.
 */

/**
 * Computerens aktuelle lys/mørke-præference, holdt levende.
 *
 * Findes som en abonnerende hook og ikke som et enkelt opslag, fordi hele pointen med
 * `themeMode: 'system'` er, at et skift på maskinen – typisk automatisk morgen/aften – skal slå
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
  const [initial] = React.useState(() => {
    const raw = readLocalStorage(LOCAL_STORAGE_KEY);
    return { raw, settings: parseStoredSettingsJson(raw) };
  });
  const [settings, setSettings] = React.useState(initial.settings);
  const current = React.useRef(settings);
  const lastStored = React.useRef(initial.raw);
  const systemPrefersDark = useSystemPrefersDark();
  const resolvedThemeMode = resolveThemeMode(settings.themeMode, systemPrefersDark);

  const readLatestSettings = React.useCallback(() => {
    const result = readLocalStorageResult(LOCAL_STORAGE_KEY);
    if (!result.ok) return current.current;
    const stored = result.value;
    if (stored !== lastStored.current) {
      current.current = parseStoredSettingsJson(stored);
      lastStored.current = stored;
    }
    return current.current;
  }, []);

  /** Fanens senest kendte råtekst – kun grundlag, indtil IndexedDB har sin første autoritative værdi. */
  const readLatestRaw = React.useCallback((): string | undefined => {
    readLatestSettings();
    return lastStored.current;
  }, [readLatestSettings]);

  const updateSettings = React.useCallback((patch: AppSettingsPatch) => {
    const apply = (next: AppSettings, serialized: string) => {
      if (writeLocalStorage(LOCAL_STORAGE_KEY, serialized)) lastStored.current = serialized;
      current.current = next;
      setSettings(next);
    };
    const commitToLocalStorage = () => {
      // Storage-events kan stå i kø. Læs derfor også før skrivning, og gem kun brugerens patch
      // oven på den nyeste kopi. Ingen I/O i Reacts state-updater eller efterfølgende effekt.
      const next = mergeAppSettings(readLatestSettings(), patch);
      apply(next, JSON.stringify(next));
    };
    const commit = async () => {
      if (!isAppSettingsCommitStoreAvailable()) {
        commitToLocalStorage();
        return;
      }
      // `localStorage` kan være forældet i en anden renderer-proces, også inde i låsen. Grundlaget
      // læses derfor fra IndexedDB i samme transaktion som skrivningen (se appSettingsCommitStore).
      let next: AppSettings | undefined;
      const serialized = await commitAppSettingsRaw(readLatestRaw(), (baseRaw) => {
        next = mergeAppSettings(parseStoredSettingsJson(baseRaw), patch);
        return JSON.stringify(next);
      });
      if (serialized === null || next === undefined) {
        await discardCommittedAppSettings();
        commitToLocalStorage();
        return;
      }
      apply(next, serialized);
    };
    // Faner har hver sin event-loop. Den fælles lås forhindrer, at to samtidige klik læser
    // samme grundlag og derefter overskriver hinandens uafhængige valg.
    if (navigator.locks) {
      void navigator.locks.request(LOCAL_STORAGE_KEY, commit).catch((error: unknown) => {
        logError('Kunne ikke opdatere programindstillinger', { error: asError(error) });
      });
    } else {
      void commit();
    }
    return true;
  }, [readLatestRaw, readLatestSettings]);

  React.useEffect(() => {
    const sync = () => setSettings(readLatestSettings());
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== null && event.storageArea !== getPersistentLocalStorage()) return;
      // Læs lageret frem for event.newValue: et ældre event må ikke rulle et nyere valg tilbage.
      if (event.key === LOCAL_STORAGE_KEY || event.key === null) sync();
    };
    window.addEventListener('storage', onStorage);
    sync();
    return () => window.removeEventListener('storage', onStorage);
  }, [readLatestSettings]);

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
