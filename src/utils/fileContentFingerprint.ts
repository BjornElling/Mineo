import { z } from 'zod';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import { MAX_FILE_SIZE } from '../config/version';
import { readOptionalSessionStorageValue } from './safeSessionStorage';

/** SHA-256 af filens præcise UTF-8-indhold; sagsværdier eller filnavne lagres ikke her. */
export const fileContentFingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const createFileContentFingerprint = async (content: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const readSavedFileContentFingerprint = (): string | null => {
  const parsed = fileContentFingerprintSchema.safeParse(
    readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFileFingerprint),
  );
  return parsed.success ? parsed.data : null;
};

export const readFileContentFingerprint = async (handle: FileSystemFileHandle): Promise<string> => {
  const file = await handle.getFile();
  // En eksternt erstattet fil kan være vilkårligt stor. Gem må ikke læse gigabytes
  // ind i hukommelsen for at afgøre, om den tidligere .eo-fil er ændret.
  if (file.size > MAX_FILE_SIZE) {
    throw new DOMException('Filen er for stor til sikker kontrol', 'NotReadableError');
  }
  return createFileContentFingerprint(await file.text());
};
