import { VERSION, FILE_FORMAT_VERSION } from '../config/version';
import { hasRealData, countFilledFields } from './dataCollection';
import { encryptToString, decryptFromString } from './encryption';
import { generateFilename, downloadFile, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import {
  logOperationStart,
  logOperationEnd,
  logDataStats,
  logInfo,
  logError,
  logWarning,
  sanitizeFilenameForLog,
} from './logger';
import {
  isFileSystemAccessSupported,
  saveFileWithPicker,
  writeToFileHandle,
  readFromFileHandle,
} from './fileSystemAccess';
import {
  requestPersistentStorage,
  saveFileHandleToIndexedDB,
  loadFileHandleFromIndexedDB,
  verifyFileHandle,
  deleteFileHandleFromIndexedDB,
} from './fileHandleStorage';
import type { SaveFileResult } from '../types/fileOperations';
import { eoFileDataSchema, type EoFileContainer, type EoFileData } from '../schemas/eoFileSchema';
import { persistenceSchemaFingerprint, persistenceSchemas } from '../config/persistenceRegistry';
import type { StorageKey } from '../config/storageManifest';

/**
 * Indsamler data direkte fra sessionStorage og simulerer gem-transformationer.
 * Dette bruges til at få det "forventede" resultat til sammenligning.
 *
 * VIGTIGT: Unwrapper PersistedData-struktur (version, timestamp, data)
 * for at få fat i den faktiske data.
 *
 * @returns {Object} Data som det ville se ud efter gem-transformationer
 */
/**
 * Autoritativt snapshot fra persistence-laget.
 *
 * Semantik:
 * - Skal indeholde alle `StorageKey`s (brug `undefined` for at udelade en sektion).
 * - Må ikke indeholde `null` (fail-fast; ellers risikerer vi silent data loss).
 */
type SaveSnapshot = Record<StorageKey, unknown | undefined>;

/**
 * Canonical `.eo` payload representation.
 *
 * VIGTIGT (trust-critical):
 * - Denne repræsentation er den ENESTE autoritative sandhed for save/verify.
 * - Alt der gemmes skal valideres til denne type via `eoFileDataSchema`.
 */
export type CanonicalEoData = EoFileData;

export type VerificationFailureKind = 'unusable' | 'integrity';

export class SaveIntegrityError extends Error {
  readonly kind = 'integrity' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SaveIntegrityError';
  }
}

export class SaveUnusableFileError extends Error {
  readonly kind = 'unusable' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SaveUnusableFileError';
  }
}

const asError = (value: unknown): Error => {
  return value instanceof Error ? value : new Error(String(value));
};

const buildAllDataRawFromSnapshot = (snapshot: SaveSnapshot): Record<string, unknown> => {
  for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
      throw new Error(`Snapshot mangler key '${key}'. Gem kræver alle keys (brug undefined for at udelade en sektion).`);
    }
  }

  const out: Record<string, unknown> = {};
  for (const key of Object.keys(persistenceSchemas) as StorageKey[]) {
    const raw = snapshot[key];
    if (raw === null) {
      throw new Error(`Snapshot indeholder null for '${key}'. Brug undefined for at udelade en sektion.`);
    }
    if (raw === undefined) continue;
    out[key] = raw;
  }
  return out;
};

/**
 * Sammenligner to datasæt felt-for-felt og finder forskelle.
 *
 * @param {Object} expected - Forventet data (fra sessionStorage)
 * @param {Object} actual - Faktisk data (fra gemt fil)
 * @param {string} path - Nuværende sti (til fejlmeldinger)
 * @param {number} depth - Rekursions-dybde (sikkerhed)
 * @returns {Array<string>} Liste af forskelle
 */
const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const stripUndefinedDeep = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(stripUndefinedDeep);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      const next = stripUndefinedDeep(v);
      if (next !== undefined) {
        out[k] = next;
      }
    }
    return out;
  }
  return value;
};

const getValueType = (value: unknown): string => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const compareData = (expected: unknown, actual: unknown, path = 'root', depth = 0): string[] => {
  const differences: string[] = [];

  // Sikkerhed mod uendelig rekursion
  if (depth > 15) {
    return differences;
  }

  // Type-tjek
  const expectedType = getValueType(expected);
  const actualType = getValueType(actual);

  if (expectedType !== actualType) {
    differences.push(`${path}: Type mismatch (forventet: ${expectedType}, faktisk: ${actualType})`);
    return differences;
  }

  // Null/undefined tjek
  if (expected === null || expected === undefined) {
    return differences;
  }
  if (actual === null || actual === undefined) {
    differences.push(`${path}: Forventet værdi, fik null/undefined`);
    return differences;
  }

  // Arrays
  if (Array.isArray(expected)) {
    const actualArray = actual as unknown[];
    if (expected.length !== actualArray.length) {
      differences.push(`${path}: Array-længde afviger (forventet: ${expected.length}, faktisk: ${actualArray.length})`);
    }

    const maxLength = Math.max(expected.length, actualArray.length);
    for (let i = 0; i < maxLength; i++) {
      const itemDiffs = compareData(expected[i], actualArray[i], `${path}[${i}]`, depth + 1);
      differences.push(...itemDiffs);
    }

    return differences;
  }

  // Objekter
  if (isRecord(expected) && isRecord(actual)) {
    // Ignorer metadata og sortér nøgler for stabil sammenligning
    const expectedKeys = Object.keys(expected).filter(k => !k.startsWith('_')).sort();
    const actualKeys = Object.keys(actual).filter(k => !k.startsWith('_')).sort();

    // Tjek for manglende nøgler
    for (const key of expectedKeys) {
      if (!actualKeys.includes(key)) {
        differences.push(`${path}.${key}: Mangler i gemt fil`);
      } else {
        const itemDiffs = compareData(expected[key], actual[key], `${path}.${key}`, depth + 1);
        differences.push(...itemDiffs);
      }
    }

    // Tjek for ekstra nøgler
    for (const key of actualKeys) {
      if (!expectedKeys.includes(key)) {
        differences.push(`${path}.${key}: Ekstra felt i gemt fil (ikke i sessionStorage)`);
      }
    }

    return differences;
  }

  // Primitive værdier
  if (expected !== actual) {
    differences.push(`${path}: Værdi afviger (forventet: "${expected}", faktisk: "${actual}")`);
  }

  return differences;
};

type VerificationResult = {
  success: boolean;
  kind?: VerificationFailureKind;
  verified?: boolean;
  warning?: boolean;
  message?: string;
  expected?: number;
  actual?: number;
  difference?: number;
  missingSections?: string[];
  error?: string;
  details?: string;
  differences?: string[];
};

const isFileSystemFileHandle = (value: unknown): value is FileSystemFileHandle => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.getFile === 'function';
};

/**
 * Verificerer at en gemt fil kan læses korrekt og indeholder forventet data.
 *
 * Læser filen tilbage efter gem og validerer:
 * - At filen kan dekrypteres
 * - At data fra sessionStorage matcher data i filen (felt-for-felt)
 * - At fieldCount matcher forventet værdi
 * - At kritiske sektioner findes
 *
 * @param {FileSystemFileHandle|string} fileHandleOrContent - File handle (File System API) eller fil-indhold (fallback)
 * @param {Object} expectedData - Forventet data (fra sessionStorage med transformationer)
 * @param {boolean} isFileHandle - True hvis første parameter er file handle, false hvis det er indhold
 * @returns {Promise<Object>} Verifikationsresultat med status og eventuelle advarsler
 */
const verifyAfterSave = async (
  fileHandleOrContent: FileSystemFileHandle | string,
  expectedData: CanonicalEoData,
  isFileHandle = true
): Promise<VerificationResult> => {
  logInfo('Verificerer gemt fil...');

  try {
    let fileContent;

    // Læs fil-indhold baseret på type
    if (isFileHandle) {
      // File System Access API - læs via file handle
      if (!isFileSystemFileHandle(fileHandleOrContent)) {
        throw new Error('Intern fejl: verifyAfterSave forventede et FileSystemFileHandle');
      }
      fileContent = await readFromFileHandle(fileHandleOrContent);
      logInfo(`✓ Fil læst tilbage via handle (${fileContent.length} bytes)`);
    } else {
      // Fallback - vi har allerede indholdet (det der lige blev "downloadet")
      if (typeof fileHandleOrContent !== 'string') {
        throw new Error('Intern fejl: verifyAfterSave forventede fil-indhold som string');
      }
      fileContent = fileHandleOrContent;
      logInfo(`✓ Fil-indhold verificeres (${fileContent.length} bytes)`);
    }

    // Dekrypter filen
    let decrypted: unknown;
    try {
      decrypted = decryptFromString(fileContent);
      logInfo('✓ Fil kan dekrypteres korrekt');
    } catch (error) {
      logError('⚠ KRITISK: Fil kan IKKE dekrypteres!');
      return {
        success: false,
        kind: 'unusable',
        error: 'KRITISK FEJL: Den gemte fil kan ikke dekrypteres!',
        details: error instanceof Error ? error.message : String(error),
      };
    }

    // Valider basis-struktur
    const decryptedObj = (decrypted && typeof decrypted === 'object') ? (decrypted as Record<string, unknown>) : null;
    const decryptedData = decryptedObj ? decryptedObj.data : null;
    if (!decryptedData || typeof decryptedData !== 'object') {
      logError('⚠ KRITISK: Ugyldig fil-struktur!');
      return {
        success: false,
        kind: 'unusable',
        error: 'KRITISK FEJL: Ugyldig fil-struktur i gemt fil!',
      };
    }

    const actualData = decryptedData as Record<string, unknown>;

    // Tæl felter
    // Canonicalize both sides like the save pipeline does:
    // - apply `.eo` schema normalization (`null` -> `undefined`)
    // - drop `undefined` keys (JSON.stringify omits them)
    const actualParsed = eoFileDataSchema.safeParse(actualData);
    if (!actualParsed.success) {
      logError('? KRITISK: Gemt fil matcher ikke schemas!');
      return {
        success: false,
        kind: 'unusable',
        error: 'KRITISK FEJL: Gemt fil matcher ikke schemas!',
        details: actualParsed.error.message,
      };
    }

    const expectedCanonicalJson = stripUndefinedDeep(expectedData);
    const actualCanonicalJson = stripUndefinedDeep(actualParsed.data);

    const expectedFieldCount = countFilledFields(expectedCanonicalJson);
    const actualFieldCount = countFilledFields(actualCanonicalJson);
    logInfo(`✓ Felter - Forventet: ${expectedFieldCount}, Faktisk: ${actualFieldCount}`);

    // KRITISK: Sammenlign felt-for-felt
    logInfo('Sammenligner persistence snapshot med gemt fil...');
    const differences = compareData(expectedCanonicalJson, actualCanonicalJson);

    if (differences.length > 0) {
      // KRITISK FEJL: Data matcher ikke!
      logError('⚠⚠⚠ KRITISK: Data i fil matcher IKKE persistence snapshot!');
      logError(`Fandt ${differences.length} forskelle:`);

      // Log første 10 forskelle (for ikke at overvælde konsollen)
      const displayCount = Math.min(10, differences.length);
      for (let i = 0; i < displayCount; i++) {
        logError(`  ${i + 1}. ${differences[i]}`);
      }

      if (differences.length > 10) {
        logError(`  ... og ${differences.length - 10} flere forskelle`);
      }

      return {
        success: false,
        kind: 'integrity',
        error: 'KRITISK FEJL: Gemt data matcher ikke persistence snapshot!',
        details: `${differences.length} forskelle fundet`,
        differences: differences.slice(0, 20), // Maksimalt 20 til returværdi
      };
    }

    logInfo('✓ Data matcher perfekt - ingen forskelle fundet!');

    // Valider at kritiske sektioner findes
    const criticalSections = ['stamdata'];
    const actualCanonicalRecord = isRecord(actualCanonicalJson) ? actualCanonicalJson : {};
    const missingSections = criticalSections.filter((section) => {
      const sectionValue = (actualCanonicalRecord as Record<string, unknown>)[section];
      return !isRecord(sectionValue) || Object.keys(sectionValue).length === 0;
    });

    if (missingSections.length > 0) {
      logWarning(`⚠ ADVARSEL: Manglende kritiske sektioner: ${missingSections.join(', ')}`);
	      return {
	        success: true,
	        verified: true,
	        warning: true,
	        message: `ADVARSEL: Manglende sektioner: ${missingSections.join(', ')}`,
	        missingSections,
	      };
    }

    logInfo('✓ Fil verificeret succesfuldt - alle data er gemt korrekt!');

	    return {
	      success: true,
	      verified: true,
	    };

  } catch (error) {
    logError('Verificering fejlede', {
      context: 'verifyAfterSave',
      error: error instanceof Error ? error : undefined,
    });
    const details = error instanceof Error ? error.message : 'Ukendt fejl';
    return {
      success: false,
      kind: 'unusable',
      error: 'Kunne ikke verificere gemt fil',
      details,
    };
  }
};

/**
 * Gemmer alle applikationsdata til krypteret .eo fil.
 *
 * Proces:
 * 1. Indsaml data fra sessionStorage
 * 2. Valider at der er data at gemme
 * 3. Tæl antal felter (til validering ved hent)
 * 4. Opbyg fil-struktur med metadata
 * 5. Krypter data
 * 6. Generer filnavn
 * 7. Download fil
 * 8. Gem filsti til sessionStorage (til hurtig overskrivning)
 *
 * @param resolvedDirectory - Optional resolved directory fra resolveDefaultDirectoryHandle
 * @returns {Promise<SaveFileResult>} Success-objekt med filnavn og statistik
 * @throws {Error} Hvis gemning fejler
 */
export const saveToFile = async (
  snapshot: SaveSnapshot,
  resolvedDirectory?: ResolvedDirectory
): Promise<SaveFileResult> => {
  logOperationStart('Gem fil');

  try {
    // 0. Byg data fra persistence snapshot (til verificering)
    // Dette skal ske FØR collectAllData() for at fange eventuelle fejl i den funktion
    logInfo('Indsamler data fra persistence snapshot...');
    const snapshotDataRaw = buildAllDataRawFromSnapshot(snapshot);
    const snapshotFieldCount = countFilledFields(snapshotDataRaw);
    const expectedFieldCount = snapshotFieldCount;
    logInfo(`✓ Forventet data indsamlet: ${expectedFieldCount} felter`);

    // 1. Indsaml data til fil fra persistence snapshot
    logInfo('Indsamler data fra persistence snapshot...');
    const allDataRaw = snapshotDataRaw;
    logDataStats(allDataRaw, 'Indsamlet data');

    // VIGTIGT: `.eo` fil må kun indeholde schema-valideret brugerinput.
    const parsedData = eoFileDataSchema.safeParse(allDataRaw);
    if (!parsedData.success) {
      throw new Error(`Kan ikke gemme: Data matcher ikke schemas.\n${parsedData.error.message}`);
    }
    // VIGTIGT: `.eo` filer må kun indeholde schema-valideret brugerinput.
    // Brug den parsed repræsentation for at undgå at gemme ukendte felter, `null`-rester, mv.
    const canonicalData: CanonicalEoData = parsedData.data;

    // 2. Valider at vi har egentlige data at gemme
    if (!hasRealData(canonicalData)) {
      const error = new Error('Ingen data fundet at gemme');
      logError('Validering fejlede', {
        context: 'saveToFile.validation',
        error,
      });
      throw error;
    }
    logInfo('✓ Data valideret - indeholder meningsfulde værdier');

    // 3. Tæl antal felter med data (KRITISK for validering ved hent!)
    const fieldCount = countFilledFields(canonicalData);
    logInfo(`✓ Talt ${fieldCount} felter med data`);

    if (fieldCount === 0) {
      const error = new Error('Ingen udfyldte felter fundet');
      logError('Feltoptælling fejlede', {
        context: 'saveToFile.fieldCount',
        error,
      });
      throw error;
    }

    // 4. Opbyg fil-struktur med metadata
    const fileData: EoFileContainer = {
      // Format version (til fremtidig kompatibilitet - bruger nu central konstant)
      version: FILE_FORMAT_VERSION,

      // Metadata
      _metadata: {
        exportDate: new Date().toISOString(),
        appVersion: VERSION,
        fieldCount: fieldCount, // VIGTIGT: Bruges til validering ved hent
        schemaHash: persistenceSchemaFingerprint,
      },

      // Selve data fra alle menupunkter
      data: canonicalData,
    };

    logInfo('✓ Fil-struktur opbygget med metadata');

    // 5. Krypter data
    logInfo('Krypterer data...');
    const encrypted = encryptToString(fileData);
    logInfo(`✓ Data krypteret (${encrypted.length} bytes)`);

    // 6. Gem fil (File System Access API eller fallback)
    let filename: string;
    let verification: VerificationResult = { success: true, verified: false }; // Gem verifikationsresultat til returværdi
    const useFileSystemAPI = isFileSystemAccessSupported();

    if (useFileSystemAPI) {
      logInfo('Bruger File System Access API');

      // Anmod om persistent storage (kun første gang)
      await requestPersistentStorage();

      // Forsøg at hente tidligere gemt file handle fra IndexedDB
      const loadedHandle: unknown = await loadFileHandleFromIndexedDB();
      let fileHandle: FileSystemFileHandle | null = isFileSystemFileHandle(loadedHandle) ? loadedHandle : null;
      const savedFilePath = sessionStorage.getItem('mineo_ui_lastSavedFilename');
      let shouldUseExistingHandle = false;

      if (fileHandle && savedFilePath) {
        // Vi har et gemt handle - valider det
        logInfo('Fundet gemt file handle - validerer...');

        // Hent gemte stamdata-værdier fra sidste gem
        const savedStamdataJson = sessionStorage.getItem('mineo_ui_lastSavedFilenameBasis');
        const savedStamdata = savedStamdataJson ? JSON.parse(savedStamdataJson) : null;
        const currentStamdata = fileData.data.stamdata || {};

        // Sammenlign kun de felter der påvirker filnavnet
        const stamdataChanged = savedStamdata && (
          savedStamdata.skadelidte !== currentStamdata.skadelidte ||
          savedStamdata.skadestype !== currentStamdata.skadestype ||
          savedStamdata.skadesdato !== currentStamdata.skadesdato
        );

        if (!stamdataChanged) {
          // Stamdata uændret (eller ikke gemt tidligere) - brug gemt handle
          logInfo('✓ Stamdata uændret - genbruger fil-handle');

          // Valider at handle stadig virker
          const isValid = await verifyFileHandle(fileHandle);

          if (isValid) {
            // Handle er gyldigt - brug det direkte (browseren håndterer overskrivning)
            logInfo('✓ File handle er gyldigt - gemmer direkte');
            shouldUseExistingHandle = true;
          } else {
            // Handle er ugyldigt - slet fra IndexedDB og åbn file picker
            logWarning('File handle er ikke længere gyldigt - sletter fra IndexedDB');
            await deleteFileHandleFromIndexedDB();
            fileHandle = null;
          }
        } else {
          // Stamdata ændret - åbn file picker med nyt foreslået filnavn
          logInfo('Stamdata er ændret - åbner file picker med nyt foreslået filnavn');
          fileHandle = null;
        }
      }

      // Hvis vi ikke skal bruge eksisterende handle, åbn file picker
      if (!shouldUseExistingHandle) {
        const currentFilename = generateFilename(fileData.data);
        const suggestedFilename = savedFilePath && !fileHandle
          ? savedFilePath
          : `${currentFilename}.eo`;

        // Bestem startIn baseret på resolved directory
        const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';

        logInfo(`Åbner file picker med forslag: ${sanitizeFilenameForLog(suggestedFilename)}`);
        const pickedHandle: unknown = await saveFileWithPicker(suggestedFilename, startIn);
        fileHandle = isFileSystemFileHandle(pickedHandle) ? pickedHandle : null;

        if (!fileHandle) {
          // Bruger annullerede - returner stille uden fejl
          logInfo('Bruger annullerede fil-valg');
          return { success: false, cancelled: true };
        }

	      // Gem nyt handle til IndexedDB
	      await saveFileHandleToIndexedDB(fileHandle);
	    }

	    if (!fileHandle) {
	      throw new Error('Kunne ikke gemme: Ingen fil valgt');
	    }
	
	    // Skriv til fil
	    logInfo('Skriver til fil via File System Access API...');
	    await writeToFileHandle(fileHandle, encrypted);
      logInfo('✓ Fil gemt succesfuldt');

      filename = fileHandle.name;

      // VERIFICER at filen er gemt korrekt
      verification = await verifyAfterSave(fileHandle, canonicalData, true);

      if (!verification.success) {
        // KRITISK fejl - filen kunne ikke læses tilbage!
        logError('⚠⚠⚠ KRITISK: Fil blev gemt, men verificering fejlede!');

        const kind: VerificationFailureKind = verification.kind ?? 'unusable';
        const heading = kind === 'integrity' ? 'INTEGRITETSKONTROL FEJLEDE' : 'FILEN ER IKKE BRUGBAR';
        const body = kind === 'integrity'
          ? 'Filen blev skrevet og kan læses, men integritetskontrollen fejlede. Systemet kan derfor ikke garantere, at filen svarer præcist til den aktuelle beregning.'
          : 'Filen blev skrevet, men kan ikke læses tilbage som en brugbar .eo-fil.';

        // Byg detaljeret fejlbesked
        let errorMsg = `${heading}: ${verification.error}\n\n` +
                       `${body}\n` +
                       `Detaljer: ${verification.details || 'Ukendt fejl'}\n\n`;

        // Tilføj forskelle hvis der er nogen
        if (verification.differences && verification.differences.length > 0) {
          errorMsg += `Forskelle fundet:\n`;
          const displayCount = Math.min(5, verification.differences.length);
          for (let i = 0; i < displayCount; i++) {
            errorMsg += `  ${i + 1}. ${verification.differences[i]}\n`;
          }
          if (verification.differences.length > 5) {
            errorMsg += `  ... og ${verification.differences.length - 5} flere\n`;
          }
          errorMsg += `\n`;
        }

        errorMsg += `Prøv at gemme igen.`;

        throw kind === 'integrity' ? new SaveIntegrityError(errorMsg) : new SaveUnusableFileError(errorMsg);
      }

      if (verification.warning) {
        // Advarsel - filen er læsbar, men noget er anderledes end forventet
        logWarning('⚠ Verificering fandt advarsler (se konsol for detaljer)');
        // Vi fortsætter - filen er teknisk OK, bare med advarsler
        // Advarslen returneres til UI senere
      }

      // Gem filnavn og stamdata til sessionStorage (til validering ved næste gem)
      sessionStorage.setItem('mineo_ui_lastSavedFilename', filename);
      const currentStamdata = fileData.data.stamdata;
      const stamdataRecord: Record<string, unknown> =
        currentStamdata && typeof currentStamdata === 'object' && !Array.isArray(currentStamdata)
          ? (currentStamdata as Record<string, unknown>)
          : {};
      const filenameBasis = {
        skadelidte: typeof stamdataRecord.skadelidte === 'string' ? stamdataRecord.skadelidte : undefined,
        skadestype: typeof stamdataRecord.skadestype === 'string' ? stamdataRecord.skadestype : undefined,
        skadesdato: typeof stamdataRecord.skadesdato === 'string' ? stamdataRecord.skadesdato : undefined,
      };
      sessionStorage.setItem('mineo_ui_lastSavedFilenameBasis', JSON.stringify(filenameBasis));

    } else {
      // Fallback til klassisk download (Firefox, osv.)
      logWarning('File System Access API ikke tilgængelig - bruger fallback download');

      // Generer filnavn baseret på stamdata eller brug gemt navn
      const lastSavedPath = sessionStorage.getItem('mineo_ui_lastSavedFilename');
      const currentFilename = generateFilename(fileData.data);

      // Brug sidste gemte filnavn hvis stamdata er uændret, ellers brug nyt baseret på stamdata
      if (lastSavedPath && lastSavedPath.startsWith(currentFilename.split('_')[0])) {
        filename = lastSavedPath;
        logInfo(`Genbruger filnavn: ${sanitizeFilenameForLog(filename)}`);
      } else {
        filename = `${currentFilename}.eo`;
        logInfo(`Nyt filnavn genereret: ${sanitizeFilenameForLog(filename)}`);
      }

      // Download fil (browseren håndterer "filen eksisterer allerede" hvis relevant)
      logInfo('Downloader fil...');
      downloadFile(encrypted, filename, 'application/octet-stream');
      logInfo('✓ Fil downloadet');

      // VERIFICER indholdet (vi har allerede encrypted data i memory)
      verification = await verifyAfterSave(encrypted, canonicalData, false);

      if (!verification.success) {
        // KRITISK fejl - data kunne ikke dekrypteres!
        logError('⚠⚠⚠ KRITISK: Verificering af gemt data fejlede!');

        const kind: VerificationFailureKind = verification.kind ?? 'unusable';
        const heading = kind === 'integrity' ? 'INTEGRITETSKONTROL FEJLEDE' : 'FILEN ER IKKE BRUGBAR';
        const body = kind === 'integrity'
          ? 'Data blev opbygget og krypteret, men integritetskontrollen fejlede. Systemet kan derfor ikke garantere, at filen svarer præcist til den aktuelle beregning.'
          : 'Data blev opbygget og krypteret, men den resulterende fil kan ikke verificeres som en brugbar .eo-fil.';

        // Byg detaljeret fejlbesked
        let errorMsg = `${heading}: ${verification.error}\n\n` +
                       `${body}\n` +
                       `Detaljer: ${verification.details || 'Ukendt fejl'}\n\n`;

        // Tilføj forskelle hvis der er nogen
        if (verification.differences && verification.differences.length > 0) {
          errorMsg += `Forskelle fundet:\n`;
          const displayCount = Math.min(5, verification.differences.length);
          for (let i = 0; i < displayCount; i++) {
            errorMsg += `  ${i + 1}. ${verification.differences[i]}\n`;
          }
          if (verification.differences.length > 5) {
            errorMsg += `  ... og ${verification.differences.length - 5} flere\n`;
          }
          errorMsg += `\n`;
        }

        errorMsg += `Dette er en alvorlig fejl - prøv at gemme igen.`;

        throw kind === 'integrity' ? new SaveIntegrityError(errorMsg) : new SaveUnusableFileError(errorMsg);
      }

      if (verification.warning) {
        // Advarsel - data er læsbar, men noget er anderledes end forventet
        logWarning('⚠ Verificering fandt advarsler (se konsol for detaljer)');
        // Vi fortsætter - filen er teknisk OK, bare med advarsler
      }

      sessionStorage.setItem('mineo_ui_lastSavedFilename', filename);
      const currentStamdata2 = fileData.data.stamdata;
      const stamdataRecord2: Record<string, unknown> =
        currentStamdata2 && typeof currentStamdata2 === 'object' && !Array.isArray(currentStamdata2)
          ? (currentStamdata2 as Record<string, unknown>)
          : {};
      const filenameBasis2 = {
        skadelidte: typeof stamdataRecord2.skadelidte === 'string' ? stamdataRecord2.skadelidte : undefined,
        skadestype: typeof stamdataRecord2.skadestype === 'string' ? stamdataRecord2.skadestype : undefined,
        skadesdato: typeof stamdataRecord2.skadesdato === 'string' ? stamdataRecord2.skadesdato : undefined,
      };
      sessionStorage.setItem('mineo_ui_lastSavedFilenameBasis', JSON.stringify(filenameBasis2));
    }

    logInfo('✓ Filsti og stamdata gemt til sessionStorage');

    logOperationEnd('Gem fil', true);

    // Returner success-info (inkl. verifikation hvis der var advarsler)
    const result: SaveFileResult = {
      success: true,
      filename,
      fieldCount,
      sections: Object.keys(canonicalData).length,
      verified: verification?.verified ?? false,
      ...(verification?.warning
        ? {
            warning: verification.message,
            verificationDetails: {
              expected: verification.expected,
              actual: verification.actual,
              difference: verification.difference,
              missingSections: verification.missingSections,
            },
          }
        : {}),
    };

    return result;

  } catch (error) {
    logOperationEnd('Gem fil', false);

    const err = asError(error);

    // Sikkerhed: Log kun fejltype, ikke følsomme data
    const safeErrorMessage = err.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre
    logError('Gem-operation fejlede', {
      context: 'saveToFile',
      error: new Error(safeErrorMessage),
    });

    // Genkast med brugervenlig besked
    if (err instanceof SaveIntegrityError || err instanceof SaveUnusableFileError) {
      throw err;
    }
    if (err.message.includes('Ingen data')) {
      throw err; // Bevar validerings-fejl som er
    }
    if (err.message.includes('Ingen udfyldte felter')) {
      throw err; // Bevar validerings-fejl som er
    }
    if (err.message.includes('annulleret')) {
      throw err; // Bevar annullerings-besked
    }

    throw new Error(`Kunne ikke gemme fil: ${err.message}`);
  }
};

/**
 * Nulstiller gemt filsti (bruges hvis bruger vil gemme som ny fil).
 */
export const resetSavedFilePath = () => {
  sessionStorage.removeItem('mineo_ui_lastSavedFilename');
  sessionStorage.removeItem('mineo_ui_lastSavedFilenameBasis');
  // Backward cleanup (ældre keys)
  sessionStorage.removeItem('mineo_lastSavedFilePath');
  sessionStorage.removeItem('mineo_lastSavedStamdata');
  logInfo('Filsti nulstillet - næste gem vil prompte for nyt navn');
};
