// @vitest-environment jsdom

const writeClientScopedFileHandleValueMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    writeClientScopedFileHandleValue: (...args: unknown[]) =>
      writeClientScopedFileHandleValueMock(...args),
  };
});

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
} from '../../utils/fileOperationClientSession';
import {
  savePendingPwaOpenRequestToIndexedDB,
  type StoredPendingPwaOpenRequest,
} from '../../utils/fileHandleStorage';

describe('fileHandleStorage – klientscopet save af pending PWA-request', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    writeClientScopedFileHandleValueMock.mockReset();
    writeClientScopedFileHandleValueMock.mockResolvedValue({
      status: 'ok',
      value: undefined,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('skriver en gyldig pending-request under den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'client-isolated-pwa-save-session-1';
    const pendingRequest: StoredPendingPwaOpenRequest = {
      id: 'pwa-open-client-1',
      createdAtEpochMs: 1_700_000_000_000,
      fileHandle: {
        kind: 'file',
        name: 'sag.eo',
        getFile: vi.fn(),
      } as unknown as FileSystemFileHandle,
      fileName: 'sag.eo',
      ignoredFileCount: 0,
    };

    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);

    await expect(savePendingPwaOpenRequestToIndexedDB(pendingRequest)).resolves.toBe(true);

    expect(writeClientScopedFileHandleValueMock).toHaveBeenCalledOnce();
    expect(writeClientScopedFileHandleValueMock).toHaveBeenCalledWith(
      `client:${sessionId}:pending-pwa-open-request`,
      pendingRequest,
      'savePendingPwaOpenRequestToIndexedDB',
    );
  });
});
