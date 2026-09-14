// @vitest-environment jsdom
import { resolveSaveTarget } from '../../utils/fileSaveTarget';
import {
  isFileSystemAccessSupported,
  isFileSystemFileHandle,
  saveFileWithPicker,
} from '../../utils/fileSystemAccess';
import {
  requestPersistentStorage,
  loadFileHandleFromIndexedDB,
  verifyFileHandleDetailed,
  deleteFileHandleFromIndexedDB,
} from '../../utils/fileHandleStorage';
import type { EoFileContainer } from '../../schemas/eoFileSchema';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';

vi.mock('../../utils/fileSystemAccess', () => ({
  isFileSystemAccessSupported: vi.fn(),
  isFileSystemFileHandle: vi.fn(),
  saveFileWithPicker: vi.fn(),
}));

vi.mock('../../utils/fileHandleStorage', () => ({
  requestPersistentStorage: vi.fn(),
  loadFileHandleFromIndexedDB: vi.fn(),
  verifyFileHandleDetailed: vi.fn(),
  deleteFileHandleFromIndexedDB: vi.fn(),
}));

vi.mock('../../utils/fileHelpers', () => ({
  generateFilename: vi.fn(() => 'foreslaaet-navn'),
  getStartInValue: vi.fn(() => 'desktop'),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  getTimestamp: () => '2026-09-14T12:34:56.789Z',
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

const mockedIsFileSystemAccessSupported = vi.mocked(isFileSystemAccessSupported);
const mockedIsFileSystemFileHandle = vi.mocked(isFileSystemFileHandle);
const mockedSaveFileWithPicker = vi.mocked(saveFileWithPicker);
const mockedRequestPersistentStorage = vi.mocked(requestPersistentStorage);
const mockedLoadFileHandleFromIndexedDB = vi.mocked(loadFileHandleFromIndexedDB);
const mockedVerifyFileHandleDetailed = vi.mocked(verifyFileHandleDetailed);
const mockedDeleteFileHandleFromIndexedDB = vi.mocked(deleteFileHandleFromIndexedDB);

const fileData = {
  data: { stamdata: { journalnr: 'J-1' } },
} as unknown as EoFileContainer;

const makeHandle = (name: string): FileSystemFileHandle =>
  ({ name, getFile: vi.fn(), createWritable: vi.fn() }) as unknown as FileSystemFileHandle;

describe('resolveSaveTarget – permission API-fejl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedRequestPersistentStorage.mockResolvedValue(true);
    mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(true);
    mockedIsFileSystemFileHandle.mockImplementation(
      (value): value is FileSystemFileHandle =>
        Boolean(value) &&
        typeof value === 'object' &&
        typeof (value as FileSystemFileHandle).getFile === 'function'
    );
  });

  it('falder tilbage til picker med præcis adgangsfejl, når permission-API-et fejler', async () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const storedHandle = makeHandle('eksisterende.eo');
    const pickedHandle = makeHandle('ny.eo');
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(storedHandle);
    mockedVerifyFileHandleDetailed.mockResolvedValue({
      valid: false,
      reason: 'permission_api_failed',
      detail: 'queryPermission threw',
    });
    mockedSaveFileWithPicker.mockResolvedValue(pickedHandle);

    const target = await resolveSaveTarget(fileData);

    expect(mockedVerifyFileHandleDetailed).toHaveBeenCalledWith(storedHandle, {
      allowRequestPermission: true,
    });
    expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledOnce();
    expect(mockedSaveFileWithPicker).toHaveBeenCalledWith('eksisterende.eo', 'desktop');
    expect(target).toEqual({
      kind: 'fileHandle',
      fileHandle: pickedHandle,
      persistHandleAfterSuccess: true,
      fallbackWarning:
        'Mineo kunne ikke bekræfte adgangen til den tidligere valgte fil og kunne derfor ikke overskrive den automatisk. Vælg filplacering igen.',
    });
  });
});
