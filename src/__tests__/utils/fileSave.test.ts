import { eoFileDataSchema } from '../../schemas/eoFileSchema';
import { decryptFromString } from '../../utils/encryption';
import { readFromFileHandle } from '../../utils/fileSystemAccess';
import { buildAllDataRawFromSnapshot, compareData, verifyAfterSave } from '../../utils/fileSaveInternals';

vi.mock('../../utils/logger', () => ({
  logOperationStart: vi.fn(),
  logOperationEnd: vi.fn(),
  logDataStats: vi.fn(),
  logInfo: vi.fn(),
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
  saveFileWithPicker: vi.fn(),
  writeToFileHandle: vi.fn(),
  readFromFileHandle: vi.fn(),
}));

const mockedDecryptFromString = vi.mocked(decryptFromString);
const mockedReadFromFileHandle = vi.mocked(readFromFileHandle);

describe('fileSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('buildAllDataRawFromSnapshot', () => {
    it('bygger data og udelader undefined-sektioner', () => {
      const result = buildAllDataRawFromSnapshot({
        stamdata: { journalnr: 'J-1' },
        satser: undefined,
        aarsloen: undefined,
        faellesAarsloen: undefined,
        faellesPersondata: undefined,
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
          faellesPersondata: undefined,
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
          faellesPersondata: undefined,
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
          faellesPersondata: undefined,
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
        faellesAarsloen: {
          aslAarsloen: { kind: 'number', value: 450000 },
          ealAarsloen: { kind: 'number', value: 500000 },
        },
        faellesPersondata: {
          skadelidteFodselsdato: '1990-01-01',
        },
        forsoergertab: {
          efterladteFodselsdato: '1988-03-04',
          beregningsdato: '2025-01-15',
          virkningsdato: '2025-01-01',
          tilkendtForPeriodeAar: 5,
        },
        erhvervsevnetab: {
          beregningsdato: '2025-01-15',
          koen: 'Kvinde',
          aslAfgoerelser: [
            {
              id: 'eet_asl_1',
              afgoerelsesDato: '2025-01-15',
              virkningsDato: '2025-01-01',
              eetPct: '20',
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
});
