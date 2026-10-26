// @vitest-environment jsdom

import { logError } from '../../utils/logger';
import { writeToFileHandle } from '../../utils/fileSystemAccess';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const logErrorMock = vi.mocked(logError);

describe('PERSIST-002 – File System Access write-fejl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('oversætter write-fejl, logger payload og undlader close efter delvist write', async () => {
    const write = vi.fn().mockRejectedValue(new Error('writable write fejlede'));
    const close = vi.fn().mockResolvedValue(undefined);
    const abort = vi.fn().mockResolvedValue(undefined);
    const createWritable = vi.fn().mockResolvedValue({ write, close, abort });
    const fileHandle = { createWritable } as unknown as FileSystemFileHandle;

    await expect(writeToFileHandle(fileHandle, 'krypteret indhold')).rejects.toThrow(
      'Kunne ikke skrive fil: writable write fejlede',
    );

    expect(createWritable).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith('krypteret indhold');
    expect(close).not.toHaveBeenCalled();
    expect(abort).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith(
      'Fejl ved skrivning til fil:',
      expect.objectContaining({ message: 'writable write fejlede' }),
    );
  });

  it('bevarer skrivefejlen selv om oprydning også fejler', async () => {
    const abort = vi.fn().mockRejectedValue(new Error('Streamen er allerede fejlet'));
    const fileHandle = {
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn().mockRejectedValue(new Error('Den oprindelige skrivefejl')),
        abort,
      }),
    } as unknown as FileSystemFileHandle;

    await expect(writeToFileHandle(fileHandle, 'indhold')).rejects.toThrow('Den oprindelige skrivefejl');
    expect(abort).toHaveBeenCalledOnce();
  });
});
