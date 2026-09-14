// @vitest-environment jsdom

const readClientScopedFileHandleValueResultMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readClientScopedFileHandleValueResult: (...args: unknown[]) =>
      readClientScopedFileHandleValueResultMock(...args),
  };
});

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
} from '../../utils/fileOperationClientSession';
import {
  loadPendingPwaOpenRequestFromIndexedDB,
  type StoredPendingPwaOpenRequest,
} from '../../utils/fileHandleStorage';

describe('fileHandleStorage – klientscopet load af pending PWA-request', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    readClientScopedFileHandleValueResultMock.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('læser pending-requesten fra den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'client-isolated-pwa-session-1';
    const pendingRequest: StoredPendingPwaOpenRequest = {
      id: 'pwa-open-client-1',
      createdAtEpochMs: 1_700_000_000_000,
      fileHandle: { kind: 'file', name: 'sag.eo' } as unknown as FileSystemFileHandle,
      fileName: 'sag.eo',
      ignoredFileCount: 0,
    };

    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);
    readClientScopedFileHandleValueResultMock.mockResolvedValue({
      status: 'ok',
      value: pendingRequest,
    });

    await expect(loadPendingPwaOpenRequestFromIndexedDB()).resolves.toEqual({
      status: 'ok',
      value: pendingRequest,
    });

    expect(readClientScopedFileHandleValueResultMock).toHaveBeenCalledOnce();
    expect(readClientScopedFileHandleValueResultMock).toHaveBeenCalledWith(
      `client:${sessionId}:pending-pwa-open-request`,
      'loadPendingPwaOpenRequestFromIndexedDB',
    );
  });
});
