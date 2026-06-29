// @vitest-environment jsdom
import * as React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { AppSettingsProvider } from '../../contexts/AppSettingsContext';
import { useAppSettings } from '../../contexts/useAppSettings';
import { LOCAL_STORAGE_KEY, writeLocalStorage } from '../../settings/appSettingsStorage';

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
    window.matchMedia = originalMatchMedia;
    delete document.documentElement.dataset.mineoTheme;
    themeColorMeta.remove();
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
