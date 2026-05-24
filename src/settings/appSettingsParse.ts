/**
 * App Settings Parse
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

const stripObsoleteAppSettingsFields = (raw: Record<string, unknown>): Record<string, unknown> => {
  const current = { ...raw };
  delete current.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
  delete current.allowReguleringMedUdloebMedMaaneder;
  return current;
};

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

  // Tolerant mod manglende keys (fremtidig schema-evolution).
  // Vi håndhæver stadig korrekte typer via Zod.
  const currentRaw = stripObsoleteAppSettingsFields(raw);
  const merged: unknown = {
    ...createDefaultAppSettings(),
    ...currentRaw,
    brevhovedIndstillinger: isRecord(currentRaw.brevhovedIndstillinger)
      ? {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        ...currentRaw.brevhovedIndstillinger,
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
