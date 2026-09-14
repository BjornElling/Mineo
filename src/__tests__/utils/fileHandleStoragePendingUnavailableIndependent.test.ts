// @vitest-environment jsdom

const readClientScopedFileHandleValueResultMock = vi.hoisted(() => vi.fn());

vi.mock('../../utils/file/fileHandleKvStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/file/fileHandleKvStore')>();
  return {
    ...actual,
    readClientScopedFileHandleValueResult: (...args: unknown[]) =>
      readClientScopedFileHandleValueResultMock(...args),
  };
});

import {
  __resetFileOperationClientSessionForTests,
} from '../../utils/fileOperationClientSession';
import { loadPendingPwaOpenRequestFromIndexedDB } from '../../utils/fileHandleStorage';

describe('PERSIST-002 – pending PWA-load ved utilgængelig IndexedDB', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
    readClientScopedFileHandleValueResultMock.mockReset();
  });

  afterEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('bevarer unavailable i stedet for at gøre en utilgængelig database til ingen request', async () => {
    readClientScopedFileHandleValueResultMock.mockResolvedValue({ status: 'unavailable' });

    await expect(loadPendingPwaOpenRequestFromIndexedDB()).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
