import CryptoJS from 'crypto-js';

// =============================================================================
// KRYPTERINGSKONSTANTER
// =============================================================================
const PASSWORD = 'MINEO_ERSTATNINGSBEREGNING_2025';
const SALT = 'mineo_salt_2025';
const ITERATIONS = 100000;

/**
 * Afleder krypteringsnøgle fra password ved hjælp af PBKDF2.
 * Matcher Python-implementeringens PBKDF2HMAC med SHA256.
 *
 * @returns {string} Afledt krypteringsnøgle
 */
const deriveKey = () => {
  try {
    // PBKDF2 key derivation (matcher Python's PBKDF2HMAC)
    const key = CryptoJS.PBKDF2(PASSWORD, SALT, {
      keySize: 256 / 32, // 32 bytes = 256 bits
      iterations: ITERATIONS,
      hasher: CryptoJS.algo.SHA256,
    });

    return key.toString();
  } catch (error) {
    console.error('Fejl ved key derivation:', error);
    throw new Error('Kunne ikke generere krypteringsnøgle');
  }
};

/**
 * Beregner SHA-256 checksum af data.
 *
 * @param {string} data - Data der skal checksummes
 * @returns {string} Hex-encoded checksum
 */
const calculateChecksum = (data) => {
  try {
    const hash = CryptoJS.SHA256(data);
    return hash.toString(CryptoJS.enc.Hex);
  } catch (error) {
    console.error('Fejl ved checksum-beregning:', error);
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
 *
 * @param {Object} data - Data der skal krypteres
 * @returns {Object} Struktur med krypteret data og metadata
 */
export const encryptData = (data) => {
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

  } catch (error) {
    console.error('Fejl ved kryptering:', error);
    throw new Error(`Kryptering fejlede: ${error.message}`);
  }
};

/**
 * Dekrypterer data med AES-256 og validerer integritet.
 * Følger samme validering som Python-implementeringen:
 * 1. Valider fil-struktur
 * 2. Dekrypter data
 * 3. Valider checksum (KRITISK!)
 * 4. Parse JSON
 *
 * @param {Object} fileContent - Fil-struktur fra .eo fil
 * @returns {Object} Dekrypteret og valideret data
 */
export const decryptData = (fileContent) => {
  try {
    // 1. Valider fil-struktur
    if (!fileContent || typeof fileContent !== 'object') {
      throw new Error('Ugyldigt filformat (ikke et objekt)');
    }

    if (!fileContent.data || !fileContent.checksum) {
      throw new Error("Ugyldigt filformat (mangler 'data' eller 'checksum')");
    }

    const encryptedB64 = fileContent.data;
    const expectedChecksum = fileContent.checksum;

    // 2. Aflæs krypteringsnøgle
    const key = deriveKey();

    // 3. Dekrypter data
    let decrypted;
    try {
      decrypted = CryptoJS.AES.decrypt(encryptedB64, key, {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
    } catch (error) {
      throw new Error('Dekryptering fejlede (ugyldig nøgle eller korrupt fil)');
    }

    // 4. Konverter til UTF-8 string
    let jsonString;
    try {
      jsonString = decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
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
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Kunne ikke parse JSON data: ${error.message}`);
    }

    // 7. Valider at data er et objekt
    if (!data || typeof data !== 'object') {
      throw new Error('Ugyldig data i fil (ikke et objekt)');
    }

    return data;

  } catch (error) {
    // Genkast med brugervenlig besked
    if (error.message.includes('Checksum')) {
      throw error; // Bevar checksum-fejl som er
    }
    if (error.message.includes('Dekryptering fejlede')) {
      throw error; // Bevar dekrypterings-fejl som er
    }
    throw new Error(`Kunne ikke indlæse fil: ${error.message}`);
  }
};

/**
 * Krypterer data og returner som JSON-string klar til fil-gemning.
 *
 * @param {Object} data - Data der skal krypteres
 * @returns {string} JSON-string med krypteret data
 */
export const encryptToString = (data) => {
  const encrypted = encryptData(data);
  return JSON.stringify(encrypted, null, 2);
};

/**
 * Dekrypterer data fra JSON-string.
 *
 * @param {string} jsonString - JSON-string med krypteret data
 * @returns {Object} Dekrypteret data
 */
export const decryptFromString = (jsonString) => {
  // Parse JSON fil
  let fileContent;
  try {
    fileContent = JSON.parse(jsonString);
  } catch (error) {
    throw new Error('Ugyldigt filformat (ikke gyldig JSON)');
  }

  return decryptData(fileContent);
};
