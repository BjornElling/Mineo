/// <reference types="vitest/globals" />
import { clearAllLogs, getAllLogEntries, getRecentLogEntries, saveLogEntry } from '../../utils/logStorage';

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
  });
});
