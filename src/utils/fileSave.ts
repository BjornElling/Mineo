import { VERSION, FILE_FORMAT_VERSION } from '../config/version';
import { hasRealData, countFilledFields } from './dataCollection';
import { encryptToString } from './encryption';
import { generateFilename, downloadFile, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import {
  logError,
  logWarning,
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
  verifyFileHandleDetailed,
  deleteFileHandleFromIndexedDB,
} from './fileHandleStorage';
import type { SaveFileResult } from '../types/fileOperations';
import { eoFileDataSchema, type EoFileContainer } from '../schemas/eoFileSchema';
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
import { isRecord, asError } from './typeGuards';

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

export class SaveValidationError extends Error {
  readonly kind = 'validation' as const;
  constructor(message: string) {
    super(message);
    this.name = 'SaveValidationError';
  }
}


/**
 * Sammenligner to datasæt felt-for-felt og finder forskelle.
 *
 * @param {Object} expected - Forventet data (fra sessionStorage)
 * @param {Object} actual - Faktisk data (fra gemt fil)
 * @param {string} path - Nuværende sti (til fejlmeldinger)
 * @param {number} depth - Rekursions-dybde (sikkerhed)
 * @returns {Array<string>} Liste af forskelle
 */

const loadStoredFilenameBasis = (): Record<string, unknown> | null => {
  const stored = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);
  if (!stored) return null;
  try {
    const parsed: unknown = JSON.parse(stored);
    return isRecord(parsed) ? parsed : null;
  } catch {
    // Bevidst robustness-valg:
    // Korrupt UI-metadata må aldrig kunne blokere gem af autoritativt brugerinput.
    sessionStorage.removeItem(UI_STORAGE_KEYS.lastSavedFilenameBasis);
    return null;
  }
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

const hasFilenameBasisChanged = (
  previousBasis: unknown,
  nextStamdata: unknown
): boolean => {
  if (!isRecord(previousBasis)) return false;
  const nextBasis = buildFilenameBasis(nextStamdata);
  return (
    previousBasis.skadelidte !== nextBasis.skadelidte ||
    previousBasis.skadestype !== nextBasis.skadestype ||
    previousBasis.skadesdato !== nextBasis.skadesdato
  );
};

const isFileSystemFileHandle = (value: unknown): value is FileSystemFileHandle => {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.getFile === 'function';
};

const buildInvalidHandleUserWarning = (
  verification: Awaited<ReturnType<typeof verifyFileHandleDetailed>>
): string => {
  if (verification.valid) return '';

  switch (verification.reason) {
    case 'not_found':
      return 'Den tidligere valgte fil blev ikke fundet og kunne derfor ikke overskrives automatisk. Vælg filplacering igen.';
    case 'permission_denied':
      return 'Mineo har ikke længere adgang til den tidligere valgte fil og kunne derfor ikke overskrive den automatisk. Vælg filplacering igen.';
    case 'missing_permission_api':
    case 'permission_api_failed':
      return 'Mineo kunne ikke bekræfte adgangen til den tidligere valgte fil og kunne derfor ikke overskrive den automatisk. Vælg filplacering igen.';
    case 'file_access_failed':
    case 'validation_failed':
      return 'Den tidligere valgte fil kunne ikke bruges til automatisk overskrivning. Vælg filplacering igen.';
    case 'missing_handle':
      return 'Der var ikke længere en gemt filreference til automatisk overskrivning. Vælg filplacering igen.';
    default:
      return 'Den tidligere valgte fil kunne ikke overskrives automatisk. Vælg filplacering igen.';
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

  try {
    const allDataRaw = buildAllDataRawFromSnapshot(snapshot);

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
      const error = new SaveValidationError('Ingen data fundet at gemme');
      logError('Validering fejlede', {
        context: 'saveToFile.validation',
        error,
      });
      throw error;
    }

    // 3. Tæl antal felter med data til preflight-rapportering ved hent
    const fieldCount = countFilledFields(canonicalData);

    if (fieldCount === 0) {
      const error = new SaveValidationError('Ingen udfyldte felter fundet');
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
        fieldCount: fieldCount, // VIGTIGT: Bruges til preflight-rapportering ved hent
      },

      // Selve data fra alle menupunkter
      data: canonicalData,
    };

    // 5. Krypter data
    const encrypted = await encryptToString(fileData);

    // 6. Gem fil (File System Access API eller fallback)
    let filename: string;
    let verification: VerificationResult = { success: true, verified: false }; // Gem verifikationsresultat til returværdi
    let fallbackWarning: string | undefined;
    const useFileSystemAPI = isFileSystemAccessSupported();

    if (useFileSystemAPI) {

      // Anmod om persistent storage (kun første gang)
      await requestPersistentStorage();

      // Forsøg at hente tidligere gemt file handle fra IndexedDB
      const loadedHandle: unknown = await loadFileHandleFromIndexedDB();
      let fileHandle: FileSystemFileHandle | null = isFileSystemFileHandle(loadedHandle) ? loadedHandle : null;
      const savedFilePath = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename);
      const savedFilenameBasis = loadStoredFilenameBasis();
      const currentStamdata = fileData.data.stamdata || {};
      const stamdataChanged = hasFilenameBasisChanged(savedFilenameBasis, currentStamdata);
      let shouldUseExistingHandle = false;
      let shouldPersistPickedHandleAfterSuccess = false;

      if (fileHandle && savedFilePath) {
        // Vi har et gemt handle - valider det

        // Sammenlign kun de felter der påvirker filnavnet
        if (!stamdataChanged) {
          // Stamdata uændret (eller ikke gemt tidligere) - brug gemt handle

          // Valider at handle stadig virker
          const handleVerification = await verifyFileHandleDetailed(fileHandle, {
            allowRequestPermission: true,
          });

          if (handleVerification.valid) {
            // Handle er gyldigt - brug det direkte (browseren håndterer overskrivning)
            shouldUseExistingHandle = true;
          } else {
            // Handle er ugyldigt - slet fra IndexedDB og åbn file picker
            fallbackWarning = buildInvalidHandleUserWarning(handleVerification);
            logWarning('Tidligere file handle kunne ikke genbruges - sletter fra IndexedDB', {
              context: 'saveToFile.invalidStoredHandle',
              data: {
                reason: handleVerification.reason,
                detail: handleVerification.detail,
              },
            });
            await deleteFileHandleFromIndexedDB();
            fileHandle = null;
          }
        } else {
          // Stamdata ændret - åbn file picker med nyt foreslået filnavn
          fileHandle = null;
        }
      }

      // Hvis vi ikke skal bruge eksisterende handle, åbn file picker
      if (!shouldUseExistingHandle) {
        const currentFilename = generateFilename(fileData.data);
        const suggestedFilename =
          savedFilePath && !stamdataChanged
            ? savedFilePath
            : `${currentFilename}.eo`;

        // Bestem startIn baseret på resolved directory
        const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';
        const pickedHandle: unknown = await saveFileWithPicker(suggestedFilename, startIn);
        fileHandle = isFileSystemFileHandle(pickedHandle) ? pickedHandle : null;

        if (!fileHandle) {
          // Bruger annullerede - returner stille uden fejl
          return { success: false, cancelled: true };
        }

        // Persist først efter succesfuld write+verify, så et halvt save-flow ikke
        // efterlader et nyt "autorativt" overskrivnings-target i IndexedDB.
        shouldPersistPickedHandleAfterSuccess = true;
      }

      if (!fileHandle) {
        throw new Error('Kunne ikke gemme: Ingen fil valgt');
      }

      // Skriv til fil
      await writeToFileHandle(fileHandle, encrypted);

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

      if (shouldPersistPickedHandleAfterSuccess) {
        const persisted = await saveFileHandleToIndexedDB(fileHandle);
        if (!persisted) {
          logWarning('Gemt fil, men kunne ikke persistere file handle til senere overskrivning', {
            context: 'saveToFile.persistFileHandleAfterSuccess',
          });
        }
      }

      // Gem filnavn og stamdata til sessionStorage (til validering ved næste gem)
      saveFilenameMetadata(filename, fileData.data.stamdata);

    } else {
      // Fallback til klassisk download (Firefox, osv.)
      logWarning('File System Access API ikke tilgængelig - bruger fallback download');

      // Generer filnavn baseret på stamdata eller brug gemt navn
      const lastSavedPath = sessionStorage.getItem(UI_STORAGE_KEYS.lastSavedFilename);
      const currentFilename = generateFilename(fileData.data);
      const savedStamdata = loadStoredFilenameBasis();
      const currentStamdata = fileData.data.stamdata || {};
      const stamdataChanged = hasFilenameBasisChanged(savedStamdata, currentStamdata);

      // Brug sidste gemte filnavn hvis stamdata er uændret, ellers brug nyt baseret på stamdata
      if (lastSavedPath && !stamdataChanged) {
        filename = lastSavedPath;
      } else {
        filename = `${currentFilename}.eo`;
      }

      // Download fil (browseren håndterer "filen eksisterer allerede" hvis relevant)
      downloadFile(encrypted, filename, 'application/octet-stream');

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

    // Returner success-info (inkl. verifikation hvis der var advarsler)
    const result: SaveFileResult = {
      success: true,
      filename,
      fieldCount,
      sections: Object.keys(canonicalData).length,
      verified: verification?.verified ?? false,
      ...((fallbackWarning || verification?.warning)
        ? {
            warning: [fallbackWarning, verification.message].filter(Boolean).join('\n\n'),
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

  } catch (error: unknown) {

    const err = asError(error);

    // Sikkerhed: Log kun fejltype, ikke følsomme data
    const safeErrorMessage = err.message.replace(/\b\d{6}-\d{4}\b/g, '[CPR]'); // Maskér CPR-numre
    logError('Gem-operation fejlede', {
      context: 'saveToFile',
      error: new Error(safeErrorMessage),
    });

    // Genkast med brugervenlig besked
    if (err instanceof SaveIntegrityError || err instanceof SaveUnusableFileError || err instanceof SaveValidationError) {
      throw err;
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
};
