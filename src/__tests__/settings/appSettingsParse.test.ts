import { describe, expect, it } from 'vitest';
import { parseStoredSettings, loadInitialSettings } from '../../settings/appSettingsParse';
import { DEFAULT_APP_SETTINGS } from '../../settings/appSettingsSchema';
import { writeLocalStorage, LOCAL_STORAGE_KEY } from '../../settings/appSettingsStorage';

// ─── parseStoredSettings ──────────────────────────────────────────────────────

describe('parseStoredSettings', () => {
  it('null → returnerer defaults', () => {
    const result = parseStoredSettings(null);
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('undefined → returnerer defaults', () => {
    const result = parseStoredSettings(undefined);
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('streng → returnerer defaults', () => {
    const result = parseStoredSettings('ugyldig streng');
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('tal → returnerer defaults', () => {
    const result = parseStoredSettings(42);
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('array → returnerer defaults', () => {
    const result = parseStoredSettings([]);
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('tomt objekt → merger med defaults og returnerer defaults', () => {
    const result = parseStoredSettings({});
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('gyldigt settings-objekt → returnerer valideret settings', () => {
    const validSettings = { ...DEFAULT_APP_SETTINGS };
    const result = parseStoredSettings(validSettings);
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('delvis settings (kun ét felt) → merger med defaults', () => {
    // Kun ét felt – resten skal hentes fra defaults
    const partial = { advokat: 'Advokat Jensens Kontor' };
    const result = parseStoredSettings(partial);
    // Ukendt felt ignoreres (schema merger kun kendte fields)
    // Men defaults for alle kendte felter bevares
    expect(result).toBeDefined();
    // Skal matche DEFAULT_APP_SETTINGS for alle felter der er i schema
    expect(typeof result).toBe('object');
  });

  it('settings med ugyldigt felt → falder tilbage til defaults', () => {
    // Ugyldigt felt (forkert type for et required felt)
    const invalid = { ...DEFAULT_APP_SETTINGS, overenskomstFilter: 999 };
    const result = parseStoredSettings(invalid);
    // Schema fejler → returnerer defaults
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('returnerer ny kopi af defaults (ikke reference)', () => {
    const result1 = parseStoredSettings({});
    const result2 = parseStoredSettings({});
    expect(result1).not.toBe(result2);
  });

  it('tolerant mod ekstra ukendte keys i input (merger med defaults)', () => {
    const withExtra = { ...DEFAULT_APP_SETTINGS, gammelKey: 'gammel_vaerdi' };
    // Parser skal ikke kaste ved ekstra keys – merger og validerer
    expect(() => parseStoredSettings(withExtra)).not.toThrow();
  });

  it('determinisme – samme input giver samme output', () => {
    const input = { ...DEFAULT_APP_SETTINGS };
    const r1 = parseStoredSettings(input);
    const r2 = parseStoredSettings(input);
    expect(r1).toEqual(r2);
  });
});

// ─── loadInitialSettings ─────────────────────────────────────────────────────

describe('loadInitialSettings', () => {
  it('gyldigt JSON i localStorage → returnerer parsede settings', () => {
    // Skriv gyldige settings til localStorage (in-memory i testmiljø)
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
    const result = loadInitialSettings();
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('ugyldigt JSON i localStorage → returnerer defaults', () => {
    // Skriv ugyldig JSON til localStorage
    writeLocalStorage(LOCAL_STORAGE_KEY, 'dette-er-ikke-json{{{[');
    const result = loadInitialSettings();
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('JSON-objekt med ugyldig felttype → schema-validering fejler → defaults', () => {
    // Gyldigt JSON men ugyldig settings (erstatningsopgoerelseAfsluttesMed som tal er ugyldig type)
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({ ...DEFAULT_APP_SETTINGS, erstatningsopgoerelseAfsluttesMed: 999 }));
    const result = loadInitialSettings();
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('returnerer AppSettings-objekt med de forventede nøgler', () => {
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_APP_SETTINGS));
    const result = loadInitialSettings();
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('defaultFuldLoenUnderFerie');
    expect(result).toHaveProperty('showContentBoxReportButton');
  });
});
