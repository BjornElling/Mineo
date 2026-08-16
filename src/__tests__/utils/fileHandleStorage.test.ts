const { readFileHandleValueResultMock } = vi.hoisted(() => ({
  readFileHandleValueResultMock: vi.fn(),
}));

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readFileHandleValueResult: (...args: unknown[]) => readFileHandleValueResultMock(...args),
  };
});

import { getDirectoryDisplayInfo, verifyDirectoryHandle } from '../../utils/fileHandleStorage';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

describe('verifyDirectoryHandle', () => {
  it('anmoder om permission når queryPermission returnerer prompt og det er tilladt', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = {
      name: 'Sager',
      queryPermission,
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;

    const result = await verifyDirectoryHandle(handle, {
      mode: 'read',
      allowRequestPermission: true,
    });

    expect(result).toBe(true);
    expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
  });

  it('falder tilbage når permission fortsat ikke er granted efter request', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('denied');
    const handle = {
      name: 'Sager',
      queryPermission,
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;

    const result = await verifyDirectoryHandle(handle, {
      mode: 'read',
      allowRequestPermission: true,
    });

    expect(result).toBe(false);
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
  });
});

describe('getDirectoryDisplayInfo', () => {
  beforeEach(() => {
    readFileHandleValueResultMock.mockReset();
  });

  it('returnerer kun schema-validerede metadata', async () => {
    readFileHandleValueResultMock.mockResolvedValue({
      status: 'ok',
      value: {
        id: 'directory-1',
        displayName: 'Sager',
        savedAt: 1_700_000_000_000,
        source: 'user',
      },
    });

    await expect(getDirectoryDisplayInfo()).resolves.toEqual({
      id: 'directory-1',
      displayName: 'Sager',
      savedAt: 1_700_000_000_000,
      source: 'user',
    });
  });

  it('afviser korrupte eller udvidede metadata uden at logge eller reparere storage', async () => {
    readFileHandleValueResultMock.mockResolvedValue({
      status: 'ok',
      value: {
        id: 'directory-1',
        displayName: 'Sager',
        savedAt: Number.NaN,
        source: 'user',
        fremmedFelt: true,
      },
    });

    await expect(getDirectoryDisplayInfo()).resolves.toBeNull();
    expect(readFileHandleValueResultMock).toHaveBeenCalledWith(
      'default_directory_meta',
      'getDirectoryDisplayInfo',
      { silent: true },
    );
  });
});
