import { logWarning } from './logger';
import { isRecord } from './typeGuards';
import {
  deleteFileHandleValues,
  directoryHandleMetaSchema,
  deleteClientScopedFileHandleValue,
  readFileHandleValue,
  readFileHandleValueResult,
  readClientScopedFileHandleValueResult,
  writeClientScopedFileHandleValue,
  writeFileHandleValues,
  type DirectoryHandleMeta,
} from './file/fileHandleKvStore';
import type { PwaFileOpenRequest } from '../schemas/pwaFileOpenRequestSchema';
import { pwaFileOpenRequestSchema } from '../schemas/pwaFileOpenRequestSchema';
import type { IndexedDbResult } from './indexedDbStore';
import {
  withFileOperationClientSession,
  readPendingPwaSourceSessionId,
  clearPendingPwaSourceSessionId,
  preservePendingPwaSourceSessionId,
  type FileOperationClientSession,
} from './fileOperationClientSession';

type ClientRecordKind = 'current-file-handle' | 'pending-pwa-open-request';
const getClientScopedFileHandleKey = (id: string, kind: ClientRecordKind): string => `client:${id}:${kind}`;
let storageSessionId: string | null = null;
let knownCurrentHandle: FileSystemFileHandle | null | undefined;
let knownPendingRequest: PwaFileOpenRequest | null | undefined;
let clientStorageQueue: Promise<unknown> = Promise.resolve();

const prepareClientStorage = async (session: FileOperationClientSession): Promise<void> => {
  if (storageSessionId !== null && storageSessionId !== session.id) {
    if (!session.resumedAfterPageHide) {
      knownCurrentHandle = undefined;
      knownPendingRequest = undefined;
    }
    // Efter pagehide bruges altid et nyt scope. Kun dette dokuments kendte værdier
    // må følge med; det tidligere scopes records kan nu tilhøre en anden klient.
    if (knownCurrentHandle) {
      const saved = await writeClientScopedFileHandleValue(
        getClientScopedFileHandleKey(session.id, 'current-file-handle'), knownCurrentHandle,
        'restoreCurrentFileHandleAfterPageHide',
      );
      if (saved.status !== 'ok') throw new Error('Filhåndtaget kunne ikke gemmes til senere direkte Gem.');
    }
    if (knownPendingRequest) {
      const saved = await writeClientScopedFileHandleValue(
        getClientScopedFileHandleKey(session.id, 'pending-pwa-open-request'), knownPendingRequest,
        'restorePendingPwaRequestAfterPageHide',
      );
      if (saved.status !== 'ok') throw new Error('PWA-filrequest kunne ikke gemmes sikkert.');
    }
  }
  storageSessionId = session.id;
};

const runClientStorageOperation = <T>(work: (session: FileOperationClientSession) => Promise<T>): Promise<T> => {
  // Genbinding og operation serialiseres sammen: en samtidig PWA-write må ikke
  // få en ældre memory-værdi skrevet oven på sin nyere request under et scopeskift.
  const operation = clientStorageQueue.then(() => withFileOperationClientSession(async (session) => {
    await prepareClientStorage(session);
    return work(session);
  }));
  clientStorageQueue = operation.catch(() => undefined);
  return operation;
};

/** Sikrer også genpersistens efter bfcache før en versions-reload må overvejes. */
export const prepareFileOperationStorageSession = (): Promise<FileOperationClientSession> =>
  runClientStorageOperation(async (session) => session);

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
  return runClientStorageOperation(async (session) => {
    const result = await writeClientScopedFileHandleValue(
      getClientScopedFileHandleKey(session.id, 'current-file-handle'),
      fileHandle,
      'saveFileHandleToIndexedDB',
    );
    if (result.status === 'ok') knownCurrentHandle = fileHandle;
    return result.status === 'ok';
  }).catch(() => false);
};

/** Henter det gemte file handle, eller `null` hvis der ikke findes et brugbart. */
export const loadFileHandleFromIndexedDB = async (): Promise<FileSystemFileHandle | null> => {
  return runClientStorageOperation(async (session) => {
    const result = await readClientScopedFileHandleValueResult<FileSystemFileHandle>(
      getClientScopedFileHandleKey(session.id, 'current-file-handle'),
      'loadFileHandleFromIndexedDB',
    );
    if (result.status === 'ok') knownCurrentHandle = result.value;
    return result.status === 'ok' ? result.value : null;
  }).catch(() => null);
};

/**
 * Sletter det gemte file handle.
 *
 * `false` betyder "kunne ikke verificere sletningen" – ikke "der var intet at slette".
 * Findes IndexedDB slet ikke, kan der ikke ligge et håndtag, så det er en verificeret tom
 * tilstand og returnerer `true`.
 */
export const deleteFileHandleFromIndexedDB = async (): Promise<boolean> => {
  return runClientStorageOperation(async (session) => {
    const result = await deleteClientScopedFileHandleValue(
      getClientScopedFileHandleKey(session.id, 'current-file-handle'),
      'deleteFileHandleFromIndexedDB',
    );
    const deleted = result.status === 'ok' || result.status === 'unavailable';
    if (deleted) knownCurrentHandle = null;
    return deleted;
  }).catch(() => false);
};

/**
 * Gemmer standardmappen og dens metadata og returnerer et unikt ID.
 *
 * VIGTIGT: ID'et genereres og returneres af denne funktion. UI-laget skal bruge dette ID –
 * IKKE generere sit eget.
 *
 * Handle og metadata skrives i SAMME transaction, så de to nøgler ikke kan komme ud af sync
 * (tidligere blev det koordineret med manuelle `handleDone`/`metaDone`-flag pr. request).
 */
export const saveDefaultDirectoryHandle = async (
  directoryHandle: FileSystemDirectoryHandle
): Promise<string | null> => {
  // Opaque UUID – semantisk neutralt og fremtidssikret.
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
 * DESIGN: passiv observatør – returnerer `null` hvis metadata ikke findes (ingen fallback),
 * og kalder ALDRIG `resolveDefaultDirectoryHandle`.
 */
export const getDirectoryDisplayInfo = async (): Promise<DirectoryHandleMeta | null> => {
  const result = await readFileHandleValueResult('default_directory_meta', 'getDirectoryDisplayInfo', { silent: true });
  if (result.status !== 'ok' || result.value === null) return null;

  // Device-lokal cache kan være delvist ryddet eller stamme fra en tidligere version. En korrupt
  // record må ikke blive til et falsk mappenavn i Indstillinger; den passive visning degraderer til
  // den eksplicitte «utilgængelig»-tilstand uden at forsøge at reparere storage bag brugerens ryg.
  const parsed = directoryHandleMetaSchema.safeParse(result.value);
  return parsed.success ? parsed.data : null;
};

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

export type StoredPendingPwaOpenRequest = PwaFileOpenRequest;

export const savePendingPwaOpenRequestToIndexedDB = async (
  request: StoredPendingPwaOpenRequest
): Promise<boolean> => {
  if (!pwaFileOpenRequestSchema.safeParse(request).success) return false;

  return runClientStorageOperation(async (session) => {
    const result = await writeClientScopedFileHandleValue(
      getClientScopedFileHandleKey(session.id, 'pending-pwa-open-request'),
      request,
      'savePendingPwaOpenRequestToIndexedDB',
    );
    if (result.status === 'ok') knownPendingRequest = request;
    // Uden Web Locks kan scope ikke genbruges efter F5. Bevar derfor kun en
    // pending-alias til den seneste eksplicit modtagne fil, aldrig til current handle.
    return result.status === 'ok' && (session.reloadStable || preservePendingPwaSourceSessionId(session.id));
  }).catch(() => false);
};

export const loadPendingPwaOpenRequestFromIndexedDB = async (): Promise<
  IndexedDbResult<StoredPendingPwaOpenRequest | null>
> => runClientStorageOperation(async (session) => {
  const result = await readClientScopedFileHandleValueResult<StoredPendingPwaOpenRequest>(
    getClientScopedFileHandleKey(session.id, 'pending-pwa-open-request'),
    'loadPendingPwaOpenRequestFromIndexedDB',
  );
  const legacy = readPendingPwaSourceSessionId();
  if (result.status === 'ok' && legacy !== null) {
    if (result.value !== null) {
      if (session.reloadStable) clearPendingPwaSourceSessionId(legacy);
    } else {
      // Kun den eksakte pending-record læses. Legacy current handle og gamle
      // requests skrives/slettes aldrig; en anden gammel klient kan stadig eje dem.
      const previous = await readClientScopedFileHandleValueResult<unknown>(
        getClientScopedFileHandleKey(legacy, 'pending-pwa-open-request'),
        'loadLegacyPendingPwaOpenRequest',
      );
      if (previous.status !== 'ok') return previous;
      if (previous.value !== null) {
        const parsed = pwaFileOpenRequestSchema.safeParse(previous.value);
        if (!parsed.success) return { status: 'error' as const, error: new Error('PWA-filrequest kunne ikke læses.') };
        const migrated = { ...parsed.data, requiresConfirmation: true };
        const copied = await writeClientScopedFileHandleValue(
          getClientScopedFileHandleKey(session.id, 'pending-pwa-open-request'), migrated,
          'copyLegacyPendingPwaOpenRequest',
        );
        if (copied.status !== 'ok') return copied;
        knownPendingRequest = migrated;
        if (session.reloadStable) clearPendingPwaSourceSessionId(legacy);
        return { status: 'ok' as const, value: migrated };
      }
      if (session.reloadStable) clearPendingPwaSourceSessionId(legacy);
    }
  }
  if (result.status === 'ok') knownPendingRequest = result.value;
  return result;
}).catch((error: unknown) => ({ status: 'error', error: error instanceof Error ? error : new Error('PWA-filrequest kunne ikke læses.') }));

export const deletePendingPwaOpenRequestFromIndexedDB = async (): Promise<boolean> => {
  return runClientStorageOperation(async (session) => {
    const result = await deleteClientScopedFileHandleValue(
      getClientScopedFileHandleKey(session.id, 'pending-pwa-open-request'),
      'deletePendingPwaOpenRequestFromIndexedDB',
    );
    if (result.status === 'ok') knownPendingRequest = null;
    return result.status === 'ok';
  }).catch(() => false);
};
