export const APP_SETTINGS_LOCAL_STORAGE_KEY = 'mineo_app_settings_v1';

export const THEME_COLOR_BY_MODE = {
  light: '#e9ecef',
  dark: '#2b2b2b',
} as const;

/** Bygger det synkrone head-script, så første paint følger samme fallback som runtime. */
export const createThemeBootstrapScript = (): string => {
  const config = JSON.stringify({
    storageKey: APP_SETTINGS_LOCAL_STORAGE_KEY,
    colors: THEME_COLOR_BY_MODE,
  });

  return `(function () {
  var config = ${config};
  var systemMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  var themeMode = systemMode;
  try {
    var raw = localStorage.getItem(config.storageKey);
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && (parsed.themeMode === 'dark' || parsed.themeMode === 'light')) {
        themeMode = parsed.themeMode;
      }
    }
  } catch (error) {
    themeMode = systemMode;
  }
  if (themeMode === 'dark') {
    document.documentElement.dataset.mineoTheme = 'dark';
  } else {
    delete document.documentElement.dataset.mineoTheme;
  }
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = config.colors[themeMode];
})();`;
};
