// @vitest-environment jsdom

import {
  deleteFileHandleValues,
  type DirectoryHandleMeta,
} from '../../utils/file/fileHandleKvStore';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

const createAbortingIndexedDb = () => {
  const directoryHandle = {
    kind: 'directory',
    name: 'Sager',
  } as unknown as FileSystemDirectoryHandle;
  const directoryMeta: DirectoryHandleMeta = {
    id: 'directory-1',
    displayName: 'Sager',
    savedAt: 1_700_000_000_000,
    source: 'user',
  };
  const data = new Map<string, unknown>([
    ['default_directory_handle', directoryHandle],
    ['default_directory_meta', directoryMeta],
  ]);
  let closedConnections = 0;
  let deletedRequests = 0;

  const makeRequest = <T>(resolveValue: () => T): IDBRequest<T> => {
    const request: {
      result: T | undefined;
      error: Error | null;
      onsuccess?: () => void;
      onerror?: () => void;
    } = {
      result: undefined,
      error: null,
    };

    queueMicrotask(() => {
      try {
        request.result = resolveValue();
        request.onsuccess?.();
      } catch (error: unknown) {
        request.error = error instanceof Error ? error : new Error(String(error));
        request.onerror?.();
      }
    });

    return request as unknown as IDBRequest<T>;
  };

  const indexedDbStub = {
    open: () => {
      const request: {
        result: IDBDatabase | undefined;
        error: Error | null;
        onsuccess?: () => void;
        onerror?: () => void;
      } = {
        result: undefined,
        error: null,
      };

      queueMicrotask(() => {
        const pendingDeletedKeys: string[] = [];
        const handlers: {
          oncomplete?: () => void;
          onerror?: () => void;
          onabort?: () => void;
        } = {};
        let aborted = false;
        const objectStore = {
          delete: (key: string) => makeRequest(() => {
            deletedRequests += 1;
            pendingDeletedKeys.push(key);
            return undefined;
          }),
        };
        const transaction = {
          objectStore: () => objectStore,
          abort: () => {
            if (aborted) return;
            aborted = true;
            pendingDeletedKeys.length = 0;
            transaction.error = new Error('transaction afbrudt');
            handlers.onabort?.();
          },
          error: null as Error | null,
          set oncomplete(handler: () => void) {
            handlers.oncomplete = () => {
              pendingDeletedKeys.forEach((key) => data.delete(key));
              pendingDeletedKeys.length = 0;
              handler();
            };
          },
          set onerror(handler: () => void) { handlers.onerror = handler; },
          set onabort(handler: () => void) { handlers.onabort = handler; },
        };

        const database = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => objectStore,
          transaction: () => transaction,
          close: () => { closedConnections += 1; },
        };

        request.result = database as unknown as IDBDatabase;
        request.onsuccess?.();

        // Afbryd efter begge delete-requests, men før en commit kan gøre dem synlige.
        queueMicrotask(() => queueMicrotask(() => transaction.abort()));
      });

      return request as unknown as IDBOpenDBRequest;
    },
  };

  return {
    data,
    directoryHandle,
    directoryMeta,
    indexedDbStub,
    stats: () => ({ closedConnections, deletedRequests }),
  };
};

const originalIndexedDbDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
const originalKeyRangeDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'IDBKeyRange');

const installStub = (indexedDbStub: unknown): void => {
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    writable: true,
    value: indexedDbStub,
  });
  Object.defineProperty(globalThis, 'IDBKeyRange', {
    configurable: true,
    writable: true,
    value: {},
  });
};

const restoreGlobal = (name: 'indexedDB' | 'IDBKeyRange', descriptor: PropertyDescriptor | undefined): void => {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
};

describe('fileHandleKvStore – atomisk delete ved transaction-fejl', () => {
  afterEach(() => {
    restoreGlobal('indexedDB', originalIndexedDbDescriptor);
    restoreGlobal('IDBKeyRange', originalKeyRangeDescriptor);
  });

  it('bevarer begge standardmappeværdier ved afbrudt atomisk sletning', async () => {
    const stub = createAbortingIndexedDb();
    installStub(stub.indexedDbStub);

    const result = await deleteFileHandleValues(
      ['default_directory_handle', 'default_directory_meta'],
      'fileHandleKvStore.atomicDeleteFailure',
    );

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.error.message).toBe('transaction afbrudt');
    }
    expect(stub.stats()).toEqual({ closedConnections: 1, deletedRequests: 2 });
    expect(stub.data).toEqual(new Map<string, unknown>([
      ['default_directory_handle', stub.directoryHandle],
      ['default_directory_meta', stub.directoryMeta],
    ]));
  });
});
