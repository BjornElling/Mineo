// @vitest-environment jsdom
import { loadFromFileHandle } from '../../utils/fileLoad';

const readFileMock = vi.fn();
const logWarningMock = vi.fn();
const logErrorMock = vi.fn();

vi.mock('../../utils/fileHelpers', () => ({
  selectFile: vi.fn(),
  readFile: (...args: unknown[]) => readFileMock(...args),
  getStartInValue: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: (...args: unknown[]) => logWarningMock(...args),
  logError: (...args: unknown[]) => logErrorMock(...args),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

describe('PERSIST-002 – PWA-filhandle med SecurityError', () => {
  it('mapper browserens SecurityError til en handlingsanvisende adgangsfejl før fil-læsning', async () => {
    const getFile = vi.fn().mockRejectedValue(new DOMException('Adgang nægtet', 'SecurityError'));
    const handle = {
      getFile,
      queryPermission: vi.fn().mockResolvedValue('granted'),
    } as unknown as FileSystemFileHandle;

    await expect(loadFromFileHandle(handle, { requestId: 'req-security' })).rejects.toMatchObject({
      name: 'FileHandleAccessError',
      message: 'Adgang til filen er ikke længere tilladt. Vælg filen igen via Hent.',
    });

    expect(getFile).toHaveBeenCalledOnce();
    expect(readFileMock).not.toHaveBeenCalled();
    expect(logWarningMock).toHaveBeenCalledWith(
      'Hent (handle) afvist af browseren',
      { context: 'loadFromFileHandle.permission', data: { name: 'SecurityError' } },
    );
    expect(logErrorMock).not.toHaveBeenCalled();
  });
});
