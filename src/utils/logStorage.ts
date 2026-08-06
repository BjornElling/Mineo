/**
 * Persistent log storage.
 *
 * Mineo er en browser-app, så vi kan ikke skrive til fil-systemet. IndexedDB bruges til at
 * gemme logs lokalt i browseren.
 *
 * Features:
 * - Max 1000 log entries (FIFO - ældste slettes først)
 * - Auto-cleanup: Slet entries ældre end 30 dage
 * - Kun errors/warnings gemmes (ikke debug/info)
 *
 * Forbindelse, transaction-livscyklus og promisificering ejes af den fælles
 * `indexedDbStore`-primitiv. Filen havde tidligere sin EGEN `openDatabase`-kopi side om side
 * med den i `fileHandleStorage.ts` — to parallelle IndexedDB-wrappers for samme plumbing.
 * Den kopi lukkede desuden aldrig sine forbindelser.
 *
 * Databasen er bevidst adskilt fra fil-handle-storet: dette er et append-only log-store med
 * `autoIncrement`-keyPath og to indexes, der læses med cursors — en anden datamodel end et
 * keyed kv-store.
 */

import {
  awaitRequest,
  isIndexedDbAvailable,
  runTransactionOr,
  type IndexedDbSchema,
} from './indexedDbStore';

const STORE_NAME = 'errorLogs';
const MAX_ENTRIES = 1000;
const MAX_AGE_DAYS = 30;

const SCHEMA: IndexedDbSchema = {
  databaseName: 'MineoLogs',
  version: 1,
  upgrade: (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      const objectStore = db.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      });
      // Index på timestamp for hurtig sortering/cleanup.
      objectStore.createIndex('timestamp', 'timestamp', { unique: false });
      objectStore.createIndex('level', 'level', { unique: false });
    }
  },
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
 * Gem log entry.
 *
 * Fejler stille: en logging-fejl må aldrig kunne vælte appen. `runTransactionOr` logger
 * selv den underliggende årsag.
 */
export async function saveLogEntry(entry: Omit<LogEntry, 'id'>): Promise<void> {
  await runTransactionOr(
    undefined,
    SCHEMA,
    [STORE_NAME],
    'readwrite',
    async (transaction) => {
      await awaitRequest(transaction.objectStore(STORE_NAME).add(entry));
    },
    'saveLogEntry'
  );

  // Cleanup kører uden at blokere skrivningen.
  void cleanupOldEntries();
}

/**
 * Hent alle log entries (seneste først).
 *
 * Bemærk: læser hele object store og sorterer i memory. Brug `getRecentLogEntries()` hvis
 * kun de seneste entries er nødvendige.
 */
export async function getAllLogEntries(): Promise<LogEntry[]> {
  return runTransactionOr(
    [],
    SCHEMA,
    [STORE_NAME],
    'readonly',
    async (transaction) => {
      const entries = await awaitRequest<LogEntry[]>(
        transaction.objectStore(STORE_NAME).getAll()
      );
      return [...entries].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
    },
    'getAllLogEntries'
  );
}

/** Hent N seneste log entries. */
export async function getRecentLogEntries(count: number): Promise<LogEntry[]> {
  if (count <= 0) {
    return [];
  }
  return runTransactionOr(
    [],
    SCHEMA,
    [STORE_NAME],
    'readonly',
    async (transaction) => {
      const timestampIndex = transaction.objectStore(STORE_NAME).index('timestamp');
      return await new Promise<LogEntry[]>((resolve, reject) => {
        const entries: LogEntry[] = [];
        const request = timestampIndex.openCursor(null, 'prev');
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor || entries.length >= count) {
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
        request.onerror = () => reject(request.error ?? new Error('Cursor fejlede'));
      });
    },
    'getRecentLogEntries'
  );
}

/** Slet alle log entries. */
export async function clearAllLogs(): Promise<void> {
  await runTransactionOr(
    undefined,
    SCHEMA,
    [STORE_NAME],
    'readwrite',
    async (transaction) => {
      await awaitRequest(transaction.objectStore(STORE_NAME).clear());
    },
    'clearAllLogs'
  );
}

/**
 * Cleanup: slet entries ældre end MAX_AGE_DAYS og trim til MAX_ENTRIES.
 *
 * Begge trin kører i SAMME transaction, så log-storet ikke kan observeres halvt trimmet.
 */
async function cleanupOldEntries(): Promise<void> {
  if (!isIndexedDbAvailable()) {
    return;
  }
  await runTransactionOr(
    undefined,
    SCHEMA,
    [STORE_NAME],
    'readwrite',
    async (transaction) => {
      const store = transaction.objectStore(STORE_NAME);
      const timestampIndex = store.index('timestamp');

      // 1. Slet entries ældre end MAX_AGE_DAYS.
      const cutoffDate = new Date();
      cutoffDate.setUTCDate(cutoffDate.getUTCDate() - MAX_AGE_DAYS);
      const cutoffTimestamp = cutoffDate.toISOString();
      await deleteViaCursor(timestampIndex.openCursor(IDBKeyRange.upperBound(cutoffTimestamp)));

      // 2. Trim til MAX_ENTRIES (ældste først).
      const count = await awaitRequest<number>(store.count());
      const entriesToDelete = count - MAX_ENTRIES;
      if (entriesToDelete > 0) {
        await deleteViaCursor(timestampIndex.openCursor(), entriesToDelete);
      }
    },
    'cleanupOldEntries'
  );
}

/**
 * Sletter rækker gennem en cursor, valgfrit begrænset til `limit` rækker.
 *
 * Cursor-løkken afventes eksplicit, så transactionen ikke auto-committer midt i sletningen —
 * den tidligere form satte kun `onsuccess`-handlere og stolede på, at de var færdige før
 * `oncomplete`.
 */
const deleteViaCursor = (
  request: IDBRequest<IDBCursorWithValue | null>,
  limit?: number
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    let deleted = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || (limit !== undefined && deleted >= limit)) {
        resolve();
        return;
      }
      cursor.delete();
      deleted += 1;
      cursor.continue();
    };
    request.onerror = () => reject(request.error ?? new Error('Cursor-sletning fejlede'));
  });
