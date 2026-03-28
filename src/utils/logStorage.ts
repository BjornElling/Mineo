/**
 * IndexedDB wrapper til persistent log storage
 *
 * MINEO er en browser-app, så vi kan ikke skrive til fil-systemet.
 * Bruger IndexedDB til at gemme logs lokalt i browseren.
 *
 * Features:
 * - Max 1000 log entries (FIFO - ældste slettes først)
 * - Auto-cleanup: Slet entries ældre end 30 dage
 * - Kun errors/warnings gemmes (ikke debug/info)
 */

const DB_NAME = 'MINEOLogs';
const DB_VERSION = 1;
const STORE_NAME = 'errorLogs';
const MAX_ENTRIES = 1000;
const MAX_AGE_DAYS = 30;

const hasIndexedDbSupport = (): boolean => {
  return typeof indexedDB !== 'undefined' && typeof IDBKeyRange !== 'undefined';
};

export interface LogEntry {
  id?: number; // Auto-increment primary key
  timestamp: string; // ISO string
  level: 'error' | 'warn' | 'info' | 'debug';
  context: string;
  message: string;
  stack?: string;
  data?: Record<string, unknown>;
}

/**
 * Åbn IndexedDB forbindelse
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDbSupport()) {
      reject(new Error('IndexedDB er ikke tilgængelig i dette miljø'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('IndexedDB kunne ikke åbnes'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Opret object store hvis den ikke eksisterer
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });

        // Opret index på timestamp for hurtig sortering/cleanup
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('level', 'level', { unique: false });
      }
    };
  });
}

/**
 * Gem log entry til IndexedDB
 */
export async function saveLogEntry(entry: Omit<LogEntry, 'id'>): Promise<void> {
  if (!hasIndexedDbSupport()) {
    return;
  }
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Gem entry
    store.add(entry);

    // Vent på transaction completion
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });

    // Cleanup (kør async uden at vente)
    cleanupOldEntries().catch((err) => {
      console.error('Log cleanup fejlede:', err);
    });
  } catch (error) {
    console.error('Kunne ikke gemme log entry:', error);
    // Fejl stille - vi vil ikke crashe appen pga. logging-fejl
  }
}

/**
 * Hent alle log entries (seneste først)
 *
 * Bemærk: denne funktion læser hele object store og sorterer i memory.
 * Brug `getRecentLogEntries()` hvis kun de seneste entries er nødvendige.
 */
export async function getAllLogEntries(): Promise<LogEntry[]> {
  if (!hasIndexedDbSupport()) {
    return [];
  }
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as LogEntry[];
        // Sorter seneste først
        entries.sort((a, b) => {
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
        resolve(entries);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Kunne ikke hente log entries:', error);
    return [];
  }
}

/**
 * Hent N seneste log entries
 */
export async function getRecentLogEntries(count: number): Promise<LogEntry[]> {
  if (!hasIndexedDbSupport() || count <= 0) {
    return [];
  }
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const timestampIndex = store.index('timestamp');

    return await new Promise<LogEntry[]>((resolve, reject) => {
      const entries: LogEntry[] = [];
      const request = timestampIndex.openCursor(null, 'prev');

      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve(entries);
          return;
        }
        entries.push(cursor.value as LogEntry);
        if (entries.length >= count) {
          resolve(entries);
          return;
        }
        cursor.continue();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error('Kunne ikke hente seneste log entries:', error);
    return [];
  }
}

/**
 * Slet alle log entries
 */
export async function clearAllLogs(): Promise<void> {
  if (!hasIndexedDbSupport()) {
    return;
  }
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    store.clear();

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Kunne ikke slette logs:', error);
  }
}

/**
 * Cleanup: Slet gamle entries og trim til MAX_ENTRIES
 */
async function cleanupOldEntries(): Promise<void> {
  if (!hasIndexedDbSupport()) {
    return;
  }
  try {
    const db = await openDatabase();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const timestampIndex = store.index('timestamp');

    // 1. Slet entries ældre end MAX_AGE_DAYS
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - MAX_AGE_DAYS);
    const cutoffTimestamp = cutoffDate.toISOString();

    const oldEntriesRequest = timestampIndex.openCursor(
      IDBKeyRange.upperBound(cutoffTimestamp)
    );

    oldEntriesRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    // 2. Trim til MAX_ENTRIES (slet ældste hvis > MAX_ENTRIES)
    const countRequest = store.count();
    countRequest.onsuccess = () => {
      const count = countRequest.result;
      if (count > MAX_ENTRIES) {
        const entriesToDelete = count - MAX_ENTRIES;

        // Hent ældste entries (sorteret på timestamp)
        const cursorRequest = timestampIndex.openCursor();
        let deleted = 0;

        cursorRequest.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor && deleted < entriesToDelete) {
            cursor.delete();
            deleted++;
            cursor.continue();
          }
        };
      }
    };

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('Log cleanup fejlede:', error);
  }
}
