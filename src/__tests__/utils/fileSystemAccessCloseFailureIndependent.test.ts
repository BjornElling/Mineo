// @vitest-environment jsdom

import { logError } from '../../utils/logger';
import { writeToFileHandle } from '../../utils/fileSystemAccess';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const logErrorMock = vi.mocked(logError);

describe('PERSIST-002 – File System Access close-fejl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('oversætter close-fejl efter write og logger den oprindelige fejl', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn().mockRejectedValue(new Error('writable close fejlede'));
    const createWritable = vi.fn().mockResolvedValue({ write, close });
    const fileHandle = { createWritable } as unknown as FileSystemFileHandle;

    await expect(writeToFileHandle(fileHandle, 'krypteret indhold')).rejects.toThrow(
      'Kunne ikke skrive fil: writable close fejlede',
    );

    expect(createWritable).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith('krypteret indhold');
    expect(close).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith(
      'Fejl ved skrivning til fil:',
      expect.objectContaining({ message: 'writable close fejlede' }),
    );
  });
});
