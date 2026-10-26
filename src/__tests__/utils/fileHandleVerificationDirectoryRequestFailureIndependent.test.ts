// @vitest-environment jsdom

import { logWarning } from '../../utils/logger';
import { verifyDirectoryHandle } from '../../utils/file/fileHandleVerification';

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
}));

type PermissionMethod = (descriptor?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>;

const logWarningMock = vi.mocked(logWarning);

describe('PERSIST-002 – directory permission-request-fejl', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returnerer false uden teknisk alarm ved afvist requestPermission', async () => {
    const queryPermission = vi.fn<PermissionMethod>().mockResolvedValue('prompt');
    const requestPermission = vi.fn<PermissionMethod>().mockRejectedValue(
      new DOMException('Brugerhandling kræves', 'NotAllowedError'),
    );
    const directoryHandle = {
      kind: 'directory',
      name: 'Sager',
      queryPermission,
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;

    await expect(
      verifyDirectoryHandle(directoryHandle, { mode: 'read', allowRequestPermission: true }),
    ).resolves.toBe(false);

    expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(logWarningMock).not.toHaveBeenCalled();
  });
});
