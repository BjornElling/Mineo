import {
  deleteClientScopedFileHandleValue,
  deleteFileHandleValues,
  readClientScopedFileHandleValueResult,
  readFileHandleValueResult,
  writeClientScopedFileHandleValue,
  writeFileHandleValues,
} from '../../utils/file/fileHandleKvStore';

type StubStore = Map<string, unknown>;

const createStubIndexedDb = () => {
  const data: StubStore = new Map();

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

  const objectStore = {
    get: (key: string) => makeRequest(() => data.get(key)),
    put: (value: unknown, key: string) => makeRequest(() => {
      data.set(key, value);
      return undefined;
    }),
    delete: (key: string) => makeRequest(() => {
      data.delete(key);
      return undefined;
    }),
  };

  const indexedDbStub = {
    open: () => {
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
        const transactionHandlers: {
          oncomplete?: () => void;
          onerror?: () => void;
          onabort?: () => void;
        } = {};
        const transaction = {
          objectStore: () => objectStore,
          abort: () => transactionHandlers.onabort?.(),
          error: null as Error | null,
          set oncomplete(handler: () => void) { transactionHandlers.oncomplete = handler; },
          set onerror(handler: () => void) { transactionHandlers.onerror = handler; },
          set onabort(handler: () => void) { transactionHandlers.onabort = handler; },
        };
        request.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => objectStore,
          transaction: () => transaction,
          close: () => undefined,
        };
        request.onsuccess?.();

        // Requests skal være færdige, før transaktionen committer, som i den rigtige API.
        queueMicrotask(() => queueMicrotask(() => transactionHandlers.oncomplete?.()));
      });

      return request as unknown as IDBOpenDBRequest;
    },
  };

  return { data, indexedDbStub };
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

describe('fileHandleKvStore', () => {
  afterEach(() => {
    restoreGlobal('indexedDB', originalIndexedDbDescriptor);
    restoreGlobal('IDBKeyRange', originalKeyRangeDescriptor);
  });

  it('skriver, læser og sletter flere statiske værdier gennem samme kv-store', async () => {
    const { data, indexedDbStub } = createStubIndexedDb();
    installStub(indexedDbStub);
    const fileHandle = { name: 'sag.eo' } as FileSystemFileHandle;
    const metadata = {
      id: 'directory-1',
      displayName: 'Sager',
      savedAt: 1_700_000_000_000,
      source: 'user' as const,
    };

    await expect(writeFileHandleValues({
      current_file_handle: fileHandle,
      default_directory_meta: metadata,
    }, 'test')).resolves.toEqual({ status: 'ok', value: undefined });

    await expect(readFileHandleValueResult('current_file_handle', 'test')).resolves.toEqual({
      status: 'ok',
      value: fileHandle,
    });
    await expect(readFileHandleValueResult('default_directory_meta', 'test')).resolves.toEqual({
      status: 'ok',
      value: metadata,
    });

    await expect(deleteFileHandleValues(['current_file_handle', 'default_directory_meta'], 'test'))
      .resolves.toEqual({ status: 'ok', value: undefined });
    expect(data.size).toBe(0);
  });

  it('holder klientscopede nøgler adskilt og sletter kun den valgte klient', async () => {
    const { indexedDbStub } = createStubIndexedDb();
    installStub(indexedDbStub);
    const clientA = { owner: 'A' };
    const clientB = { owner: 'B' };

    await expect(writeClientScopedFileHandleValue('client:a:current-file-handle', clientA, 'test'))
      .resolves.toEqual({ status: 'ok', value: undefined });
    await expect(writeClientScopedFileHandleValue('client:b:current-file-handle', clientB, 'test'))
      .resolves.toEqual({ status: 'ok', value: undefined });

    await expect(readClientScopedFileHandleValueResult<typeof clientA>(
      'client:a:current-file-handle',
      'test',
    )).resolves.toEqual({ status: 'ok', value: clientA });
    await expect(readClientScopedFileHandleValueResult<typeof clientB>(
      'client:b:current-file-handle',
      'test',
    )).resolves.toEqual({ status: 'ok', value: clientB });

    await expect(deleteClientScopedFileHandleValue('client:a:current-file-handle', 'test'))
      .resolves.toEqual({ status: 'ok', value: undefined });
    await expect(readClientScopedFileHandleValueResult<typeof clientB>(
      'client:b:current-file-handle',
      'test',
    )).resolves.toEqual({ status: 'ok', value: clientB });
    await expect(readClientScopedFileHandleValueResult('client:a:current-file-handle', 'test'))
      .resolves.toEqual({ status: 'ok', value: null });
  });
});
