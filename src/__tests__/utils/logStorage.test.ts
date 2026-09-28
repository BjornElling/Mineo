/// <reference types="vitest/globals" />
import { clearAllLogs, getAllLogEntries, getRecentLogEntries, saveLogEntry } from '../../utils/logStorage';
import type { LogEntry } from '../../utils/logStorage';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

type StoredLogEntry = LogEntry & { id: number };

const createIndexedDbStub = (
  initialEntries: readonly StoredLogEntry[] = [],
  options: Readonly<{ cursorError?: 'recent' | 'cleanup' }> = {},
) => {
  const entries = [...initialEntries];
  let nextId = Math.max(0, ...entries.map((entry) => entry.id)) + 1;
  let storeExists = false;

  const createCursorRequest = (
    transactionState: { scheduleCompletion: () => void },
    query: unknown,
    direction: IDBCursorDirection | undefined,
  ): IDBRequest<IDBCursorWithValue | null> => {
    const upperBound = typeof query === 'object' && query !== null && 'upperBound' in query
      ? String((query as { upperBound: unknown }).upperBound)
      : undefined;
    const orderedEntries = entries
      .filter((entry) => upperBound === undefined || entry.timestamp <= upperBound)
      .sort((left, right) => left.timestamp.localeCompare(right.timestamp));
    if (direction === 'prev') orderedEntries.reverse();

    let position = 0;
    const request: {
      result: IDBCursorWithValue | null;
      error: Error | null;
      onsuccess: (() => void) | null;
      onerror: (() => void) | null;
    } = {
      result: null,
      error: null,
      onsuccess: null,
      onerror: null,
    };

    const emit = (): void => {
      const isRecentCursor = query === null;
      const isCleanupCursor = query !== null;
      if ((options.cursorError === 'recent' && isRecentCursor)
        || (options.cursorError === 'cleanup' && isCleanupCursor)) {
        request.error = new Error('stub-cursor-fejl');
        request.onerror?.();
        return;
      }
      const entry = orderedEntries[position];
      if (entry === undefined) {
        request.result = null;
      } else {
        request.result = {
          value: entry,
          delete: () => {
            const index = entries.findIndex((candidate) => candidate.id === entry.id);
            if (index >= 0) entries.splice(index, 1);
          },
          continue: () => {
            position += 1;
            queueMicrotask(emit);
          },
        } as unknown as IDBCursorWithValue;
      }
      request.onsuccess?.();
      transactionState.scheduleCompletion();
    };

    queueMicrotask(emit);
    return request as unknown as IDBRequest<IDBCursorWithValue | null>;
  };

  const createTransaction = (mode: IDBTransactionMode) => {
    const handlers: {
      oncomplete?: () => void;
      onerror?: () => void;
      onabort?: () => void;
    } = {};
    let completionScheduled = false;
    const transactionState = {
      scheduleCompletion: (): void => {
        if (mode === 'readonly' || completionScheduled) return;
        completionScheduled = true;
        setTimeout(() => handlers.oncomplete?.(), 0);
      },
    };

    const makeRequest = <T>(resolveValue: () => T, scheduleCompletion = false): IDBRequest<T> => {
      const request: {
        result: T | undefined;
        error: Error | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
      } = {
        result: undefined,
        error: null,
        onsuccess: null,
        onerror: null,
      };
      queueMicrotask(() => {
        try {
          request.result = resolveValue();
          request.onsuccess?.();
          if (scheduleCompletion) transactionState.scheduleCompletion();
        } catch (error: unknown) {
          request.error = error instanceof Error ? error : new Error(String(error));
          request.onerror?.();
        }
      });
      return request as unknown as IDBRequest<T>;
    };

    const objectStore = {
      add: (value: unknown) => makeRequest(() => {
        const entry = value as Omit<LogEntry, 'id'>;
        entries.push({ ...entry, id: nextId });
        nextId += 1;
        return undefined;
      }, true),
      getAll: () => makeRequest(() => [...entries]),
      clear: () => makeRequest(() => {
        entries.splice(0, entries.length);
        return undefined;
      }, true),
      count: () => makeRequest(() => entries.length),
      index: () => ({
        openCursor: (query?: unknown, direction?: IDBCursorDirection) =>
          createCursorRequest(transactionState, query, direction),
      }),
      createIndex: () => undefined,
    };

    return {
      objectStore: () => objectStore,
      abort: () => handlers.onabort?.(),
      error: null,
      set oncomplete(handler: () => void) { handlers.oncomplete = handler; },
      set onerror(handler: () => void) { handlers.onerror = handler; },
      set onabort(handler: () => void) { handlers.onabort = handler; },
    } as unknown as IDBTransaction;
  };

  const objectStore = {
    createIndex: () => undefined,
  };
  const db = {
    objectStoreNames: { contains: () => storeExists },
    createObjectStore: () => {
      storeExists = true;
      return objectStore;
    },
    transaction: (_storeNames: readonly string[], mode: IDBTransactionMode) => createTransaction(mode),
    close: () => undefined,
  };

  const indexedDbStub = {
    open: () => {
      const request: {
        result: typeof db;
        error: Error | null;
        onsuccess: (() => void) | null;
        onerror: (() => void) | null;
        onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null;
      } = {
        result: db,
        error: null,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.({ target: { result: db } } as unknown as IDBVersionChangeEvent);
        request.onsuccess?.();
      });
      return request as unknown as IDBOpenDBRequest;
    },
  };

  return {
    indexedDbStub,
    keyRangeStub: { upperBound: (value: string) => ({ upperBound: value }) },
    entries,
  };
};

const installIndexedDbStub = (stub: ReturnType<typeof createIndexedDbStub>): void => {
  vi.stubGlobal('indexedDB', stub.indexedDbStub);
  vi.stubGlobal('IDBKeyRange', stub.keyRangeStub);
};

describe('logStorage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fejler stille når IndexedDB ikke findes', async () => {
    vi.stubGlobal('indexedDB', undefined);
    vi.stubGlobal('IDBKeyRange', undefined);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(saveLogEntry({
      timestamp: '2026-03-10T10:00:00.000Z',
      level: 'error',
      context: 'test',
      message: 'Test',
    })).resolves.toBeUndefined();
    await expect(getAllLogEntries()).resolves.toEqual([]);
    await expect(getRecentLogEntries(5)).resolves.toEqual([]);
    await expect(clearAllLogs()).resolves.toBeUndefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('henter de seneste log entries via timestamp-cursor i faldende rækkefølge', async () => {
    vi.stubGlobal('IDBKeyRange', { upperBound: vi.fn() });

    const entries = [
      {
        id: 1,
        timestamp: '2026-03-10T10:00:00.000Z',
        level: 'error',
        context: 'old',
        message: 'Old',
      },
      {
        id: 2,
        timestamp: '2026-03-10T11:00:00.000Z',
        level: 'warn',
        context: 'mid',
        message: 'Mid',
      },
      {
        id: 3,
        timestamp: '2026-03-10T12:00:00.000Z',
        level: 'error',
        context: 'new',
        message: 'New',
      },
    ];

    const openCursor = (_query?: unknown, direction?: IDBCursorDirection) => {
      let position = direction === 'prev' ? entries.length - 1 : 0;
      const request: {
        result: { value: unknown; continue: () => void } | null;
        onsuccess: null | (() => void);
        onerror: null | (() => void);
        error?: unknown;
      } = {
        result: null,
        onsuccess: null,
        onerror: null,
      };

      const emit = () => {
        if (position < 0 || position >= entries.length) {
          request.result = null;
        } else {
          request.result = {
            value: entries[position],
            continue: () => {
              position += direction === 'prev' ? -1 : 1;
              emit();
            },
          };
        }
        request.onsuccess?.();
      };

      queueMicrotask(emit);
      return request;
    };

    const db = {
      transaction: () => ({
        objectStore: () => ({
          index: () => ({
            openCursor,
          }),
        }),
      }),
      objectStoreNames: {
        contains: () => true,
      },
    };

    vi.stubGlobal('indexedDB', {
      open: () => {
        const request: {
          result?: unknown;
          onsuccess: null | (() => void);
          onerror: null | (() => void);
          onupgradeneeded: null | (() => void);
        } = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
        };

        queueMicrotask(() => {
          request.result = db;
          request.onsuccess?.();
        });

        return request;
      },
    });

    await expect(getRecentLogEntries(2)).resolves.toEqual([
      expect.objectContaining({ id: 3, context: 'new' }),
      expect.objectContaining({ id: 2, context: 'mid' }),
    ]);

    await expect(getRecentLogEntries(5)).resolves.toEqual([
      expect.objectContaining({ id: 3, context: 'new' }),
      expect.objectContaining({ id: 2, context: 'mid' }),
      expect.objectContaining({ id: 1, context: 'old' }),
    ]);
  });

  it('returnerer straks en tom liste ved et ikke-positivt antal', async () => {
    await expect(getRecentLogEntries(0)).resolves.toEqual([]);
    await expect(getRecentLogEntries(-1)).resolves.toEqual([]);
  });

  it('sorterer alle entries efter timestamp og kan rydde hele loggen', async () => {
    const stub = createIndexedDbStub([
      { id: 1, timestamp: '2026-03-10T10:00:00.000Z', level: 'error', context: 'old', message: 'Old' },
      { id: 2, timestamp: '2026-03-10T12:00:00.000Z', level: 'warn', context: 'new', message: 'New' },
      { id: 3, timestamp: '2026-03-10T11:00:00.000Z', level: 'error', context: 'mid', message: 'Mid' },
    ]);
    installIndexedDbStub(stub);

    await expect(getAllLogEntries()).resolves.toEqual([
      expect.objectContaining({ id: 2, context: 'new' }),
      expect.objectContaining({ id: 3, context: 'mid' }),
      expect.objectContaining({ id: 1, context: 'old' }),
    ]);

    await expect(clearAllLogs()).resolves.toBeUndefined();
    await expect(getAllLogEntries()).resolves.toEqual([]);
  });

  it('gemmer en entry og sletter entries ældre end 30 dage i oprydningen', async () => {
    const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const stub = createIndexedDbStub([
      { id: 1, timestamp: oldTimestamp, level: 'error', context: 'old', message: 'Old' },
    ]);
    installIndexedDbStub(stub);

    await saveLogEntry({
      timestamp: new Date().toISOString(),
      level: 'warn',
      context: 'new',
      message: 'New',
    });

    await vi.waitFor(() => {
      expect(stub.entries).toEqual([
        expect.objectContaining({ id: 2, context: 'new' }),
      ]);
    });
  });

  it('trimmer ældste entry, når loggen overstiger 1000 entries', async () => {
    const initialEntries = Array.from({ length: 1000 }, (_, index): StoredLogEntry => ({
      id: index + 1,
      timestamp: new Date(Date.now() - (1000 - index) * 1000).toISOString(),
      level: 'error',
      context: `context-${index + 1}`,
      message: `message-${index + 1}`,
    }));
    const stub = createIndexedDbStub(initialEntries);
    installIndexedDbStub(stub);

    await saveLogEntry({
      timestamp: new Date().toISOString(),
      level: 'error',
      context: 'newest',
      message: 'Newest',
    });

    await vi.waitFor(() => {
      expect(stub.entries).toHaveLength(1000);
      expect(stub.entries.some((entry) => entry.id === 1)).toBe(false);
      expect(stub.entries.some((entry) => entry.context === 'newest')).toBe(true);
    });
  });

  it('giver fail-safe tom læsning, når timestamp-cursoren fejler', async () => {
    const stub = createIndexedDbStub([
      { id: 1, timestamp: '2026-03-10T10:00:00.000Z', level: 'error', context: 'test', message: 'Test' },
    ], { cursorError: 'recent' });
    installIndexedDbStub(stub);

    await expect(getRecentLogEntries(1)).resolves.toEqual([]);
  });

  it('lader en cleanup-fejl blive i den stille loggevej', async () => {
    const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const stub = createIndexedDbStub([
      { id: 1, timestamp: oldTimestamp, level: 'error', context: 'old', message: 'Old' },
    ], { cursorError: 'cleanup' });
    installIndexedDbStub(stub);

    await expect(saveLogEntry({
      timestamp: new Date().toISOString(),
      level: 'warn',
      context: 'new',
      message: 'New',
    })).resolves.toBeUndefined();

    await vi.waitFor(() => {
      expect(stub.entries).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: 1, context: 'old' }),
        expect.objectContaining({ id: 2, context: 'new' }),
      ]));
    });
  });
});
