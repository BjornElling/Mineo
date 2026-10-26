// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  ensureFileOperationClientSession,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

let restoreLocks: () => void;

describe('fileOperationClientSession – crypto-fallback', () => {
  beforeEach(() => {
    restoreLocks = installFileOperationLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    restoreLocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('danner og persisterer en klientidentitet uden crypto.randomUUID', async () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const fixedTimestamp = 1_700_000_000_000;
    const expectedSessionId = 'owned:client-loyw3v28-i';

    vi.stubGlobal('crypto', {});
    vi.spyOn(Date, 'now').mockReturnValue(fixedTimestamp);
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(expectedSessionId);
    expect(sessionStorage.getItem(storageKey)).toBe(expectedSessionId);

    __resetFileOperationClientSessionForTests();

    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(expectedSessionId);
    expect(Date.now).toHaveBeenCalledOnce();
    expect(Math.random).toHaveBeenCalledOnce();
  });
});
