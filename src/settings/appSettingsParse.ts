/**
 * App Settings Parse
 *
 * Ansvar: Tolerant parsing og merge af settings fra localStorage.
 * Håndterer schema-evolution ved at merge ukendte værdier med defaults.
 */

import { DEFAULT_APP_SETTINGS, type AppSettings, appSettingsSchema } from './appSettingsSchema';
import { LOCAL_STORAGE_KEY, readLocalStorage } from './appSettingsStorage';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
};

// Vi kloner nested defaults, så flere fallback-objekter ikke deler samme reference.
const cloneDefaultAppSettings = (): AppSettings => ({
  ...DEFAULT_APP_SETTINGS,
  brevhovedIndstillinger: { ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger },
});

export const resolveAppSettings = (raw: unknown): AppSettings => {
  const parsed = appSettingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : cloneDefaultAppSettings();
};

/**
 * Parser og validerer rå settings-data mod schema.
 * Tolerant mod manglende keys - merger med defaults før validering.
 */
export const parseStoredSettings = (raw: unknown): AppSettings => {
  if (!isRecord(raw)) return cloneDefaultAppSettings();

  // Tolerant mod manglende keys (fremtidig schema-evolution).
  // Vi håndhæver stadig korrekte typer via Zod.
  const merged: unknown = {
    ...cloneDefaultAppSettings(),
    ...raw,
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
  if (!raw) return cloneDefaultAppSettings();
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseStoredSettings(parsed);
  } catch {
    return cloneDefaultAppSettings();
  }
};
