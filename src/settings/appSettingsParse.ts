/**
 * Parsing af programindstillinger
 *
 * Ansvar: Tolerant parsing og merge af settings fra localStorage.
 * Håndterer schema-evolution ved at merge ukendte værdier med defaults.
 */

import { DEFAULT_APP_SETTINGS, type AppSettings, appSettingsSchema } from './appSettingsSchema';
import { LOCAL_STORAGE_KEY, readLocalStorage } from './appSettingsStorage';
import { isRecord } from '../utils/typeGuards';

// Vi kloner nested defaults, så flere fallback-objekter ikke deler samme reference.
const cloneDefaultAppSettings = (): AppSettings => ({
  ...DEFAULT_APP_SETTINGS,
  brevhovedIndstillinger: { ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger },
});

const readSystemThemeMode = (): AppSettings['themeMode'] => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return DEFAULT_APP_SETTINGS.themeMode;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const createDefaultAppSettings = (): AppSettings => ({
  ...cloneDefaultAppSettings(),
  themeMode: readSystemThemeMode(),
});

export const resolveAppSettings = (raw: unknown): AppSettings => {
  const parsed = appSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : createDefaultAppSettings();
};

/**
 * Parser og validerer rå settings-data mod schema.
 * Tolerant mod manglende keys - merger med defaults før validering.
 */
export const parseStoredSettings = (raw: unknown): AppSettings => {
  if (!isRecord(raw)) return createDefaultAppSettings();

  // Ét-vejs migration af omdøbte nøgler før merge/parse. `appSettingsSchema` er `.strict()`,
  // så en gammel nøgle ellers ville blive strippet og brugerens valg tabt.
  // `showEODebugMenu` blev omdøbt til `showEOInspektionMenu` (sproglig oprydning: fanerne er
  // kontrolfaner, ikke fejlsøgning). Bevar en tidligere gemt boolean-værdi.
  const migrated: Record<string, unknown> = { ...raw };
  if (!('showEOInspektionMenu' in migrated) && typeof migrated.showEODebugMenu === 'boolean') {
    migrated.showEOInspektionMenu = migrated.showEODebugMenu;
  }
  delete migrated.showEODebugMenu;
  // `showStamdataTestTab` er fjernet med greenfield-cutoveren: DEV-showcase-fanen for de legacy
  // `Styled*Field`-komponenter er slettet sammen med komponenterne. Nøglen droppes, så en gammel
  // gemt værdi ikke fejler `.strict()`-parsingen (ingen adfærd at bevare).
  delete migrated.showStamdataTestTab;

  // Tolerant mod manglende keys (fremtidig schema-evolution).
  // Vi håndhæver stadig korrekte typer via Zod.
  const merged: unknown = {
    ...createDefaultAppSettings(),
    ...migrated,
    brevhovedIndstillinger: isRecord(raw.brevhovedIndstillinger)
      ? {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        ...raw.brevhovedIndstillinger,
      }
      : { ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger },
  };

  return resolveAppSettings(merged);
};

export const mergeAppSettings = (
  prev: AppSettings,
  patch: Readonly<Partial<AppSettings>>
): AppSettings => {
  // Defensive second-line guard: patch forventes type-korrekt fra intern kode,
  // men vi fastholder schema-invarianten før state skrives tilbage.
  return resolveAppSettings({
    ...prev,
    ...patch,
    brevhovedIndstillinger: patch.brevhovedIndstillinger
      ? {
        ...prev.brevhovedIndstillinger,
        ...patch.brevhovedIndstillinger,
      }
      : prev.brevhovedIndstillinger,
  });
};

/**
 * Indlæser initial settings fra localStorage.
 * Returnerer defaults hvis localStorage er tom eller ugyldig.
 */
export const loadInitialSettings = (): AppSettings => {
  const raw = readLocalStorage(LOCAL_STORAGE_KEY);
  if (!raw) return createDefaultAppSettings();
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseStoredSettings(parsed);
  } catch {
    return createDefaultAppSettings();
  }
};
