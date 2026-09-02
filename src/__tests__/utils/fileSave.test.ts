// @vitest-environment jsdom
import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { decryptFromString, encryptToString } from '../../utils/encryption';
import { readFromFileHandle } from '../../utils/fileSystemAccess';
import { saveToFile } from '../../utils/fileSave';
import { downloadFile } from '../../utils/fileHelpers';
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
import { VERSION } from '../../config/buildInfo';
import { FILE_FORMAT_VERSION } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import {
  saveFileWithPicker,
  writeToFileHandle,
  isFileSystemAccessSupported,
  isFileSystemFileHandle,
} from '../../utils/fileSystemAccess';
import { UI_STORAGE_KEYS } from '../../config/storageManifest';

vi.mock('../../utils/logger', () => ({
  logError: vi.fn(),
  logWarning: vi.fn(),
  getTimestamp: () => '2026-09-02T12:34:56.789Z',
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

const persistSavedFilenameMetadataMock = vi.fn<(filename: string, stamdata: unknown) => void>();

vi.mock('../../utils/filePersistenceMetadata', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/filePersistenceMetadata')>();
  return {
    ...actual,
    persistSavedFilenameMetadata: (filename: string, stamdata: unknown) =>
      persistSavedFilenameMetadataMock(filename, stamdata),
  };
});

const mockedDecryptFromString = vi.mocked(decryptFromString);
const mockedEncryptToString = vi.mocked(encryptToString);
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
const mockedDownloadFile = vi.mocked(downloadFile);

const currentContainer = (data: Record<string, unknown>): Record<string, unknown> => ({
  version: FILE_FORMAT_VERSION,
  _metadata: {
    exportDate: '2026-07-12T00:00:00.000Z',
    appVersion: VERSION,
    persistedDataVersion: PERSISTED_DATA_VERSION,
    fieldCount: 1,
  },
  data,
});

describe('fileSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockedDeleteFileHandleFromIndexedDB.mockResolvedValue(true);
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
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        ukendtSektion: { x: 1 },
      }));

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(false);
      expect(result.kind).toBe('unusable');
      expect(result.error).toContain('Ugyldig fil-struktur');
    });

    it('returnerer integrity ved data-mismatch', async () => {
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'J-2' },
      }));

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(false);
      expect(result.kind).toBe('integrity');
      expect(result.differences?.some((line) => line.includes('stamdata.journalnr'))).toBe(true);
    });

    it('læser via file handle når isFileHandle=true', async () => {
      mockedReadFromFileHandle.mockResolvedValueOnce('encrypted');
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));

      const handle = { name: 'sag.eo', getFile: vi.fn() } as unknown as FileSystemFileHandle;
      const result = await verifyAfterSave(handle, expectedData, true);

      expect(mockedReadFromFileHandle).toHaveBeenCalledOnce();
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
    });

    it('returnerer success ved identisk data via content-verificering', async () => {
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));

      const result = await verifyAfterSave('encrypted', expectedData, false);
      expect(result.success).toBe(true);
      expect(result.verified).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('afviser en ellers læsbar fil med manglende eller forkert dataversion', async () => {
      const withoutVersion = currentContainer({ stamdata: { journalnr: 'J-1' } });
      delete (withoutVersion._metadata as Record<string, unknown>).persistedDataVersion;
      mockedDecryptFromString
        .mockResolvedValueOnce(withoutVersion)
        .mockResolvedValueOnce({
          ...currentContainer({ stamdata: { journalnr: 'J-1' } }),
          _metadata: {
            ...(currentContainer({})._metadata as Record<string, unknown>),
            persistedDataVersion: '1.0',
          },
        });

      await expect(verifyAfterSave('encrypted', expectedData, false)).resolves.toMatchObject({
        success: false,
        kind: 'unusable',
      });
      await expect(verifyAfterSave('encrypted', expectedData, false)).resolves.toMatchObject({
        success: false,
        kind: 'unusable',
      });
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

      mockedDecryptFromString.mockResolvedValueOnce(currentContainer(structuredClone(expectedData)));

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

    it('stempler current persistedDataVersion i det krypterede artefakt', async () => {
      mockedIsFileSystemAccessSupported.mockReturnValue(false);
      mockedEncryptToString.mockResolvedValueOnce('encrypted');
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));

      const result = await saveToFile(snapshot);

      expect(result.status).toBe('saved');
      expect(mockedEncryptToString).toHaveBeenCalledWith(expect.objectContaining({
        version: FILE_FORMAT_VERSION,
        _metadata: expect.objectContaining({
          persistedDataVersion: PERSISTED_DATA_VERSION,
        }),
      }));
    });

    it('persisterer først nyt file handle efter write og verificering er lykkedes', async () => {
      const existingHandle = { name: 'eksisterende.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;
      const pickedHandle = { name: 'sag.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'eksisterende.eo');
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(existingHandle);
      mockedSaveFileWithPicker.mockResolvedValue(pickedHandle);
      mockedWriteToFileHandle.mockResolvedValue();
      mockedReadFromFileHandle.mockResolvedValue('encrypted');
      mockedDecryptFromString.mockResolvedValue(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));
      mockedSaveFileHandleToIndexedDB.mockResolvedValue(true);
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: false, reason: 'not_found' });

      const result = await saveToFile(snapshot);

      expect(result.status).toBe('saved');
      if (result.status !== 'saved') return;
      expect(result.warning).toContain('Den tidligere valgte fil blev ikke fundet');
      expect(mockedSaveFileHandleToIndexedDB).toHaveBeenCalledWith(pickedHandle);
      expect(mockedWriteToFileHandle.mock.invocationCallOrder[0]).toBeLessThan(
        mockedSaveFileHandleToIndexedDB.mock.invocationCallOrder[0]
      );
    });

    it('genbruger indlæst file handle når write-adgang kan anmodes ved gem', async () => {
      const loadedHandle = { name: 'indlaest.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'indlaest.eo');
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(loadedHandle);
      mockedVerifyFileHandleDetailed.mockResolvedValue({ valid: true });
      mockedWriteToFileHandle.mockResolvedValue();
      mockedReadFromFileHandle.mockResolvedValue('encrypted');
      mockedDecryptFromString.mockResolvedValue(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));

      const result = await saveToFile(snapshot);

      expect(result.status).toBe('saved');
      expect(mockedSaveFileWithPicker).not.toHaveBeenCalled();
      expect(mockedWriteToFileHandle).toHaveBeenCalledTimes(1);
      expect(mockedWriteToFileHandle.mock.calls[0]?.[0]).toBe(loadedHandle);
    });

    it('behandler annulleret write-permission til gemt file handle som stille annullering', async () => {
      const loadedHandle = { name: 'indlaest.eo', getFile: vi.fn(), createWritable: vi.fn() } as unknown as FileSystemFileHandle;

      sessionStorage.setItem('mineo_ui_lastSavedFilename', 'indlaest.eo');
      sessionStorage.setItem(UI_STORAGE_KEYS.lastSavedFilenameBasis, '{}');
      mockedIsFileSystemAccessSupported.mockReturnValue(true);
      mockedRequestPersistentStorage.mockResolvedValue(true);
      mockedLoadFileHandleFromIndexedDB.mockResolvedValue(loadedHandle);
      mockedVerifyFileHandleDetailed.mockResolvedValue({
        valid: false,
        reason: 'permission_denied',
        detail: 'permission=prompt',
      });

      const result = await saveToFile(snapshot);

      expect(result).toEqual({ status: 'cancelled' });
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
      mockedDecryptFromString.mockResolvedValue(currentContainer({
        stamdata: { journalnr: 'forkert' },
      }));
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

      expect(result.status).toBe('cancelled');
      expect(sessionStorage.getItem('mineo_ui_lastSavedFilenameBasis')).toBeNull();
    });

    it('verificerer artefaktet FØR download i fallback-stien', async () => {
      mockedIsFileSystemAccessSupported.mockReturnValue(false);
      mockedEncryptToString.mockResolvedValueOnce('encrypted');
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));

      const result = await saveToFile(snapshot);

      expect(result.status).toBe('saved');
      expect(mockedDownloadFile).toHaveBeenCalledWith('encrypted', expect.any(String), expect.any(String));
      // Verifikationen (som dekrypterer artefaktet) skal ske FØR download-sinken kaldes.
      expect(mockedDecryptFromString.mock.invocationCallOrder[0]).toBeLessThan(
        mockedDownloadFile.mock.invocationCallOrder[0]
      );
      expect(result).toMatchObject({
        status: 'saved',
        warning: expect.stringContaining('kan ikke overskrive en eksisterende .eo-fil'),
      });
    });

    it('bevarer saved-status med advarsel når filnavnsmetadata fejler efter verificeret download', async () => {
      mockedIsFileSystemAccessSupported.mockReturnValue(false);
      mockedEncryptToString.mockResolvedValueOnce('encrypted');
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'J-1' },
      }));
      persistSavedFilenameMetadataMock.mockImplementationOnce(() => {
        throw new Error('sessionStorage utilgængelig');
      });

      const result = await saveToFile(snapshot);

      expect(result).toMatchObject({
        status: 'saved',
        verified: true,
        warning: expect.stringContaining('filnavnsoplysninger til næste Gem'),
      });
      expect(mockedDownloadFile).toHaveBeenCalledTimes(1);
      expect(persistSavedFilenameMetadataMock).toHaveBeenCalledTimes(1);
      expect(mockedDownloadFile.mock.invocationCallOrder[0]).toBeLessThan(
        persistSavedFilenameMetadataMock.mock.invocationCallOrder[0]
      );
    });

    it('downloader ALDRIG et korrupt artefakt i fallback-stien (byg-og-verificér-før-sink)', async () => {
      mockedIsFileSystemAccessSupported.mockReturnValue(false);
      mockedEncryptToString.mockResolvedValueOnce('encrypted');
      // Verifikationen dekrypterer til afvigende data → integritetsfejl før download.
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        stamdata: { journalnr: 'forkert' },
      }));

      await expect(saveToFile(snapshot)).rejects.toThrow('INTEGRITETSKONTROL FEJLEDE');
      expect(mockedDownloadFile).not.toHaveBeenCalled();
    });

    it('ejer ikke en tomheds-gate – et default-only snapshot afvises IKKE her', async () => {
      // "Er sagen tom?" kan IKKE besvares på dette lag: her ses kun det schema-parsede snapshot, ikke
      // ny-sags-baselinen, så "intet indtastet" og "standardværdierne er bevidst valgt" ser ens ud. Den
      // tidligere `hasRealData()`-gate gættede via feltoptælling og regnede hver `false` og hvert
      // standardtal som brugerdata – derfor kunne en tom standardsag gemmes. Gaten ejes nu af
      // `hasAnyData()` i save-shellen; se `useFileSaveLoad`-testen «gemmer ikke en urørt sag».
      //
      // Testen her pinner den NYE grænse: et snapshot, som kun bærer standardværdier, går igennem dette lag
      // uden at blive afvist som "ingen data". Det er shellens beslutning, ikke dette lags.
      // Kun et standard-satsår: ingen brugerindtastning. Præcis den slags standardtal, den gamle
      // feltoptælling regnede som brugerdata, og som derfor lod en tom sag gemme.
      const defaultOnlySnapshot = {
        stamdata: undefined,
        satser: { aargang: 2026 },
        aarsloen: undefined,
        faellesAarsloen: undefined,
        renteberegning: undefined,
        varigemen: undefined,
        forsoergertab: undefined,
        erstatningsopgoerelse: undefined,
        erhvervsevnetab: undefined,
      } as const;

      mockedIsFileSystemAccessSupported.mockReturnValue(false);
      mockedEncryptToString.mockResolvedValueOnce('encrypted');
      mockedDecryptFromString.mockResolvedValueOnce(currentContainer({
        satser: { aargang: 2026 },
      }));

      const result = await saveToFile(defaultOnlySnapshot);

      expect(result.status).toBe('saved');
      expect(mockedLogError).not.toHaveBeenCalled();
    });
  });
});
