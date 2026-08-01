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
  // Schema-evolution: den fjernede DEV-indstilling droppes, så en gemt ældre værdi ikke fejler
  // `.strict()`-parsingen. Indstillingen har ingen brugeradfærd at bevare.
  delete migrated.showStamdataTestTab;

  const defaults = createDefaultAppSettings();
  const sanitized: Record<string, unknown> = { ...defaults };

  // En enkelt fremmed eller korrupt nøgle må ikke nulstille de øvrige, gyldige indstillinger.
  // Hvert kendt top-level felt valideres derfor mod sin egen Zod-schema-grænse, før hele det
  // sanitiserede objekt slutvalideres samlet. Ukendte felter ignoreres fremad-tolerant.
  for (const key of Object.keys(appSettingsSchema.shape) as (keyof AppSettings)[]) {
    if (key === 'brevhovedIndstillinger' || !(key in migrated)) continue;
    const parsedField = appSettingsSchema.shape[key].safeParse(migrated[key]);
    if (parsedField.success) {
      sanitized[key] = parsedField.data;
    }
  }

  const sanitizedBrevhoved: Record<string, unknown> = {
    ...defaults.brevhovedIndstillinger,
  };
  const rawBrevhoved = migrated.brevhovedIndstillinger;
  if (isRecord(rawBrevhoved)) {
    for (const key of Object.keys(appSettingsSchema.shape.brevhovedIndstillinger.shape) as (
      keyof AppSettings['brevhovedIndstillinger']
    )[]) {
      if (!(key in rawBrevhoved)) continue;
      const parsedField = appSettingsSchema.shape.brevhovedIndstillinger.shape[key].safeParse(
        rawBrevhoved[key],
      );
      if (parsedField.success) {
        sanitizedBrevhoved[key] = parsedField.data;
      }
    }
  }
  sanitized.brevhovedIndstillinger = sanitizedBrevhoved;

  // Konstruktionen ovenfor er schema-drevet; denne parse fastholder AppSettings som den eneste
  // runtime-type og fanger samtidig intern drift mellem defaults og schema.
  return appSettingsSchema.parse(sanitized);
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
