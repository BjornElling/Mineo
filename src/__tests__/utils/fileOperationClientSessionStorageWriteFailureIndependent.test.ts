// @vitest-environment jsdom

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

describe('fileOperationClientSession – storage-skrivefejl', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('bevarer en stabil in-memory-identitet når sessionStorage ikke kan skrives', () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const replacementId = 'client-write-failure-session-1';
    const randomUUID = vi.fn(() => replacementId);
    const storageProto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const setItemSpy = vi.spyOn(storageProto, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    vi.stubGlobal('crypto', { randomUUID });

    expect(getFileOperationClientSessionId()).toBe(replacementId);
    expect(setItemSpy).toHaveBeenCalledWith(storageKey, replacementId);
    expect(sessionStorage.getItem(storageKey)).toBeNull();
    expect(getFileOperationClientSessionId()).toBe(replacementId);
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
