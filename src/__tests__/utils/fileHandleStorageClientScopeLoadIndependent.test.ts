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
import { loadFileHandleFromIndexedDB } from '../../utils/fileHandleStorage';

describe('fileHandleStorage – klientscopet load af file handle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    readClientScopedFileHandleValueResultMock.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('læser det aktive file handle fra den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'client-isolated-load-session-1';
    const fileHandle = {
      kind: 'file',
      name: 'sag.eo',
    } as unknown as FileSystemFileHandle;

    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);
    readClientScopedFileHandleValueResultMock.mockResolvedValue({
      status: 'ok',
      value: fileHandle,
    });

    await expect(loadFileHandleFromIndexedDB()).resolves.toBe(fileHandle);

    expect(readClientScopedFileHandleValueResultMock).toHaveBeenCalledOnce();
    expect(readClientScopedFileHandleValueResultMock).toHaveBeenCalledWith(
      `client:${sessionId}:current-file-handle`,
      'loadFileHandleFromIndexedDB',
    );
  });
});
