import React from 'react';

const INSTALLED_PWA_DISPLAY_MODE_QUERY = '(display-mode: standalone)';

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

const isIosStandaloneMode = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return (navigator as NavigatorWithStandalone).standalone === true;
};

const isStandaloneDisplayMode = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }

  return window.matchMedia(INSTALLED_PWA_DISPLAY_MODE_QUERY).matches;
};

const getInstalledPwaDisplayModeSnapshot = (): boolean => (
  isStandaloneDisplayMode() || isIosStandaloneMode()
);

const subscribeToInstalledPwaDisplayMode = (onStoreChange: () => void): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }

  const mediaQueryList = window.matchMedia(INSTALLED_PWA_DISPLAY_MODE_QUERY);

  mediaQueryList.addEventListener('change', onStoreChange);
  return () => {
    mediaQueryList.removeEventListener('change', onStoreChange);
  };
};

export const useInstalledPwaDisplayMode = (): boolean => (
  React.useSyncExternalStore(
    subscribeToInstalledPwaDisplayMode,
    getInstalledPwaDisplayModeSnapshot,
    () => false
  )
);
