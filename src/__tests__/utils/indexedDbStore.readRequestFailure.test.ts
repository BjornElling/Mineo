import { awaitRequest, runTransaction, type IndexedDbSchema } from '../../utils/indexedDbStore';
import { logError } from '../../utils/logger';

const logErrorMock = vi.mocked(logError);

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

const schema: IndexedDbSchema = {
  databaseName: 'read-failure-test-db',
  version: 1,
  upgrade: () => undefined,
};

const createReadFailureIndexedDb = (): {
  indexedDb: IDBFactory;
  stats: () => Readonly<{ closedConnections: number }>;
} => {
  let closedConnections = 0;
  const objectStore = {
    get: () => {
      const request: Record<string, unknown> = { result: undefined, error: null };
      queueMicrotask(() => {
        request.error = new Error('stub-read-fejl');
        (request.onerror as (() => void) | undefined)?.();
      });
      return request as unknown as IDBRequest<unknown>;
    },
  };

  const indexedDb = {
    open: () => {
      const request: Record<string, unknown> = { result: undefined, error: null };
      queueMicrotask(() => {
        const handlers: Record<string, (() => void) | undefined> = {};
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
          close: () => { closedConnections += 1; },
          transaction: () => transaction,
        };
        request.result = database;
        (request.onsuccess as (() => void) | undefined)?.();
      });
      return request as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;

  return { indexedDb, stats: () => ({ closedConnections }) };
};

describe('PERSIST-002 – IndexedDB readonly read-fejl', () => {
  const originalIndexedDb = globalThis.indexedDB;
  const originalKeyRange = globalThis.IDBKeyRange;
  let getConnectionStats: () => Readonly<{ closedConnections: number }>;

  beforeEach(() => {
    const stub = createReadFailureIndexedDb();
    getConnectionStats = stub.stats;
    const { indexedDb } = stub;
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: indexedDb });
    Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: class IDBKeyRange {} });
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalIndexedDb === undefined) Reflect.deleteProperty(globalThis, 'indexedDB');
    else Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: originalIndexedDb });
    if (originalKeyRange === undefined) Reflect.deleteProperty(globalThis, 'IDBKeyRange');
    else Object.defineProperty(globalThis, 'IDBKeyRange', { configurable: true, value: originalKeyRange });
  });

  it('returnerer en storage-fejl ved fejlet get-request og lukker forbindelsen', async () => {
    const result = await runTransaction(
      schema,
      ['entries'],
      'readonly',
      async (transaction) => await awaitRequest(transaction.objectStore('entries').get('mangler')),
      'read-request-test',
    );

    expect(result).toEqual({
      status: 'error',
      error: expect.objectContaining({ message: 'stub-read-fejl' }),
    });
    expect(logErrorMock).toHaveBeenCalledWith(
      'IndexedDB-operation fejlede',
      expect.objectContaining({
        context: 'read-request-test',
        error: expect.objectContaining({ message: 'stub-read-fejl' }),
      }),
    );
    expect(getConnectionStats().closedConnections).toBe(1);
  });
});
