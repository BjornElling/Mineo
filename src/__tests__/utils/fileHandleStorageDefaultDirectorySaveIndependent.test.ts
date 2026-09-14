// @vitest-environment jsdom

const writeFileHandleValuesMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    writeFileHandleValues: (...args: unknown[]) => writeFileHandleValuesMock(...args),
  };
});

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

import { saveDefaultDirectoryHandle } from '../../utils/fileHandleStorage';

describe('PERSIST-002 – succesfuld standardmappe-lagring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'directory-id-1') });
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    writeFileHandleValuesMock.mockResolvedValue({ status: 'ok', value: undefined });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returnerer samme ID som det atomisk gemte standardmappegrundlag', async () => {
    const directoryHandle = {
      kind: 'directory',
      name: 'Sager',
    } as unknown as FileSystemDirectoryHandle;

    await expect(saveDefaultDirectoryHandle(directoryHandle)).resolves.toBe('directory-id-1');
    expect(writeFileHandleValuesMock).toHaveBeenCalledOnce();
    expect(writeFileHandleValuesMock).toHaveBeenCalledWith(
      {
        default_directory_handle: directoryHandle,
        default_directory_meta: {
          id: 'directory-id-1',
          displayName: 'Sager',
          savedAt: 1_700_000_000_000,
          source: 'user',
        },
      },
      'saveDefaultDirectoryHandle',
    );
  });
});
