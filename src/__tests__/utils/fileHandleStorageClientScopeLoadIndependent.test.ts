// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';

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
  ensureFileOperationClientSession,
} from '../../utils/fileOperationClientSession';
import { loadFileHandleFromIndexedDB } from '../../utils/fileHandleStorage';

let restoreLocks: () => void;

describe('fileHandleStorage – klientscopet load af file handle', () => {
  beforeEach(() => {
    restoreLocks = installFileOperationLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    readClientScopedFileHandleValueResultMock.mockReset();
  });

  afterEach(() => {
    restoreLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('læser det aktive file handle fra den aktuelle klients session-scopede nøgle', async () => {
    const sessionId = 'owned:client-isolated-load-session-1';
    const fileHandle = {
      kind: 'file',
      name: 'sag.eo',
    } as unknown as FileSystemFileHandle;

    sessionStorage.setItem(getFileOperationClientSessionStorageKey(), sessionId);
    await ensureFileOperationClientSession();
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
