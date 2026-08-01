import { getSafeLocalStorage } from '../utils/safeLocalStorage';
import { APP_SETTINGS_LOCAL_STORAGE_KEY } from './themeBootstrap';

/**
 * Lagring af programindstillinger
 *
 * Ansvar: localStorage I/O for programindstillinger.
 * Best-effort persistence - fail-safe fallback til in-memory state.
 */

export const LOCAL_STORAGE_KEY = APP_SETTINGS_LOCAL_STORAGE_KEY;

const storage = getSafeLocalStorage();

export const readLocalStorage = (key: string): string | undefined => {
  try {
    const value = storage.getItem(key);
    return value ?? undefined;
  } catch {
    return undefined;
  }
};

export const writeLocalStorage = (key: string, value: string): void => {
  try {
    storage.setItem(key, value);
  } catch {
    // Fail-safe: storage kan være utilgængeligt/blokeret; behold kun in-memory state.
  }
};
