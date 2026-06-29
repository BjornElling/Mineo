// @vitest-environment jsdom
import {
  Mineo_PWA_FILE_OPEN_EVENT,
  clearPendingPwaFileOpenRequest,
  getPendingPwaFileOpenRequest,
  hydratePendingPwaFileOpenRequest,
  markPendingPwaFileOpenRequestHandled,
  setupPwaLaunchQueueConsumer,
  retryPendingPwaFileOpenRequest,
} from '../../utils/pwaLaunchQueue';

const loadPendingPwaOpenRequestFromIndexedDBMock = vi.fn();
const deletePendingPwaOpenRequestFromIndexedDBMock = vi.fn();
const savePendingPwaOpenRequestToIndexedDBMock = vi.fn();
const logWarningMock = vi.fn();

vi.mock('../../utils/fileHandleStorage', () => ({
  savePendingPwaOpenRequestToIndexedDB: (...args: unknown[]) => savePendingPwaOpenRequestToIndexedDBMock(...args),
  loadPendingPwaOpenRequestFromIndexedDB: () => loadPendingPwaOpenRequestFromIndexedDBMock(),
  deletePendingPwaOpenRequestFromIndexedDB: () => deletePendingPwaOpenRequestFromIndexedDBMock(),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: (...args: unknown[]) => logWarningMock(...args),
}));

describe('pwaLaunchQueue', () => {
  beforeEach(async () => {
    loadPendingPwaOpenRequestFromIndexedDBMock.mockReset();
    deletePendingPwaOpenRequestFromIndexedDBMock.mockReset();
    savePendingPwaOpenRequestToIndexedDBMock.mockReset();
    logWarningMock.mockReset();
    savePendingPwaOpenRequestToIndexedDBMock.mockResolvedValue(true);
    await clearPendingPwaFileOpenRequest();
  });

  it('rehydrates a persisted pending request and keeps it pending until it is marked handled', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    loadPendingPwaOpenRequestFromIndexedDBMock.mockResolvedValue({
      id: 'pwa-open-7',
      createdAtEpochMs: 123,
      targetUrl: '/open',
      fileHandle: {} as FileSystemFileHandle,
      fileName: 'test.eo',
      ignoredFileCount: 0,
    });

    await hydratePendingPwaFileOpenRequest();

    expect(await retryPendingPwaFileOpenRequest()).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'mineo:pwa-file-open',
    }));

    const next = getPendingPwaFileOpenRequest();
    expect(next).toEqual(expect.objectContaining({
      id: 'pwa-open-7',
      fileName: 'test.eo',
    }));

    await markPendingPwaFileOpenRequestHandled('pwa-open-7');
    expect(getPendingPwaFileOpenRequest()).toBeNull();
  });

  it('dispatches PWA-open event even if persistence of the pending request fails', async () => {
    const setConsumerMock = vi.fn();
    Object.defineProperty(window, 'launchQueue', {
      configurable: true,
      value: {
        setConsumer: setConsumerMock,
      },
    });
    savePendingPwaOpenRequestToIndexedDBMock.mockRejectedValueOnce(new Error('IDB nede'));

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    setupPwaLaunchQueueConsumer();

    const consumer = setConsumerMock.mock.calls[0]?.[0] as ((params: {
      files?: ReadonlyArray<FileSystemHandle>;
      targetURL?: string;
    }) => Promise<void>) | undefined;

    expect(consumer).toBeDefined();

    await consumer?.({
      files: [{ kind: 'file', name: 'test.eo' } as FileSystemFileHandle],
      targetURL: '/open',
    });

    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: Mineo_PWA_FILE_OPEN_EVENT,
    }));
    await Promise.resolve();
    expect(logWarningMock).toHaveBeenCalled();

    delete (window as Window & { launchQueue?: unknown }).launchQueue;
  });
});
