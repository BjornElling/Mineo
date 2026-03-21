// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { loadFromFile } from '../../utils/fileLoad';
import { CalculationError } from '../../utils/errorMessages';

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
  logWarning: vi.fn(),
  logError: vi.fn(),
  sanitizeFilenameForLog: (value: unknown) => String(value ?? ''),
}));

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

describe('fileLoad decrypt failure', () => {
  it('maps decrypt failure to FILE_LOAD_FAILED', async () => {
    const file = new File(['x'], 'bad.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce('not-json');

    await expect(loadFromFile()).rejects.toMatchObject<CalculationError>({
      code: 'FILE_LOAD_FAILED',
      name: 'CalculationError',
    });
  });
});
