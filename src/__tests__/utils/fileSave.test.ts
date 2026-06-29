// @vitest-environment jsdom
import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { decryptFromString } from '../../utils/encryption';
import { readFromFileHandle } from '../../utils/fileSystemAccess';
import { SaveValidationError, saveToFile } from '../../utils/fileSave';
import { buildAllDataRawFromSnapshot, compareData, verifyAfterSave } from '../../utils/fileSaveInternals';
import { logError, logWarning } from '../../utils/logger';
import {
  deleteFileHandleFromIndexedDB,
  loadFileHandleFromIndexedDB,
  requestPersistentStorage,
  saveFileHandleToIndexedDB,
  verifyFileHandleDetailed,
} from '../../utils/fileHandleStorage';
import { toISODateString } from '../../types/branded';
import {
  saveFileWithPicker,
  writeToFileHandle,
  isFileSystemAccessSupported,
  isFileSystemFileHandle,
} from '../../utils/fileSystemAccess';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

vi.mock('../../utils/encryption', () => ({
  encryptToString: vi.fn(),
  decryptFromString: vi.fn(),
}));

vi.mock('../../utils/fileSystemAccess', () => ({
  isFileSystemAccessSupported: vi.fn(),
  isFileSystemFileHandle: vi.fn(),
  saveFileWithPicker: vi.fn(),
  writeToFileHandle: vi.fn(),
  readFromFileHandle: vi.fn(),
}));

vi.mock('../../utils/fileHandleStorage', () => ({
  requestPersistentStorage: vi.fn(),
  saveFileHandleToIndexedDB: vi.fn(),
  loadFileHandleFromIndexedDB: vi.fn(),
  verifyFileHandleDetailed: vi.fn(),
  deleteFileHandleFromIndexedDB: vi.fn(),
}));

vi.mock('../../utils/fileHelpers', () => ({
  generateFilename: vi.fn(() => 'foreslaaet-navn'),
  downloadFile: vi.fn(),
  getStartInValue: vi.fn(() => 'desktop'),
}));

const mockedDecryptFromString = vi.mocked(decryptFromString);
const mockedReadFromFileHandle = vi.mocked(readFromFileHandle);
const mockedIsFileSystemAccessSupported = vi.mocked(isFileSystemAccessSupported);
const mockedIsFileSystemFileHandle = vi.mocked(isFileSystemFileHandle);
const mockedSaveFileWithPicker = vi.mocked(saveFileWithPicker);
const mockedWriteToFileHandle = vi.mocked(writeToFileHandle);
const mockedRequestPersistentStorage = vi.mocked(requestPersistentStorage);
const mockedLoadFileHandleFromIndexedDB = vi.mocked(loadFileHandleFromIndexedDB);
const mockedSaveFileHandleToIndexedDB = vi.mocked(saveFileHandleToIndexedDB);
const mockedVerifyFileHandleDetailed = vi.mocked(verifyFileHandleDetailed);
const mockedDeleteFileHandleFromIndexedDB = vi.mocked(deleteFileHandleFromIndexedDB);
const mockedLogError = vi.mocked(logError);
const mockedLogWarning = vi.mocked(logWarning);

describe('fileSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedIsFileSystemFileHandle.mockImplementation(
      (value): value is FileSystemFileHandle =>
        Boolean(value) &&
        typeof value === 'object' &&
        typeof (value as FileSystemFileHandle).getFile === 'function'
    );
  });

  describe('buildAllDataRawFromSnapshot', () => {
    it('bygger data og udelader undefined-sektioner', () => {
      const result = buildAllDataRawFromSnapshot({
        stamdata: { journalnr: 'J-1' },
        satser: undefined,
        aarsloen: undefined,
        faellesAarsloen: undefined,
        renteberegning: undefined,
        varigemen: undefined,
        forsoergertab: undefined,
        erstatningsopgoerelse: undefined,
        erhvervsevnetab: undefined,
      });

      expect(result).toEqual({ stamdata: { journalnr: 'J-1' } });
    });

    it('fejler når en required key mangler', () => {
      expect(() =>
        buildAllDataRawFromSnapshot({
          stamdata: {},
          satser: undefined,
          aarsloen: undefined,
          faellesAarsloen: undefined,
          renteberegning: undefined,
          varigemen: undefined,
          forsoergertab: undefined,
        } as never)
      ).toThrow("Snapshot mangler key 'erstatningsopgoerelse'");
    });

    it('fejler ved null-værdi', () => {
      expect(() =>
        buildAllDataRawFromSnapshot({
          stamdata: null,
          satser: undefined,
          aarsloen: undefined,
          faellesAarsloen: undefined,
          renteberegning: undefined,
          varigemen: undefined,
          forsoergertab: undefined,
          erstatningsopgoerelse: undefined,
          erhvervsevnetab: undefined,
        } as never)
      ).toThrow("Snapshot indeholder null for 'stamdata'");
    });

    it('fejler ved ukendt key', () => {
      expect(() =>
        buildAllDataRawFromSnapshot({
          stamdata: {},
          satser: undefined,
          aarsloen: undefined,
          faellesAarsloen: undefined,
          renteberegning: undefined,
          varigemen: undefined,
          forsoergertab: undefined,
          erstatningsopgoerelse: undefined,
          erhvervsevnetab: undefined,
          ukendt: {},
        } as never)
      ).toThrow("Snapshot indeholder ukendt key 'ukendt'");
    });
  });

  describe('compareData', () => {
    it('finder type mismatch', () => {
      expect(compareData({ a: 1 }, ['x'])).toEqual([
        'root: Type mismatch (forventet: object, faktisk: array)',
      ]);
    });

    it('finder array-længdeafvigelse', () => {
      expect(compareData([1, 2], [1])).toContain(
        'root: Array-længde afviger (forventet: 2, faktisk: 1)'
      );
    });

    it('finder manglende og ekstra nøgler', () => {
      const diffs = compareData({ a: 1 }, { b: 1 });
      expect(diffs).toContain('root.a: Mangler i gemt fil');
      expect(diffs).toContain('root.b: Ekstra felt i gemt fil (ikke i sessionStorage)');
    });

    it('finder primitive afvigelser', () => {
      expect(compareData({ a: 1 }, { a: 2 })).toContain('root.a: Værdi afviger');
    });

    it('stopper comparison når rekursionsdybde er over 15', () => {
      let expected: Record<string, unknown> = { value: 'a' };
      let actual: Record<string, unknown> = { value: 'b' };
      for (let i = 0; i < 16; i += 1) {
        expected = { nested: expected };
        actual = { nested: actual };
      }
      expect(compareData(expected, actual)).toEqual([]);
    });
  });

  describe('verifyAfterSave', () => {
    const expectedData = eoFileDataSchema.parse({
      stamdata: { journalnr: 'J-1' },
    });

    it('returnerer unusable ved dekrypteringsfejl', async () => {
      mockedDecryptFromString.mockRejectedValueOnce(new Error('decrypt fail'));

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(false);
      expect(result.kind).toBe('unusable');
    });

    it('returnerer unusable ved ugyldig container-struktur', async () => {
      mockedDecryptFromString.mockResolvedValueOnce({ version: '1.0.0' });

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(false);
      expect(result.kind).toBe('unusable');
      expect(result.error).toContain('Ugyldig fil-struktur');
    });

    it('returnerer unusable ved schema-fejl i data', async () => {
      mockedDecryptFromString.mockResolvedValueOnce({
        data: {
          ukendtSektion: { x: 1 },
        },
      });

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(false);
      expect(result.kind).toBe('unusable');
      expect(result.error).toContain('matcher ikke schemas');
    });

    it('returnerer integrity ved data-mismatch', async () => {
      mockedDecryptFromString.mockResolvedValueOnce({
        data: {
          stamdata: { journalnr: 'J-2' },
        },
      });

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(false);
      expect(result.kind).toBe('integrity');
      expect(result.differences?.some((line) => line.includes('stamdata.journalnr'))).toBe(true);
    });

    it('læser via file handle når isFileHandle=true', async () => {
      mockedReadFromFileHandle.mockResolvedValueOnce('encrypted');
      mockedDecryptFromString.mockResolvedValueOnce({
        data: {
          stamdata: { journalnr: 'J-1' },
        },
      });

      const handle = { name: 'sag.eo', getFile: vi.fn() } as unknown as FileSystemFileHandle;
      const result = await verifyAfterSave(handle, expectedData, true);

      expect(mockedReadFromFileHandle).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('returnerer success ved identisk data via content-verificering', async () => {
      mockedDecryptFromString.mockResolvedValueOnce({
        data: {
          stamdata: { journalnr: 'J-1' },
        },
      });

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('bevarer faellesAarsloen, forsoergertab og erhvervsevnetab i round-trip verifikation', async () => {
      const expectedData = eoFileDataSchema.parse({
        stamdata: {
          skadelidteFodselsdato: toISODateString('1990-01-01'),
        },
        faellesAarsloen: {
          aslAarsloen: { kind: 'number', value: 450000 },
          ealAarsloen: { kind: 'number', value: 500000 },
        },
        forsoergertab: {
          efterladteFodselsdato: toISODateString('1988-03-04'),
          beregningsdato: toISODateString('2025-01-15'),
          virkningsdato: toISODateString('2025-01-01'),
          tilkendtForPeriodeAar: 5,
        },
        erhvervsevnetab: {
          beregningsdato: toISODateString('2025-01-15'),
          koen: 'Kvinde',
          aslAfgoerelser: [
            {
              id: 'eet_asl_1',
              afgoerelsesDato: toISODateString('2025-01-15'),
              virkningsDato: toISODateString('2025-01-01'),
              eetPct: 20,
              kapDato: undefined,
              kapPct: undefined,
              afgoerelseType: 'Midlertidig',
              tidlKapDato: undefined,
            },
          ],
          ealEetPct: 25,
          eetDifferencekravBilagSelection: {
            loebendeYdelser: true,
            kapitalisering: true,
            eetEfterEal: true,
            proformaKapitalisering: true,
    merErstatningPensionsalder: false,
            visUdvidetSpecifikation: false,
            visUdvidetSpecifikationLoebendeYdelserBilag: false,
          },
        },
      });

      mockedDecryptFromString.mockResolvedValueOnce({
        data: structuredClone(expectedData),
      });

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });
  });

  describe('saveToFile', () => {
    const snapshot = {
      stamdata: { journalnr: 'J-1' },
      satser: undefined,
      aarsloen: undefined,
      faellesAarsloen: undefined,
      renteberegning: undefined,
      varigemen: undefined,
      forsoergertab: undefined,
      erstatningsopgoerelse: undefined,
      erhvervsevnetab: undefined,
    } as const;

    it('persisterer først nyt file handle efter write og verificering er lykkedes', async () => {
      const existingHandle = { name: 'eksisterende.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;
      const pickedHandle = { name: 'sag.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(existingHandle);
      mockedSaveFileWithPicker.mockResolvedValue(pickedHandle);
      mockedWriteToFileHandle.mockResolvedValue();
      mockedReadFromFileHandle.mockResolvedValue('encrypted');
      mockedDecryptFromString.mockResolvedValue({
        data: {
          stamdata: { journalnr: 'J-1' },
        },
      });
      mockedSaveFileHandleToIndexedDB.mockResolvedValue(true);
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: false, reason: 'not_found' });

      const result = await saveToFile(snapshot);

      expect(result.success).toBe(true);
      expect(result.warning).toContain('Den tidligere valgte fil blev ikke fundet');
      expect(mockedSaveFileHandleToIndexedDB).toHaveBeenCalledWith(pickedHandle);
      expect(mockedWriteToFileHandle.mock.invocationCallOrder[0]).toBeLessThan(
        mockedSaveFileHandleToIndexedDB.mock.invocationCallOrder[0]
      );
    });

    it('genbruger indlæst file handle når write-adgang kan anmodes ved gem', async () => {
      const loadedHandle = { name: 'indlaest.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'indlaest.eo');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(loadedHandle);
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });
      mockedWriteToFileHandle.mockResolvedValue();
      mockedReadFromFileHandle.mockResolvedValue('encrypted');
      mockedDecryptFromString.mockResolvedValue({
        data: {
          stamdata: { journalnr: 'J-1' },
        },
      });

      const result = await saveToFile(snapshot);

      expect(result.success).toBe(true);
      expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
      expect(mockedWriteToFileHandle).toHaveBeenCalledTimes(1);
      expect(mockedWriteToFileHandle.mock.calls[0]?.[0]).toBe(loadedHandle);
    });

    it('behandler annulleret write-permission til gemt file handle som stille annullering', async () => {
      const loadedHandle = { name: 'indlaest.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'indlaest.eo');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(loadedHandle);
      mockedVerifyFileHandleDetailed.mockResolvedValue({
        valid: false,
        reason: 'permission_denied',
        detail: 'permission=prompt',
      });

      const result = await saveToFile(snapshot);

      expect(result).toEqual({ success: false, cancelled: true });
      expect(mockedLogWarning).not.toHaveBeenCalled();
      expect(mockedDeleteFileHandleFromIndexedDB).not.toHaveBeenCalled();
      expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
      expect(mockedWriteToFileHandle).not.toHaveBeenCalled();
    });

    it('persisterer ikke nyt file handle når verificering fejler', async () => {
      const pickedHandle = { name: 'sag.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(null);
      mockedSaveFileWithPicker.mockResolvedValue(pickedHandle);
      mockedWriteToFileHandle.mockResolvedValue();
      mockedReadFromFileHandle.mockResolvedValue('encrypted');
      mockedDecryptFromString.mockResolvedValue({
        data: {
          stamdata: { journalnr: 'forkert' },
        },
      });
      mockedSaveFileHandleToIndexedDB.mockResolvedValue(true);

      await expect(saveToFile(snapshot)).rejects.toThrow('INTEGRITETSKONTROL FEJLEDE');
      expect(mockedSaveFileHandleToIndexedDB).not.toHaveBeenCalled();
    });

    it('fejler ikke på korrupt lastSavedFilenameBasis metadata', async () => {
      sessionStorage.setItem('mineo_ui_lastSavedFilenameBasis', '{ikke-json');
      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');

      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(null);
      mockedSaveFileWithPicker.mockResolvedValue(null);

      const result = await saveToFile(snapshot);

      expect(result.cancelled).toBe(true);
      expect(sessionStorage.getItem('mineo_ui_lastSavedFilenameBasis')).toBeNull();
    });

    it('logger ikke fejl når der ikke er data at gemme', async () => {
      const emptySnapshot = {
        stamdata: undefined,
        satser: undefined,
        aarsloen: undefined,
        faellesAarsloen: undefined,
        renteberegning: undefined,
        varigemen: undefined,
        forsoergertab: undefined,
        erstatningsopgoerelse: undefined,
        erhvervsevnetab: undefined,
      } as const;

      await expect(saveToFile(emptySnapshot)).rejects.toBeInstanceOf(SaveValidationError);
      expect(mockedLogError).not.toHaveBeenCalled();
    });
  });
});
