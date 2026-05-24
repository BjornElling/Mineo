// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { loadFromFile, loadFromFileHandle } from '../../utils/fileLoad';
import { encryptToString } from '../../utils/encryption';
import { countFilledFields } from '../../utils/dataCollection';
import { FILE_FORMAT_VERSION, VERSION } from '../../config/version';

const readFromFileHandleMock = vi.fn();

vi.mock('../../utils/fileSystemAccess', async () => ({
  isFileSystemAccessSupported: () => false,
  openFileWithPicker: vi.fn(),
  readFromFileHandle: (...args: unknown[]) => readFromFileHandleMock(...args),
}));
const selectFileMock = vi.fn();
const readFileMock = vi.fn();

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

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const encryptLoadContainer = async (data: Record<string, unknown>): Promise<string> => {
  return encryptToString({
    version: FILE_FORMAT_VERSION,
    _metadata: {
      exportDate: '2026-03-20T00:00:00.000Z',
      appVersion: VERSION,
      fieldCount: countFilledFields(data),
    },
    data,
  });
};

const makeValidContainer = async (overrides: Record<string, unknown> = {}): Promise<string> => {
  return encryptLoadContainer({
    stamdata: {
      journalnr: 'J-2024-001',
      advokat: '',
      sagsbehandler: '',
      skadelidte: 'Testperson',
      skadestype: 'Arbejdsulykke',
      skadedato: '2024-01-15',
    },
    ...overrides,
  });
};

// ─── loadFromFile – success ───────────────────────────────────────────────────

describe('fileLoad – normalLoadFlow', () => {
  it('returnerer success med snapshot ved gyldig fil', async () => {
    const content = await makeValidContainer();
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.filename).toBe('sag.eo');
    expect(result.source).toBe('manual');
    expect(result.snapshot.stamdata).toBeDefined();
  });

  it('returnerer cancelled=true når bruger annullerer fil-valg', async () => {
    selectFileMock.mockResolvedValueOnce(null);

    const result = await loadFromFile();

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.cancelled).toBe(true);
  });

  it('kaster fejl for forkert filendelse', async () => {
    const file = new File(['data'], 'forkert.txt', { type: 'text/plain' });
    selectFileMock.mockResolvedValueOnce(file);

    await expect(loadFromFile()).rejects.toThrow('ikke en .eo fil');
  });

  it('kaster fejl for for stor fil', async () => {
    // MAX_FILE_SIZE er 1 MB = 1048576 bytes
    const bigContent = 'x'.repeat(2 * 1024 * 1024);
    // Simulér stor fil med size-overskridelse via mock
    const file = {
      name: 'stor.eo',
      size: 2 * 1024 * 1024,
    } as File;
    selectFileMock.mockResolvedValueOnce(file);

    await expect(loadFromFile()).rejects.toThrow('for stor');
    // Supress unused variable lint
    void bigContent;
  });

  it('kaster fejl for krypteret fil med ugyldig container-struktur', async () => {
    // Krypteret content med ugyldig container (mangler version)
    const badContainer = await encryptToString({ data: { stamdata: { journalnr: 'X' } } });
    const file = new File([badContainer], 'bad.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(badContainer);

    await expect(loadFromFile()).rejects.toThrow();
  });

  it('kaster fejl for fil med nul udfyldte felter', async () => {
    // Container med kun tomme felter → fileFieldCount === 0
    const emptyContainer = await encryptLoadContainer({
      stamdata: { journalnr: '', advokat: '', sagsbehandler: '', skadelidte: '', skadestype: undefined, skadedato: undefined },
    });
    const file = new File([emptyContainer], 'tom.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(emptyContainer);

    await expect(loadFromFile()).rejects.toThrow();
  });

  it('returnerer preflight-advarsel og bevarer kendte sektioner ved ukendt sektion', async () => {
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: VERSION,
        fieldCount: 1,
      },
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadedato: undefined,
        },
        ukendtSektion: { noget: 'data' },
      },
    });
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.snapshot?.stamdata).toBeDefined();
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'unknownSection',
      path: 'ukendtSektion',
    }));
  });

  it('returnerer preflight-advarsel og stripper ukendte felter i kendt sektion', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: undefined,
        uventetFelt: 'fjernes',
      },
    });
    const file = new File([content], 'sag.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.snapshot?.stamdata as Record<string, unknown>)?.uventetFelt).toBeUndefined();
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'strippedUnknownField',
      path: 'stamdata.uventetFelt',
    }));
  });

  it('rapporterer faellesPersondata som ukendt sektion uden at migrere data', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: '2024-01-15',
      },
      faellesPersondata: {
        skadelidteFodselsdato: '1990-01-01',
      },
    });
    const file = new File([content], 'ukendt-fodselsdato-sektion.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.snapshot?.stamdata as Record<string, unknown>)?.skadelidteFodselsdato).toBeUndefined();
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'unknownSection',
      path: 'faellesPersondata',
    }));
  });

  it('springer ugyldig sektion over og bevarer øvrige gyldige sektioner', async () => {
    const content = await encryptLoadContainer({
      stamdata: {
        journalnr: 'J-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Test',
        skadestype: undefined,
        skadedato: undefined,
      },
      renteberegning: {
        rentekravRows: 'forkert-type',
      },
    });
    const file = new File([content], 'delvist-gyldig.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    const result = await loadFromFile();

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.snapshot?.stamdata).toBeDefined();
    expect(result.snapshot?.renteberegning).toBeUndefined();
    expect(result.preflightWarning?.failedCount).toBe(result.preflightWarning?.issues.length);
    expect(result.preflightWarning?.issues).toContainEqual(expect.objectContaining({
      kind: 'sectionDropped',
      path: expect.stringMatching(/^renteberegning/),
    }));
  });

  it('afviser filer hvor kun ukendte sektioner har indhold', async () => {
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: VERSION,
        fieldCount: 2,
      },
      data: {
        ukendtSektion: { noget: 'data' },
      },
    });
    const file = new File([content], 'kun-ukendt-sektion.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow('ingen data der kan indlæses');
  });

  it('afviser forkert filversion eksplicit', async () => {
    const content = await encryptToString({
      version: '0.9.0',
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: VERSION,
        fieldCount: 1,
      },
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadedato: undefined,
        },
      },
    });
    const file = new File([content], 'forkert-version.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow(`format ${FILE_FORMAT_VERSION}`);
  });

  it('afviser filer uden obligatorisk metadata i nyt format', async () => {
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadedato: undefined,
        },
      },
    });
    const file = new File([content], 'mangler-metadata.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);

    await expect(loadFromFile()).rejects.toThrow('ugyldig .eo-struktur');
  });
});

describe('loadFromFileHandle', () => {
  it('returnerer success med snapshot ved gyldig PWA-fil', async () => {
    const content = await makeValidContainer();
    const handle = {
      getFile: vi.fn().mockResolvedValue(new File([content], 'pwa.eo', { type: 'application/octet-stream' })),
    } as unknown as FileSystemFileHandle;
    readFromFileHandleMock.mockResolvedValueOnce(content);

    const result = await loadFromFileHandle(handle, { requestId: 'req-1' });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.source).toBe('pwa');
    expect(result.requestId).toBe('req-1');
    expect(result.snapshot?.stamdata).toBeDefined();
  });
});
