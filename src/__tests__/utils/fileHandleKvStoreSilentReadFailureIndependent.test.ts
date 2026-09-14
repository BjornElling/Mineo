// @vitest-environment jsdom

import { logError } from '../../utils/logger';
import { readFileHandleValueResult } from '../../utils/file/fileHandleKvStore';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

const logErrorMock = vi.mocked(logError);

const createReadFailureIndexedDb = () => {
  let closedConnections = 0;
  const objectStore = {
    get: () => {
      const request: {
        result: unknown;
        error: Error | null;
        onsuccess?: () => void;
        onerror?: () => void;
      } = {
        result: undefined,
        error: null,
      };

      queueMicrotask(() => {
        request.error = new Error('silent-read-fejl');
        request.onerror?.();
      });

      return request as unknown as IDBRequest<unknown>;
    },
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
        const handlers: {
          oncomplete?: () => void;
          onerror?: () => void;
          onabort?: () => void;
        } = {};
        const transaction = {
          objectStore: () => objectStore,
          abort: () => handlers.onabort?.(),
          error: null as Error | null,
          set oncomplete(handler: () => void) { handlers.oncomplete = handler; },
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
      });

      return request as unknown as IDBOpenDBRequest;
    },
  };

  return { indexedDbStub, stats: () => ({ closedConnections }) };
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

describe('fileHandleKvStore – silent read-fejl', () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    restoreGlobal('indexedDB', originalIndexedDbDescriptor);
    restoreGlobal('IDBKeyRange', originalKeyRangeDescriptor);
  });

  it('returnerer storage-fejl uden logError ved silent read', async () => {
    const stub = createReadFailureIndexedDb();
    installStub(stub.indexedDbStub);

    const result = await readFileHandleValueResult(
      'default_directory_meta',
      'fileHandleKvStore.silentReadFailure',
      { silent: true },
    );

    expect(result).toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'silent-read-fejl' }),
    });
    expect(logErrorMock).not.toHaveBeenCalled();
    expect(stub.stats()).toEqual({ closedConnections: 1 });
  });
});
