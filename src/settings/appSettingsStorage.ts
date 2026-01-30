import { getSafeLocalStorage } from '../utils/safeLocalStorage';

/**
 * App Settings Storage
 *
 * Ansvar: localStorage I/O for programindstillinger.
 * Best-effort persistence - fail-safe fallback til in-memory state.
 */

export const LOCAL_STORAGE_KEY = 'mineo_app_settings_v1';

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
