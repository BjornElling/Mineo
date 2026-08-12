import React from 'react';
import {
  getInstalledPwaDisplayModeSnapshot,
  subscribeToInstalledPwaDisplayMode,
} from '../utils/pwaDisplayMode';

export const useInstalledPwaDisplayMode = (): boolean => (
  React.useSyncExternalStore(
    subscribeToInstalledPwaDisplayMode,
    getInstalledPwaDisplayModeSnapshot,
    () => false
  )
);
