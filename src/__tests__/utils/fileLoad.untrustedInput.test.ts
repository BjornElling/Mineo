// @vitest-environment jsdom
import { createCipheriv, createHash } from 'node:crypto';
import { loadFromFile, loadFromFileHandle } from '../../utils/fileLoad';
import { FILE_FORMAT_VERSION, MAX_FILE_SIZE } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { createErstatningsopgoerelseInitialValues } from '../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

const selectFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('../../utils/fileSystemAccess', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../utils/fileSystemAccess')>(),
  isFileSystemAccessSupported: () => false,
}));
vi.mock('../../utils/fileHelpers', () => ({
  selectFile: (...args: unknown[]) => selectFileMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  getStartInValue: vi.fn(),
}));
vi.mock('../../utils/logger', () => ({
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

// Uafhængig format-fixture: rå JSON krypteres uden produktets serializer, der selv
// ville ramme call stack på de 10.000 niveauer. Den faste IV bruges kun til testdata.
const encryptRawJson = (json: string): string => {
  const key = createHash('sha256').update('MINEO_OBFUSCATION_KEY_V1').digest();
  const iv = Buffer.alloc(12, 7);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(json, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return JSON.stringify({ version: 1, alg: 'A256GCM', ivB64: iv.toString('base64'), ctB64: ciphertext.toString('base64') });
};

const buildFileContent = (dataJson: string, version = PERSISTED_DATA_VERSION): string => encryptRawJson(
  `{"version":${JSON.stringify(FILE_FORMAT_VERSION)},"_metadata":${JSON.stringify({
    exportDate: '2026-10-27T00:00:00.000Z', appVersion: 'sikkerhedstest', persistedDataVersion: version, fieldCount: 1,
  })},"data":${dataJson}}`,
);

const loadContent = (source: 'manual' | 'pwa', content: string) => {
  const file = new File([content], 'utroværdig.eo', { type: 'application/octet-stream' });
  readFileMock.mockResolvedValueOnce(content);
  if (source === 'manual') {
    selectFileMock.mockResolvedValueOnce(file);
    return loadFromFile();
  }
  const handle: FileSystemFileHandle = {
    kind: 'file', name: file.name,
    getFile: async () => file,
    isSameEntry: async (other) => other === handle,
    createWritable: async () => { throw new Error('Indlæsning må ikke skrive til filen'); },
  };
  return loadFromFileHandle(handle);
};

describe.each(['manual', 'pwa'] as const)('fileLoad – utroværdigt input via %s', (source) => {
  beforeEach(() => vi.clearAllMocks());

  it.each(['objekter', 'arrays'] as const)('afviser 10.000 indlejrede %s under størrelsesgrænsen uden stackfejl', async (kind) => {
    const nested = kind === 'objekter'
      ? '{"x":'.repeat(10000) + '1' + '}'.repeat(10000)
      : '['.repeat(10000) + '1' + ']'.repeat(10000);
    const content = buildFileContent(`{"stamdata":{"journalnr":"J-1"},"erstatningsopgoerelse":{"ukendt":${nested}}}`);
    expect(new Blob([content]).size).toBeLessThan(MAX_FILE_SIZE);

    await expect(loadContent(source, content)).rejects.toMatchObject({
      name: 'CalculationError', code: 'FILE_LOAD_FAILED',
      message: 'Kunne ikke indlæse fil. Tjek at filen er gyldig.',
    });
  });

  it('lader ikke data.__proto__ indføre en sagssektion gennem arv', async () => {
    const content = buildFileContent('{"stamdata":{"journalnr":"J-1"},"__proto__":{"faellesAarsloen":{"aslAarsloen":{"kind":"number","value":999999}}}}');
    const result = await loadContent(source, content);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') throw new Error('Den kendte sektion skal kunne indlæses');
    expect(result.snapshot.stamdata).toMatchObject({ journalnr: 'J-1' });
    expect(result.snapshot.faellesAarsloen).toBeUndefined();
  });

  it.each(['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty'])(
    'bevarer gyldige feltværdier og rapporterer det ukendte felt %s',
    async (key) => {
      const text = '<script>uønsket kode</script> – __proto__ er også almindelig tekst';
      const content = buildFileContent(JSON.stringify({
        stamdata: { journalnr: 'J-1', skadelidte: text, [key]: { skadelidte: 'FORFALSKET' } },
      }));
      const result = await loadContent(source, content);

      expect(result.status).toBe('preflight');
      if (result.status !== 'preflight') throw new Error('Det ukendte felt skal rapporteres');
      expect(result.snapshot.stamdata).toMatchObject({ journalnr: 'J-1', skadelidte: text });
      expect(result.preflightWarning.issues).toContainEqual(expect.objectContaining({
        kind: 'strippedUnknownField', path: `stamdata.${key}`,
      }));
      expect(Object.prototype.hasOwnProperty.call(result.snapshot.stamdata, key)).toBe(false);
    },
  );

  it('behandler et arvet versionsnavn som andre ukendte versioner', async () => {
    const content = buildFileContent(JSON.stringify({
      erstatningsopgoerelse: { ...createErstatningsopgoerelseInitialValues(), kravPaaTabtArbejdsfortjeneste: 'Nej' },
    }), 'constructor');
    const result = await loadContent(source, content);

    expect(result.status).toBe('loaded');
    if (result.status !== 'loaded') throw new Error('Ukendt version skal følge den almindelige feltvalidering');
    expect(result.snapshot.erstatningsopgoerelse).toMatchObject({ kravPaaTabtArbejdsfortjeneste: 'Nej' });
  });
});
