import { loadInitialSettings, mergeAppSettings, parseStoredSettings, resolveAppSettings } from '../../settings/appSettingsParse';
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

  it('bevarer eksplicit dark themeMode ved parsing', () => {
    const result = parseStoredSettings({
      ...DEFAULT_APP_SETTINGS,
      themeMode: 'dark',
    });

    expect(result.themeMode).toBe('dark');
  });

  it('delvis settings (ukendt felt) → merger med defaults, alle kendte felter er defaults', () => {
    const partial = { advokat: 'Advokat Jensens Kontor' };
    const result = parseStoredSettings(partial);
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });

  it('settings med ukendt felt → strict schema afviser → falder tilbage til defaults', () => {
    const invalid = { ...DEFAULT_APP_SETTINGS, overenskomstFilter: 999 };
    const result = parseStoredSettings(invalid);
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

  it('merger nested brevhovedIndstillinger med defaults ved schema-evolution', () => {
    const result = parseStoredSettings({
      brevhovedIndstillinger: {
        erstatningsopgoerelse: false,
      },
    });

    expect(result.brevhovedIndstillinger.erstatningsopgoerelse).toBe(false);
    expect(result.brevhovedIndstillinger.regulering).toBe(DEFAULT_APP_SETTINGS.brevhovedIndstillinger.regulering);
    expect(result.brevhovedIndstillinger.aarsloensberegning).toBe(DEFAULT_APP_SETTINGS.brevhovedIndstillinger.aarsloensberegning);
  });

  it('merger ny root-startside-setting med default ved schema-evolution', () => {
    const result = parseStoredSettings({
      showEODebugMenu: true,
    });

    expect(result.showEODebugMenu).toBe(true);
    expect(result.defaultStartsideErStamdata).toBe(false);
  });

  it('gamle gemte settings uden regulerings-felterne loader med defaults (bagudkompatibel injicering)', () => {
    // Simulerer en localStorage-blob gemt før reguleringsindstillingerne blev (gen)indført
    // som device-lokale appSettings. De manglende felter må udfyldes af defaults — ikke
    // bryde parse — så øvrige gemte præferencer bevares.
    const {
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden,
      allowReguleringMedUdloebMedMaaneder,
      documentDownloadFormat,
      ...legacy
    } =
      DEFAULT_APP_SETTINGS;
    void allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden;
    void allowReguleringMedUdloebMedMaaneder;
    void documentDownloadFormat;

    const result = parseStoredSettings({ ...legacy, themeMode: 'dark' });

    expect(result.themeMode).toBe('dark');
    expect(result.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden).toBe(
      DEFAULT_APP_SETTINGS.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden
    );
    expect(result.allowReguleringMedUdloebMedMaaneder).toBe(
      DEFAULT_APP_SETTINGS.allowReguleringMedUdloebMedMaaneder
    );
    expect(result.documentDownloadFormat).toBe(DEFAULT_APP_SETTINGS.documentDownloadFormat);
  });
});

describe('resolveAppSettings', () => {
  it('ugyldig settings → falder tilbage til defaults', () => {
    const result = resolveAppSettings({ invalid: true });
    expect(result).toEqual(DEFAULT_APP_SETTINGS);
  });
});

describe('mergeAppSettings', () => {
  it('merger partial patch uden localStorage-parsing-semantik', () => {
    const result = mergeAppSettings(DEFAULT_APP_SETTINGS, {
      showEODebugMenu: true,
    });

    expect(result.showEODebugMenu).toBe(true);
    expect(result.defaultFuldLoenUnderFerie).toBe(DEFAULT_APP_SETTINGS.defaultFuldLoenUnderFerie);
  });

  it('merger nested brevhovedIndstillinger uden at nulstille øvrige flags', () => {
    const result = mergeAppSettings(DEFAULT_APP_SETTINGS, {
      brevhovedIndstillinger: {
        ...DEFAULT_APP_SETTINGS.brevhovedIndstillinger,
        regulering: true,
      },
    });

    expect(result.brevhovedIndstillinger.regulering).toBe(true);
    expect(result.brevhovedIndstillinger.erstatningsopgoerelse).toBe(DEFAULT_APP_SETTINGS.brevhovedIndstillinger.erstatningsopgoerelse);
  });
});

// ─── loadInitialSettings ─────────────────────────────────────────────────────

describe('loadInitialSettings', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

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
    expect(result).toHaveProperty('themeMode');
    expect(result).toHaveProperty('defaultFuldLoenUnderFerie');
    expect(result).toHaveProperty('showContentBoxReportButton');
  });

  it('ingen persisted settings + prefers-color-scheme mørk → default er dark', () => {
    writeLocalStorage(LOCAL_STORAGE_KEY, '');
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;

    const result = loadInitialSettings();

    expect(result).toEqual({
      ...DEFAULT_APP_SETTINGS,
      themeMode: 'dark',
    });
  });

  it('persisted dark themeMode round-tripper gennem loadInitialSettings', () => {
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({
      ...DEFAULT_APP_SETTINGS,
      themeMode: 'dark',
    }));

    const result = loadInitialSettings();

    expect(result.themeMode).toBe('dark');
  });

  it('regulerings-felterne round-tripper gennem localStorage', () => {
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({
      ...DEFAULT_APP_SETTINGS,
      allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden: true,
      allowReguleringMedUdloebMedMaaneder: 11,
    }));

    const result = loadInitialSettings();

    expect(result.allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden).toBe(true);
    expect(result.allowReguleringMedUdloebMedMaaneder).toBe(11);
  });
});
