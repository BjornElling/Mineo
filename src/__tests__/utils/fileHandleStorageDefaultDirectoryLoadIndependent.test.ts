// @vitest-environment jsdom

const readDefaultDirectoryRegistrationMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readDefaultDirectoryRegistration: (...args: unknown[]) => readDefaultDirectoryRegistrationMock(...args),
  };
});

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
}));

import { loadDefaultDirectoryHandle } from '../../utils/fileHandleStorage';

describe('PERSIST-002 – succesfuld standardmappe-load', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bruger kun handle fra den registrering, som fanens indstilling peger på', async () => {
    const handle = { kind: 'directory', name: 'Sager' } as FileSystemDirectoryHandle;
    readDefaultDirectoryRegistrationMock.mockResolvedValue({
      handle,
      meta: { id: 'aktuel', displayName: 'Sager', savedAt: 100, source: 'user' },
    });

    await expect(loadDefaultDirectoryHandle('forældet')).resolves.toBeNull();
    await expect(loadDefaultDirectoryHandle('aktuel')).resolves.toBe(handle);
  });
});
