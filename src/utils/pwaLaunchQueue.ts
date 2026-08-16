import {
  deletePendingPwaOpenRequestFromIndexedDB,
  loadPendingPwaOpenRequestFromIndexedDB,
  savePendingPwaOpenRequestToIndexedDB,
} from './fileHandleStorage';
import { isFileSystemFileHandle } from './fileSystemAccess';
import { logWarning, sanitizeFilenameForLog } from './logger';
import { pwaFileOpenRequestSchema, type PwaFileOpenRequest } from '../schemas/pwaFileOpenRequestSchema';

export type { PwaFileOpenRequest } from '../schemas/pwaFileOpenRequestSchema';

export const Mineo_PWA_FILE_OPEN_EVENT = 'mineo:pwa-file-open';

let isInitialized = false;
let requestCounter = 0;
let pendingRequest: PwaFileOpenRequest | null = null;
let hydratePendingRequestPromise: Promise<void> | null = null;
let persistPendingRequestQueue: Promise<boolean> = Promise.resolve(true);
let pendingRequestGeneration = 0;
let pendingRequestHydrationFailed = false;

const PWA_STORAGE_HANDOFF_TIMEOUT_MS = 5_000;

type LaunchQueueLike = {
  setConsumer(consumer: (launchParams: { files?: ReadonlyArray<FileSystemHandle>; targetURL?: string }) => void | Promise<void>): void;
};

const isLaunchQueueLike = (value: unknown): value is LaunchQueueLike => {
  return !!value
    && typeof value === 'object'
    && 'setConsumer' in value
    && typeof (value as { setConsumer?: unknown }).setConsumer === 'function';
};

const getLaunchQueue = (): LaunchQueueLike | null => {
  const queue = (window as unknown as { launchQueue?: unknown }).launchQueue;
  return isLaunchQueueLike(queue) ? queue : null;
};

type StoredRequestRead =
  | Readonly<{ status: 'ok'; value: unknown | null }>
  | Readonly<{ status: 'failed' }>;

const normalizeStoredRequestRead = (value: unknown): StoredRequestRead => {
  // Testdobler og ældre lokale wrappers returnerede den rå værdi. Den form accepteres her for at
  // holde persistencegrænsen tolerant, mens produktionen nu returnerer det statusbærende resultat.
  if (!value || typeof value !== 'object' || !('status' in value)) {
    return { status: 'ok', value: value ?? null };
  }

  const status = (value as { status?: unknown }).status;
  if (status !== 'ok') return { status: 'failed' };
  return { status: 'ok', value: (value as { value?: unknown }).value ?? null };
};

const readStoredRequest = async (context = 'readStoredRequest'): Promise<StoredRequestRead> => {
  try {
    return normalizeStoredRequestRead(await loadPendingPwaOpenRequestFromIndexedDB());
  } catch (error: unknown) {
    logWarning('Pending PWA-open request kunne ikke hentes fra IndexedDB', {
      context,
      data: { errorMessage: error instanceof Error ? error.message : String(error) },
    });
    return { status: 'failed' };
  }
};

const settleBeforeDeadline = <T>(promise: Promise<T>, deadline: number, fallback: T): Promise<T> => {
  return new Promise<T>((resolve) => {
    const timeoutId = globalThis.setTimeout(() => resolve(fallback), Math.max(1, deadline - Date.now()));
    void promise.then(
      (value) => {
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      () => {
        globalThis.clearTimeout(timeoutId);
        resolve(fallback);
      },
    );
  });
};

const dispatchPendingRequestEvent = (request: PwaFileOpenRequest): void => {
  window.dispatchEvent(new CustomEvent(Mineo_PWA_FILE_OPEN_EVENT, { detail: { requestId: request.id } }));
};

const persistPendingPwaFileOpenRequestState = async (): Promise<boolean> => {
  const run = async (): Promise<boolean> => {
    const request = pendingRequest;
    try {
      if (!request) {
        const deleted = await deletePendingPwaOpenRequestFromIndexedDB();
        if (!deleted) {
          logWarning('Pending PWA-open request kunne ikke slettes sikkert fra IndexedDB', {
            context: 'persistPendingPwaFileOpenRequestState.delete',
          });
        }
        return deleted;
      }

      const saved = await savePendingPwaOpenRequestToIndexedDB(request);
      if (!saved) {
          logWarning('Pending PWA-open request kunne ikke persisteres; fortsætter med in-memory request', {
            context: 'persistPendingPwaFileOpenRequestState.save',
            data: { requestId: request.id, fileName: sanitizeFilenameForLog(request.fileName) },
        });
      }
      return saved;
    } catch (error: unknown) {
      logWarning('Pending PWA-open request kunne ikke persisteres; fortsætter med in-memory request', {
        context: 'persistPendingPwaFileOpenRequestState.save',
        data: {
          requestId: request?.id,
          fileName: sanitizeFilenameForLog(request?.fileName),
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
      return false;
    }
  };

  // Serialisering er nødvendig: ellers kan en langsom save af en allerede håndteret request
  // overskrive den efterfølgende delete og genopstå som falsk pending request ved næste boot.
  persistPendingRequestQueue = persistPendingRequestQueue.then(run, run);
  await persistPendingRequestQueue;
  return persistPendingRequestQueue;
};

export const hydratePendingPwaFileOpenRequest = async (): Promise<void> => {
  if (pendingRequest !== null) return;
  if (hydratePendingRequestPromise) {
    await hydratePendingRequestPromise;
    return;
  }

  hydratePendingRequestPromise = (async () => {
    const hydrationDeadline = Date.now() + PWA_STORAGE_HANDOFF_TIMEOUT_MS;
    const storedRead = await settleBeforeDeadline(
      readStoredRequest('hydratePendingPwaFileOpenRequest.load'),
      hydrationDeadline,
      { status: 'failed' } as const,
    );
    if (storedRead.status !== 'ok') {
      pendingRequestHydrationFailed = true;
      return;
    }
    pendingRequestHydrationFailed = false;
    const stored = storedRead.value;

    // launchQueue kan aflevere en ny fil, mens IndexedDB læses. Den nyligt modtagne fil er
    // brugerens seneste handling og må aldrig erstattes af en ældre request fra før opdateringen.
    if (pendingRequest !== null) return;

    const parsed = pwaFileOpenRequestSchema.safeParse(stored);
    if (parsed.success) {
      pendingRequest = parsed.data;
      pendingRequestGeneration += 1;
      const numericSuffix = Number.parseInt(parsed.data.id.replace(/^pwa-open-/, ''), 10);
      if (Number.isFinite(numericSuffix) && numericSuffix > requestCounter) {
        requestCounter = numericSuffix;
      }
    } else if (stored !== null) {
      logWarning('Ugyldig pending PWA-open request blev fjernet fra IndexedDB', {
        context: 'hydratePendingPwaFileOpenRequest.invalidStoredRequest',
      });
      // Oprydningen skal gennem samme serialiserede kø som saves/deletes. En ny launchQueue-fil kan
      // ankomme mens den ugyldige record fjernes; en direkte delete ville da kunne slette den nye request.
      if (!(await persistPendingPwaFileOpenRequestState())) {
        pendingRequestHydrationFailed = true;
      }
    }
  })();

  try {
    await hydratePendingRequestPromise;
  } finally {
    hydratePendingRequestPromise = null;
  }
};

export const setupPwaLaunchQueueConsumer = (): void => {
  if (isInitialized) return;

  const launchQueue = getLaunchQueue();
  if (!launchQueue) {
    return;
  }

  isInitialized = true;

  launchQueue.setConsumer(async (launchParams) => {
    const handles = (launchParams.files ?? []).filter(
      (handle): handle is FileSystemFileHandle => handle.kind === 'file' && isFileSystemFileHandle(handle)
    );
    if (handles.length === 0) {
      return;
    }

    const primaryHandle = handles[0];
    const parsedRequest = pwaFileOpenRequestSchema.safeParse({
      id: `pwa-open-${++requestCounter}`,
      createdAtEpochMs: Date.now(),
      fileHandle: primaryHandle,
      fileName: primaryHandle.name,
      ignoredFileCount: Math.max(0, handles.length - 1),
    });
    if (!parsedRequest.success) {
      logWarning('PWA-filåbning blev afvist, fordi browserens request var ugyldig', {
        context: 'setupPwaLaunchQueueConsumer.invalidRequest',
      });
      return;
    }
    const request = parsedRequest.data;

    // Deterministisk strategi: seneste request vinder (overskriver evt. tidligere pending request).
    pendingRequest = request;
    pendingRequestGeneration += 1;
    // Eventet udsendes FØR den langsomme IDB-skrivning, så en request, der ankommer under Gem/Hent/
    // Slet alt, registreres som travl ved ankomst og ikke pludselig behandles som en ny ledig handling,
    // når persisteringen er færdig. Callbacken afventer stadig den serialiserede skrivning, så launchQueue
    // får en afsluttet durable-handoff i samme async-forløb.
    dispatchPendingRequestEvent(request);
    if (await persistPendingPwaFileOpenRequestState()) {
      pendingRequestHydrationFailed = false;
    }
  });
};

/**
 * Afventer, at enhver igangværende launchQueue-persistering er nået sikkert i IndexedDB.
 *
 * Opstartens opdateringsbarriere kan genindlæse dokumentet. En `.eo`-request, browseren afleverede
 * få millisekunder forinden, lever på det tidspunkt kun i hukommelsen, mens skrivningen er undervejs
 * — og en genindlæsning ville tabe den. Boot skal derfor kunne vente på den durable handoff, FØR den
 * river dokumentet ned.
 *
 * Returnerer `false`, hvis der findes en pending request, som ikke kunne bekræftes persisteret. Da
 * må opstarten ikke genindlæse: brugerens fil vejer tungere end at komme på nyeste version straks.
 */
export const awaitDurablePendingPwaFileOpenHandoff = async (): Promise<boolean> => {
  await hydratePendingPwaFileOpenRequest();
  if (pendingRequestHydrationFailed) return false;

  // En ny launchQueue-callback kan starte mellem to await-punkter. Versionsreloaden må først
  // frigives, når både persistence-køen og den læste record beskriver samme stabile generation.
  // En deadline er nødvendig, så en defekt IndexedDB ikke kan holde hele opstarten fast for evigt.
  const deadline = Date.now() + PWA_STORAGE_HANDOFF_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const generationBeforePersistence = pendingRequestGeneration;
    const persisted = await settleBeforeDeadline(persistPendingRequestQueue, deadline, false);
    if (!persisted || pendingRequestHydrationFailed) return false;

    // IndexedDB kan i praksis også hænge uden at afvise promise'en. Læsen skal derfor have samme
    // loft som skrivningen; ellers kan en opdatering blokere opstarten permanent.
    const storedRead = await settleBeforeDeadline(readStoredRequest(), deadline, { status: 'failed' } as const);
    if (storedRead.status !== 'ok') return false;
    if (generationBeforePersistence !== pendingRequestGeneration) continue;

    const stored = pwaFileOpenRequestSchema.safeParse(storedRead.value);
    if (pendingRequest === null) return storedRead.value === null;
    return stored.success && stored.data.id === pendingRequest.id;
  }

  return false;
};

export const getPendingPwaFileOpenRequest = (): PwaFileOpenRequest | null => {
  return pendingRequest;
};

export const retryPendingPwaFileOpenRequest = async (): Promise<boolean> => {
  await hydratePendingPwaFileOpenRequest();
  if (!pendingRequest) {
    return false;
  }

  dispatchPendingRequestEvent(pendingRequest);
  return true;
};

export const markPendingPwaFileOpenRequestHandled = async (requestId: string): Promise<void> => {
  if (!pendingRequest) {
    return;
  }
  if (pendingRequest.id !== requestId) {
    return;
  }

  const handledRequest = pendingRequest;
  pendingRequest = null;
  pendingRequestGeneration += 1;
  const persisted = await persistPendingPwaFileOpenRequestState();
  if (!persisted && pendingRequest === null) {
    pendingRequest = handledRequest;
    pendingRequestGeneration += 1;
    throw new Error('Pending PWA-fil-request kunne ikke markeres håndteret sikkert.');
  }
};

export const clearPendingPwaFileOpenRequest = async (expectedRequestId?: string): Promise<void> => {
  if (expectedRequestId !== undefined && pendingRequest?.id !== expectedRequestId) return;
  const clearedRequest = pendingRequest;
  pendingRequest = null;
  pendingRequestGeneration += 1;
  const persisted = await persistPendingPwaFileOpenRequestState();
  if (!persisted && pendingRequest === null && clearedRequest !== null) {
    pendingRequest = clearedRequest;
    pendingRequestGeneration += 1;
    throw new Error('Pending PWA-fil-request kunne ikke ryddes sikkert.');
  }
};
