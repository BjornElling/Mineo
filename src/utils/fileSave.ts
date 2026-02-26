import { VERSION, FILE_FORMAT_VERSION } from '../config/version';
import { hasRealData, countFilledFields } from './dataCollection';
import { encryptToString } from './encryption';
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
} from './fileSystemAccess';
import {
  requestPersistentStorage,
  saveFileHandleToIndexedDB,
  loadFileHandleFromIndexedDB,
  verifyFileHandle,
  deleteFileHandleFromIndexedDB,
} from './fileHandleStorage';
import type { SaveFileResult } from '../types/fileOperations';
import { eoFileDataSchema, type EoFileContainer } from '../schemas/eoFileSchema';
import { persistenceSchemaFingerprint } from '../config/persistenceRegistry';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import type {
  CanonicalEoData,
  SaveSnapshot,
  VerificationFailureKind,
  VerificationResult,
} from './fileSaveTypes';
import {
  buildAllDataRawFromSnapshot,
  verifyAfterSave,
} from './fileSaveInternals';

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

const buildFilenameBasis = (stamdata: unknown): { skadelidte?: string; skadestype?: string; skadesdato?: string } => {
  const stamdataRecord: Record<string, unknown> =
    isRecord(stamdata)
      ? stamdata
      : {};
  return {
    skadelidte: typeof stamdataRecord.skadelidte === 'string' ? stamdataRecord.skadelidte : undefined,
    skadestype: typeof stamdataRecord.skadestype === 'string' ? stamdataRecord.skadestype : undefined,
    skadesdato: typeof stamdataRecord.skadesdato === 'string' ? stamdataRecord.skadesdato : undefined,
  };
};

const saveFilenameMetadata = (filename: string, stamdata: unknown): void => {
  sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, filename);
  sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, JSON.stringify(buildFilenameBasis(stamdata)));
};

const isFileSystemFileHandle = (value: unknown): value is FileSystemFileHandle => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.getFile === 'function';
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
    const encrypted = await encryptToString(fileData);
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
      const savedFilePath = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename);
      let shouldUseExistingHandle = false;

      if (fileHandle && savedFilePath) {
        // Vi har et gemt handle - valider det
        logInfo('Fundet gemt file handle - validerer...');

        // Hent gemte stamdata-værdier fra sidste gem
        const savedStamdataJson = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);
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
      saveFilenameMetadata(filename, fileData.data.stamdata);

    } else {
      // Fallback til klassisk download (Firefox, osv.)
      logWarning('File System Access API ikke tilgængelig - bruger fallback download');

      // Generer filnavn baseret på stamdata eller brug gemt navn
      const lastSavedPath = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename);
      const currentFilename = generateFilename(fileData.data);
      const savedStamdataJson = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);
      const savedStamdata = savedStamdataJson ? JSON.parse(savedStamdataJson) : null;
      const currentStamdata = fileData.data.stamdata || {};
      const currentBasis = buildFilenameBasis(currentStamdata);
      const stamdataChanged = savedStamdata && (
        savedStamdata.skadelidte !== currentBasis.skadelidte ||
        savedStamdata.skadestype !== currentBasis.skadestype ||
        savedStamdata.skadesdato !== currentBasis.skadesdato
      );

      // Brug sidste gemte filnavn hvis stamdata er uændret, ellers brug nyt baseret på stamdata
      if (lastSavedPath && !stamdataChanged) {
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

      saveFilenameMetadata(filename, fileData.data.stamdata);
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
  sessionStorage.removeItem(UI_STORAGE_KEYS.lastSavedFilename);
  sessionStorage.removeItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);
  // Backward cleanup (ældre keys)
  sessionStorage.removeItem('mineo_lastSavedFilePath');
  sessionStorage.removeItem('mineo_lastSavedStamdata');
  logInfo('Filsti nulstillet - næste gem vil prompte for nyt navn');
};
