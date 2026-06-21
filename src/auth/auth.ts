import {
  AUTH_STORAGE_KEY,
  AUTH_STORAGE_VALUE,
  SHARED_PASSWORD_HASHES,
} from './authConfig';
import { getSafeLocalStorage } from '../utils/safeLocalStorage';

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');

// SHA-256 hex output er altid 64 tegn — length-tjekket er en invariant, ikke et timing-leak.
const hexEqual = (left: string, right: string): boolean => {
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

  // Adgangskoder er case-neutrale: config-hashes skal derfor være beregnet på lowercased plaintext.
  const encoded = new TextEncoder().encode(password.toLocaleLowerCase('da-DK'));
  const digest = await cryptoObj.subtle.digest('SHA-256', encoded);
  return toHex(new Uint8Array(digest));
};

export const isAuthenticated = (): boolean => {
  const storage = getSafeLocalStorage();
  // localStorage-flagget er kun en svag UX-gate, ikke en sikkerhedsmekanisme.
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
  return SHARED_PASSWORD_HASHES.some((entry) => hexEqual(passwordHash, entry.hash.toLowerCase()));
};
