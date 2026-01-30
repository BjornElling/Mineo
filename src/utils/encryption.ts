import CryptoJS from 'crypto-js';

// =============================================================================
// KRYPTERINGSKONSTANTER
// =============================================================================
const PASSWORD = 'MINEO_ERSTATNINGSBEREGNING_2025';
const SALT = 'mineo_salt_2025';
const ITERATIONS = 100000;

/**
 * Fil-struktur efter kryptering
 */
interface EncryptedFileStructure {
  version: string;
  checksum: string;
  data: string;
}

// Cache til afledt nøgle (performance-optimering)
// Nøglen beregnes én gang og genbruges for hele sessionen
let cachedKey: string | null = null;

/**
 * Afleder krypteringsnøgle fra password ved hjælp af PBKDF2.
 * Matcher Python-implementeringens PBKDF2HMAC med SHA256.
 * Nøglen caches for at undgå genberegning (100.000 iterationer er CPU-tungt).
 */
const deriveKey = (): string => {
  // Returner cached nøgle hvis den allerede er beregnet
  if (cachedKey !== null) {
    return cachedKey;
  }

  try {
    // PBKDF2 key derivation (matcher Python's PBKDF2HMAC)
    const key = CryptoJS.PBKDF2(PASSWORD, SALT, {
      keySize: 256 / 32, // 32 bytes = 256 bits
      iterations: ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    });

    const keyString = key.toString();

    // Cache nøglen for fremtidige kald
    cachedKey = keyString;

    return keyString;
  } catch (_error) {
    console.error('Fejl ved key derivation:', _error);
    throw new Error('Kunne ikke generere krypteringsnøgle');
  }
};

/**
 * Beregner SHA-256 checksum af data.
 */
const calculateChecksum = (data: string): string => {
  try {
    const hash = CryptoJS.SHA256(data);
    return hash.toString(CryptoJS.enc.Hex);
  } catch (_error) {
    console.error('Fejl ved checksum-beregning:', _error);
    throw new Error('Kunne ikke beregne checksum');
  }
};

/**
 * Krypterer data med AES-256.
 * Følger samme struktur som Python-implementeringen:
 * 1. JSON stringify
 * 2. Beregn checksum
 * 3. Krypter med AES
 * 4. Base64-encode
 * 5. Returner struktur med checksum + encrypted data + version
 */
export const encryptData = (data: unknown): EncryptedFileStructure => {
  try {
    // 1. Serialiser data til JSON
    const jsonString = JSON.stringify(data, null, 2);

    // 2. Beregn checksum af original JSON
    const checksum = calculateChecksum(jsonString);

    // 3. Aflæs krypteringsnøgle
    const key = deriveKey();

    // 4. Krypter data med AES
    const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 5. Base64-encode krypteret data
    const encryptedB64 = encrypted.toString();

    // 6. Returner fil-struktur (matcher Python's format)
    return {
      version: '1.0',
      checksum: checksum,
      data: encryptedB64,
    };

  } catch (_error) {
    console.error('Fejl ved kryptering:', _error);
    throw new Error(`Kryptering fejlede: ${_error.message}`);
  }
};

/**
 * Dekrypterer data med AES-256 og validerer integritet.
 * Følger samme validering som Python-implementeringen:
 * 1. Valider fil-struktur
 * 2. Dekrypter data
 * 3. Valider checksum (KRITISK!)
 * 4. Parse JSON
 */
export const decryptData = (fileContent: unknown): unknown => {
  try {
    // 1. Valider fil-struktur
    if (!fileContent || typeof fileContent !== 'object') {
      throw new Error('Ugyldigt filformat (ikke et objekt)');
    }

    const container = fileContent as Record<string, unknown>;

    if (!container.data || !container.checksum) {
      throw new Error("Ugyldigt filformat (mangler 'data' eller 'checksum')");
    }

    const encryptedB64 = container.data;
    const expectedChecksum = container.checksum;

    if (typeof encryptedB64 !== 'string' || typeof expectedChecksum !== 'string') {
      throw new Error("Ugyldigt filformat ('data' eller 'checksum' har forkert type)");
    }

    // 2. Aflæs krypteringsnøgle
    const key = deriveKey();

    // 3. Dekrypter data
    let decrypted;
    try {
      decrypted = CryptoJS.AES.decrypt(encryptedB64, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
    } catch {
      throw new Error('Dekryptering fejlede (ugyldig nøgle eller korrupt fil)');
    }

    // 4. Konverter til UTF-8 string
    let jsonString;
    try {
      jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    } catch {
      throw new Error('Kunne ikke dekode dekrypteret data');
    }

    if (!jsonString) {
      throw new Error('Dekryptering fejlede (tomt resultat - forkert nøgle?)');
    }

    // 5. Valider checksum FØR JSON parsing (kritisk sikkerhedstjek!)
    const actualChecksum = calculateChecksum(jsonString);
    if (actualChecksum !== expectedChecksum) {
      throw new Error('Checksum matcher ikke (filen kan være korrupt)');
    }

    // 6. Parse JSON (nu vi ved data er valid)
    let data: unknown;
    try {
      data = JSON.parse(jsonString);
    } catch (_error) {
      const message = _error instanceof Error ? _error.message : 'Ukendt fejl';
      throw new Error(`Kunne ikke parse JSON data: ${message}`);
    }

    // 7. Valider at data er et objekt
    if (!data || typeof data !== 'object') {
      throw new Error('Ugyldig data i fil (ikke et objekt)');
    }

    return data;

  } catch (_error) {
    // Sikkerhed: Maskér følsomme data i fejlbeskeder
    const safeErrorMessage = _error.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre

    // Genkast med brugervenlig besked (uden følsomme data)
    if (safeErrorMessage.includes('Checksum')) {
      throw new Error(safeErrorMessage);
    }
    if (safeErrorMessage.includes('Dekryptering fejlede')) {
      throw new Error(safeErrorMessage);
    }
    throw new Error(`Kunne ikke indlæse fil: ${safeErrorMessage}`);
  }
};

/**
 * Krypterer data og returner som JSON-string klar til fil-gemning.
 */
export const encryptToString = (data: unknown): string => {
  const encrypted = encryptData(data);
  return JSON.stringify(encrypted, null, 2);
};

/**
 * Dekrypterer data fra JSON-string.
 */
export const decryptFromString = (jsonString: string): unknown => {
  // Parse JSON fil
  let fileContent: unknown;
  try {
    fileContent = JSON.parse(jsonString);
  } catch {
    throw new Error('Ugyldigt filformat (ikke gyldig JSON)');
  }

  return decryptData(fileContent);
};
