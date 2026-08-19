// @vitest-environment jsdom
import {
  APP_SETTINGS_LOCAL_STORAGE_KEY,
  createThemeBootstrapScript,
} from '../../settings/themeBootstrap';
import { resolveThemeMode, themeModeEnum, type AppThemeMode } from '../../settings/appSettingsSchema';

/**
 * Bootstrap-scriptet og `resolveThemeMode` afgør det samme spørgsmål – «hvilket tema skal males?» –
 * men kan ikke dele kode: scriptet er en selvstændig ES5-streng, der køres i `<head>` før nogen
 * modulgraf findes. Reglen er derfor skrevet to gange, og uden denne test kunne den ene ændre sig
 * uden den anden.
 *
 * Konsekvensen ville være synlig og ubehagelig: første paint i ét tema, og et omslag til et andet i
 * samme øjeblik React monterer. Testen udtømmer krydsproduktet af hvert gemt valg (inkl. de
 * ugyldige tilstande) og begge systempræferencer og kræver, at de to veje er enige.
 */
describe('tema-bootstrap: paritet mellem head-script og resolveThemeMode', () => {
  const originalMatchMedia = window.matchMedia;
  const originalLocalStorage = window.localStorage;
  const bootstrapScript = createThemeBootstrapScript();
  let storageMap: Map<string, string>;
  let themeColorMeta: HTMLMetaElement;

  const setSystemPrefersDark = (prefersDark: boolean): void => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark && query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
  };

  /** Det tema, head-scriptet faktisk maler – aflæst som DOM-tilstand, ikke som returværdi. */
  const runBootstrapAndReadTheme = (): 'light' | 'dark' => {
    new Function(bootstrapScript)();
    return document.documentElement.dataset.mineoTheme === 'dark' ? 'dark' : 'light';
  };

  beforeEach(() => {
    storageMap = new Map<string, string>();
    delete document.documentElement.dataset.mineoTheme;
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    document.head.appendChild(themeColorMeta);
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageMap.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storageMap.set(key, value);
        },
        removeItem: (key: string) => {
          storageMap.delete(key);
        },
        clear: () => {
          storageMap.clear();
        },
        key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
        get length() {
          return storageMap.size;
        },
      } satisfies Storage,
    });
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
    delete document.documentElement.dataset.mineoTheme;
    themeColorMeta.remove();
  });

  const gemteValg: readonly AppThemeMode[] = themeModeEnum.options;

  describe.each([true, false])('systemet foretrækker mørkt: %s', (prefersDark) => {
    it.each(gemteValg)('gemt valg "%s" giver samme tema begge veje', (themeMode) => {
      setSystemPrefersDark(prefersDark);
      window.localStorage.setItem(APP_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify({ themeMode }));

      expect(runBootstrapAndReadTheme()).toBe(resolveThemeMode(themeMode, prefersDark));
    });

    // De tilstande, hvor der ikke ER et gyldigt gemt valg, skal opføre sig som `'system'`: det er
    // dét, en manglende værdi betyder, og dét brugeren får ved allerførste åbning.
    it.each([
      ['tom storage', null],
      ['ugyldig JSON', '{'],
      ['ukendt themeMode', JSON.stringify({ themeMode: 'sepia' })],
      ['themeMode mangler', JSON.stringify({ showEOInspektionMenu: true })],
    ])('%s behandles som "system"', (_label, storedValue) => {
      setSystemPrefersDark(prefersDark);
      if (storedValue !== null) {
        window.localStorage.setItem(APP_SETTINGS_LOCAL_STORAGE_KEY, storedValue);
      }

      expect(runBootstrapAndReadTheme()).toBe(resolveThemeMode('system', prefersDark));
    });
  });

  // Selv-test af testen: uden den kunne begge veje returnere den samme konstant og bestå ovenstående
  // uden at måle noget. Kræver, at systempræferencen FAKTISK flytter udfaldet ved 'system' – og
  // lige så vigtigt, at den IKKE gør det ved et konkret valg.
  it('systempræferencen flytter kun udfaldet for "system"', () => {
    expect(resolveThemeMode('system', true)).toBe('dark');
    expect(resolveThemeMode('system', false)).toBe('light');
    expect(resolveThemeMode('light', true)).toBe('light');
    expect(resolveThemeMode('dark', false)).toBe('dark');
  });
});
