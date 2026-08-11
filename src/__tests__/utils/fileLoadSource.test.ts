// @vitest-environment jsdom
import {
  assertLoadableEoFile,
  createManualLoadSource,
  createPwaLoadSource,
} from '../../utils/fileLoadSource';
import {
  isFileSystemAccessSupported,
  openFileWithPicker,
  readFromFileHandle,
  ensureFileHandleReadPermission,
  FileHandleAccessError,
} from '../../utils/fileSystemAccess';
import { selectFile, readFile } from '../../utils/fileHelpers';
import { MAX_FILE_SIZE } from '../../config/version';
import { logWarning } from '../../utils/logger';

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

vi.mock('../../utils/fileSystemAccess', () => ({
  isFileSystemAccessSupported: vi.fn(),
  openFileWithPicker: vi.fn(),
  readFromFileHandle: vi.fn(),
  ensureFileHandleReadPermission: vi.fn(),
  FileHandleAccessError: class FileHandleAccessError extends Error {},
}));

vi.mock('../../utils/fileHelpers', () => ({
  selectFile: vi.fn(),
  readFile: vi.fn(),
  getStartInValue: vi.fn(() => 'desktop'),
}));

const mockedIsFileSystemAccessSupported = vi.mocked(isFileSystemAccessSupported);
const mockedOpenFileWithPicker = vi.mocked(openFileWithPicker);
const mockedReadFromFileHandle = vi.mocked(readFromFileHandle);
const mockedEnsurePermission = vi.mocked(ensureFileHandleReadPermission);
const mockedSelectFile = vi.mocked(selectFile);
const mockedReadFile = vi.mocked(readFile);
const mockedLogWarning = vi.mocked(logWarning);

const makeFile = (name: string, size = 10): File => {
  const file = new File(['x'], name, { type: 'application/octet-stream' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

describe('assertLoadableEoFile', () => {
  it('accepterer en gyldig .eo-fil', () => {
    expect(() => assertLoadableEoFile(makeFile('sag.eo'))).not.toThrow();
  });

  it('afviser forkert filendelse', () => {
    expect(() => assertLoadableEoFile(makeFile('sag.txt'))).toThrow('ikke en .eo fil');
  });

  it('afviser en for stor fil', () => {
    expect(() => assertLoadableEoFile(makeFile('sag.eo', MAX_FILE_SIZE + 1))).toThrow('for stor');
  });
});

describe('createManualLoadSource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('File System Access: returnerer valgt fil + handle + read-back-reader', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    const file = makeFile('sag.eo');
    const handle = { name: 'sag.eo', getFile: vi.fn() } as unknown as FileSystemFileHandle;
    mockedOpenFileWithPicker.mockResolvedValue({ file, handle });
    mockedReadFromFileHandle.mockResolvedValue('bytes');

    const outcome = await createManualLoadSource().open();

    expect(outcome.status).toBe('selected');
    if (outcome.status !== 'selected') return;
    expect(outcome.source).toBe('manual');
    expect(outcome.file).toBe(file);
    expect(outcome.fileHandle).toBe(handle);
    await expect(outcome.readContent()).resolves.toBe('bytes');
    expect(mockedReadFromFileHandle).toHaveBeenCalledWith(handle);
  });

  it('File System Access: annullering giver cancelled', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedOpenFileWithPicker.mockResolvedValue(null);

    const outcome = await createManualLoadSource().open();

    expect(outcome).toEqual({ status: 'cancelled', source: 'manual' });
  });

  it('Fallback: bruger selectFile + readFile', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(false);
    const file = makeFile('sag.eo');
    mockedSelectFile.mockResolvedValue(file);
    mockedReadFile.mockResolvedValue('bytes');

    const outcome = await createManualLoadSource().open();

    expect(outcome.status).toBe('selected');
    if (outcome.status !== 'selected') return;
    expect(outcome.fileHandle).toBeUndefined();
    await expect(outcome.readContent()).resolves.toBe('bytes');
    expect(mockedReadFile).toHaveBeenCalledWith(file);
    expect(mockedLogWarning).not.toHaveBeenCalled();
  });

  it('Fallback: annullering giver cancelled', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(false);
    mockedSelectFile.mockResolvedValue(null);

    const outcome = await createManualLoadSource().open();

    expect(outcome).toEqual({ status: 'cancelled', source: 'manual' });
  });
});

describe('createPwaLoadSource', () => {
  beforeEach(() => vi.clearAllMocks());

  it('sikrer læse-tilladelse FØR filen åbnes og bærer requestId', async () => {
    const getFile = vi.fn().mockResolvedValue(makeFile('pwa.eo'));
    const handle = { name: 'pwa.eo', getFile } as unknown as FileSystemFileHandle;
    mockedEnsurePermission.mockResolvedValue(undefined);
    mockedReadFromFileHandle.mockResolvedValue('bytes');

    const outcome = await createPwaLoadSource(handle, 'req-1').open();

    expect(mockedEnsurePermission).toHaveBeenCalledWith(handle);
    expect(outcome.status).toBe('selected');
    if (outcome.status !== 'selected') return;
    expect(outcome.source).toBe('pwa');
    expect(outcome.requestId).toBe('req-1');
    expect(outcome.fileHandle).toBe(handle);
  });

  it('kaster (og åbner aldrig filen) hvis tilladelse mangler', async () => {
    const getFile = vi.fn();
    const handle = { name: 'pwa.eo', getFile } as unknown as FileSystemFileHandle;
    mockedEnsurePermission.mockRejectedValue(new FileHandleAccessError('nej'));

    await expect(createPwaLoadSource(handle).open()).rejects.toBeInstanceOf(FileHandleAccessError);
    expect(getFile).not.toHaveBeenCalled();
  });
});
