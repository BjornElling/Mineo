import {
  awaitRequest,
  isIndexedDbAvailable,
  runTransaction,
  runTransactionOr,
  type IndexedDbSchema,
} from '../../utils/indexedDbStore';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

/**
 * Minimal IndexedDB-stub.
 *
 * Bevidst hjemmelavet frem for `fake-indexeddb`: de invarianter der skal bevises her er
 * primitivets EGNE (venter den på commit? lukker den forbindelsen? aborter den ved fejl?
 * håndterer den utilgængelighed?), ikke IndexedDB-specifikationens semantik. En ny
 * dependency ville ikke gøre de fire ting nemmere at hævde, og AGENTS.md kræver en reel
 * begrundelse for nye afhængigheder.
 */
type StubStore = Map<string, unknown>;

const createStubIndexedDb = (options: Readonly<{
  failOnPut?: boolean;
  failToOpen?: boolean;
}> = {}) => {
  const data: StubStore = new Map();
  let openConnections = 0;
  let closedConnections = 0;

  const makeRequest = <T>(resolveValue: () => T, shouldFail = false) => {
    const request: Record<string, unknown> = { result: undefined, error: null };
    queueMicrotask(() => {
      if (shouldFail) {
        request.error = new Error('stub-request-fejl');
        (request.onerror as (() => void) | undefined)?.();
        return;
      }
      request.result = resolveValue();
      (request.onsuccess as (() => void) | undefined)?.();
    });
    return request as unknown as IDBRequest<T>;
  };

  const objectStore = {
    get: (key: string) => makeRequest(() => data.get(key)),
    put: (value: unknown, key: string) =>
      makeRequest(() => { data.set(key, value); return undefined; }, options.failOnPut === true),
    delete: (key: string) => makeRequest(() => { data.delete(key); return undefined; }),
    count: () => makeRequest(() => data.size),
    clear: () => makeRequest(() => { data.clear(); return undefined; }),
  };

  const indexedDbStub = {
    open: () => {
      const request: Record<string, unknown> = { result: undefined, error: null };
      queueMicrotask(() => {
        if (options.failToOpen === true) {
          request.error = new Error('kunne ikke åbne');
          (request.onerror as (() => void) | undefined)?.();
          return;
        }
        openConnections += 1;
        let transactionHandlers: Record<string, (() => void) | undefined> = {};
        const db = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => objectStore,
          close: () => { closedConnections += 1; },
          transaction: () => {
            const transaction = {
              objectStore: () => objectStore,
              abort: () => { transactionHandlers.onabort?.(); },
              error: null,
              set oncomplete(fn: () => void) { transactionHandlers.oncomplete = fn; },
              set onerror(fn: () => void) { transactionHandlers.onerror = fn; },
              set onabort(fn: () => void) { transactionHandlers.onabort = fn; },
            };
            // Commit efter at alle requests i denne microtask-runde er afviklet.
            queueMicrotask(() => {
              queueMicrotask(() => {
                queueMicrotask(() => transactionHandlers.oncomplete?.());
              });
            });
            return transaction as unknown as IDBTransaction;
          },
        };
        transactionHandlers = {};
        request.result = db;
        (request.onsuccess as (() => void) | undefined)?.();
      });
      return request as unknown as IDBOpenDBRequest;
    },
  };

  return {
    indexedDbStub,
    data,
    stats: () => ({ openConnections, closedConnections }),
  };
};

const SCHEMA: IndexedDbSchema = {
  databaseName: 'test-db',
  version: 1,
  upgrade: () => { /* stub opretter altid storet */ },
};

describe('indexedDbStore', () => {
  const originalIndexedDb = globalThis.indexedDB;
  const originalKeyRange = globalThis.IDBKeyRange;

  afterEach(() => {
    Object.defineProperty(globalThis, 'indexedDB', { value: originalIndexedDb, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'IDBKeyRange', { value: originalKeyRange, configurable: true, writable: true });
  });

  const installStub = (stub: unknown) => {
    Object.defineProperty(globalThis, 'indexedDB', { value: stub, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'IDBKeyRange', { value: originalKeyRange ?? {}, configurable: true, writable: true });
  };

  describe('utilgængelig IndexedDB er en egen tilstand, ikke en fejl', () => {
    // Tidligere var `typeof indexedDB`-guarden gentaget 9 steder med INKONSISTENTE
    // returværdier (false/null/true). Nu er der ét svar, som kalderen oversætter.
    it('rapporterer unavailable frem for error når indexedDB mangler', async () => {
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });

      const result = await runTransaction(SCHEMA, ['s'], 'readonly', async () => 'urørt', 'test');

      expect(result).toEqual({ status: 'unavailable' });
    });

    it('isIndexedDbAvailable er falsk uden indexedDB', () => {
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });
      expect(isIndexedDbAvailable()).toBe(false);
    });

    it('runTransactionOr giver kalderens fallback ved utilgængelighed', async () => {
      Object.defineProperty(globalThis, 'indexedDB', { value: undefined, configurable: true, writable: true });

      const value = await runTransactionOr('fallback', SCHEMA, ['s'], 'readonly', async () => 'rigtig', 'test');

      expect(value).toBe('fallback');
    });
  });

  describe('forbindelsen lukkes altid', () => {
    it('lukker forbindelsen efter en gennemført transaction', async () => {
      const { indexedDbStub, stats } = createStubIndexedDb();
      installStub(indexedDbStub);

      await runTransaction(SCHEMA, ['s'], 'readwrite', async (transaction) => {
        await awaitRequest(transaction.objectStore('s').put('værdi', 'nøgle'));
      }, 'test');

      expect(stats()).toEqual({ openConnections: 1, closedConnections: 1 });
    });

    it('lukker forbindelsen også når arbejdet fejler', async () => {
      const { indexedDbStub, stats } = createStubIndexedDb();
      installStub(indexedDbStub);

      const result = await runTransaction(SCHEMA, ['s'], 'readwrite', async () => {
        throw new Error('arbejdet fejlede');
      }, 'test');

      expect(result.status).toBe('error');
      expect(stats().closedConnections).toBe(1);
    });
  });

  describe('flere writes er én enhed', () => {
    it('skriver alle nøgler i samme transaction', async () => {
      const { indexedDbStub, data } = createStubIndexedDb();
      installStub(indexedDbStub);

      const result = await runTransaction(SCHEMA, ['s'], 'readwrite', async (transaction) => {
        const store = transaction.objectStore('s');
        await Promise.all([
          awaitRequest(store.put('a', 'nøgle-a')),
          awaitRequest(store.put('b', 'nøgle-b')),
        ]);
      }, 'test');

      expect(result.status).toBe('ok');
      expect(data.get('nøgle-a')).toBe('a');
      expect(data.get('nøgle-b')).toBe('b');
    });

    it('rapporterer error når en write fejler', async () => {
      const { indexedDbStub } = createStubIndexedDb({ failOnPut: true });
      installStub(indexedDbStub);

      const result = await runTransaction(SCHEMA, ['s'], 'readwrite', async (transaction) => {
        await awaitRequest(transaction.objectStore('s').put('a', 'nøgle-a'));
      }, 'test');

      expect(result.status).toBe('error');
    });
  });

  describe('åbningsfejl', () => {
    it('bliver en error, ikke en uhåndteret rejection', async () => {
      const { indexedDbStub } = createStubIndexedDb({ failToOpen: true });
      installStub(indexedDbStub);

      const result = await runTransaction(SCHEMA, ['s'], 'readonly', async () => 'x', 'test');

      expect(result.status).toBe('error');
    });
  });
});
