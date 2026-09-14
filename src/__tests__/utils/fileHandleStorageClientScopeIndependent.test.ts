// @vitest-environment jsdom

const writeClientScopedFileHandleValueMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    writeClientScopedFileHandleValue: (...args: unknown[]) => writeClientScopedFileHandleValueMock(...args),
  };
});

import {
  __resetFileOperationClientSessionForTests,
} from '../../utils/fileOperationClientSession';
import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import { saveFileHandleToIndexedDB } from '../../utils/fileHandleStorage';

describe('fileHandleStorage – klientscopet file handle', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    writeClientScopedFileHandleValueMock.mockReset();
    writeClientScopedFileHandleValueMock.mockResolvedValue({ status: 'ok', value: undefined });
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('skriver det aktive file handle under den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'client-isolated-session-1';
    const fileHandle = {
      kind: 'file',
      name: 'sag.eo',
    } as unknown as FileSystemFileHandle;

    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);

    await expect(saveFileHandleToIndexedDB(fileHandle)).resolves.toBe(true);

    expect(writeClientScopedFileHandleValueMock).toHaveBeenCalledWith(
      `client:${sessionId}:current-file-handle`,
      fileHandle,
      'saveFileHandleToIndexedDB',
    );
  });
});
