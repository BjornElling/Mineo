import {
  deletePendingPwaOpenRequestFromIndexedDB,
  loadPendingPwaOpenRequestFromIndexedDB,
  savePendingPwaOpenRequestToIndexedDB,
} from './fileHandleStorage';
import { isFileSystemFileHandle } from './fileSystemAccess';
import { logWarning } from './logger';

export const Mineo_PWA_FILE_OPEN_EVENT = 'mineo:pwa-file-open';

export type PwaFileOpenRequest = {
  id: string;
  createdAtEpochMs: number;
  targetUrl?: string;
  fileHandle: FileSystemFileHandle;
  fileName: string;
  ignoredFileCount: number;
};

let isInitialized = false;
let requestCounter = 0;
let pendingRequest: PwaFileOpenRequest | null = null;
let hydratePendingRequestPromise: Promise<void> | null = null;
let persistPendingRequestQueue: Promise<boolean> = Promise.resolve(true);

const isFileHandle = (handle: FileSystemHandle): handle is FileSystemFileHandle => {
  return handle.kind === 'file';
};

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

const isStoredPwaFileOpenRequest = (value: unknown): value is PwaFileOpenRequest => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PwaFileOpenRequest>;
  return typeof candidate.id === 'string'
    && candidate.id.trim() !== ''
    && typeof candidate.createdAtEpochMs === 'number'
    && Number.isFinite(candidate.createdAtEpochMs)
    && typeof candidate.fileName === 'string'
    && candidate.fileName.trim() !== ''
    && typeof candidate.ignoredFileCount === 'number'
    && Number.isInteger(candidate.ignoredFileCount)
    && candidate.ignoredFileCount >= 0
    && isFileSystemFileHandle(candidate.fileHandle)
    && (candidate.targetUrl === undefined || typeof candidate.targetUrl === 'string');
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
          data: { requestId: request.id, fileName: request.fileName },
        });
      }
      return saved;
    } catch (error: unknown) {
      logWarning('Pending PWA-open request kunne ikke persisteres; fortsætter med in-memory request', {
        context: 'persistPendingPwaFileOpenRequestState.save',
        data: {
          requestId: request?.id,
          fileName: request?.fileName,
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
    let stored: Awaited<ReturnType<typeof loadPendingPwaOpenRequestFromIndexedDB>>;
    try {
      stored = await loadPendingPwaOpenRequestFromIndexedDB();
    } catch (error: unknown) {
      logWarning('Pending PWA-open request kunne ikke hentes fra IndexedDB', {
        context: 'hydratePendingPwaFileOpenRequest.load',
        data: { errorMessage: error instanceof Error ? error.message : String(error) },
      });
      return;
    }

    // launchQueue kan aflevere en ny fil, mens IndexedDB læses. Den nyligt modtagne fil er
    // brugerens seneste handling og må aldrig erstattes af en ældre request fra før opdateringen.
    if (pendingRequest !== null) return;

    if (isStoredPwaFileOpenRequest(stored)) {
      pendingRequest = stored;
      const numericSuffix = Number.parseInt(stored.id.replace(/^pwa-open-/, ''), 10);
      if (Number.isFinite(numericSuffix) && numericSuffix > requestCounter) {
        requestCounter = numericSuffix;
      }
    } else if (stored !== null) {
      logWarning('Ugyldig pending PWA-open request blev fjernet fra IndexedDB', {
        context: 'hydratePendingPwaFileOpenRequest.invalidStoredRequest',
      });
      // Oprydningen skal gennem samme serialiserede kø som saves/deletes. En ny launchQueue-fil kan
      // ankomme mens den ugyldige record fjernes; en direkte delete ville da kunne slette den nye request.
      await persistPendingPwaFileOpenRequestState();
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
    const handles = (launchParams.files ?? []).filter(isFileHandle);
    if (handles.length === 0) {
      return;
    }

    const primaryHandle = handles[0];
    const request: PwaFileOpenRequest = {
      id: `pwa-open-${++requestCounter}`,
      createdAtEpochMs: Date.now(),
      targetUrl: typeof launchParams.targetURL === 'string' ? launchParams.targetURL : undefined,
      fileHandle: primaryHandle,
      fileName: primaryHandle.name,
      ignoredFileCount: Math.max(0, handles.length - 1),
    };

    // Deterministisk strategi: seneste request vinder (overskriver evt. tidligere pending request).
    pendingRequest = request;
    // Eventet udsendes FØR den langsomme IDB-skrivning, så en request, der ankommer under Gem/Hent/
    // Slet alt, registreres som travl ved ankomst og ikke pludselig behandles som en ny ledig handling,
    // når persisteringen er færdig. Callbacken afventer stadig den serialiserede skrivning, så launchQueue
    // får en afsluttet durable-handoff i samme async-forløb.
    dispatchPendingRequestEvent(request);
    await persistPendingPwaFileOpenRequestState();
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
  try {
    await persistPendingRequestQueue;
  } catch {
    return false;
  }
  if (pendingRequest === null) return true;

  try {
    const stored = await loadPendingPwaOpenRequestFromIndexedDB();
    return isStoredPwaFileOpenRequest(stored) && stored.id === pendingRequest.id;
  } catch {
    return false;
  }
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
  const persisted = await persistPendingPwaFileOpenRequestState();
  if (!persisted && pendingRequest === null) {
    pendingRequest = handledRequest;
    throw new Error('Pending PWA-fil-request kunne ikke markeres håndteret sikkert.');
  }
};

export const clearPendingPwaFileOpenRequest = async (expectedRequestId?: string): Promise<void> => {
  if (expectedRequestId !== undefined && pendingRequest?.id !== expectedRequestId) return;
  const clearedRequest = pendingRequest;
  pendingRequest = null;
  const persisted = await persistPendingPwaFileOpenRequestState();
  if (!persisted && pendingRequest === null && clearedRequest !== null) {
    pendingRequest = clearedRequest;
    throw new Error('Pending PWA-fil-request kunne ikke ryddes sikkert.');
  }
};
