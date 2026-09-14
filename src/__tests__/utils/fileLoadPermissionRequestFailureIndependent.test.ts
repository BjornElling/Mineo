// @vitest-environment jsdom

import { FileHandleAccessError } from '../../utils/fileSystemAccess';
import { loadFromFileHandle } from '../../utils/fileLoad';
import { logError, logWarning } from '../../utils/logger';

vi.mock('../../utils/fileHelpers', () => ({
  selectFile: vi.fn(),
  readFile: vi.fn(),
  getStartInValue: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const logWarningMock = vi.mocked(logWarning);
const logErrorMock = vi.mocked(logError);

describe('PERSIST-002 – PWA permission-request-fejl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('mapper requestPermission-rejection til dansk adgangsfejl før fil-læsning', async () => {
    const getFile = vi.fn();
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockRejectedValue(
      new DOMException('Brugerhandling kræves', 'NotAllowedError'),
    );
    const fileHandle = {
      getFile,
      queryPermission,
      requestPermission,
    } as unknown as FileSystemFileHandle;

    const loadPromise = loadFromFileHandle(fileHandle, { requestId: 'req-request-failure' });

    await expect(loadPromise).rejects.toBeInstanceOf(FileHandleAccessError);
    await expect(loadPromise).rejects.toMatchObject({
      name: 'FileHandleAccessError',
      message: 'Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.',
    });

    expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(getFile).not.toHaveBeenCalled();
    expect(logWarningMock).toHaveBeenCalledWith(
      'Hent (handle) afvist af browseren',
      { context: 'loadFromFileHandle.permission', data: { name: 'NotAllowedError' } },
    );
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
