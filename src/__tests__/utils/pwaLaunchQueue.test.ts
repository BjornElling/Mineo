import {
  clearPendingPwaFileOpenRequest,
  hydratePendingPwaFileOpenRequest,
  retryPendingPwaFileOpenRequest,
  takeNextPwaFileOpenRequest,
} from '../../utils/pwaLaunchQueue';

const loadPendingPwaOpenRequestFromIndexedDBMock = vi.fn();
const deletePendingPwaOpenRequestFromIndexedDBMock = vi.fn();

vi.mock('../../utils/fileHandleStorage', () => ({
  savePendingPwaOpenRequestToIndexedDB: vi.fn(async () => true),
  loadPendingPwaOpenRequestFromIndexedDB: () => loadPendingPwaOpenRequestFromIndexedDBMock(),
  deletePendingPwaOpenRequestFromIndexedDB: () => deletePendingPwaOpenRequestFromIndexedDBMock(),
}));

describe('pwaLaunchQueue', () => {
  beforeEach(async () => {
    loadPendingPwaOpenRequestFromIndexedDBMock.mockReset();
    deletePendingPwaOpenRequestFromIndexedDBMock.mockReset();
    await clearPendingPwaFileOpenRequest();
  });

  it('rehydrates a persisted pending request and exposes it to retry/takeNext after reload-like state loss', async () => {
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

    const next = takeNextPwaFileOpenRequest();
    expect(next).toEqual(expect.objectContaining({
      id: 'pwa-open-7',
      fileName: 'test.eo',
    }));
  });
});
