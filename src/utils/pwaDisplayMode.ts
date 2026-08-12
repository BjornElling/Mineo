export const PWA_STANDALONE_DISPLAY_MODE_QUERY = '(display-mode: standalone)';

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

/**
 * Aflæser om dokumentet kører i hjælpeprogrammets eget vindue.
 *
 * `navigator.standalone` er kun relevant for iOS' hjemmeskærmsvindue. På øvrige platforme er
 * `display-mode: standalone` det kanoniske signal. Funktionen er bevidst fri for React, så både
 * install-flowet og footerens linkpolitik bruger præcis samme afgrænsning.
 */
export const isRunningInsideInstalledPwa = (): boolean => {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(PWA_STANDALONE_DISPLAY_MODE_QUERY).matches) {
    return true;
  }

  return typeof navigator !== 'undefined' && (navigator as NavigatorWithStandalone).standalone === true;
};

export const getInstalledPwaDisplayModeSnapshot = (): boolean => isRunningInsideInstalledPwa();

export const subscribeToInstalledPwaDisplayMode = (onStoreChange: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mediaQueryList = window.matchMedia(PWA_STANDALONE_DISPLAY_MODE_QUERY);
  mediaQueryList.addEventListener('change', onStoreChange);
  return () => {
    mediaQueryList.removeEventListener('change', onStoreChange);
  };
};
