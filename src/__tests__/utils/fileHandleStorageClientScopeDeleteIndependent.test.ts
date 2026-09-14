// @vitest-environment jsdom

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
} from '../../utils/fileOperationClientSession';
import { deleteFileHandleFromIndexedDB } from '../../utils/fileHandleStorage';

describe('fileHandleStorage – klientscopet delete af file handle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    deleteClientScopedFileHandleValueMock.mockReset();
    deleteClientScopedFileHandleValueMock.mockResolvedValue({
      status: 'ok',
      value: undefined,
    });
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('sletter det aktive file handle under den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'client-isolated-delete-session-1';
    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);

    await expect(deleteFileHandleFromIndexedDB()).resolves.toBe(true);

    expect(deleteClientScopedFileHandleValueMock).toHaveBeenCalledOnce();
    expect(deleteClientScopedFileHandleValueMock).toHaveBeenCalledWith(
      `client:${sessionId}:current-file-handle`,
      'deleteFileHandleFromIndexedDB',
    );
  });
});
