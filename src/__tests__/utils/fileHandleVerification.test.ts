// @vitest-environment jsdom
import { logWarning } from '../../utils/logger';
import {
  verifyDirectoryHandle,
  verifyFileHandleDetailed,
} from '../../utils/file/fileHandleVerification';

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
}));

type PermissionDescriptor = { mode?: 'read' | 'readwrite' };
type PermissionMethod = (descriptor?: PermissionDescriptor) => Promise<PermissionState>;
type GetFileMethod = () => Promise<File>;
type PermissionMock = ReturnType<typeof vi.fn<PermissionMethod>>;
type GetFileMock = ReturnType<typeof vi.fn<GetFileMethod>>;

type FileHandleOptions = Readonly<{
  queryPermission?: PermissionMock;
  requestPermission?: PermissionMock;
  getFile?: GetFileMock;
}>;

type DirectoryHandleOptions = Readonly<{
  queryPermission?: PermissionMock;
  requestPermission?: PermissionMock;
}>;

const createPermissionMock = (permission: PermissionState): PermissionMock =>
  vi.fn<PermissionMethod>().mockResolvedValue(permission);

const createFileHandle = (options: FileHandleOptions = {}): FileSystemFileHandle => ({
  kind: 'file',
  name: 'sag.eo',
  getFile: options.getFile ?? vi.fn<GetFileMethod>().mockResolvedValue(new File([], 'sag.eo')),
  ...(options.queryPermission ? { queryPermission: options.queryPermission } : {}),
  ...(options.requestPermission ? { requestPermission: options.requestPermission } : {}),
} as unknown as FileSystemFileHandle);

const createDirectoryHandle = (options: DirectoryHandleOptions = {}): FileSystemDirectoryHandle => ({
  kind: 'directory',
  name: 'Sager',
  queryPermission: options.queryPermission ?? createPermissionMock('granted'),
  ...(options.requestPermission ? { requestPermission: options.requestPermission } : {}),
} as unknown as FileSystemDirectoryHandle);

const namedError = (name: string, message: string): Error => Object.assign(new Error(message), { name });

describe('fileHandleVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyFileHandleDetailed', () => {
    it.each([null, undefined])('returnerer missing_handle når handle er %s', async (handle) => {
      await expect(verifyFileHandleDetailed(handle)).resolves.toEqual({
        valid: false,
        reason: 'missing_handle',
      });
    });

    it('returnerer missing_permission_api når handle mangler queryPermission', async () => {
      const handle = { name: 'sag.eo' } as unknown as FileSystemFileHandle;

      await expect(verifyFileHandleDetailed(handle)).resolves.toEqual({
        valid: false,
        reason: 'missing_permission_api',
      });
    });

    it('returnerer valid når write-tilladelsen er granted og filen kan hentes', async () => {
      const queryPermission = createPermissionMock('granted');
      const getFile = vi.fn<GetFileMethod>().mockResolvedValue(new File([], 'sag.eo'));
      const handle = createFileHandle({ queryPermission, getFile });

      await expect(verifyFileHandleDetailed(handle)).resolves.toEqual({ valid: true });
      expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(getFile).toHaveBeenCalledOnce();
    });

    it('returnerer permission_denied uden filadgang når permission ikke er granted', async () => {
      const queryPermission = createPermissionMock('denied');
      const getFile = vi.fn<GetFileMethod>();
      const handle = createFileHandle({ queryPermission, getFile });

      await expect(verifyFileHandleDetailed(handle, { allowRequestPermission: true })).resolves.toEqual({
        valid: false,
        reason: 'permission_denied',
        detail: 'permission=denied',
      });
      expect(getFile).not.toHaveBeenCalled();
    });

    it('anmoder om write-tilladelse og validerer filen når det er tilladt', async () => {
      const queryPermission = createPermissionMock('prompt');
      const requestPermission = createPermissionMock('granted');
      const getFile = vi.fn<GetFileMethod>().mockResolvedValue(new File([], 'sag.eo'));
      const handle = createFileHandle({ queryPermission, requestPermission, getFile });

      await expect(verifyFileHandleDetailed(handle, { allowRequestPermission: true })).resolves.toEqual({
        valid: true,
      });
      expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(getFile).toHaveBeenCalledOnce();
    });

    it('returnerer not_found når filen ikke længere findes', async () => {
      const queryPermission = createPermissionMock('granted');
      const getFile = vi.fn<GetFileMethod>().mockRejectedValue(
        namedError('NotFoundError', 'Filen findes ikke længere'),
      );
      const handle = createFileHandle({ queryPermission, getFile });

      await expect(verifyFileHandleDetailed(handle)).resolves.toEqual({
        valid: false,
        reason: 'not_found',
        detail: 'Filen findes ikke længere',
      });
      expect(logWarning).toHaveBeenCalledWith(
        'Fil blev ikke fundet - er sandsynligvis blevet slettet eller flyttet',
      );
    });

    it('returnerer permission_denied ved NotAllowedError', async () => {
      const queryPermission = vi.fn<PermissionMethod>().mockRejectedValue(
        namedError('NotAllowedError', 'Adgang afvist'),
      );
      const handle = createFileHandle({ queryPermission });

      await expect(verifyFileHandleDetailed(handle)).resolves.toEqual({
        valid: false,
        reason: 'permission_denied',
        detail: 'Adgang afvist',
      });
    });

    it.each([
      [new Error('Ukendt fejl'), 'Ukendt fejl'],
      [{ name: 'UkendtFejl', message: 'Ukendt objektfejl' }, 'Ukendt objektfejl'],
      ['Ukendt primitivfejl', undefined],
    ] as const)('returnerer permission_api_failed ved ukendt fejl %o', async (error, detail) => {
      const queryPermission = vi.fn<PermissionMethod>().mockRejectedValue(error);
      const handle = createFileHandle({ queryPermission });

      const result = await verifyFileHandleDetailed(handle);

      expect(result).toMatchObject({
        valid: false,
        reason: 'permission_api_failed',
      });
      if (result.valid) throw new Error('Forventede et fejlagtigt verifikationsresultat');
      expect(result.detail).toBe(detail);
      expect(logWarning).toHaveBeenCalledWith(
        'Permission API eller file handle-validering fejlede',
        expect.objectContaining({
          context: 'verifyFileHandle.permissionCheck',
        }),
      );
    });

    it('returnerer validation_failed når handle-inspektionen kaster', async () => {
      const handle = Object.create(null) as FileSystemFileHandle;
      Object.defineProperty(handle, 'queryPermission', {
        configurable: true,
        get: () => {
          throw new Error('Handle-inspektion fejlede');
        },
      });

      await expect(verifyFileHandleDetailed(handle)).resolves.toEqual({
        valid: false,
        reason: 'validation_failed',
        detail: 'Handle-inspektion fejlede',
      });
      expect(logWarning).toHaveBeenCalledWith(
        'File handle validering fejlede',
        expect.objectContaining({ context: 'verifyFileHandle' }),
      );
    });
  });

  describe('verifyDirectoryHandle', () => {
    it.each([
      ['handle mangler', null],
      ['queryPermission mangler', {}],
    ] as const)('returnerer false når %s', async (_beskrivelse, handle) => {
      await expect(
        verifyDirectoryHandle(handle as unknown as FileSystemDirectoryHandle),
      ).resolves.toBe(false);
    });

    it('returnerer true ved granted og bruger den angivne mode', async () => {
      const queryPermission = createPermissionMock('granted');
      const handle = createDirectoryHandle({ queryPermission });

      await expect(verifyDirectoryHandle(handle, { mode: 'readwrite' })).resolves.toBe(true);
      expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    });

    it('returnerer false ved denied uden requestPermission', async () => {
      const queryPermission = createPermissionMock('denied');
      const handle = createDirectoryHandle({ queryPermission });

      await expect(
        verifyDirectoryHandle(handle, { allowRequestPermission: true }),
      ).resolves.toBe(false);
    });

    it('anmoder om directory permission når det er tilladt', async () => {
      const queryPermission = createPermissionMock('prompt');
      const requestPermission = createPermissionMock('granted');
      const handle = createDirectoryHandle({ queryPermission, requestPermission });

      await expect(
        verifyDirectoryHandle(handle, { mode: 'read', allowRequestPermission: true }),
      ).resolves.toBe(true);
      expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
      expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    });

    it.each([
      namedError('NotFoundError', 'Mappen findes ikke længere'),
      namedError('NotAllowedError', 'Adgang til mappen blev afvist'),
      { name: 'UkendtFejl', message: 'Ukendt directory-fejl' },
      'Ukendt primitivfejl',
    ] as const)('returnerer false og logger ved permission-fejlen %o', async (error) => {
      const queryPermission = vi.fn<PermissionMethod>().mockRejectedValue(error);
      const handle = createDirectoryHandle({ queryPermission });

      await expect(verifyDirectoryHandle(handle)).resolves.toBe(false);
      expect(logWarning).toHaveBeenCalledWith(
        'Directory permission tjek fejlede',
        expect.objectContaining({
          context: 'verifyDirectoryHandle.permissionCheck',
        }),
      );
    });

    it('returnerer false når directory-handle-inspektionen kaster', async () => {
      const handle = Object.create(null) as FileSystemDirectoryHandle;
      Object.defineProperty(handle, 'queryPermission', {
        configurable: true,
        get: () => {
          throw new Error('Directory-inspektion fejlede');
        },
      });

      await expect(verifyDirectoryHandle(handle)).resolves.toBe(false);
      expect(logWarning).toHaveBeenCalledWith(
        'Directory handle validering fejlede',
        expect.objectContaining({ context: 'verifyDirectoryHandle' }),
      );
    });
  });
});
