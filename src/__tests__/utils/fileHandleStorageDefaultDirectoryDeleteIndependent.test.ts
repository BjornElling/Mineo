// @vitest-environment jsdom

const deleteFileHandleValuesMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    deleteFileHandleValues: (...args: unknown[]) => deleteFileHandleValuesMock(...args),
  };
});

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

import { deleteDefaultDirectoryHandle } from '../../utils/fileHandleStorage';

describe('PERSIST-002 – succesfuld standardmappe-sletning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteFileHandleValuesMock.mockResolvedValue({ status: 'ok', value: undefined });
  });

  it('returnerer true efter atomisk sletning af handle og metadata', async () => {
    await expect(deleteDefaultDirectoryHandle()).resolves.toBe(true);
    expect(deleteFileHandleValuesMock).toHaveBeenCalledOnce();
    expect(deleteFileHandleValuesMock).toHaveBeenCalledWith(
      ['default_directory_handle', 'default_directory_meta'],
      'deleteDefaultDirectoryHandle',
    );
  });
});
