import { logInfo, logWarning, logError } from './logger';

// IndexedDB database navn og version
const DB_NAME = 'mineo_file_handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'current_file_handle';
const DEFAULT_DIRECTORY_KEY = 'default_directory_handle';

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
        error: request.error as Error | undefined,
      });
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event: any) => {
      const db = (event.target as any).result as IDBDatabase;

      // Opret object store hvis den ikke findes
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
        logInfo('IndexedDB object store oprettet');
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
export const requestPersistentStorage = async () => {
  try {
    if (!navigator.storage || !navigator.storage.persist) {
      logWarning('Persistent storage API ikke tilgængelig');
      return false;
    }

    const isPersisted = await navigator.storage.persist();

    if (isPersisted) {
      logInfo('✓ Persistent storage granted - file handle vil overleve browser-restart');
    } else {
      logInfo('Persistent storage ikke granted - file handle kan gå tabt');
    }

    return isPersisted;
  } catch (error) {
    logWarning('Kunne ikke anmode om persistent storage:', error);
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
  try {
    logInfo('Gemmer file handle til IndexedDB...');

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(fileHandle, HANDLE_KEY);

      request.onsuccess = () => {
        logInfo('✓ File handle gemt til IndexedDB');
        resolve(true);
      };

      request.onerror = () => {
        logError('Kunne ikke gemme file handle', {
          context: 'saveFileHandleToIndexedDB',
          error: request.error as Error | undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error) {
    logError('Fejl ved gemning af file handle:', error);
    return false;
  }
};

/**
 * Henter file handle fra IndexedDB
 *
 * @returns {Promise<FileSystemFileHandle|null>} File handle eller null
 */
export const loadFileHandleFromIndexedDB = async () => {
  try {
    logInfo('Henter file handle fra IndexedDB...');

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(HANDLE_KEY);

      request.onsuccess = () => {
        const handle = request.result;

        if (handle) {
          logInfo('✓ File handle fundet i IndexedDB');
        } else {
          logInfo('Ingen file handle fundet i IndexedDB');
        }

        resolve(handle || null);
      };

      request.onerror = () => {
        logError('Kunne ikke hente file handle', {
          context: 'loadFileHandleFromIndexedDB',
          error: request.error as Error | undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error) {
    logError('Fejl ved hentning af file handle:', error);
    return null;
  }
};

/**
 * Sletter file handle fra IndexedDB
 *
 * @returns {Promise<boolean>} True hvis slettet succesfuldt
 */
export const deleteFileHandleFromIndexedDB = async () => {
  try {
    logInfo('Sletter file handle fra IndexedDB...');

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(HANDLE_KEY);

      request.onsuccess = () => {
        logInfo('✓ File handle slettet fra IndexedDB');
        resolve(true);
      };

      request.onerror = () => {
        logError('Kunne ikke slette file handle', {
          context: 'deleteFileHandleFromIndexedDB',
          error: request.error as Error | undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error) {
    logError('Fejl ved sletning af file handle:', error);
    return false;
  }
};

/**
 * Validerer at et gemt file handle stadig er gyldigt og har adgang
 * Tjekker både permissions OG at filen stadig eksisterer
 *
 * @param {FileSystemFileHandle} handle - File handle der skal valideres
 * @returns {Promise<boolean>} True hvis handle er gyldigt og filen eksisterer
 */
export const verifyFileHandle = async (handle: FileSystemFileHandle | null | undefined): Promise<boolean> => {
  try {
    if (!handle) {
      return false;
    }
    type PermissionCapableHandle = FileSystemFileHandle & {
      queryPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
      requestPermission: (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;
    };
    const permissionHandle = handle as Partial<PermissionCapableHandle>;
    if (typeof permissionHandle.queryPermission !== 'function' || typeof permissionHandle.requestPermission !== 'function') {
      return false;
    }

    // Tjek først om filen stadig eksisterer
    try {
      await handle.getFile();
      logInfo('✓ Fil eksisterer stadig');
    } catch (error) {
      // Fil eksisterer ikke længere eller vi har ikke adgang
      if (error.name === 'NotFoundError') {
        logWarning('Fil blev ikke fundet - er sandsynligvis blevet slettet eller flyttet');
        return false;
      }
      if (error.name === 'NotAllowedError') {
        logInfo('File handle har ikke adgang endnu - vil anmode om permission');
        // Fortsæt til permission-tjek nedenfor
      } else {
        // Andre uventede fejl
        logWarning('Kunne ikke få adgang til fil', {
          context: 'verifyFileHandle',
          data: { errorName: error.name, errorMessage: error.message },
        });
        // Fortsæt til permission-tjek for at se om vi kan få adgang
      }
    }

    // Tjek om vi stadig har read/write permission
    try {
      const permission = await permissionHandle.queryPermission({ mode: 'readwrite' });

      if (permission === 'granted') {
        logInfo('✓ File handle har readwrite permission');
        return true;
      }

      // Forsøg at anmode om permission
      logInfo('File handle mangler readwrite permission - anmoder om adgang...');
      const newPermission = await permissionHandle.requestPermission({ mode: 'readwrite' });

      if (newPermission === 'granted') {
        logInfo('✓ File handle readwrite permission granted');
        return true;
      }

      logInfo('Bruger nægtede readwrite permission - åbner file picker');
      return false;

    } catch (permError: any) {
      // Permission API kan fejle hvis browseren ikke understøtter det
      logWarning('Permission API fejlede', {
        context: 'verifyFileHandle.permissionCheck',
        data: { errorName: permError?.name, errorMessage: permError?.message },
      });
      return false;
    }

  } catch (error: any) {
    logWarning('File handle validering fejlede', {
      context: 'verifyFileHandle',
      data: { errorName: error?.name, errorMessage: error?.message },
    });
    return false;
  }
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
export const saveDefaultDirectoryHandle = async (directoryHandle: FileSystemDirectoryHandle): Promise<string> => {
  try {
    logInfo('Gemmer directory handle til IndexedDB...');

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
          logInfo(`✓ Directory handle gemt til IndexedDB (id: ${id})`);
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
          error: handleRequest.error as Error | undefined,
        });
        reject(handleRequest.error);
      };

      metaRequest.onerror = () => {
        logError('Kunne ikke gemme directory metadata', {
          context: 'saveDefaultDirectoryHandle',
          error: metaRequest.error as Error | undefined,
        });
        reject(metaRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error) {
    logError('Fejl ved gemning af directory handle:', error);
    throw error;
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
  try {
    logInfo('Henter directory handle fra IndexedDB...');

    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(DEFAULT_DIRECTORY_KEY);

      request.onsuccess = () => {
        const handle = request.result;

        if (handle) {
          logInfo('✓ Directory handle fundet i IndexedDB');
        } else {
          logInfo('Ingen directory handle fundet i IndexedDB');
        }

        resolve(handle || null);
      };

      request.onerror = () => {
        logError('Kunne ikke hente directory handle', {
          context: 'loadDefaultDirectoryHandle',
          error: request.error as Error | undefined,
        });
        reject(request.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error) {
    logError('Fejl ved hentning af directory handle:', error);
    return null;
  }
};

/**
 * Sletter directory handle og metadata fra IndexedDB
 *
 * @returns {Promise<boolean>} True hvis slettet succesfuldt
 */
export const deleteDefaultDirectoryHandle = async (): Promise<boolean> => {
  try {
    logInfo('Sletter directory handle fra IndexedDB...');

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
          logInfo('✓ Directory handle og metadata slettet fra IndexedDB');
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
          error: handleRequest.error as Error | undefined,
        });
        reject(handleRequest.error);
      };

      metaRequest.onerror = () => {
        logError('Kunne ikke slette directory metadata', {
          context: 'deleteDefaultDirectoryHandle',
          error: metaRequest.error as Error | undefined,
        });
        reject(metaRequest.error);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });

  } catch (error) {
    logError('Fejl ved sletning af directory handle:', error);
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
export const verifyDirectoryHandle = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
  try {
    if (!handle || !handle.queryPermission) {
      return false;
    }

    // Tjek om vi har readwrite permission
    try {
      const permission = await handle.queryPermission({ mode: 'readwrite' });

      if (permission === 'granted') {
        logInfo('✓ Directory handle har readwrite permission');
        return true;
      }

      // Forsøg at anmode om permission
      logInfo('Directory handle mangler readwrite permission - anmoder om adgang...');
      const newPermission = await handle.requestPermission({ mode: 'readwrite' });

      if (newPermission === 'granted') {
        logInfo('✓ Directory handle readwrite permission granted');
        return true;
      }

      logInfo('Bruger nægtede readwrite permission');
      return false;

    } catch (permError: any) {
      // Permission kan fejle hvis mappen er slettet
      logWarning('Directory permission tjek fejlede', {
        context: 'verifyDirectoryHandle.permissionCheck',
        data: { errorName: permError?.name, errorMessage: permError?.message },
      });
      return false;
    }

  } catch (error: any) {
    logWarning('Directory handle validering fejlede', {
      context: 'verifyDirectoryHandle',
      data: { errorName: error?.name, errorMessage: error?.message },
    });
    return false;
  }
};
