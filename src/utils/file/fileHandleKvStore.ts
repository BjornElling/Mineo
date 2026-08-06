import {
  awaitRequest,
  runTransaction,
  runTransactionOr,
  runTransactionSilently,
  type IndexedDbResult,
  type IndexedDbSchema,
} from '../indexedDbStore';

/**
 * Det device-lokale kv-store bag fil-handles, standardmappe og afventende PWA-åbning.
 *
 * Nøglerne var tidligere fire løse strengkonstanter spredt over ~300 linjer i
 * `fileHandleStorage.ts` (`DEFAULT_DIRECTORY_META_KEY` blev deklareret 300 linjer efter de
 * tre andre), uden nogen typebinding mellem nøgle og værditype. Her er de ét sted, og
 * `FileHandleStoreValue` binder hver nøgle til sin type, så `read('default_directory_meta')`
 * ikke kan forveksles med et handle.
 *
 * Alt i storet er **device-lokal cache** og aldrig sagsdata: det må derfor gerne mangle,
 * og hver læsning degraderer til `null`/`false` frem for at fejle en brugerhandling.
 */

const SCHEMA: IndexedDbSchema = {
  databaseName: 'mineo_file_handles',
  version: 1,
  // VIGTIGT: Ved fremtidige skemaændringer skal `version` øges og migrationen tilføjes her.
  // `onupgradeneeded` er den eneste migrationsvej for IndexedDB.
  upgrade: (db) => {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME);
    }
  },
};

const STORE_NAME = 'handles';

/** Metadata for den registrerede standardmappe (display-info cache). */
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
 * De fire concerns i storet, som typede nøgler. Delte tidligere ét store med ad hoc-nøgler
 * og uden nogen kobling mellem nøgle og værditype.
 */
export type FileHandleStoreValue = {
  current_file_handle: FileSystemFileHandle;
  default_directory_handle: FileSystemDirectoryHandle;
  default_directory_meta: DirectoryHandleMeta;
  pending_pwa_open_request: unknown;
};

export type FileHandleStoreKey = keyof FileHandleStoreValue;

/**
 * Læser én nøgle. Returnerer `null` både når nøglen mangler, og når storet er utilgængeligt.
 *
 * `silent: true` undertrykker fejllogningen. Det bruges af `getDirectoryDisplayInfo`, som er
 * en dokumenteret **passiv observatør**: den kaldes ved mount/re-render fra Indstillinger og
 * må hverken requestere permissions eller logge, fordi UI'et ikke skal "reparere" noget.
 */
export const readFileHandleValue = async <K extends FileHandleStoreKey>(
  key: K,
  context: string,
  options?: Readonly<{ silent?: boolean }>
): Promise<FileHandleStoreValue[K] | null> => {
  const read = async (transaction: IDBTransaction) => {
    const result = await awaitRequest<unknown>(
      transaction.objectStore(STORE_NAME).get(key)
    );
    return (result as FileHandleStoreValue[K] | undefined) ?? null;
  };

  if (options?.silent === true) {
    const result = await runTransactionSilently(SCHEMA, [STORE_NAME], 'readonly', read);
    return result.status === 'ok' ? result.value : null;
  }

  return runTransactionOr(null, SCHEMA, [STORE_NAME], 'readonly', read, context);
};

/** Skriver én eller flere nøgler ATOMISK i samme transaction. */
export const writeFileHandleValues = async (
  entries: Partial<{ [K in FileHandleStoreKey]: FileHandleStoreValue[K] }>,
  context: string
): Promise<IndexedDbResult<void>> =>
  runTransaction(
    SCHEMA,
    [STORE_NAME],
    'readwrite',
    async (transaction) => {
      const store = transaction.objectStore(STORE_NAME);
      // Alle put's i samme transaction; `runTransaction` venter på commit, så en delvis
      // skrivning ikke kan observeres (tidligere blev det koordineret med manuelle
      // `handleDone`/`metaDone`-flag pr. request).
      await Promise.all(
        Object.entries(entries).map(([key, value]) =>
          awaitRequest(store.put(value, key))
        )
      );
    },
    context
  );

/** Sletter én eller flere nøgler ATOMISK i samme transaction. */
export const deleteFileHandleValues = async (
  keys: readonly FileHandleStoreKey[],
  context: string
): Promise<IndexedDbResult<void>> =>
  runTransaction(
    SCHEMA,
    [STORE_NAME],
    'readwrite',
    async (transaction) => {
      const store = transaction.objectStore(STORE_NAME);
      await Promise.all(keys.map((key) => awaitRequest(store.delete(key))));
    },
    context
  );
