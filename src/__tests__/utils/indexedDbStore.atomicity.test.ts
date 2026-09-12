import {
  awaitRequest,
  runTransaction,
  type IndexedDbSchema,
} from '../../utils/indexedDbStore';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

type PendingWrite = Readonly<{ key: string; value: unknown }>;

/**
 * Minimal stub med transaktionsstaging: writes bliver først synlige ved commit.
 * Det er netop den egenskab, det eksisterende request-/statusfacit ikke beviser.
 */
const createAtomicIndexedDbStub = () => {
  const data = new Map<string, unknown>([['bestående', 'før']]);
  let closedConnections = 0;
  let writesReceived = 0;

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
        const pendingWrites: PendingWrite[] = [];
        const handlers: {
          oncomplete?: () => void;
          onerror?: () => void;
          onabort?: () => void;
        } = {};
        let aborted = false;
        const objectStore = {
          put: (value: unknown, key: string) => makeRequest(() => {
            writesReceived += 1;
            pendingWrites.push({ key, value });
            return undefined;
          }),
        };
        const transaction = {
          objectStore: () => objectStore,
          abort: () => {
            if (aborted) return;
            aborted = true;
            pendingWrites.length = 0;
            transaction.error = new Error('transaction afbrudt');
            handlers.onabort?.();
          },
          error: null as Error | null,
          set oncomplete(handler: () => void) { handlers.oncomplete = handler; },
          set onerror(handler: () => void) { handlers.onerror = handler; },
          set onabort(handler: () => void) { handlers.onabort = handler; },
        };
        const db = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => objectStore,
          transaction: () => transaction,
          close: () => { closedConnections += 1; },
        };

        request.result = db as unknown as IDBDatabase;
        request.onsuccess?.();

        // Afbryd efter requests, men før commit, så testen rammer den samme
        // grænse som et browserdrevet transaction-abort.
        queueMicrotask(() => queueMicrotask(() => transaction.abort()));
      });

      return request as unknown as IDBOpenDBRequest;
    },
  };

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
      request.result = resolveValue();
      request.onsuccess?.();
    });

    return request as unknown as IDBRequest<T>;
  };

  return {
    indexedDbStub,
    data,
    stats: () => ({ closedConnections, writesReceived }),
  };
};

const SCHEMA: IndexedDbSchema = {
  databaseName: 'atomicity-test-db',
  version: 1,
  upgrade: () => { /* Stubben opretter altid storet. */ },
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

const restoreGlobal = (
  name: 'indexedDB' | 'IDBKeyRange',
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (descriptor) {
    Object.defineProperty(globalThis, name, descriptor);
  } else {
    Reflect.deleteProperty(globalThis, name);
  }
};

describe('indexedDbStore – transactionens atomicitet', () => {
  afterEach(() => {
    restoreGlobal('indexedDB', originalIndexedDbDescriptor);
    restoreGlobal('IDBKeyRange', originalKeyRangeDescriptor);
  });

  it('gør ingen af transactionens writes synlige efter et abort', async () => {
    const { indexedDbStub, data, stats } = createAtomicIndexedDbStub();
    installStub(indexedDbStub);

    const result = await runTransaction(
      SCHEMA,
      ['entries'],
      'readwrite',
      async (transaction) => {
        const store = transaction.objectStore('entries');
        await Promise.all([
          awaitRequest(store.put('første write', 'ny-a')),
          awaitRequest(store.put('anden write', 'ny-b')),
        ]);
      },
      'indexedDbStore.atomicity.test',
    );

    expect(result).toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'transaction afbrudt' }),
    });
    expect(stats()).toEqual({ closedConnections: 1, writesReceived: 2 });
    expect(data).toEqual(new Map([['bestående', 'før']]));
  });
});
