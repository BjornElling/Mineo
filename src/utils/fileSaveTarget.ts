import { generateFilename, type ResolvedDirectory, getStartInValue } from './fileHelpers';
import { logWarning } from './logger';
import {
  isFileSystemAccessSupported,
  isFileSystemFileHandle,
  saveFileWithPicker,
} from './fileSystemAccess';
import {
  requestPersistentStorage,
  loadFileHandleFromIndexedDB,
  verifyFileHandleDetailed,
  deleteFileHandleFromIndexedDB,
} from './fileHandleStorage';
import type { EoFileContainer } from '../schemas/eoFileSchema';
import { UI_STORAGE_KEYS } from '../config/storageManifest';
import {
  buildFilenameBasisFromStamdata,
  loadStoredFilenameBasis,
} from './filePersistenceMetadata';
import { readOptionalSessionStorageValue } from './safeSessionStorage';

/**
 * Typet gem-port: HVOR det verificerede `.eo`-artefakt skal skrives hen.
 *
 * `saveToFile` havde tidligere en stor forgrenet blok, der blandede to concerns: (1) hvilket mål der
 * skal skrives til (genbrug persisteret handle, åbn picker, eller fallback-download) og (2) selve
 * skrivning + verifikation. Denne port ejer KUN målresolutionen og returnerer en diskrimineret værdi
 * — `fileHandle` (read-back-sink), `download` (in-memory-verificér-før-sink) eller `cancelled`
 * (brugeren lukkede pickeren / afviste tilladelses-prompten). Skrivning + verifikation ejes fortsat af
 * `saveToFile`, som blot forgrener på `target.kind`.
 */
export type SaveTarget =
  | {
      kind: 'fileHandle';
      fileHandle: FileSystemFileHandle;
      /** Om det (netop valgte) handle først skal persisteres til IndexedDB EFTER en lykket write+verify. */
      persistHandleAfterSuccess: boolean;
      /** Advarsel hvis et tidligere handle måtte kasseres, så brugeren blev sendt til pickeren. */
      fallbackWarning?: string;
    }
  | { kind: 'download'; filename: string }
  | { kind: 'cancelled' };

const hasFilenameBasisChanged = (
  previousBasis: unknown,
  nextStamdata: unknown
): boolean => {
  if (!previousBasis || typeof previousBasis !== 'object') return false;
  const nextBasis = buildFilenameBasisFromStamdata(nextStamdata);
  return (
    (previousBasis as Record<string, unknown>).skadelidte !== nextBasis.skadelidte ||
    (previousBasis as Record<string, unknown>).skadestype !== nextBasis.skadestype ||
    (previousBasis as Record<string, unknown>).skadedato !== nextBasis.skadedato
  );
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

const isUserDismissedPermissionPrompt = (
  verification: Awaited<ReturnType<typeof verifyFileHandleDetailed>>
): boolean =>
  !verification.valid &&
  verification.reason === 'permission_denied' &&
  verification.detail === 'permission=prompt';

/**
 * Resolver det autoritative gem-mål ud fra det aktuelle miljø og tidligere gem-metadata.
 *
 * File System Access: genbrug et gyldigt persisteret handle når stamdata er uændret; ellers (eller ved
 * et ubrugeligt handle) åbn pickeren med et foreslået filnavn. Ingen File System Access: fallback til
 * klassisk browser-download med et stamdata-afledt eller sidst-gemt filnavn.
 */
export const resolveSaveTarget = async (
  fileData: EoFileContainer,
  resolvedDirectory?: ResolvedDirectory
): Promise<SaveTarget> => {
  if (isFileSystemAccessSupported()) {
    await requestPersistentStorage();

    const loadedHandle: unknown = await loadFileHandleFromIndexedDB();
    let fileHandle: FileSystemFileHandle | null = isFileSystemFileHandle(loadedHandle) ? loadedHandle : null;
    const savedFilePath = readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename);
    const savedFilenameBasis = loadStoredFilenameBasis();
    const currentStamdata = fileData.data.stamdata || {};
    const stamdataChanged = hasFilenameBasisChanged(savedFilenameBasis, currentStamdata);
    let shouldUseExistingHandle = false;
    let fallbackWarning: string | undefined;

    if (fileHandle && savedFilePath) {
      // Vi har et gemt handle — valider det, men kun hvis filnavns-relevant stamdata er uændret.
      if (!stamdataChanged) {
        const handleVerification = await verifyFileHandleDetailed(fileHandle, {
          allowRequestPermission: true,
        });

        if (handleVerification.valid) {
          shouldUseExistingHandle = true;
        } else if (isUserDismissedPermissionPrompt(handleVerification)) {
          return { kind: 'cancelled' };
        } else {
          fallbackWarning = buildInvalidHandleUserWarning(handleVerification);
          logWarning('Tidligere file handle kunne ikke genbruges - sletter fra IndexedDB', {
            context: 'resolveSaveTarget.invalidStoredHandle',
            data: {
              reason: handleVerification.reason,
              detail: handleVerification.detail,
            },
          });
          await deleteFileHandleFromIndexedDB();
          fileHandle = null;
        }
      } else {
        // Stamdata ændret — åbn picker med nyt foreslået filnavn i stedet for at overskrive.
        fileHandle = null;
      }
    }

    if (shouldUseExistingHandle && fileHandle) {
      // Handle er gyldigt — browseren håndterer overskrivning; intet nyt at persistere.
      return { kind: 'fileHandle', fileHandle, persistHandleAfterSuccess: false };
    }

    const currentFilename = generateFilename(fileData.data);
    const suggestedFilename =
      savedFilePath && !stamdataChanged ? savedFilePath : `${currentFilename}.eo`;
    const startIn = resolvedDirectory ? getStartInValue(resolvedDirectory) : 'desktop';
    const pickedHandle: unknown = await saveFileWithPicker(suggestedFilename, startIn);
    const picked = isFileSystemFileHandle(pickedHandle) ? pickedHandle : null;

    if (!picked) {
      // Bruger annullerede pickeren.
      return { kind: 'cancelled' };
    }

    // Persistér først EFTER lykket write+verify, så et halvt gem ikke efterlader et nyt "autoritativt"
    // overskrivnings-target i IndexedDB.
    return { kind: 'fileHandle', fileHandle: picked, persistHandleAfterSuccess: true, fallbackWarning };
  }

  // Fallback til klassisk download (Firefox m.fl.).
  logWarning('File System Access API ikke tilgængelig - bruger fallback download');

  const lastSavedPath = readOptionalSessionStorageValue(UI_STORAGE_KEYS.lastSavedFilename);
  const currentFilename = generateFilename(fileData.data);
  const savedStamdata = loadStoredFilenameBasis();
  const currentStamdata = fileData.data.stamdata || {};
  const stamdataChanged = hasFilenameBasisChanged(savedStamdata, currentStamdata);
  const filename = lastSavedPath && !stamdataChanged ? lastSavedPath : `${currentFilename}.eo`;

  return { kind: 'download', filename };
};
