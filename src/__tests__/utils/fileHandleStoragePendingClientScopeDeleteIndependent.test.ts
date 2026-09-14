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
import { deletePendingPwaOpenRequestFromIndexedDB } from '../../utils/fileHandleStorage';

describe('fileHandleStorage – klientscopet delete af pending PWA-request', () => {
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

  it('sletter pending-requesten under den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'client-isolated-pwa-delete-session-1';
    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);

    await expect(deletePendingPwaOpenRequestFromIndexedDB()).resolves.toBe(true);

    expect(deleteClientScopedFileHandleValueMock).toHaveBeenCalledOnce();
    expect(deleteClientScopedFileHandleValueMock).toHaveBeenCalledWith(
      `client:${sessionId}:pending-pwa-open-request`,
      'deletePendingPwaOpenRequestFromIndexedDB',
    );
  });
});
