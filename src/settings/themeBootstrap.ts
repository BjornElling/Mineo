import { createContentUiScaleBootstrapSource } from '../utils/uiScale';

export const APP_SETTINGS_LOCAL_STORAGE_KEY = 'mineo_app_settings_v1';

/** Ét sted, så runtime-abonnementet og bootstrap-scriptet ikke kan spørge om hver sin ting. */
export const SYSTEM_DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

export const THEME_COLOR_BY_MODE = {
  light: '#e9ecef',
  dark: '#2b2b2b',
} as const;

/**
 * Bygger det synkrone head-script, så første paint følger samme fallback som runtime.
 *
 * Scriptet er en selvstændig streng uden adgang til moduler og kan derfor ikke kalde
 * `resolveThemeMode`. Reglen er i stedet gentaget her i ES5, og `themeBootstrapParity.test.ts`
 * måler de to mod hinanden for hver kombination af gemt valg og systempræference – så en
 * ændret regel ét sted ikke kan efterlade det andet sted med den gamle.
 *
 * `'system'` og fraværet af en gemt værdi giver samme udfald: følg maskinen. Forskellen er, at
 * `'system'` nu er et VALG, brugeren kan vende tilbage til, og ikke blot en starttilstand.
 */
export const createThemeBootstrapScript = (): string => {
  const config = JSON.stringify({
    storageKey: APP_SETTINGS_LOCAL_STORAGE_KEY,
    colors: THEME_COLOR_BY_MODE,
    darkQuery: SYSTEM_DARK_MEDIA_QUERY,
  });

  return `(function () {
  var config = ${config};
  var systemMode = window.matchMedia && window.matchMedia(config.darkQuery).matches ? 'dark' : 'light';
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
  ${createContentUiScaleBootstrapSource()}
})();`;
};
