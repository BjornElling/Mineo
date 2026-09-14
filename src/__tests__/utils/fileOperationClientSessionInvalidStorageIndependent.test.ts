// @vitest-environment jsdom

import { getFileOperationClientSessionStorageKey } from '../../config/storageManifest';
import {
  __resetFileOperationClientSessionForTests,
  getFileOperationClientSessionId,
} from '../../utils/fileOperationClientSession';

describe('fileOperationClientSession – ugyldig sessionStorage-identitet', () => {
  beforeEach(() => {
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    __resetFileOperationClientSessionForTests();
  });

  it('roterer en ugyldig gemt identitet og bevarer den nye efter reload', () => {
    const storageKey = getFileOperationClientSessionStorageKey();
    const replacementId = 'client-recovered-session-1';
    const randomUUID = vi.fn(() => replacementId);

    sessionStorage.setItem(storageKey, 'for-kort');
    vi.stubGlobal('crypto', { randomUUID });

    expect(getFileOperationClientSessionId()).toBe(replacementId);
    expect(randomUUID).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(storageKey)).toBe(replacementId);

    __resetFileOperationClientSessionForTests();

    expect(getFileOperationClientSessionId()).toBe(replacementId);
    expect(randomUUID).toHaveBeenCalledOnce();
  });
});
