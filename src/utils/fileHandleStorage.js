import { logInfo, logWarning, logError } from './logger';

// IndexedDB database navn og version
const DB_NAME = 'mineo_file_handles';
const DB_VERSION = 1;
const STORE_NAME = 'handles';
const HANDLE_KEY = 'current_file_handle';

/**
 * Åbner IndexedDB database for file handles
 *
 * @returns {Promise<IDBDatabase>} Database connection
 */
const openDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logError('Kunne ikke åbne IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

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
      logWarning('Persistent storage ikke granted - file handle kan gå tabt');
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
export const saveFileHandleToIndexedDB = async (fileHandle) => {
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
        logError('Kunne ikke gemme file handle:', request.error);
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
        logError('Kunne ikke hente file handle:', request.error);
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
        logError('Kunne ikke slette file handle:', request.error);
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
export const verifyFileHandle = async (handle) => {
  try {
    if (!handle || !handle.queryPermission) {
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
      // Andre fejl (fx permission denied) håndteres nedenfor
      logWarning('Kunne ikke få adgang til fil:', error);
    }

    // Tjek om vi stadig har read/write permission
    const permission = await handle.queryPermission({ mode: 'readwrite' });

    if (permission === 'granted') {
      logInfo('✓ File handle har stadig adgang');
      return true;
    }

    // Forsøg at anmode om permission igen
    logInfo('File handle mangler permission - anmoder om adgang...');
    const newPermission = await handle.requestPermission({ mode: 'readwrite' });

    if (newPermission === 'granted') {
      logInfo('✓ File handle adgang genoprettet');
      return true;
    }

    logWarning('File handle adgang nægtet af bruger');
    return false;

  } catch (error) {
    logWarning('File handle validering fejlede:', error);
    return false;
  }
};
