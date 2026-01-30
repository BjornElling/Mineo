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

/**
 * Parser og validerer rå settings-data mod schema.
 * Tolerant mod manglende keys - merger med defaults før validering.
 */
export const parseStoredSettings = (raw: unknown): AppSettings => {
  if (!isRecord(raw)) return { ...DEFAULT_APP_SETTINGS };

  // Tolerant mod manglende keys (fremtidig schema-evolution).
  // Vi håndhæver stadig korrekte typer via Zod.
  const merged: unknown = {
    ...DEFAULT_APP_SETTINGS,
    ...raw,
  };

  const parsed = appSettingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : { ...DEFAULT_APP_SETTINGS };
};

/**
 * Indlæser initial settings fra localStorage.
 * Returnerer defaults hvis localStorage er tom eller ugyldig.
 */
export const loadInitialSettings = (): AppSettings => {
  const raw = readLocalStorage(LOCAL_STORAGE_KEY);
  if (!raw) return { ...DEFAULT_APP_SETTINGS };
  try {
    const parsed: unknown = JSON.parse(raw);
    return parseStoredSettings(parsed);
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
};
