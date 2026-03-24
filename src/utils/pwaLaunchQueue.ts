import {
  deletePendingPwaOpenRequestFromIndexedDB,
  loadPendingPwaOpenRequestFromIndexedDB,
  savePendingPwaOpenRequestToIndexedDB,
} from './fileHandleStorage';
import { logWarning } from './logger';

export const MINEO_PWA_FILE_OPEN_EVENT = 'mineo:pwa-file-open';

export type PwaFileOpenRequest = {
  id: string;
  createdAtEpochMs: number;
  targetUrl?: string;
  fileHandle: FileSystemFileHandle;
  fileName: string;
  ignoredFileCount: number;
};

export type PwaLaunchQueueSupport = 'supported' | 'unsupported';

let isInitialized = false;
let support: PwaLaunchQueueSupport = 'unsupported';
let requestCounter = 0;
let pendingRequest: PwaFileOpenRequest | null = null;
let hydratePendingRequestPromise: Promise<void> | null = null;

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

export const getPwaLaunchQueueSupport = (): PwaLaunchQueueSupport => {
  return support;
};

const isStoredPwaFileOpenRequest = (value: unknown): value is PwaFileOpenRequest => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<PwaFileOpenRequest>;
  return typeof candidate.id === 'string'
    && typeof candidate.createdAtEpochMs === 'number'
    && typeof candidate.fileName === 'string'
    && typeof candidate.ignoredFileCount === 'number'
    && !!candidate.fileHandle;
};

const dispatchPendingRequestEvent = (request: PwaFileOpenRequest): void => {
  window.dispatchEvent(new CustomEvent(MINEO_PWA_FILE_OPEN_EVENT, { detail: { requestId: request.id } }));
};

export const hydratePendingPwaFileOpenRequest = async (): Promise<void> => {
  if (pendingRequest !== null) return;
  if (hydratePendingRequestPromise) {
    await hydratePendingRequestPromise;
    return;
  }

  hydratePendingRequestPromise = (async () => {
    const stored = await loadPendingPwaOpenRequestFromIndexedDB();
    if (isStoredPwaFileOpenRequest(stored)) {
      pendingRequest = stored;
      const numericSuffix = Number.parseInt(stored.id.replace(/^pwa-open-/, ''), 10);
      if (Number.isFinite(numericSuffix) && numericSuffix > requestCounter) {
        requestCounter = numericSuffix;
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
    support = 'unsupported';
    return;
  }

  isInitialized = true;
  support = 'supported';

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
    dispatchPendingRequestEvent(request);
    void savePendingPwaOpenRequestToIndexedDB(request).then((saved) => {
      if (!saved) {
        logWarning('Pending PWA-open request kunne ikke persisteres; fortsætter med in-memory request', {
          context: 'setupPwaLaunchQueueConsumer.persistPendingRequest',
          data: { requestId: request.id, fileName: request.fileName },
        });
      }
    }).catch((error: unknown) => {
      logWarning('Pending PWA-open request kunne ikke persisteres; fortsætter med in-memory request', {
        context: 'setupPwaLaunchQueueConsumer.persistPendingRequest',
        data: {
          requestId: request.id,
          fileName: request.fileName,
          errorMessage: error instanceof Error ? error.message : String(error),
        },
      });
    });
  });
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

  pendingRequest = null;
  await deletePendingPwaOpenRequestFromIndexedDB();
};

export const clearPendingPwaFileOpenRequest = async (): Promise<void> => {
  pendingRequest = null;
  await deletePendingPwaOpenRequestFromIndexedDB();
};
