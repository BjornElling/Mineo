// @vitest-environment jsdom
import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { useAppSettings } from '../../contexts/useAppSettings';
import { LOCAL_STORAGE_KEY, readLocalStorage, writeLocalStorage } from '../../settings/appSettingsStorage';

const { storage, storedValues } = vi.hoisted(() => ({
  storage: {
    getItem: vi.fn<(key: string) => string | null>(),
    setItem: vi.fn<(key: string, value: string) => void>(),
    removeItem: vi.fn<(key: string) => void>(),
  },
  storedValues: new Map<string, string>(),
}));

vi.mock('../../utils/safeLocalStorage', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/safeLocalStorage')>(),
  getSafeLocalStorage: () => storage,
}));

const SettingsHarness = () => {
  const { settings, updateSettings } = useAppSettings();
  return <>
    <output role="status">{JSON.stringify(settings)}</output>
    <button onClick={() => updateSettings({ defaultVisBilagsnumre: true })}>Bilagsnumre</button>
  </>;
};

const ThemeModeHarness = ({ nextThemeMode }: { nextThemeMode: 'light' | 'dark' }) => {
  const { updateSettings } = useAppSettings();

  React.useEffect(() => {
    updateSettings({ themeMode: nextThemeMode });
  }, [nextThemeMode, updateSettings]);

  return null;
};

const ThemeModeSequenceHarness = ({ themeModes }: { themeModes: ReadonlyArray<'light' | 'dark'> }) => {
  const { updateSettings } = useAppSettings();

  React.useEffect(() => {
    themeModes.forEach((themeMode) => {
      updateSettings({ themeMode });
    });
  }, [themeModes, updateSettings]);

  return null;
};

describe('AppSettingsProvider', () => {
  const originalMatchMedia = window.matchMedia;
  let themeColorMeta: HTMLMetaElement;

  beforeEach(() => {
    storedValues.clear();
    storage.getItem.mockImplementation((key) => storedValues.get(key) ?? null);
    storage.setItem.mockImplementation((key, value) => { storedValues.set(key, value); });
    storage.removeItem.mockImplementation((key) => { storedValues.delete(key); });
    writeLocalStorage(LOCAL_STORAGE_KEY, '');
    delete document.documentElement.dataset.mineoTheme;
    themeColorMeta = document.createElement('meta');
    themeColorMeta.name = 'theme-color';
    themeColorMeta.content = '#ffffff';
    document.head.appendChild(themeColorMeta);
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
    vi.restoreAllMocks();
    window.matchMedia = originalMatchMedia;
    delete document.documentElement.dataset.mineoTheme;
    themeColorMeta.remove();
  });

  it('bevarer afsluttede valg i hukommelsen, når lageret bliver utilgængeligt', () => {
    const view = render(<AppSettingsProvider><SettingsHarness /></AppSettingsProvider>);
    act(() => screen.getByRole('button', { name: 'Bilagsnumre' }).click());
    storage.getItem.mockImplementation(() => { throw new Error('Blokeret'); });
    storage.setItem.mockImplementation(() => { throw new Error('Blokeret'); });
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_STORAGE_KEY })));
    expect(screen.getByRole('status').textContent).toContain('"defaultVisBilagsnumre":true');
    view.rerender(<AppSettingsProvider><SettingsHarness /><ThemeModeHarness nextThemeMode="dark" /></AppSettingsProvider>);
    expect(screen.getByRole('status').textContent).toContain('"themeMode":"dark"');
    expect(screen.getByRole('status').textContent).toContain('"defaultVisBilagsnumre":true');
  });

  it('bevarer et nyere valg fra en anden fane, selv før storage-eventet er behandlet', () => {
    render(<AppSettingsProvider><SettingsHarness /></AppSettingsProvider>);
    writeLocalStorage(LOCAL_STORAGE_KEY, JSON.stringify({ themeMode: 'dark' }));
    act(() => screen.getByRole('button', { name: 'Bilagsnumre' }).click());
    expect(JSON.parse(readLocalStorage(LOCAL_STORAGE_KEY) ?? '{}')).toMatchObject({
      themeMode: 'dark', defaultVisBilagsnumre: true,
    });
  });

  it('synkroniserer andre faners valg uden at skrive en gammel event-værdi tilbage', () => {
    render(<AppSettingsProvider><SettingsHarness /></AppSettingsProvider>);
    const latest = JSON.stringify({ themeMode: 'dark', documentDownloadFormat: 'docx' });
    writeLocalStorage(LOCAL_STORAGE_KEY, latest);
    act(() => window.dispatchEvent(new StorageEvent('storage', {
      key: LOCAL_STORAGE_KEY, newValue: JSON.stringify({ themeMode: 'light' }),
    })));
    expect(screen.getByRole('status').textContent).toContain('"themeMode":"dark"');
    expect(readLocalStorage(LOCAL_STORAGE_KEY)).toBe(latest);
  });

  it('opdaterer data-mineo-theme på html når themeMode ændres', async () => {
    render(
      <AppSettingsProvider>
        <ThemeModeHarness nextThemeMode="dark" />
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.mineoTheme).toBe('dark');
    });
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#2b2b2b');
  });

  it('bevarer light på html når themeMode sættes til light', async () => {
    render(
      <AppSettingsProvider>
        <ThemeModeHarness nextThemeMode="light" />
      </AppSettingsProvider>
    );

    await act(async () => {});

    expect(document.documentElement.dataset.mineoTheme).toBe('light');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#e9ecef');
  });

  it('opdaterer html-attributten korrekt ved dark til light transition', async () => {
    render(
      <AppSettingsProvider>
        <ThemeModeSequenceHarness themeModes={['dark', 'light']} />
      </AppSettingsProvider>
    );

    await waitFor(() => {
      expect(document.documentElement.dataset.mineoTheme).toBe('light');
    });
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe('#e9ecef');
  });
});
