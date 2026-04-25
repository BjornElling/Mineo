import { z } from 'zod';

// =============================================================================
// OBFUSCATION + INTEGRITET (IKKE HEMMELIGHOLDELSE)
// =============================================================================
// Format-kontrakt:
// - KEY_MATERIAL -> UTF-8 -> SHA-256 -> raw AES-256 key
// - AES-GCM med 96-bit IV og 128-bit tag
// - ivB64/ctB64 er standard base64 (ikke URL-safe)
const KEY_MATERIAL = 'MinEO_OBFUSCATION_KEY_V1';
const AES_GCM_IV_BYTES = 12;

export class EncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

const encryptedFileSchema = z.object({
  version: z.number().int(),
  alg: z.literal('A256GCM'),
  ivB64: z.string(),
  ctB64: z.string(),
});

export type EncryptedFileStructure = z.infer<typeof encryptedFileSchema>;

let cachedKey: CryptoKey | null = null;

export const resetKeyCache = (): void => {
  cachedKey = null;
};

const getSubtle = (): SubtleCrypto => {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error('Kryptering understøttes ikke i denne browser');
  }
  return cryptoObj.subtle;
};

const base64Encode = (bytes: Uint8Array): string => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

const base64Decode = (b64: string): Uint8Array => {
  if (b64.trim() !== b64 || b64.trim() === '') {
    throw new EncryptionError('Ugyldigt filformat');
  }
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    throw new EncryptionError('Ugyldigt filformat');
  }
};

const deriveKey = async (): Promise<CryptoKey> => {
  if (cachedKey) return cachedKey;

  const subtle = getSubtle();
  const material = new TextEncoder().encode(KEY_MATERIAL);
  const hash = await subtle.digest('SHA-256', material);
  const key = await subtle.importKey('raw', hash, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  cachedKey = key;
  return key;
};

/**
 * Krypterer data til en obfuskeret container med integritet (AES-GCM).
 */
export const encryptData = async (data: unknown): Promise<EncryptedFileStructure> => {
  const jsonString = JSON.stringify(data, null, 2);
  const key = await deriveKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(AES_GCM_IV_BYTES));
  const plaintext = new TextEncoder().encode(jsonString);

  let ciphertext: ArrayBuffer;
  try {
    ciphertext = await getSubtle().encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, plaintext);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl';
    throw new Error(`Kryptering fejlede: ${message}`);
  }

  return {
    version: 1,
    alg: 'A256GCM',
    ivB64: base64Encode(iv),
    ctB64: base64Encode(new Uint8Array(ciphertext)),
  };
};

/**
 * Dekrypterer data fra obfuskeret container.
 */
export const decryptData = async (fileContent: unknown): Promise<unknown> => {
  const parsed = encryptedFileSchema.safeParse(fileContent);
  if (!parsed.success) {
    throw new EncryptionError('Ugyldigt filformat');
  }

  if (parsed.data.version !== 1) {
    throw new EncryptionError('Ikke understøttet filversion');
  }

  const { ivB64, ctB64 } = parsed.data;
  const ivBytes = base64Decode(ivB64);
  const iv = new Uint8Array(ivBytes.byteLength);
  iv.set(ivBytes);
  const ciphertextBytes = base64Decode(ctB64);
  const ciphertext = new Uint8Array(ciphertextBytes.byteLength);
  ciphertext.set(ciphertextBytes);

  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new EncryptionError('Ugyldigt filformat');
  }

  const key = await deriveKey();

  let plaintext: ArrayBuffer;
  try {
    plaintext = await getSubtle().decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext);
  } catch {
    throw new EncryptionError('Dekryptering fejlede');
  }

  const jsonString = new TextDecoder().decode(plaintext);
  if (!jsonString) {
    throw new EncryptionError('Dekryptering fejlede');
  }

  let data: unknown;
  try {
    data = JSON.parse(jsonString);
  } catch {
    throw new EncryptionError('Ugyldigt filformat');
  }

  if (!data || typeof data !== 'object') {
    throw new EncryptionError('Ugyldigt filformat');
  }

  return data;
};

/**
 * Krypterer data og returner som JSON-string klar til fil-gemning.
 */
export const encryptToString = async (data: unknown): Promise<string> => {
  const encrypted = await encryptData(data);
  return JSON.stringify(encrypted, null, 2);
};

/**
 * Dekrypterer data fra JSON-string.
 */
export const decryptFromString = async (jsonString: string): Promise<unknown> => {
  let fileContent: unknown;
  try {
    fileContent = JSON.parse(jsonString);
  } catch {
    throw new EncryptionError('Ugyldigt filformat');
  }

  return decryptData(fileContent);
};
