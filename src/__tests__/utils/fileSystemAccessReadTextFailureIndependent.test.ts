// @vitest-environment jsdom

import { logError } from '../../utils/logger';
import { readFromFileHandle } from '../../utils/fileSystemAccess';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const logErrorMock = vi.mocked(logError);

describe('PERSIST-002 – File System Access text-read-fejl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('oversætter fejl fra file.text og logger den oprindelige fejl', async () => {
    const text = vi.fn().mockRejectedValue(new Error('tekstlæsning fejlede'));
    const getFile = vi.fn().mockResolvedValue({ text });
    const fileHandle = { getFile } as unknown as FileSystemFileHandle;

    await expect(readFromFileHandle(fileHandle)).rejects.toThrow(
      'Kunne ikke læse fil: tekstlæsning fejlede',
    );

    expect(getFile).toHaveBeenCalledOnce();
    expect(text).toHaveBeenCalledOnce();
    expect(logErrorMock).toHaveBeenCalledWith(
      'Fejl ved læsning fra fil:',
      expect.objectContaining({ message: 'tekstlæsning fejlede' }),
    );
  });
});
