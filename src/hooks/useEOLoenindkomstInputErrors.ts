import React from 'react';
import { eoLoenindkomstInputErrorStore } from '../stores/eoLoenindkomstInputErrorStore';

export const useEOLoenindkomstInputErrors = (): Readonly<Record<string, true>> => {
  return React.useSyncExternalStore(
    eoLoenindkomstInputErrorStore.subscribe,
    () => eoLoenindkomstInputErrorStore.getState().errors,
    () => eoLoenindkomstInputErrorStore.getState().errors
  );
};

export const useSetEOLoenindkomstInputError = (): ((ansaettelsesforholdId: string, hasError: boolean) => void) => {
  return eoLoenindkomstInputErrorStore.getState().setError;
};
