// @vitest-environment jsdom
import { APP_SETTINGS_LOCAL_STORAGE_KEY, createThemeBootstrapScript } from '../../settings/themeBootstrap';

describe('index theme bootstrap script', () => {
  const originalMatchMedia = window.matchMedia;
  const originalLocalStorage = window.localStorage;
  const bootstrapScript = createThemeBootstrapScript();
  let storageMap: Map<string, string>;
  let themeColorMeta: HTMLMetaElement;

  beforeEach(() => {
    storageMap = new Map<string, string>();
    delete document.documentElement.dataset.mineoTheme;
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    themeColorMeta.content = '#ffffff';
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
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as typeof window.matchMedia;
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

  it('sætter dark theme på html når localStorage indeholder themeMode dark', () => {
    window.localStorage.setItem(APP_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify({ themeMode: 'dark' }));

    new Function(bootstrapScript)();

    expect(document.documentElement.dataset.mineoTheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#2b2b2b');
  });

  it('sætter dark theme på html når system-theme er mørkt og ingen settings findes', () => {
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

    new Function(bootstrapScript)();

    expect(document.documentElement.dataset.mineoTheme).toBe('dark');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#2b2b2b');
  });

  it('sætter ikke dark attributten når persisted settings er light', () => {
    window.localStorage.setItem(APP_SETTINGS_LOCAL_STORAGE_KEY, JSON.stringify({ themeMode: 'light' }));

    new Function(bootstrapScript)();

    expect(document.documentElement.dataset.mineoTheme).toBeUndefined();
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#e9ecef');
  });

  it.each([
    ['ugyldig JSON', '{'],
    ['ukendt themeMode', JSON.stringify({ themeMode: 'sepia' })],
  ])('følger mørkt systemtema ved %s', (_label, storedValue) => {
    window.localStorage.setItem(APP_SETTINGS_LOCAL_STORAGE_KEY, storedValue);
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

    new Function(bootstrapScript)();

    expect(document.documentElement.dataset.mineoTheme).toBe('dark');
    expect(themeColorMeta.content).toBe('#2b2b2b');
  });

  it('følger systemtema når localStorage ikke kan læses', () => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: () => { throw new Error('blokeret'); } },
    });
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

    new Function(bootstrapScript)();

    expect(document.documentElement.dataset.mineoTheme).toBe('dark');
  });
});
