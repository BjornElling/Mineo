// @vitest-environment jsdom

const readFileHandleValueMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readFileHandleValue: (...args: unknown[]) => readFileHandleValueMock(...args),
  };
});

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

import { loadDefaultDirectoryHandle } from '../../utils/fileHandleStorage';

describe('PERSIST-002 – succesfuld standardmappe-load', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returnerer handle-værdien fra den navngivne standardmappe-nøgle', async () => {
    const directoryHandle = {
      kind: 'directory',
      name: 'Sager',
    } as unknown as FileSystemDirectoryHandle;
    readFileHandleValueMock.mockResolvedValue(directoryHandle);

    await expect(loadDefaultDirectoryHandle()).resolves.toBe(directoryHandle);
    expect(readFileHandleValueMock).toHaveBeenCalledOnce();
    expect(readFileHandleValueMock).toHaveBeenCalledWith(
      'default_directory_handle',
      'loadDefaultDirectoryHandle',
    );
  });
});
