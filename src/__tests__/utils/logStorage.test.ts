/// <reference types="vitest/globals" />
import { clearAllLogs, getAllLogEntries, saveLogEntry } from '../../utils/logStorage';

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
    await expect(clearAllLogs()).resolves.toBeUndefined();

    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
