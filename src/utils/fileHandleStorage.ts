import { logWarning } from './logger';
import { isRecord } from './typeGuards';
import {
  deleteFileHandleValues,
  readFileHandleValue,
  writeFileHandleValues,
  type DirectoryHandleMeta,
} from './file/fileHandleKvStore';

/**
 * De navngivne fil-handle-operationer, som resten af appen bruger.
 *
 * Filen var tidligere 735 linjer med 10 funktioner, der hver åbnede IndexedDB, startede en
 * transaction og hånd-wrappede ét `get`/`put`/`delete` i `new Promise` med gentagne
 * `onsuccess`/`onerror`/`oncomplete`/`close`-handlere. Plumbingen bor nu i
 * `indexedDbStore.ts`, nøglerne og deres typer i `file/fileHandleKvStore.ts`, og
 * permission-verifikationen (som slet ikke rørte IndexedDB) i
 * `file/fileHandleVerification.ts`. Tilbage står kun de domænenavngivne operationer og
 * deres fail-safe-værdier.
 *
 * `typeof indexedDB`-guarden var tidligere gentaget 9 steder med INKONSISTENTE
 * returværdier (`false`/`null`/`true`) og manglede helt i `getDirectoryDisplayInfo`.
 * Utilgængelighed håndteres nu ét sted i primitivet; hver funktion nedenfor vælger
 * eksplicit sin egen fail-safe værdi og begrunder den, hvor den ikke er oplagt.
 */

export type { DirectoryHandleMeta };
export {
  verifyDirectoryHandle,
  verifyFileHandle,
  verifyFileHandleDetailed,
  type FileHandleVerificationResult,
} from './file/fileHandleVerification';

/**
 * Anmod om persistent storage permission.
 * Dette forhindrer at browseren sletter vores file handle.
 */
export const requestPersistentStorage = async (): Promise<boolean> => {
  try {
    if (!navigator.storage || !navigator.storage.persist) {
      logWarning('Persistent storage API ikke tilgængelig');
      return false;
    }

    return await navigator.storage.persist();
  } catch (error: unknown) {
    logWarning('Kunne ikke anmode om persistent storage', {
      context: 'requestPersistentStorage',
      data: {
        errorMessage: error instanceof Error
          ? error.message
          : isRecord(error) ? String(error.message ?? '') : String(error),
      },
    });
    return false;
  }
};

/** Gemmer det aktive file handle. `false` = ikke gemt. */
export const saveFileHandleToIndexedDB = async (
  fileHandle: FileSystemFileHandle
): Promise<boolean> => {
  const result = await writeFileHandleValues(
    { current_file_handle: fileHandle },
    'saveFileHandleToIndexedDB'
  );
  return result.status === 'ok';
};

/** Henter det gemte file handle, eller `null` hvis der ikke findes et brugbart. */
export const loadFileHandleFromIndexedDB = async (): Promise<FileSystemFileHandle | null> =>
  readFileHandleValue('current_file_handle', 'loadFileHandleFromIndexedDB');

/**
 * Sletter det gemte file handle.
 *
 * `false` betyder "kunne ikke verificere sletningen" — ikke "der var intet at slette".
 * Findes IndexedDB slet ikke, kan der ikke ligge et håndtag, så det er en verificeret tom
 * tilstand og returnerer `true`.
 */
export const deleteFileHandleFromIndexedDB = async (): Promise<boolean> => {
  const result = await deleteFileHandleValues(
    ['current_file_handle'],
    'deleteFileHandleFromIndexedDB'
  );
  return result.status === 'ok' || result.status === 'unavailable';
};

/**
 * Gemmer standardmappen og dens metadata og returnerer et unikt ID.
 *
 * VIGTIGT: ID'et genereres og returneres af denne funktion. UI-laget skal bruge dette ID —
 * IKKE generere sit eget.
 *
 * Handle og metadata skrives i SAMME transaction, så de to nøgler ikke kan komme ud af sync
 * (tidligere blev det koordineret med manuelle `handleDone`/`metaDone`-flag pr. request).
 */
export const saveDefaultDirectoryHandle = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<string | null> => {
  // Opaque UUID — semantisk neutralt og fremtidssikret.
  const id = crypto.randomUUID();
  const meta: DirectoryHandleMeta = {
    id,
    displayName: directoryHandle.name,
    savedAt: Date.now(),
    source: 'user', // Altid 'user' når bruger eksplicit vælger mappe
  };

  const result = await writeFileHandleValues(
    { default_directory_handle: directoryHandle, default_directory_meta: meta },
    'saveDefaultDirectoryHandle'
  );
  return result.status === 'ok' ? id : null;
};

/**
 * Henter standardmappens display-info UDEN at requestere permissions.
 *
 * VIGTIGT: Designet til UI-brug (fx `Indstillinger.tsx`). Den foretager INGEN
 * permission-requests og er derfor sikker at kalde ved mount og re-render.
 *
 * DESIGN: passiv observatør — returnerer `null` hvis metadata ikke findes (ingen fallback),
 * og kalder ALDRIG `resolveDefaultDirectoryHandle`.
 */
export const getDirectoryDisplayInfo = async (): Promise<DirectoryHandleMeta | null> =>
  readFileHandleValue('default_directory_meta', 'getDirectoryDisplayInfo', { silent: true });

/** Henter standardmappens handle, eller `null`. */
export const loadDefaultDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> =>
  readFileHandleValue('default_directory_handle', 'loadDefaultDirectoryHandle');

/** Sletter både standardmappens handle og dens metadata atomisk. */
export const deleteDefaultDirectoryHandle = async (): Promise<boolean> => {
  const result = await deleteFileHandleValues(
    ['default_directory_handle', 'default_directory_meta'],
    'deleteDefaultDirectoryHandle'
  );
  return result.status === 'ok';
};

export type StoredPendingPwaOpenRequest = Readonly<{
  id: string;
  createdAtEpochMs: number;
  targetUrl?: string;
  fileHandle: FileSystemFileHandle;
  fileName: string;
  ignoredFileCount: number;
}>;

export const savePendingPwaOpenRequestToIndexedDB = async (
  request: StoredPendingPwaOpenRequest
): Promise<boolean> => {
  const result = await writeFileHandleValues(
    { pending_pwa_open_request: request },
    'savePendingPwaOpenRequestToIndexedDB'
  );
  return result.status === 'ok';
};

export const loadPendingPwaOpenRequestFromIndexedDB =
  async (): Promise<StoredPendingPwaOpenRequest | null> => {
    const stored = await readFileHandleValue(
      'pending_pwa_open_request',
      'loadPendingPwaOpenRequestFromIndexedDB'
    );
    return (stored as StoredPendingPwaOpenRequest | null) ?? null;
  };

export const deletePendingPwaOpenRequestFromIndexedDB = async (): Promise<boolean> => {
  const result = await deleteFileHandleValues(
    ['pending_pwa_open_request'],
    'deletePendingPwaOpenRequestFromIndexedDB'
  );
  return result.status === 'ok';
};
