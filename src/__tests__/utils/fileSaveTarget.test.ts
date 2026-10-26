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
import { readFileContentFingerprint, readSavedFileContentFingerprint } from '../../utils/fileContentFingerprint';

vi.mock('../../utils/fileContentFingerprint', () => ({
  readFileContentFingerprint: vi.fn().mockResolvedValue('fingerprint'),
  readSavedFileContentFingerprint: vi.fn(() => 'fingerprint'),
  createFileContentFingerprint: vi.fn().mockResolvedValue('fingerprint'),
}));

vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

vi.mock('../../utils/fileSystemAccess', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/fileSystemAccess')>(),
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
    vi.mocked(readFileContentFingerprint).mockResolvedValue('fingerprint');
    vi.mocked(readSavedFileContentFingerprint).mockReturnValue('fingerprint');
    mockedRequestPersistentStorage.mockResolvedValue(true);
    mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(true);
    mockedIsFileSystemFileHandle.mockImplementation(
      (value): value is FileSystemFileHandle =>
        Boolean(value) &&
        typeof value === 'object' &&
        typeof (value as FileSystemFileHandle).getFile === 'function'
    );
  });

  it('gemmer download-fallback uden tidsstempel og forklarer den næste Hent', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(false);

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({
      kind: 'download',
      filename: 'foreslaaet-navn.eo',
      fallbackWarning: expect.stringContaining('Vælg denne nyeste fil næste gang du bruger Hent.'),
    });
    expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
    expect(mockedLogWarning).not.toHaveBeenCalled();
  });

  it('bruger sagens navneoplysninger ved download, selv om et tidligere filnavn er gemt', async () => {
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'tidligere.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(false);

    expect(await resolveSaveTarget(fileData)).toMatchObject({
      kind: 'download',
      filename: 'foreslaaet-navn.eo',
    });
  });

  it('genbruger et gyldigt persisteret handle uden at persistere det igen', async () => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const handle = makeHandle('eksisterende.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(handle);
    mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'fileHandle', fileHandle: handle, persistHandleAfterSuccess: false, expectedFingerprint: 'fingerprint' });
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
      expectedFingerprint: 'fingerprint',
    });
  });

  it('rydder et forældreløst filhandle uden sessionStorage-filnavn før filvælgerforløbet', async () => {
    const orphaned = makeHandle('ukendt.eo');
    const picked = makeHandle('ny.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(orphaned);
    mockedSaveFileWithPicker.mockResolvedValue(picked);

    const target = await resolveSaveTarget(fileData);

    expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledOnce();
    expect(mockedVerifyFileHandleDetailed).not.toHaveBeenCalled();
    expect(mockedSaveFileWithPicker).toHaveBeenCalledWith('foreslaaet-navn.eo', 'desktop');
    expect(target).toEqual({
      kind: 'fileHandle',
      fileHandle: picked,
      persistHandleAfterSuccess: true,
      expectedFingerprint: 'fingerprint',
    });
  });

  it('afbryder fail-closed, hvis et forældreløst filhandle ikke kan ryddes', async () => {
    const orphaned = makeHandle('ukendt.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(orphaned);
    mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(false);

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'cancelled' });
    expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
    expect(mockedLogWarning).toHaveBeenCalledWith(
      'Ukendt file handle kunne ikke ryddes sikkert; gemning afbrudt',
      expect.objectContaining({ context: 'resolveSaveTarget.orphanedStoredHandle' }),
    );
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
      expectedFingerprint: 'fingerprint',
    });
    if (target.kind !== 'fileHandle') return;
    expect(target.fallbackWarning).toContain('ikke fundet');
    expect(mockedLogWarning).not.toHaveBeenCalled();
  });

  it.each([
    ['permission_denied', 'Mineo har ikke længere adgang til den tidligere valgte fil'],
    ['validation_failed', 'Den tidligere valgte fil kunne ikke bruges til automatisk overskrivning'],
    ['missing_handle', 'Der var ikke længere en gemt filreference til automatisk overskrivning'],
  ] as const)('viser den konkrete fallback-advarsel ved %s', async (reason, expectedWarning) => {
    sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
    sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
    const stored = makeHandle('eksisterende.eo');
    const picked = makeHandle('ny.eo');
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
    mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: false, reason });
    mockedSaveFileWithPicker.mockResolvedValue(picked);

    const target = await resolveSaveTarget(fileData);

    expect(target).toMatchObject({
      kind: 'fileHandle',
      fileHandle: picked,
      persistHandleAfterSuccess: true,
      expectedFingerprint: 'fingerprint',
      fallbackWarning: expect.stringContaining(expectedWarning),
    });
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

  /**
   * BB-049: `Gem` skrev den ene sag ind i den anden sags fil, når Mineo var åben i to faner.
   *
   * Mekanismen er en rækkevidde-forskel: sagsdata og `lastSavedFilename` ligger i sessionStorage
   * (fanens eget), mens filhåndtaget ligger i IndexedDB (fælles for hele browseren) og derfor altid
   * peger på den SIDST rørte fil. Fane A's stamdatagrundlag er uændret, og håndtaget er gyldigt – så
   * begge de dengang eksisterende betingelser var opfyldt, og håndtaget blev genbrugt tavst.
   *
   * Prøverne herunder er skruet sammen, så de kan SKELNE den nye identitetsprøve fra den
   * konkurrerende stamdata-prøve: basis er sat og uændret, og verifikationen ville sige `valid: true`,
   * hvis den blev kaldt. Bliver identitetsprøven fjernet, genbruges håndtaget, og begge fejler.
   */
  describe('håndtagets identitet (BB-049)', () => {
    const setupForeignHandleScenario = (): { stored: FileSystemFileHandle; picked: FileSystemFileHandle } => {
      // Fane A mener at arbejde på sin egen fil …
      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'Hansen 12-03-2024.eo');
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
      // … men det delte håndtag i IndexedDB peger på den fil, fane B sidst gemte til.
      const stored = makeHandle('Jensen 04-11-2023.eo');
      const picked = makeHandle('Hansen 12-03-2024.eo');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
      // Ville have sagt ja: håndtaget ER gyldigt og tilgængeligt. Netop derfor var overskrivningen tavs.
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });
      mockedSaveFileWithPicker.mockResolvedValue(picked);
      return { stored, picked };
    };

    it('genbruger IKKE et handle, der peger på en anden fil end fanens egen', async () => {
      const { picked } = setupForeignHandleScenario();

      const target = await resolveSaveTarget(fileData);

      // Pickeren skal have været inde over – ingen tavs overskrivning af Jensen-filen.
      expect(target).toMatchObject({
        kind: 'fileHandle',
        fileHandle: picked,
        persistHandleAfterSuccess: true,
      expectedFingerprint: 'fingerprint',
      });
      expect(mockedSaveFileWithPicker).toHaveBeenCalledOnce();
      // Identitetsprøven afgør sagen FØR permission-verifikationen; der er intet at verificere på et
      // håndtag, der alligevel ikke må bruges.
      expect(mockedVerifyFileHandleDetailed).not.toHaveBeenCalled();
      expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledOnce();
    });

    it('foreslår fanens EGET filnavn, ikke den anden fanes', async () => {
      setupForeignHandleScenario();

      await resolveSaveTarget(fileData);

      expect(mockedSaveFileWithPicker).toHaveBeenCalledWith('Hansen 12-03-2024.eo', 'desktop');
    });

    it('siger hvorfor filvælgeren kom, så det ikke ligner en fejl i programmet', async () => {
      setupForeignHandleScenario();

      const target = await resolveSaveTarget(fileData);

      if (target.kind !== 'fileHandle') throw new Error('Forventede et fileHandle-mål.');
      expect(target.fallbackWarning).toContain('hører ikke til denne sag');
    });

    it('afbryder fail-closed, hvis det fremmede handle ikke kan ryddes', async () => {
      setupForeignHandleScenario();
      mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(false);

      const target = await resolveSaveTarget(fileData);

      expect(target).toEqual({ kind: 'cancelled' });
      expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
      expect(mockedLogWarning).toHaveBeenCalledWith(
        'Gammelt file handle kunne ikke ryddes sikkert; gemning afbrudt',
        expect.objectContaining({ context: 'resolveSaveTarget.foreignTabHandle' })
      );
    });

    it('genbruger stadig håndtaget, når det ER fanens egen fil', async () => {
      // Modprøven: uden den ville en identitetsprøve, der altid afviser, også bestå de fire ovenfor.
      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'Hansen 12-03-2024.eo');
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
      const stored = makeHandle('Hansen 12-03-2024.eo');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });

      const target = await resolveSaveTarget(fileData);

      expect(target).toEqual({
        kind: 'fileHandle',
        fileHandle: stored,
        persistHandleAfterSuccess: false,
        expectedFingerprint: 'fingerprint',
      });
      expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
    });
  });

  it('annullerer når brugeren lukker file-pickeren', async () => {
    mockedIsFileSystemAccessSupported.mockReturnValue(true);
    mockedLoadFileHandleFromIndexedDB.mockResolvedValue(null);
    mockedSaveFileWithPicker.mockResolvedValue(null);

    const target = await resolveSaveTarget(fileData);

    expect(target).toEqual({ kind: 'cancelled' });
  });

  describe('eksterne ændringer', () => {
    const setupConflict = () => {
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilename, 'sag.eo');
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
      const stored = makeHandle('sag.eo');
      const picked = makeHandle('sag.eo');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(stored);
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });
      mockedSaveFileWithPicker.mockResolvedValue(picked);
      vi.mocked(readFileContentFingerprint).mockResolvedValue('changed');
      return { stored, picked };
    };

    it.each(['cancel', 'overwrite', 'saveAs'] as const)('respekterer valget %s uden teknisk alarm', async (decision) => {
      const { stored, picked } = setupConflict();
      const decide = vi.fn().mockResolvedValue(decision);
      const target = await resolveSaveTarget(fileData, undefined, decide);
      expect(decide).toHaveBeenCalledWith('changed');
      if (decision === 'cancel') expect(target).toEqual({ kind: 'cancelled' });
      else expect(target).toMatchObject({
        kind: 'fileHandle',
        fileHandle: decision === 'overwrite' ? stored : picked,
        persistHandleAfterSuccess: decision === 'saveAs',
        expectedFingerprint: 'changed',
      });
      expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledTimes(decision === 'saveAs' ? 1 : 0);
      expect(mockedSaveFileWithPicker).toHaveBeenCalledTimes(decision === 'saveAs' ? 1 : 0);
      expect(mockedLogWarning).not.toHaveBeenCalled();
    });

    it('spørger ved manglende tidligere filindhold og afbryder uden callback', async () => {
      setupConflict();
      vi.mocked(readSavedFileContentFingerprint).mockReturnValue(null);
      const decide = vi.fn().mockResolvedValue('cancel');
      await expect(resolveSaveTarget(fileData, undefined, decide)).resolves.toEqual({ kind: 'cancelled' });
      expect(decide).toHaveBeenCalledWith('unverifiable');
      await expect(resolveSaveTarget(fileData)).resolves.toEqual({ kind: 'cancelled' });
      expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
    });

    it('bevarer gammel kobling hvis Gem i en anden fil annulleres', async () => {
      setupConflict();
      mockedSaveFileWithPicker.mockResolvedValue(null);
      await expect(resolveSaveTarget(fileData, undefined, async () => 'saveAs')).resolves.toEqual({ kind: 'cancelled' });
      expect(mockedDeleteFileHandleFromIndexedDB).not.toHaveBeenCalled();
    });

    it('skriver ikke til nyt mål hvis gammel kobling ikke kunne fjernes', async () => {
      setupConflict();
      mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(false);
      await expect(resolveSaveTarget(fileData, undefined, async () => 'saveAs')).rejects.toThrow('Filen blev ikke skrevet');
    });

    it('tilbyder en anden placering når den tidligere fil ikke kan læses sikkert', async () => {
      const { picked } = setupConflict();
      vi.mocked(readFileContentFingerprint).mockRejectedValueOnce(new DOMException('Filen er ændret', 'NotReadableError'));
      const target = await resolveSaveTarget(fileData);
      expect(target).toMatchObject({ kind: 'fileHandle', fileHandle: picked, fallbackWarning: expect.stringContaining('kunne ikke kontrolleres') });
      expect(mockedDeleteFileHandleFromIndexedDB).toHaveBeenCalledOnce();
      expect(mockedLogWarning).not.toHaveBeenCalled();
    });
  });
});
