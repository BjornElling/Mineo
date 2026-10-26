// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';

const deleteClientScopedFileHandleValueMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    deleteClientScopedFileHandleValue: (...args: unknown[]) =>
      deleteClientScopedFileHandleValueMock(...args),
  };
});

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  ensureFileOperationClientSession,
} from '../../utils/fileOperationClientSession';
import { deleteFileHandleFromIndexedDB } from '../../utils/fileHandleStorage';

let restoreLocks: () => void;

describe('fileHandleStorage – klientscopet delete af file handle', () => {
  beforeEach(() => {
    restoreLocks = installFileOperationLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    deleteClientScopedFileHandleValueMock.mockReset();
    deleteClientScopedFileHandleValueMock.mockResolvedValue({
      status: 'ok',
      value: undefined,
    });
  });

  afterEach(() => {
    restoreLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('sletter det aktive file handle under den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'owned:client-isolated-delete-session-1';
    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);
    await ensureFileOperationClientSession();

    await expect(deleteFileHandleFromIndexedDB()).resolves.toBe(true);

    expect(deleteClientScopedFileHandleValueMock).toHaveBeenCalledOnce();
    expect(deleteClientScopedFileHandleValueMock).toHaveBeenCalledWith(
      `client:${sessionId}:current-file-handle`,
      'deleteFileHandleFromIndexedDB',
    );
  });
});
