// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { loadFromFile, validateEoFile } from '../../utils/fileLoad';
import { encryptToString } from '../../utils/encryption';

vi.mock('../../utils/fileSystemAccess', () => ({
  isFileSystemAccessSupported: () => false,
  openFileWithPicker: vi.fn(),
  readFromFileHandle: vi.fn(),
}));

const selectFileMock = vi.fn();
const readFileMock = vi.fn();

vi.mock('../../utils/fileHelpers', () => ({
  selectFile: (...args: unknown[]) => selectFileMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  getStartInValue: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logOperationStart: vi.fn(),
  logOperationEnd: vi.fn(),
  logDataStats: vi.fn(),
  logDebug: vi.fn(),
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

const makeValidContainer = async (overrides: Record<string, unknown> = {}): Promise<string> => {
  const container = {
    version: '1.0.0',
    data: {
      stamdata: {
        journalnr: 'J-2024-001',
        advokat: '',
        sagsbehandler: '',
        skadelidte: 'Testperson',
        skadestype: 'Arbejdsulykke',
        skadesdato: '2024-01-15',
      },
      ...overrides,
    },
  };
  return encryptToString(container);
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
    const emptyContainer = await encryptToString({
      version: '1.0.0',
      data: {
        stamdata: { journalnr: '', advokat: '', sagsbehandler: '', skadelidte: '', skadestype: undefined, skadesdato: undefined },
      },
    });
    const file = new File([emptyContainer], 'tom.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(emptyContainer);

    await expect(loadFromFile()).rejects.toThrow();
  });

  it('sætter preflightWarning ved ukendte sektioner i filen', async () => {
    const content = await encryptToString({
      version: '1.0.0',
      data: {
        stamdata: {
          journalnr: 'J-001',
          advokat: '',
          sagsbehandler: '',
          skadelidte: 'Test',
          skadestype: undefined,
          skadesdato: undefined,
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
    expect(result.preflightWarning).toBeDefined();
    expect(result.preflightWarning?.issues.some((i) => i.path === 'ukendtSektion')).toBe(true);
  });
});

// ─── validateEoFile ───────────────────────────────────────────────────────────

describe('validateEoFile', () => {
  it('returnerer true for gyldig krypteret .eo fil', async () => {
    const container = { version: '1.0.0', data: {} };
    const encrypted = await encryptToString(container);
    const file = new File([encrypted], 'sag.eo', { type: 'application/octet-stream' });
    readFileMock.mockResolvedValueOnce(encrypted);

    const isValid = await validateEoFile(file);
    expect(isValid).toBe(true);
  });

  it('returnerer false for forkert filendelse', async () => {
    const file = new File(['data'], 'sag.txt', { type: 'text/plain' });
    const isValid = await validateEoFile(file);
    expect(isValid).toBe(false);
  });

  it('returnerer false for ikke-krypteret JSON', async () => {
    const file = new File(['{"not":"encrypted"}'], 'sag.eo', { type: 'application/octet-stream' });
    readFileMock.mockResolvedValueOnce('{"not":"encrypted"}');
    const isValid = await validateEoFile(file);
    expect(isValid).toBe(false);
  });

  it('returnerer false for ugyldig JSON', async () => {
    const file = new File(['ikke json'], 'sag.eo', { type: 'application/octet-stream' });
    readFileMock.mockResolvedValueOnce('ikke json');
    const isValid = await validateEoFile(file);
    expect(isValid).toBe(false);
  });
});
