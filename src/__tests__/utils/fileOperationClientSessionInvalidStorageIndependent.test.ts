// @vitest-environment jsdom
import { installFileOperationLocks } from '../fixtures/fileOperationLocks';

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  ensureFileOperationClientSession,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

let restoreLocks: () => void;

describe('fileOperationClientSession – ugyldig sessionStorage-identitet', () => {
  beforeEach(() => {
    restoreLocks = installFileOperationLocks();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    restoreLocks();
    vi.unstubAllGlobals();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('roterer en ugyldig gemt identitet og bevarer den nye efter reload', async () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const replacementId = 'client-recovered-session-1';
    const randomUUID = vi.fn(() => replacementId);

    sessionStorage.setItem(storageKey, 'for-kort');
    vi.stubGlobal('crypto', { randomUUID });

    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(`owned:${replacementId}`);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(storageKey)).toBe(`owned:${replacementId}`);

    __resetFileOperationClientSessionForTests();

    await ensureFileOperationClientSession();
    expect(getFileOperationClientSessionId()).toBe(`owned:${replacementId}`);
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
