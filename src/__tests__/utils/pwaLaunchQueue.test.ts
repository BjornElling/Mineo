import {
  clearPendingPwaFileOpenRequest,
  getPendingPwaFileOpenRequest,
  hydratePendingPwaFileOpenRequest,
  markPendingPwaFileOpenRequestHandled,
  retryPendingPwaFileOpenRequest,
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
});
