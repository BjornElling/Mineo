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
import { logWarning } from '../../utils/logger';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

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

const mockedIsFileSystemAccessSupported = vi.mocked(isFileSystemAccessSupported);
const mockedIsFileSystemFileHandle = vi.mocked(isFileSystemFileHandle);
const mockedSaveFileWithPicker = vi.mocked(saveFileWithPicker);
const mockedRequestPersistentStorage = vi.mocked(requestPersistentStorage);
const mockedLoadFileHandleFromIndexedDB = vi.mocked(loadFileHandleFromIndexedDB);
const mockedVerifyFileHandleDetailed = vi.mocked(verifyFileHandleDetailed);
const mockedDeleteFileHandleFromIndexedDB = vi.mocked(deleteFileHandleFromIndexedDB);
const mockedLogWarning = vi.mocked(logWarning);

const fileData = {
  data: { stamdata: { journalnr: 'J-1' } },
} as unknown as EoFileContainer;

const makeHandle = (name: string): FileSystemFileHandle =>
  ({ name, getFile: vi.fn(), createWritable: vi.fn() }) as unknown as FileSystemFileHandle;

describe('resolveSaveTarget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedRequestPersistentStorage.mockResolvedValue(true);
    mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(true);
    mockedIsFileSystemFileHandle.mockImplementation(
      (value): value is FileSystemFileHandle =>
        Boolean(value) &&
        typeof value === 'object' &&
        typeof (value as FileSystemFileHandle).getFile === 'function'
    );
  });

  it('falder tilbage til download-mål når File System Access ikke er understøttet', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(false);

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'download', filename: 'foreslaaet-navn.eo' });
    expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
    expect(mockedLogWarning).not.toHaveBeenCalled();
  });

  it('genbruger et gyldigt persisteret handle uden at persistere det igen', async () => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const handle = makeHandle('eksisterende.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(handle);
    mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'fileHandle', fileHandle: handle, persistHandleAfterSuccess: false });
    expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
  });

  it.each([
    ['manglende', null],
    ['korrupt', '{ikke-json'],
  ])('genbruger ikke et gammelt handle når filnavnsbasis er %s', async (_description, storedBasis) => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    if (storedBasis !== null) {
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, storedBasis);
    }
    const stored = makeHandle('eksisterende.eo');
    const picked = makeHandle('ny.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
    mockedSaveFileWithPicker.mockResolvedValue(picked);

    const target = await resolveSaveTarget(fileData);

    expect(mockedVerifyFileHandleDetailed).not.toHaveBeenCalled();
    expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledOnce();
    expect(target).toEqual({
      kind: 'fileHandle',
      fileHandle: picked,
      persistHandleAfterSuccess: true,
    });
  });

  it('annullerer stille når brugeren afviser tilladelses-prompten på et gemt handle', async () => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const handle = makeHandle('eksisterende.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(handle);
    mockedVerifyFileHandleDetailed.mockResolvedValue({
      valid: false,
      reason: 'permission_denied',
      detail: 'permission=prompt',
    });

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'cancelled' });
    expect(mockedDeleteFileHandleFromIndexedDB).not.toHaveBeenCalled();
    expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
  });

  it('kasserer et ubrugeligt handle, åbner picker og bærer en advarsel + persist-flag', async () => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const stored = makeHandle('eksisterende.eo');
    const picked = makeHandle('ny.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
    mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: false, reason: 'not_found' });
    mockedSaveFileWithPicker.mockResolvedValue(picked);

    const target = await resolveSaveTarget(fileData);

    expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledTimes(1);
    expect(target).toMatchObject({
      kind: 'fileHandle',
      fileHandle: picked,
      persistHandleAfterSuccess: true,
    });
    if (target.kind !== 'fileHandle') return;
    expect(target.fallbackWarning).toContain('ikke fundet');
  });

  it('afbryder fail-closed, hvis et ubrugeligt handle ikke kan ryddes', async () => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const stored = makeHandle('eksisterende.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
    mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: false, reason: 'not_found' });
    mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(false);

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'cancelled' });
    expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
    expect(mockedLogWarning).toHaveBeenCalledWith(
      'Gammelt file handle kunne ikke ryddes sikkert; gemning afbrudt',
      expect.objectContaining({ context: 'resolveSaveTarget.failedToInvalidateStoredHandle' })
    );
  });

  it('annullerer når brugeren lukker file-pickeren', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(null);
    mockedSaveFileWithPicker.mockResolvedValue(null);

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'cancelled' });
  });
});
