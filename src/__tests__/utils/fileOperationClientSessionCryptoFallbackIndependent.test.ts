// @vitest-environment jsdom

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

describe('fileOperationClientSession – crypto-fallback', () => {
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

  it('danner og persisterer en klientidentitet uden crypto.randomUUID', () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const fixedTimestamp = 1_700_000_000_000;
    const expectedSessionId = 'client-loyw3v28-i';

    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    expect(getFileOperationClientSessionId()).toBe(expectedSessionId);
    expect(sessionStorage.getItem(storageKey)).toBe(expectedSessionId);

    __resetFileOperationClientSessionForTests();

    expect(getFileOperationClientSessionId()).toBe(expectedSessionId);
    expect(Date.now).toHaveBeenCalledOnce();
    expect(Math.random).toHaveBeenCalledOnce();
  });
});
