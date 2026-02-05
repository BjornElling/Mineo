import {
  AUTH_STORAGE_KEY,
  AUTH_STORAGE_VALUE,
  SHARED_PASSWORD_HASH,
} from './authConfig';
import { getSafeLocalStorage } from '../utils/safeLocalStorage';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

const timingSafeHashEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
};

const hashPassword = async (password: string): Promise<string> => {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('Denne browser understøtter ikke adgangskontrol.');
  }

  const encoded = new TextEncoder().encode(password);
  const digest = await cryptoObj.subtle.digest('SHA-256', encoded);
  return toHex(new Uint8Array(digest));
};

export const isAuthenticated = (): boolean => {
  const storage = getSafeLocalStorage();
  return storage.getItem(AUTH_STORAGE_KEY) === AUTH_STORAGE_VALUE;
};

export const setAuthenticated = (): void => {
  const storage = getSafeLocalStorage();
  try {
    storage.setItem(AUTH_STORAGE_KEY, AUTH_STORAGE_VALUE);
  } catch {
    throw new Error('Kunne ikke gemme login-status i browseren.');
  }
};

export const verifySharedPassword = async (password: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return timingSafeHashEqual(passwordHash, SHARED_PASSWORD_HASH.toLowerCase());
};
