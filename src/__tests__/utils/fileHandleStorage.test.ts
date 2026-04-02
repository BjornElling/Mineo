import { verifyDirectoryHandle } from '../../utils/fileHandleStorage';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
}));

describe('verifyDirectoryHandle', () => {
  it('anmoder om permission når queryPermission returnerer prompt og det er tilladt', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const handle = {
      name: 'Sager',
      queryPermission,
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;

    const result = await verifyDirectoryHandle(handle, {
      mode: 'read',
      allowRequestPermission: true,
    });

    expect(result).toBe(true);
    expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
  });

  it('falder tilbage når permission fortsat ikke er granted efter request', async () => {
    const queryPermission = vi.fn().mockResolvedValue('prompt');
    const requestPermission = vi.fn().mockResolvedValue('denied');
    const handle = {
      name: 'Sager',
      queryPermission,
      requestPermission,
    } as unknown as FileSystemDirectoryHandle;

    const result = await verifyDirectoryHandle(handle, {
      mode: 'read',
      allowRequestPermission: true,
    });

    expect(result).toBe(false);
    expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
  });
});
