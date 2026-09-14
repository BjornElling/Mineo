// @vitest-environment jsdom
import {
  savePendingPwaOpenRequestToIndexedDB,
  type StoredPendingPwaOpenRequest,
} from '../../utils/fileHandleStorage';
import type { PwaFileOpenRequest } from '../../schemas/pwaFileOpenRequestSchema';

const writeClientScopedFileHandleValueMock = vi.fn();

vi.mock('../../utils/file/fileHandleKvStore', () => ({
  deleteFileHandleValues: vi.fn(),
  directoryHandleMetaSchema: { safeParse: vi.fn() },
  deleteClientScopedFileHandleValue: vi.fn(),
  readFileHandleValue: vi.fn(),
  readFileHandleValueResult: vi.fn(),
  readClientScopedFileHandleValueResult: vi.fn(),
  writeClientScopedFileHandleValue: (...args: unknown[]) => writeClientScopedFileHandleValueMock(...args),
  writeFileHandleValues: vi.fn(),
}));

const makeFileHandle = (): FileSystemFileHandle => ({
  kind: 'file',
  getFile: vi.fn(),
} as unknown as FileSystemFileHandle);

const validRequest = (): PwaFileOpenRequest => ({
  id: 'pwa-open-client-1',
  createdAtEpochMs: 1,
  fileHandle: makeFileHandle(),
  fileName: 'sag.eo',
  ignoredFileCount: 0,
});

describe('PERSIST-002 – validering før pending PWA-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('afviser negativt ignoreret filantal uden at skrive en ugyldig request til IndexedDB', async () => {
    const invalidRequest = {
      ...validRequest(),
      ignoredFileCount: -1,
    } as unknown as StoredPendingPwaOpenRequest;

    await expect(savePendingPwaOpenRequestToIndexedDB(invalidRequest)).resolves.toBe(false);
    expect(writeClientScopedFileHandleValueMock).not.toHaveBeenCalled();
  });
});
