import { logWarning, logError } from './logger';
import { isRecord, asError } from './typeGuards';

// IndexedDB database navn og version
// VIGTIGT: Ved fremtidige skemaændringer skal DB_VERSION øges og logik tilføjes
// til onupgradeneeded-handleren nedenfor. Undlad aldrig at opdatere onupgradeneeded
// ved versionsskift — det er den eneste migrationsvej for IndexedDB.
const DB_NAME = 'mineo_file_handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'current_file_handle';
const DEFAULT_DIRECTORY_KEY = 'default_directory_handle';
const PENDING_PWA_OPEN_REQUEST_KEY = 'pending_pwa_open_request';

/**
 * Åbner IndexedDB database for file handles
 *
 * @returns {Promise<IDBDatabase>} Database connection
 */
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logError('Kunne ikke åbne IndexedDB', {
        context: 'openDatabase',
        error: request.error ?? undefined,
      });
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Opret object store hvis den ikke findes
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/**
 * Anmod om persistent storage permission
 * Dette forhindrer at browseren sletter vores file handle
 *
 * @returns {Promise<boolean>} True hvis persistent storage er granted
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (!navigator.storage || !navigator.storage.persist) {
      logWarning('Persistent storage API ikke tilgængelig');
      return false;
    }

    const isPersisted = await navigator.storage.persist();

    return isPersisted;
  } catch (error: unknown) {
    logWarning('Kunne ikke anmode om persistent storage', {
      context: 'requestPersistentStorage',
      data: { errorMessage: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : String(error) },
    });
    return false;
  }
};

/**
 * Gemmer file handle til IndexedDB
 *
 * @param {FileSystemFileHandle} fileHandle - File handle der skal gemmes
 * @returns {Promise<boolean>} True hvis gemt succesfuldt
 */
export const saveFileHandleToIndexedDB = async (fileHandle: FileSystemFileHandle): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') {
    return false;
  }
  try {

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(fileHandle, HANDLE_KEY);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        logError('Kunne ikke gemme file handle', {
          context: 'saveFileHandleToIndexedDB',
          error: request.error ?? undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error: unknown) {
    logError('Fejl ved gemning af file handle:', asError(error));
    return false;
  }
};

/**
 * Henter file handle fra IndexedDB
 *
 * @returns {Promise<FileSystemFileHandle|null>} File handle eller null
 */
export const loadFileHandleFromIndexedDB = async (): Promise<FileSystemFileHandle | null> => {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  try {

    const db = await openDatabase();

    return new Promise<FileSystemFileHandle | null>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);

      request.onsuccess = () => {
        resolve((request.result as FileSystemFileHandle | undefined) ?? null);
      };

      request.onerror = () => {
        logError('Kunne ikke hente file handle', {
          context: 'loadFileHandleFromIndexedDB',
          error: request.error ?? undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error: unknown) {
    logError('Fejl ved hentning af file handle:', asError(error));
    return null;
  }
};

/**
 * Sletter file handle fra IndexedDB
 *
 * `false` betyder "kunne ikke verificere sletningen" — ikke "der var intet at slette". Findes IndexedDB slet
 * ikke, kan der ikke ligge et håndtag, så det er en verificeret tom tilstand og returnerer `true` (R4-F02:
 * `Slet alt` læser resultatet og ville ellers rapportere en rest, der ikke findes).
 *
 * @returns {Promise<boolean>} True hvis håndtaget bevisligt ikke længere findes
 */
export const deleteFileHandleFromIndexedDB = async (): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') {
    return true;
  }
  try {

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(HANDLE_KEY);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        logError('Kunne ikke slette file handle', {
          context: 'deleteFileHandleFromIndexedDB',
          error: request.error ?? undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error: unknown) {
    logError('Fejl ved sletning af file handle:', asError(error));
    return false;
  }
};

export type FileHandleVerificationResult = Readonly<
  | { valid: true }
  | {
      valid: false;
      reason:
        | 'missing_handle'
        | 'missing_permission_api'
        | 'not_found'
        | 'permission_denied'
        | 'permission_api_failed'
        | 'file_access_failed'
        | 'validation_failed';
      detail?: string;
    }
>;

/**
 * Validerer at et gemt file handle stadig er gyldigt og har adgang
 * Tjekker både permissions OG at filen stadig eksisterer
 *
 * @param {FileSystemFileHandle} handle - File handle der skal valideres
 * @returns {Promise<FileHandleVerificationResult>} Resultat med konkret årsag ved fejl
 */
export const verifyFileHandleDetailed = async (
  handle: FileSystemFileHandle | null | undefined,
  options: Readonly<{ allowRequestPermission?: boolean }> = {}
): Promise<FileHandleVerificationResult> => {
  try {
    if (!handle) {
      return { valid: false, reason: 'missing_handle' };
    }
    type PermissionCapableHandle = FileSystemFileHandle & {
      queryPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
      requestPermission?: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    };
    const permissionHandle = handle as Partial<PermissionCapableHandle>;
    if (typeof permissionHandle.queryPermission !== 'function') {
      return { valid: false, reason: 'missing_permission_api' };
    }

    try {
      let permission = await permissionHandle.queryPermission({ mode: 'readwrite' });

      if (
        permission !== 'granted' &&
        options.allowRequestPermission === true &&
        typeof permissionHandle.requestPermission === 'function'
      ) {
        permission = await permissionHandle.requestPermission({ mode: 'readwrite' });
      }

      if (permission !== 'granted') {
        return {
          valid: false,
          reason: 'permission_denied',
          detail: `permission=${permission}`,
        };
      }

      // Når write-adgang er bekræftet, tjekker vi at filen stadig eksisterer.
      await handle.getFile();

      return { valid: true };

    } catch (permError: unknown) {
      const errName = permError instanceof Error ? permError.name : isRecord(permError) ? String(permError.name ?? '') : undefined;
      const errMessage = permError instanceof Error ? permError.message : isRecord(permError) ? String(permError.message ?? '') : undefined;

      if (errName === 'NotFoundError') {
        logWarning('Fil blev ikke fundet - er sandsynligvis blevet slettet eller flyttet');
        return { valid: false, reason: 'not_found', detail: errMessage };
      }
      if (errName === 'NotAllowedError') {
        return { valid: false, reason: 'permission_denied', detail: errMessage };
      }

      logWarning('Permission API eller file handle-validering fejlede', {
        context: 'verifyFileHandle.permissionCheck',
        data: {
          errorName: errName,
          errorMessage: errMessage,
        },
      });
      return {
        valid: false,
        reason: 'permission_api_failed',
        detail: errMessage ?? errName,
      };
    }

  } catch (error: unknown) {
    logWarning('File handle validering fejlede', {
      context: 'verifyFileHandle',
      data: {
        errorName: error instanceof Error ? error.name : isRecord(error) ? String(error.name ?? '') : undefined,
        errorMessage: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : undefined,
      },
    });
    return {
      valid: false,
      reason: 'validation_failed',
      detail: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : String(error),
    };
  }
};

export const verifyFileHandle = async (handle: FileSystemFileHandle | null | undefined): Promise<boolean> => {
  const result = await verifyFileHandleDetailed(handle);
  return result.valid;
};

// ============================================================================
// Directory Handle funktioner (til brugervalgt standardplacering)
// ============================================================================

// Nøgle til directory metadata (display-info cache)
const DEFAULT_DIRECTORY_META_KEY = 'default_directory_meta';

/**
 * Metadata struktur for directory handle
 */
export interface DirectoryHandleMeta {
  /** Unikt ID for denne directory-registrering */
  id: string;
  /** Mappenavn (fra handle.name) */
  displayName: string;
  /** Tidspunkt for registrering */
  savedAt: number;
  /** Kilde: 'user' = brugervalgt, 'fallback-desktop' = standard/fallback */
  source: 'user' | 'fallback-desktop';
}

/**
 * Gemmer directory handle til IndexedDB og returnerer et unikt ID.
 *
 * VIGTIGT: ID'et genereres og returneres af denne funktion.
 * UI-laget skal bruge dette ID - IKKE generere sit eget.
 *
 * @param {FileSystemDirectoryHandle} directoryHandle - Directory handle der skal gemmes
 * @returns {Promise<string>} Unikt ID for dette directory handle
 * @throws {Error} Hvis gemning fejler
 */
export const saveDefaultDirectoryHandle = async (directoryHandle: FileSystemDirectoryHandle): Promise<string | null> => {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  try {

    const db = await openDatabase();

    // Generer opaque UUID - semantisk neutralt og fremtidssikret
    const id = crypto.randomUUID();
    const meta: DirectoryHandleMeta = {
      id,
      displayName: directoryHandle.name,
      savedAt: Date.now(),
      source: 'user', // Altid 'user' når bruger eksplicit vælger mappe
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Gem både handle og metadata
      const handleRequest = store.put(directoryHandle, DEFAULT_DIRECTORY_KEY);
      const metaRequest = store.put(meta, DEFAULT_DIRECTORY_META_KEY);

      let handleDone = false;
      let metaDone = false;

      const checkComplete = () => {
        if (handleDone && metaDone) {
          resolve(id);
        }
      };

      handleRequest.onsuccess = () => {
        handleDone = true;
        checkComplete();
      };

      metaRequest.onsuccess = () => {
        metaDone = true;
        checkComplete();
      };

      handleRequest.onerror = () => {
        logError('Kunne ikke gemme directory handle', {
          context: 'saveDefaultDirectoryHandle',
          error: handleRequest.error ?? undefined,
        });
        reject(handleRequest.error);
      };

      metaRequest.onerror = () => {
        logError('Kunne ikke gemme directory metadata', {
          context: 'saveDefaultDirectoryHandle',
          error: metaRequest.error ?? undefined,
        });
        reject(metaRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error: unknown) {
    logError('Fejl ved gemning af directory handle:', asError(error));
    return null;
  }
};

/**
 * Henter directory display-info fra IndexedDB UDEN at requestere permissions.
 *
 * VIGTIGT: Denne funktion er designet til UI-brug (fx Indstillinger.tsx).
 * Den foretager INGEN permission-requests og er derfor sikker at kalde
 * ved mount og re-render.
 *
 * DESIGN: Funktionen er en passiv observatør:
 * - Returnerer null hvis metadata ikke findes (ingen fallback)
 * - Logger IKKE warnings (UI skal ikke "reparere")
 * - Kalder ALDRIG resolveDefaultDirectoryHandle
 *
 * @returns {Promise<DirectoryHandleMeta | null>} Metadata eller null hvis ingen gemt
 */
export const getDirectoryDisplayInfo = async (): Promise<DirectoryHandleMeta | null> => {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DEFAULT_DIRECTORY_META_KEY);

      request.onsuccess = () => {
        const meta = request.result as DirectoryHandleMeta | undefined;
        resolve(meta || null);
      };

      request.onerror = () => {
        // Passiv observatør - ingen logging, bare returner null
        resolve(null);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch {
    // Passiv observatør - ingen logging, bare returner null
    return null;
  }
};

/**
 * Henter directory handle fra IndexedDB
 *
 * @returns {Promise<FileSystemDirectoryHandle|null>} Directory handle eller null
 */
export const loadDefaultDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  try {

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DEFAULT_DIRECTORY_KEY);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        logError('Kunne ikke hente directory handle', {
          context: 'loadDefaultDirectoryHandle',
          error: request.error ?? undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error: unknown) {
    logError('Fejl ved hentning af directory handle:', asError(error));
    return null;
  }
};

/**
 * Sletter directory handle og metadata fra IndexedDB
 *
 * @returns {Promise<boolean>} True hvis slettet succesfuldt
 */
export const deleteDefaultDirectoryHandle = async (): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') {
    return false;
  }
  try {

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Slet både handle og metadata
      const handleRequest = store.delete(DEFAULT_DIRECTORY_KEY);
      const metaRequest = store.delete(DEFAULT_DIRECTORY_META_KEY);

      let handleDone = false;
      let metaDone = false;

      const checkComplete = () => {
        if (handleDone && metaDone) {
          resolve(true);
        }
      };

      handleRequest.onsuccess = () => {
        handleDone = true;
        checkComplete();
      };

      metaRequest.onsuccess = () => {
        metaDone = true;
        checkComplete();
      };

      handleRequest.onerror = () => {
        logError('Kunne ikke slette directory handle', {
          context: 'deleteDefaultDirectoryHandle',
          error: handleRequest.error ?? undefined,
        });
        reject(handleRequest.error);
      };

      metaRequest.onerror = () => {
        logError('Kunne ikke slette directory metadata', {
          context: 'deleteDefaultDirectoryHandle',
          error: metaRequest.error ?? undefined,
        });
        reject(metaRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error: unknown) {
    logError('Fejl ved sletning af directory handle:', asError(error));
    return false;
  }
};

/**
 * Verificerer at et directory handle stadig er gyldigt og har adgang
 * Tjekker permissions og at mappen stadig eksisterer
 *
 * @param {FileSystemDirectoryHandle} handle - Directory handle der skal valideres
 * @returns {Promise<boolean>} True hvis handle er gyldigt og mappen eksisterer
 */
export const verifyDirectoryHandle = async (
  handle: FileSystemDirectoryHandle,
  options: Readonly<{ mode?: 'read' | 'readwrite'; allowRequestPermission?: boolean }> = {}
): Promise<boolean> => {
  try {
    if (!handle || !handle.queryPermission) {
      return false;
    }

    const mode = options.mode ?? 'read';
    const requestPermission = typeof handle.requestPermission === 'function'
      ? handle.requestPermission.bind(handle)
      : null;

    // Tjek om vi har den nødvendige adgang for at bruge handle som picker-startmappe.
    // Hvis kaldet sker fra en direkte brugergestus-handler, må vi bede browseren om tilladelse
    // i stedet for at falde tilbage til skrivebordet ved permission='prompt'.
    try {
      let permission = await handle.queryPermission({ mode });

      if (
        permission !== 'granted' &&
        options.allowRequestPermission === true &&
        requestPermission
      ) {
        permission = await requestPermission({ mode });
      }

      return permission === 'granted';

    } catch (permError: unknown) {
      // Permission kan fejle hvis mappen er slettet
      const permErr = permError instanceof Error ? permError : isRecord(permError) ? permError : null;
      logWarning('Directory permission tjek fejlede', {
        context: 'verifyDirectoryHandle.permissionCheck',
        data: {
          errorName: permErr instanceof Error ? permErr.name : isRecord(permErr) ? String(permErr.name ?? '') : undefined,
          errorMessage: permErr instanceof Error ? permErr.message : isRecord(permErr) ? String(permErr.message ?? '') : undefined,
        },
      });
      return false;
    }

  } catch (error: unknown) {
    logWarning('Directory handle validering fejlede', {
      context: 'verifyDirectoryHandle',
      data: {
        errorName: error instanceof Error ? error.name : isRecord(error) ? String(error.name ?? '') : undefined,
        errorMessage: error instanceof Error ? error.message : isRecord(error) ? String(error.message ?? '') : undefined,
      },
    });
    return false;
  }
};

type StoredPendingPwaOpenRequest = Readonly<{
  id: string;
  createdAtEpochMs: number;
  targetUrl?: string;
  fileHandle: FileSystemFileHandle;
  fileName: string;
  ignoredFileCount: number;
}>;

export const savePendingPwaOpenRequestToIndexedDB = async (request: StoredPendingPwaOpenRequest): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') {
    return false;
  }
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const idbRequest = store.put(request, PENDING_PWA_OPEN_REQUEST_KEY);

      idbRequest.onsuccess = () => {
        resolve(true);
      };

      idbRequest.onerror = () => {
        logError('Kunne ikke gemme pending PWA-open request', {
          context: 'savePendingPwaOpenRequestToIndexedDB',
          error: idbRequest.error ?? undefined,
        });
        reject(idbRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error: unknown) {
    logError('Fejl ved gemning af pending PWA-open request:', asError(error));
    return false;
  }
};

export const loadPendingPwaOpenRequestFromIndexedDB = async (): Promise<StoredPendingPwaOpenRequest | null> => {
  if (typeof indexedDB === 'undefined') {
    return null;
  }
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const idbRequest = store.get(PENDING_PWA_OPEN_REQUEST_KEY);

      idbRequest.onsuccess = () => {
        resolve((idbRequest.result as StoredPendingPwaOpenRequest | undefined) ?? null);
      };

      idbRequest.onerror = () => {
        logError('Kunne ikke hente pending PWA-open request', {
          context: 'loadPendingPwaOpenRequestFromIndexedDB',
          error: idbRequest.error ?? undefined,
        });
        reject(idbRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error: unknown) {
    logError('Fejl ved hentning af pending PWA-open request:', asError(error));
    return null;
  }
};

export const deletePendingPwaOpenRequestFromIndexedDB = async (): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') {
    return false;
  }
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const idbRequest = store.delete(PENDING_PWA_OPEN_REQUEST_KEY);

      idbRequest.onsuccess = () => {
        resolve(true);
      };

      idbRequest.onerror = () => {
        logError('Kunne ikke slette pending PWA-open request', {
          context: 'deletePendingPwaOpenRequestFromIndexedDB',
          error: idbRequest.error ?? undefined,
        });
        reject(idbRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error: unknown) {
    logError('Fejl ved sletning af pending PWA-open request:', asError(error));
    return false;
  }
};
