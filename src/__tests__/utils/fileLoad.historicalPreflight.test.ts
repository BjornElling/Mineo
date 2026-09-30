// @vitest-environment jsdom
import { webcrypto } from 'node:crypto';
import { encryptToString } from '../../utils/encryption';
import { FILE_FORMAT_VERSION } from '../../config/version';
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { loadFromFile } from '../../utils/fileLoad';

const { parseInboundMock, selectFileMock, readFileMock } = vi.hoisted(() => ({
  parseInboundMock: vi.fn(),
  selectFileMock: vi.fn(),
  readFileMock: vi.fn(),
}));

vi.mock('../../utils/inboundPersistedSection', () => ({
  parseInboundPersistedSection: (...args: unknown[]) => parseInboundMock(...args),
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

beforeAll(() => {
  if (!globalThis.crypto) {
    globalThis.crypto = webcrypto as unknown as Crypto;
  }
});

describe('fileLoad – historisk missing-field preflight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('viser adapterens manglende historiske felt i preflight', async () => {
    const data = { stamdata: { journalnr: 'J-MISSING-FIELD' } };
    const content = await encryptToString({
      version: FILE_FORMAT_VERSION,
      _metadata: {
        exportDate: '2026-03-20T00:00:00.000Z',
        appVersion: 'test',
        persistedDataVersion: PERSISTED_DATA_VERSION,
        fieldCount: 1,
      },
      data,
    });
    const file = new File([content], 'missing-field.eo', { type: 'application/octet-stream' });
    selectFileMock.mockResolvedValueOnce(file);
    readFileMock.mockResolvedValueOnce(content);
    parseInboundMock.mockReturnValueOnce({
      migratedValue: data.stamdata,
      unknownPaths: [],
      invalidPaths: [],
      preflightMissingFields: [{
        path: ['skadetype'],
        reason: 'Feltet blev indført efter den gemte fil.',
      }],
      ok: true,
      data: data.stamdata,
    });

    const result = await loadFromFile();

    expect(result.status).toBe('preflight');
    if (result.status !== 'preflight') return;
    expect(result.preflightWarning).toEqual(expect.objectContaining({
      expectedCount: 1,
      loadedCount: 1,
      failedCount: 0,
    }));
    expect(result.preflightWarning.issues).toContainEqual({
      kind: 'missingHistoricalField',
      path: 'stamdata.skadetype',
      reason: 'Feltet blev indført efter den gemte fil.',
    });
    expect(parseInboundMock).toHaveBeenCalledWith(
      'stamdata',
      data.stamdata,
      PERSISTED_DATA_VERSION,
    );
  });
});
