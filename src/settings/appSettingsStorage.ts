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

export const readLocalStorageResult = (key: string):
  { ok: true; value: string | undefined } | { ok: false } => {
  try {
    const value = storage.getItem(key);
    return { ok: true, value: value ?? undefined };
  } catch {
    return { ok: false };
  }
};

export const readLocalStorage = (key: string): string | undefined => {
  const result = readLocalStorageResult(key);
  return result.ok ? result.value : undefined;
};

export const writeLocalStorage = (key: string, value: string): boolean => {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    // Fail-safe: storage kan være utilgængeligt/blokeret; behold kun in-memory state.
    return false;
  }
};
